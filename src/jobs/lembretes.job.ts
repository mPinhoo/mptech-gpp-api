const INTERVAL_MS = 60_000;

export function startLembretesJob() {
  async function run() {
    try {
      const { processarLembretesPendentes } = await import('../services/agenda.service.js');
      const lembretes = await processarLembretesPendentes();
      if (lembretes > 0) {
        console.log(`[Agenda] ${lembretes} lembrete(s) notificado(s)`);
      }
    } catch (error) {
      console.error('[Agenda] Erro ao processar lembretes:', error);
    }

    try {
      const { processarAlertasPrazoPedidos } = await import('../services/prazo-alerta.service.js');
      const alertas = await processarAlertasPrazoPedidos();
      if (alertas > 0) {
        console.log(`[Prazo] ${alertas} alerta(s) de prazo criado(s)`);
      }
    } catch (error) {
      console.error('[Prazo] Erro ao processar alertas de prazo:', error);
    }
  }

  run();
  return setInterval(run, INTERVAL_MS);
}
