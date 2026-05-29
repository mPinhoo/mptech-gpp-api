const INTERVAL_MS = 60_000;

export function startLembretesJob() {
  async function run() {
    try {
      const { processarLembretesPendentes } = await import('../services/agenda.service.js');
      const processed = await processarLembretesPendentes();
      if (processed > 0) {
        console.log(`[Agenda] ${processed} lembrete(s) notificado(s)`);
      }
    } catch (error) {
      console.error('[Agenda] Erro ao processar lembretes:', error);
    }
  }

  run();
  return setInterval(run, INTERVAL_MS);
}
