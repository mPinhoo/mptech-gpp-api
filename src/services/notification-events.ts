import { EventEmitter } from 'node:events';
import { sendWebPush, type PushNotificacao } from './web-push.service.js';

export type NotificationEvent = { type: 'created'; id: string } | { type: 'sync' };

// In-process fan-out to each user's open notification streams. Every notification
// is created inside this API process (HTTP handlers and the minute job), so one
// instance needs no broker. Running several instances would require Postgres
// LISTEN/NOTIFY here instead.
const emitter = new EventEmitter();
emitter.setMaxListeners(0);

export function subscribeNotificationEvents(
  userId: string,
  listener: (event: NotificationEvent) => void
) {
  emitter.on(userId, listener);
  return () => {
    emitter.off(userId, listener);
  };
}

/** Open listeners for a user (observability and leak checks). */
export function subscriberCount(userId: string) {
  return emitter.listenerCount(userId);
}

export function emitNotificationEvent(userId: string, event: NotificationEvent) {
  emitter.emit(userId, event);
}

/** Announce a notification once, after the transaction that created it commits. */
export function publishNotificacao(notificacao: PushNotificacao) {
  emitNotificationEvent(notificacao.userId, { type: 'created', id: notificacao.id });
  void sendWebPush(notificacao).catch(() =>
    console.error('[Push] Não foi possível enviar a notificação push.')
  );
}
