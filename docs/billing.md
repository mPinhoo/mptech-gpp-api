# Assinaturas e checkout (Asaas + Brevo)

Como o Zentra vende os planos Básico, Pro e Business: do checkout hospedado no Asaas até a conta ativada e a renovação mensal. Este documento é a referência de operação e o roteiro para passar do Sandbox para produção.

## Fluxo

```
Visitante            Frontend (Vercel)          API (Render)                     Asaas              Brevo
   │  /comecar?plano=x     │                          │                              │                   │
   │──────────────────────▶│ POST /billing/checkouts  │                              │                   │
   │                       │─────────────────────────▶│ reserva CheckoutAttempt      │                   │
   │                       │                          │ POST /v3/checkouts ─────────▶│                   │
   │                       │◀──── link do Asaas ──────│ grava gatewayId + link       │                   │
   │◀──── redireciona ─────│                          │                              │                   │
   │──────────── paga com cartão na página do Asaas ────────────────────────────────▶│                   │
   │                       │                          │◀──── webhook CHECKOUT_PAID ──│                   │
   │                       │                          │ consulta /payments?checkoutSession (verdade)     │
   │                       │                          │ cria User + Empresa + Subscription (1 transação) │
   │                       │                          │ enfileira convite (outbox) ─────────────────────▶│ email
   │◀── /checkout/retorno (consulta status, nunca libera acesso) ──│                   │
   │──── /ativar#token ───▶│ POST /billing/activate   │ senha + sessão               │                   │
   │◀──── /home ───────────│                          │                              │                   │
```

Regras que sustentam o fluxo:

- **O redirecionamento de sucesso nunca libera acesso.** Só a conciliação no servidor, que lê pagamentos e assinatura direto da API do Asaas filtrando pelo ID do checkout, provisiona a conta. O corpo do webhook é tratado só como um aviso de que algo mudou.
- **Preço só no backend.** O valor vem de `src/billing/plans.json` e é gravado na tentativa; a conciliação confere valor, ciclo, forma de pagamento, cliente e `checkoutSession` antes de qualquer provisionamento.
- **Idempotência em todas as pontas:** `requestId` por tentativa (o navegador reaproveita para os mesmos dados), webhook por `id` do evento (`INSERT … ON CONFLICT DO NOTHING`), provisionamento sob lock por checkout e por email, emails por `dedupeKey`.

## Decisões

| Tema | Decisão | Motivo |
|---|---|---|
| Autenticação | Mantido o JWT próprio do Zentra (bcrypt + `User`). | Já funciona; migrar para Supabase Auth não traria ganho e exigiria migrar todas as contas. |
| Checkout | Checkout hospedado do Asaas, `RECURRENT`, apenas `CREDIT_CARD`. | Cartão nunca passa pelo Zentra. A documentação do Asaas só mostra cartão para checkout recorrente. |
| Pix | Fora da primeira versão. | No checkout recorrente o Pix não é cobrado automaticamente (o cliente pagaria cada fatura manualmente). O Pix Automático existe, mas é outra API (autorizações + QR Code, `paymentCreationMode: SUBSCRIPTION` desde 05/2026) e exige tela própria no Zentra. Ver "Próximos passos". |
| Primeiro acesso | Convite com token aleatório de 256 bits, guardado só como hash, uso único, 48 h. Ativar já inicia a sessão. | Nada de senha provisória por email. |
| Email digitado no Asaas | Se o pagador digitar outro email na página do Asaas, a compra segue e um registro de auditoria é criado; a conta usa o email informado ao Zentra. | O vínculo é garantido pelo `checkoutSession`, consultado no servidor. O Asaas só aceita pré-preencher dados com CPF, telefone e endereço completos, que o Zentra não coleta. |
| Checkout abandonado | Nova tentativa com o mesmo email cancela a anterior no Asaas (`POST /checkouts/{id}/cancel`) e cria outra. Se a anterior já foi paga, a nova é recusada. | Permite trocar de plano ou de aparelho sem esperar 60 min. |
| Cancelamento | Encerra a recorrência na hora; o acesso continua até o fim do período já pago. | O cliente pagou pelo mês. Estorno e chargeback continuam cortando o acesso imediatamente. |
| Inadimplência | `BILLING_GRACE_DAYS` (padrão 3) de tolerância após o vencimento, com status `past_due`; depois, `suspended`. | Configurável por ambiente. |
| Tenant | Uma `Empresa` por usuário dono, preservando o isolamento atual por `userId`. | Não há times ainda; nenhum dado existente foi movido. |

## Estados da assinatura

Derivados em `src/billing/state.ts` a partir do histórico completo de cobranças do Asaas, nunca da ordem dos eventos. Por isso webhooks atrasados, duplicados ou fora de ordem não mudam o resultado.

| Estado | Quando | Acesso |
|---|---|---|
| `pending` | Assinatura criada, nenhum pagamento confirmado. | Não |
| `active` | Última mensalidade paga cobre hoje. | Sim |
| `past_due` | Período pago terminou, dentro da tolerância. | Sim, até `paidUntil + BILLING_GRACE_DAYS` |
| `suspended` | Tolerância esgotada, estorno no período vigente ou qualquer chargeback. | Não |
| `canceled` | Cancelada pelo cliente ou removida/inativada no Asaas. | Até `paidUntil` (sem tolerância); zero se estornada |
| `expired` | Assinatura `EXPIRED` no Asaas. | Até `paidUntil` |

Pagamentos que contam como pagos: `CONFIRMED`, `RECEIVED`, `RECEIVED_IN_CASH`. O Asaas gera a cobrança do mês seguinte até 40 dias antes; o estorno é avaliado na cobrança do período vigente, não na futura.

O acesso é aplicado no backend por `billingAccess` (todas as rotas protegidas; responde `402 SUBSCRIPTION_REQUIRED`) e por `withQuota` (limites de clientes, produtos e pedidos/mês do plano, com lock por tenant; responde `403 PLAN_LIMIT`). Assinantes recebem o grupo "Assinante Zentra", sem a administração global. O painel `/assinatura` continua acessível sem assinatura ativa, para o cliente regularizar.

## Banco de dados

Migrations: `prisma/migrations/20261009000000_add_billing` e `20261009150000_billing_checkout_link`. Todas aditivas; nenhuma tabela existente é alterada além da coluna `User.billingManaged` (padrão `false`, então contas atuais não são afetadas).

| Tabela | Conteúdo |
|---|---|
| `BillingPlan` | Catálogo (sincronizado com `plans.json` ao iniciar a API quando `BILLING_ENABLED=true`). |
| `CheckoutAttempt` | Tentativa: plano, preço congelado, dados do futuro assinante, IDs e link do Asaas, próxima conciliação. |
| `Empresa` | Empresa do dono (1:1 com `User`). |
| `Subscription` | Estado, `paidUntil`, próximo vencimento, pedido de cancelamento. |
| `BillingPayment` | Espelho das cobranças (valor, status, vencimento, link da fatura em aberto). |
| `BillingWebhook` | Fila de eventos recebidos (só IDs, nunca o payload). |
| `ActivationInvite` | Hash do token, expiração, uso. |
| `BillingOutbox` | Emails pendentes com conteúdo cifrado (AES-256-GCM); apagado após envio. |
| `BillingAudit` | Ativações, mudanças de estado, divergências financeiras. |

Proteções no próprio banco: `CHECK` de status e de preço positivo, índice único parcial "uma assinatura não cancelada por empresa" e "uma tentativa aberta por email", FKs com `RESTRICT`. RLS está ligado em todas as tabelas de billing sem nenhuma policy: pela API REST do Supabase (`anon`/`authenticated`) elas ficam inacessíveis; a API do Zentra conecta como dono das tabelas e não é afetada. O Prisma ignora os índices parciais e os `CHECK`, então um `prisma migrate dev` futuro não os remove (verificado com `prisma migrate diff`).

## Variáveis de ambiente

API (Render). Nunca no frontend.

| Variável | Valor |
|---|---|
| `BILLING_ENABLED` | `true` liga a venda online e desliga o `/auth/register` gratuito. |
| `ASAAS_ENV` | `sandbox` (padrão) ou `production`. |
| `BILLING_LIVE_APPROVED` | `true` é a chave humana de go-live; sem ela, `production` não funciona. |
| `ASAAS_API_KEY` | `$aact_hmlg_…` (Sandbox) ou `$aact_prod_…` (produção). A API recusa chave do ambiente errado. No `.env`, use aspas simples por causa do `$`. |
| `ASAAS_WEBHOOK_TOKEN` | Mesmo valor cadastrado no webhook do Asaas. `openssl rand -hex 48` |
| `BILLING_STATUS_SECRET` | Assina os links de status do checkout. `openssl rand -hex 48` |
| `BILLING_ENCRYPTION_KEY` | Cifra a fila de emails. `openssl rand -hex 32` (64 hex) |
| `BILLING_APP_URL` | URL HTTPS pública do frontend. O Asaas recusa `http` e `localhost`. |
| `BILLING_GRACE_DAYS` | Tolerância de inadimplência (padrão 3, máx. 30). |
| `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` | Envio transacional. O remetente precisa estar verificado no Brevo. |
| `BILLING_TEST_EMAIL` | Só no Sandbox: único destinatário permitido. Os demais emails são descartados (`SANDBOX_RECIPIENT_BLOCKED`). |
| `TRUST_PROXY_HOPS` | `1` no Render. Sem isso o rate limit enxerga o IP do proxy e todos os visitantes dividem o mesmo limite. |
| `ASAAS_WEBHOOK_URL`, `ASAAS_WEBHOOK_EMAIL` | Usadas por `npm run billing:webhook` para cadastrar o webhook. |

Frontend (Vercel): `NEXT_PUBLIC_BILLING_ENABLED=true` troca o formulário de contato do `/comecar` pelo checkout online. Os demais `NEXT_PUBLIC_*` estão em `.env.example` do frontend.

## Operação

- **Worker** (`src/billing/worker.ts`, a cada 30 s no processo da API): processa webhooks, retenta cancelamentos pendentes, concilia tentativas e envia emails. O webhook também dispara o worker na hora.
- **Conciliação periódica** (rede de segurança para webhooks perdidos): a cada 2 min enquanto o checkout está aberto; 15 min em `pending`/`past_due`; 6 h para assinaturas em dia; diária para suspensas e por 7 dias após o fim de uma cancelada; depois para. Tentativas abandonadas param de consultar o Asaas.
- **Divergência financeira** (`BILLING_MISMATCH`): a assinatura vai para `suspended`, nada é provisionado, e o caso aparece em `npm run billing:status`. A conciliação volta a tentar a cada 6 h; resolva no painel do Asaas e ela se normaliza sozinha.
- **Eventos de vendas fora do Zentra** (conta Asaas compartilhada) ficam como `ignored`, sem retry.
- **Emails**: até 10 tentativas com backoff exponencial (30 s a 1 h). Convites vencidos ou substituídos são descartados antes de chamar o Brevo. `lastError` guarda o status HTTP do Brevo (`BREVO_HTTP_401`, `BREVO_HTTP_400` etc.).

Scripts:

```bash
npm run billing:check     # valida a chave e lista os webhooks (somente leitura)
npm run billing:webhook   # cadastra o webhook (exige ASAAS_WEBHOOK_URL https)
npm run billing:status    # filas de webhook/email e checkouts em revisão
npm run test:billing      # integração com Postgres local (scripts/prepare-billing-test.sh cria o schema)
```

> **Render no plano gratuito dorme após 15 min sem requisições.** Webhooks acordam o serviço (cold start de 30 a 60 s; o Asaas reenvia), mas a conciliação periódica e o envio de emails param enquanto ele dorme. Para produção, use uma instância paga (Starter) ou um ping externo gratuito ao `/api/health` a cada 10 min.

## Testes

`tests/billing/security.test.ts` (unitário) e `tests/billing/integration.test.ts` (HTTP real + PostgreSQL real, Asaas simulado). Cenários cobertos, entre outros:

compra aprovada com ativação de uso único e primeiro login · compra recusada · checkout abandonado · webhook duplicado e concorrente · webhook fora de ordem e `SUBSCRIPTION_CREATED` antes de `CHECKOUT_PAID` · falha ao criar usuário e ao criar assinatura (rollback total) · falha do Brevo com retry · reenvio de ativação sem enumeração de email · token expirado · email já cadastrado · renovação · inadimplência além da tolerância · cancelamento (acesso até o fim do período) · estorno e chargeback · limite do plano e tentativa de upgrade sem pagar · acesso a dados de outra empresa · Asaas fora do ar · valor/assinatura divergentes · adulteração de preço · checkout substituído e checkout já pago · webhook com token inválido e payload inesperado · Sandbox enviando só para o email de teste.

## Custos

| Serviço | Custo fixo | Variável / limites |
|---|---|---|
| Asaas | R$ 0 (sem mensalidade) | Cartão: R$ 0,49 + 2,99% por cobrança recebida (1,99% nos 3 primeiros meses). Recebimento em ~32 dias; antecipação 1,25% a.m. **Notificações do Asaas (email/SMS): R$ 0,99 por cobrança paga**; o Zentra já envia os emails pelo Brevo, então avalie desligá-las no painel do Asaas. |
| Brevo | R$ 0 (Free) | 300 emails/dia, somando marketing e transacional. |
| Supabase | R$ 0 (Free) | 500 MB; projetos inativos por 7 dias são pausados. |
| Render | R$ 0 (Free) | Dorme após 15 min (ver acima). Starter: US$ 7/mês. |
| Vercel | R$ 0 (Hobby) | **O Hobby é restrito a uso não comercial** pelos termos da Vercel; vender assinaturas exige o Pro (US$ 20/mês por membro). Decisão sua antes do go-live. |

Exemplo, plano Básico (R$ 39,90) após a promoção: R$ 0,49 + R$ 1,19 = **R$ 1,68 por mês** por assinante (R$ 2,67 com as notificações do Asaas ligadas).

## Do Sandbox para produção

Pré-requisitos (dependem de você):

1. Conta Asaas de produção aprovada (documentos e conta bancária), com o **site comercial** preenchido em Minha Conta → Informações. Na produção, o domínio do `BILLING_APP_URL` deve ser o mesmo dos dados comerciais.
2. Chave de API de produção (`$aact_prod_…`), gerada em Integrações.
3. Brevo: domínio do Zentra autenticado (registros SPF, DKIM e DMARC que o Brevo mostra em Senders & Domains, adicionados no DNS **sem remover os registros existentes**) e remetente verificado.
4. Decisão sobre Vercel Hobby × Pro e Render Free × Starter.

Checklist de go-live:

- [ ] Backup do banco de produção (Supabase → Database → Backups).
- [ ] Deploy da API. O `build` do Render roda `prisma migrate deploy`, que aplica as duas migrations de billing (aditivas).
- [ ] Variáveis no Render: `BILLING_ENABLED=true`, `ASAAS_ENV=production`, `BILLING_LIVE_APPROVED=true`, `ASAAS_API_KEY`, segredos novos (não reutilize os do Sandbox), `BILLING_APP_URL`, `BREVO_*`, `TRUST_PROXY_HOPS=1`. Não defina `BILLING_TEST_EMAIL`.
- [ ] `npm run billing:check` com as variáveis de produção, depois `npm run billing:webhook` com `ASAAS_WEBHOOK_URL=https://<api>/api/billing/webhooks/asaas`.
- [ ] Na Vercel: `NEXT_PUBLIC_BILLING_ENABLED=true` e novo deploy.
- [ ] Compra real de R$ 39,90 com cartão próprio, ativação, login, cancelamento e estorno pelo painel do Asaas. Conferir `npm run billing:status`.
- [ ] Contas que já existiam continuam funcionando (`billingManaged=false` não passa por cobrança). Para migrá-las, o usuário entra e contrata pelo `/comecar`.

Rollback:

1. `NEXT_PUBLIC_BILLING_ENABLED=false` na Vercel: o `/comecar` volta ao contato com a equipe.
2. `BILLING_ENABLED=false` no Render: novos checkouts param, o worker para e o `/auth/register` volta. Assinantes existentes **continuam** sujeitos à verificação de assinatura com os dados já gravados e, sem conciliação, perdem o acesso quando o período pago terminar. Para liberá-los, marque `billingManaged=false` nas contas afetadas.
3. Webhook: desative no painel do Asaas (os eventos ficam retidos por até 14 dias e são reenviados quando reativado).
4. As migrations são aditivas e não precisam ser revertidas. Se for necessário, remova as tabelas de billing e a coluna `User.billingManaged` em uma migration nova, depois de exportar os dados financeiros.

## Próximos passos

- **Pix Automático**: autorização + QR Code na própria tela do Zentra, pela [API de autorizações do Pix Automático](https://docs.asaas.com/reference/criar-uma-autorizacao-pix-automatico) com `paymentCreationMode: SUBSCRIPTION`. Reaproveita conciliação, estados e emails; muda só a criação e o vínculo.
- **Upgrade/downgrade**: `PUT /v3/subscriptions/{id}` com novo valor e `updatePendingPayments`, mais troca de `planId` na conciliação.
- **Painel administrativo** das revisões financeiras (hoje via `billing:status`).
- **Rate limit distribuído** (Redis ou borda) se a API rodar em mais de uma instância.
