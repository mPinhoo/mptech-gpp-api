import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma.js';
import { decrypt, encrypt, hash } from './security.js';
import { billingConfig, graceDays } from './config.js';

export type MailKind =
  | 'activation'
  | 'resend'
  | 'payment'
  | 'renewal'
  | 'declined'
  | 'past_due'
  | 'suspended'
  | 'canceled';
type MailData = {
  nome: string;
  planName?: string;
  email?: string;
  activationUrl?: string;
  paidUntil?: string;
  /** App path for the call to action, e.g. /comecar?plano=pro */
  actionPath?: string;
};
export async function enqueueMail(
  tx: Prisma.TransactionClient,
  dedupeKey: string,
  recipient: string,
  kind: MailKind,
  data: MailData,
  options: { suppress?: boolean } = {},
) {
  // A suppressed row still consumes the dedupe key, so the message never goes
  // out later under another kind.
  await tx.billingOutbox.createMany({
    data: [
      options.suppress
        ? { dedupeKey, recipient, kind, encryptedData: '', status: 'skipped' }
        : { dedupeKey, recipient, kind, encryptedData: encrypt(data) },
    ],
    skipDuplicates: true,
  });
}
export async function createInvite(
  tx: Prisma.TransactionClient,
  user: { id: string; nome: string; email: string },
  planName: string,
  kind: 'activation' | 'resend',
) {
  const token = randomBytes(32).toString('hex');
  await tx.activationInvite.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  const invite = await tx.activationInvite.create({
    data: {
      userId: user.id,
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + 48 * 3600000),
    },
  });
  await enqueueMail(tx, `activation:${invite.id}`, user.email, kind, {
    nome: user.nome,
    email: user.email,
    planName,
    activationUrl: `${billingConfig().appUrl}/ativar#token=${token}`,
  });
}

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
const day = (iso?: string) =>
  iso
    ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(
        new Date(iso),
      )
    : 'o fim do período pago';

type Template = {
  subject: string;
  heading: string;
  paragraphs: string[];
  steps?: string[];
  button: string;
  path: string;
  footnote?: string;
};
function template(kind: MailKind, d: MailData): Template {
  const plan = d.planName || 'Zentra';
  const invite = {
    button: 'Definir minha senha',
    path: d.activationUrl || '/ativar',
    steps: [
      'Clique no botão abaixo e crie uma senha pessoal (mínimo de 12 caracteres).',
      `Entre no Zentra com o email ${d.email || 'em que recebeu esta mensagem'} e a senha criada.`,
      'Cadastre seus primeiros clientes e produtos para começar a lançar pedidos.',
    ],
    footnote:
      'Este link é pessoal, vale por 48 horas e pode ser usado uma única vez. Se expirar, solicite um novo na página de ativação. O Zentra nunca envia senhas por email.',
  };
  switch (kind) {
    case 'activation':
      return {
        subject: 'Pagamento confirmado — ative sua conta Zentra',
        heading: 'Bem-vindo ao Zentra!',
        paragraphs: [
          `Confirmamos o pagamento da sua assinatura do plano ${plan}. Sua conta já está pronta.`,
          `Seu email de acesso é <strong>${escape(d.email || '')}</strong>. Para entrar, defina sua senha:`,
        ],
        ...invite,
      };
    case 'resend':
      return {
        subject: 'Seu novo link de ativação do Zentra',
        heading: 'Novo link de ativação',
        paragraphs: [
          `Você pediu um novo link para ativar sua conta do plano ${plan}. Os links enviados antes deixaram de funcionar.`,
          `Seu email de acesso é <strong>${escape(d.email || '')}</strong>.`,
        ],
        ...invite,
      };
    case 'payment':
      return {
        subject: 'Pagamento confirmado — Zentra',
        heading: 'Pagamento confirmado',
        paragraphs: [
          `Recebemos o pagamento da sua assinatura do plano ${plan}. Os recursos do plano já estão liberados na sua conta.`,
          'A renovação é mensal e automática no cartão cadastrado. Você pode acompanhar ou cancelar a assinatura a qualquer momento no painel.',
        ],
        button: 'Ver minha assinatura',
        path: '/assinatura',
      };
    case 'renewal':
      return {
        subject: 'Renovação confirmada — Zentra',
        heading: 'Renovação confirmada',
        paragraphs: [
          `A mensalidade do plano ${plan} foi paga e seu acesso continua liberado. Obrigado por seguir com o Zentra.`,
        ],
        button: 'Ver histórico de cobranças',
        path: '/assinatura',
      };
    case 'declined':
      return {
        subject: 'Pagamento não aprovado — Zentra',
        heading: 'Pagamento não aprovado',
        paragraphs: [
          `O pagamento do plano ${plan} não foi aprovado pela operadora do cartão. Nenhum valor foi cobrado nesta tentativa.`,
          'Confira os dados do cartão ou tente com outro cartão.',
        ],
        button: 'Tentar novamente',
        path: d.actionPath || '/assinatura',
      };
    case 'past_due':
      return {
        subject: 'Pagamento pendente — Zentra',
        heading: 'Não conseguimos confirmar sua mensalidade',
        paragraphs: [
          `A cobrança do plano ${plan} está em aberto. Seu acesso continua liberado por até ${graceDays()} dias após o vencimento.`,
          'Regularize o pagamento no painel da assinatura para evitar a suspensão.',
        ],
        button: 'Regularizar pagamento',
        path: '/assinatura',
      };
    case 'suspended':
      return {
        subject: 'Assinatura suspensa — Zentra',
        heading: 'Sua assinatura foi suspensa',
        paragraphs: [
          `O acesso ao plano ${plan} foi suspenso porque o pagamento não foi confirmado ou foi estornado. Seus dados continuam guardados.`,
          'Regularize a cobrança no painel da assinatura para voltar a usar o Zentra.',
        ],
        button: 'Ver assinatura',
        path: '/assinatura',
      };
    case 'canceled':
      return {
        subject: 'Assinatura cancelada — Zentra',
        heading: 'Assinatura cancelada',
        paragraphs: [
          `A renovação do plano ${plan} foi encerrada e nenhuma nova cobrança será feita.`,
          `Você continua com acesso até ${day(d.paidUntil)}. Para voltar, basta contratar um plano novamente.`,
        ],
        button: 'Ver assinatura',
        path: '/assinatura',
      };
  }
}
export function mailContent(kind: MailKind, data: MailData) {
  const t = template(kind, data);
  const url = /^https:\/\//.test(t.path)
    ? t.path
    : `${billingConfig().appUrl}${t.path}`;
  const strip = (html: string) => html.replace(/<[^>]+>/g, '');
  const p = (html: string) =>
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#344054">${html}</p>`;
  const steps = t.steps
    ? `<ol style="margin:0 0 24px;padding-left:20px;font-size:15px;line-height:1.6;color:#344054">${t.steps
        .map((s) => `<li style="margin-bottom:6px">${escape(s)}</li>`)
        .join('')}</ol>`
    : '';
  const htmlContent = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(t.subject)}</title></head>
<body style="margin:0;padding:0;background:#f2f4f7;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f7"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px">
<tr><td style="padding:28px 32px 0;font-size:20px;font-weight:bold;letter-spacing:1px;color:#1745c2">ZENTRA</td></tr>
<tr><td style="padding:16px 32px 32px">
<h1 style="margin:0 0 20px;font-size:24px;line-height:1.3;color:#101828">${escape(t.heading)}</h1>
${p(`Olá, ${escape(data.nome)}.`)}
${t.paragraphs.map(p).join('\n')}
${steps}
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:#1745c2">
<a href="${escape(url)}" style="display:inline-block;padding:14px 24px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none">${escape(t.button)}</a>
</td></tr></table>
<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#667085">Se o botão não funcionar, copie e cole este endereço no navegador:<br><span style="word-break:break-all">${escape(url)}</span></p>
${t.footnote ? `<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#667085">${escape(t.footnote)}</p>` : ''}
</td></tr></table>
<p style="margin:16px 0 0;font-size:12px;color:#98a2b3">Zentra · gestão de pedidos, clientes e produção</p>
</td></tr></table></body></html>`;
  const textContent = [
    `Olá, ${data.nome}.`,
    '',
    t.heading,
    ...t.paragraphs.map(strip),
    ...(t.steps ? ['', ...t.steps.map((s, i) => `${i + 1}. ${s}`)] : []),
    '',
    `${t.button}: ${url}`,
    ...(t.footnote ? ['', t.footnote] : []),
  ].join('\n');
  return { subject: t.subject, htmlContent, textContent };
}

export async function deliverOutbox() {
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) return;
  const config = billingConfig();
  const candidates = await prisma.billingOutbox.findMany({
    where: {
      status: { in: ['pending', 'sending'] },
      availableAt: { lte: new Date() },
    },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });
  for (const mail of candidates) {
    const claim = await prisma.billingOutbox.updateMany({
      where: {
        id: mail.id,
        status: mail.status,
        availableAt: mail.availableAt,
      },
      data: {
        status: 'sending',
        availableAt: new Date(Date.now() + 120000),
        attempts: { increment: 1 },
      },
    });
    if (!claim.count) continue;
    const discard = (lastError: string) =>
      prisma.billingOutbox.update({
        where: { id: mail.id },
        data: { status: 'canceled', encryptedData: '', lastError },
      });
    let lastError = 'MAIL_DELIVERY_FAILED';
    try {
      const data = decrypt<MailData>(mail.encryptedData);
      if (data.activationUrl) {
        const token =
          new URLSearchParams(new URL(data.activationUrl).hash.slice(1)).get(
            'token',
          ) || '';
        const valid = await prisma.activationInvite.findFirst({
          where: {
            tokenHash: hash(token),
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
        });
        if (!valid) {
          await discard('INVITE_EXPIRED_OR_REPLACED');
          continue;
        }
      }
      // Sandbox delivers only to the explicitly configured test recipient.
      if (
        config.environment === 'sandbox' &&
        mail.recipient.toLowerCase() !==
          process.env.BILLING_TEST_EMAIL?.trim().toLowerCase()
      ) {
        await discard('SANDBOX_RECIPIENT_BLOCKED');
        continue;
      }
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sender: {
            email: process.env.BREVO_SENDER_EMAIL,
            name: process.env.BREVO_SENDER_NAME || 'Zentra',
          },
          to: [{ email: mail.recipient }],
          ...mailContent(mail.kind as MailKind, data),
          tags: ['billing', mail.kind],
          headers: { idempotencyKey: mail.id },
        }),
        signal: AbortSignal.timeout(15000),
        redirect: 'error',
      });
      if (!response.ok) {
        lastError = `BREVO_HTTP_${response.status}`;
        throw new Error(lastError);
      }
      const result = (await response.json()) as { messageId?: string };
      await prisma.billingOutbox.update({
        where: { id: mail.id },
        data: {
          status: 'sent',
          sentAt: new Date(),
          messageId: result.messageId,
          encryptedData: '',
          lastError: null,
        },
      });
    } catch {
      await prisma.billingOutbox.update({
        where: { id: mail.id },
        data: {
          status: mail.attempts >= 9 ? 'failed' : 'pending',
          lastError,
          availableAt: new Date(
            Date.now() + Math.min(3600000, 30000 * 2 ** mail.attempts),
          ),
        },
      });
    }
  }
}
