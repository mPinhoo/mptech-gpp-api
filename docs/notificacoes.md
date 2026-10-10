# Notificações: central, tempo real e push

Como as notificações do Zentra chegam ao sino, à Central de Notificações e ao sistema operacional do usuário.

## Origem

As notificações nascem dentro do processo da API:

| Tipo | Quem cria |
|---|---|
| `PEDIDO_APROVADO` | Cliente aprova o pedido pelo link público (`pedidos.service`). |
| `AGENDA_LEMBRETE` | Job de minuto (`processarLembretesPendentes`). |
| `PEDIDO_PRAZO_ALERTA` | Job de minuto (`processarAlertasPrazoPedidos`), no máximo uma por pedido por dia. |

Depois que a transação grava a notificação, `publishNotificacao()` (`src/services/notification-events.ts`) avisa uma única vez:

1. os streams SSE abertos do dono (evento `created`, só com o id);
2. os aparelhos inscritos no Web Push do dono.

## Endpoints

Todos exigem login e são filtrados pelo usuário autenticado (cada conta é um tenant). Ids de outra conta respondem 404.

| Método | Rota | O que faz |
|---|---|---|
| GET | `/api/notificacoes` | Últimas 50 não removidas (lidas e não lidas) + `meta.naoLidas`. |
| GET | `/api/notificacoes/contagem` | Total de não lidas. |
| PATCH | `/api/notificacoes/:id/lida` | Marca uma como lida. |
| PATCH | `/api/notificacoes/lidas` | Marca todas como lidas (um `UPDATE`). |
| DELETE | `/api/notificacoes/:id` | Remove uma. |
| DELETE | `/api/notificacoes` | Remove todas (um `UPDATE`). |
| GET | `/api/notificacoes/stream` | Server-Sent Events: `created` e `sync`. |
| GET | `/api/push/chave` | Chave pública VAPID (ou `null`). |
| POST/DELETE | `/api/push/inscricoes` | Inscreve/remove o aparelho no Web Push. |

**Remover = arquivar** (`Notificacao.arquivadaEm`). A linha continua no banco porque os jobs consultam notificações existentes para não recriar o mesmo alerta; apagar faria o alerta de prazo voltar no minuto seguinte.

Ações individuais e em lote emitem `sync` para as outras abas e aparelhos do mesmo usuário.

## Tempo real (SSE)

- Uma conexão por aba, aberta com `fetch` (o `EventSource` não envia o header `Authorization`).
- Heartbeat a cada 25 s, no máximo 5 streams por usuário (o mais antigo é fechado) e duração máxima de 55 min para revalidar o token. Listeners são removidos quando a conexão fecha.
- O frontend reconecta com backoff (1 s a 30 s) e, ao reconectar, atualiza a lista. O polling de 30 s só roda enquanto o stream está fora.
- **Limitação:** o fan-out é em memória. Funciona com uma instância da API (o caso do Render hoje). Com mais de uma instância, troque `notification-events.ts` por `LISTEN/NOTIFY` do Postgres.

## Notificações nativas e Web Push

- O frontend nunca chama `Notification.requestPermission()` sozinho: um modal do Zentra convida, e o pedido do navegador só acontece no clique em "Ativar notificações". "Agora não" adia o convite por 7 dias; permissão negada encerra o convite e o modal passa a mostrar como liberar nas configurações.
- Com permissão e chave VAPID, o aparelho se inscreve no Web Push e o Service Worker (`public/sw.js`) mostra os avisos, inclusive com o Zentra fechado. Sem Web Push, a própria página mostra o aviso quando o stream entrega uma notificação nova.
- **Sem duplicatas:** a página não mostra avisos quando o aparelho tem Web Push; os dois caminhos usam a mesma `tag` (`zentra-notificacao-<id>`), então o sistema substitui em vez de repetir; só notificações criadas nos últimos 5 minutos geram aviso (histórico e reconexões não).
- Ao sair, a inscrição do aparelho é removida. Inscrições expiradas (404/410) são apagadas no envio. O cadastro só aceita endpoints dos serviços de push dos navegadores (Google, Mozilla, Apple, Microsoft), o que impede usar a API para chamar outras URLs.

Configuração (API): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` (`mailto:` ou `https://`). Gere o par uma vez com `npx web-push generate-vapid-keys`; trocar as chaves invalida as inscrições existentes (os aparelhos se reinscrevem no próximo acesso). Sem essas variáveis, o push fica desligado e o restante continua funcionando.

## Compatibilidade

| Plataforma | Site aberto | Site fechado |
|---|---|---|
| Chrome, Edge, Firefox, Opera (computador) | Aviso nativo | Web Push (o navegador precisa estar aberto em segundo plano) |
| Safari 16+ (Mac) | Aviso nativo | Web Push |
| Android (Chrome, Edge, Samsung Internet, Firefox) | Aviso nativo via Service Worker | Web Push |
| iPhone/iPad em aba do Safari | Só no sino (a Apple não libera notificações) | Não disponível |
| iPhone/iPad com o Zentra na Tela de Início (iOS 16.4+) | Aviso nativo | Web Push |

O modal explica como adicionar à Tela de Início quando detecta iPhone/iPad fora do app instalado.

**Render no plano gratuito** dorme após 15 min sem requisições: enquanto dormir, os jobs não rodam e nada é criado ou enviado. Ver `docs/billing.md`.
