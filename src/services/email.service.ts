import nodemailer from 'nodemailer';

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('Configuração de e-mail incompleta');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function getFromAddress() {
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  if (!from) {
    throw new Error('Configuração de e-mail incompleta');
  }
  return from;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string, nome: string) {
  const transporter = getTransporter();

  await transporter.sendMail({
    from: `"Zentra" <${getFromAddress()}>`,
    to,
    subject: 'Redefinição de senha — Zentra',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111;">
        <h2 style="color: #1a3a8f;">Olá, ${nome}!</h2>
        <p>Recebemos uma solicitação para redefinir a senha da sua conta Zentra.</p>
        <p>Clique no botão abaixo para criar uma nova senha. O link expira em 1 hora.</p>
        <p style="margin: 28px 0;">
          <a href="${resetUrl}" style="background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Redefinir senha
          </a>
        </p>
        <p style="font-size: 13px; color: #666;">Se você não solicitou esta alteração, ignore este e-mail.</p>
        <p style="font-size: 12px; color: #999; word-break: break-all;">${resetUrl}</p>
      </div>
    `,
  });
}

export async function sendSupportContactEmail(params: {
  nome: string;
  telefone: string;
  descricao: string;
}) {
  const transporter = getTransporter();
  const supportEmail = process.env.SUPPORT_EMAIL;

  if (!supportEmail) {
    throw new Error('Configuração de e-mail incompleta');
  }

  await transporter.sendMail({
    from: `"Zentra Suporte" <${getFromAddress()}>`,
    to: supportEmail,
    subject: `[Zentra] Novo contato de suporte — ${params.nome}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111;">
        <h2 style="color: #1a3a8f;">Novo contato via Zentra</h2>
        <p><strong>Nome:</strong> ${params.nome}</p>
        <p><strong>Telefone:</strong> ${params.telefone}</p>
        <p><strong>Descrição:</strong></p>
        <p style="white-space: pre-wrap; background: #f4f4f5; padding: 12px; border-radius: 8px;">${params.descricao}</p>
      </div>
    `,
  });
}
