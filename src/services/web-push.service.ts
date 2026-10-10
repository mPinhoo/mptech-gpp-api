import webpush from 'web-push';
import prisma from '../utils/prisma.js';

export interface PushNotificacao {
  id: string;
  userId: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  pedidoId: string | null;
  lembreteId: string | null;
}

// Only the browsers' own push services may receive our requests; any other
// endpoint would turn subscription registration into a server-side request forgery.
const PUSH_HOSTS = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'];
const PUSH_HOST_SUFFIXES = ['.notify.windows.com', '.push.apple.com'];

export function isPushServiceEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      (url.port === '' || url.port === '443') &&
      (PUSH_HOSTS.includes(url.hostname) ||
        PUSH_HOST_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix)))
    );
  } catch {
    return false;
  }
}

function vapidDetails() {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !/^(mailto:|https:\/\/)/.test(VAPID_SUBJECT || ''))
    return null;
  return { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY, subject: VAPID_SUBJECT! };
}

/** Public VAPID key for the browser, or null while Web Push is not configured. */
export function pushPublicKey(): string | null {
  return vapidDetails()?.publicKey ?? null;
}

/** App route opened when the notification is clicked. */
export function notificacaoPath(n: Pick<PushNotificacao, 'tipo' | 'pedidoId' | 'lembreteId'>) {
  if (n.tipo === 'PEDIDO_PRAZO_ALERTA') return '/area-trabalho';
  if (n.pedidoId) return `/pedidos/${n.pedidoId}`;
  if (n.lembreteId) return '/agenda';
  return '/home#notificacoes';
}

export async function sendWebPush(n: PushNotificacao) {
  const vapid = vapidDetails();
  if (!vapid) return;
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId: n.userId } });
  if (!subscriptions.length) return;
  // The payload is end-to-end encrypted for the device; it carries only what the
  // in-app notification already shows. The tag lets the device collapse repeats.
  const payload = JSON.stringify({
    id: n.id,
    title: n.titulo.slice(0, 120),
    body: n.mensagem.slice(0, 240),
    url: notificacaoPath(n),
    tag: `zentra-notificacao-${n.id}`,
  });
  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
          { vapidDetails: vapid, TTL: 3600, urgency: 'normal', timeout: 10000 }
        );
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // The browser expired or revoked this subscription.
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.deleteMany({ where: { id: subscription.id } });
        }
      }
    })
  );
}
