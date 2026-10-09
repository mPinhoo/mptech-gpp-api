import 'dotenv/config';
import { startBillingWorker } from './billing/worker.js';
import app from './app.js';
import { startLembretesJob } from './jobs/lembretes.job.js';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`[MPTech GPP API] Servidor rodando na porta ${PORT}`);
  startLembretesJob();
  startBillingWorker();
});
