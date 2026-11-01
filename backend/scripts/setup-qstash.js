import { qstashService } from '../src/services/qstashService.js';

async function main() {
  console.info('Configuration des crons Upstash QStash en cours...');
  const result = await qstashService.setupProductionSchedules();
  console.info('Planifications Upstash QStash actives :');
  console.table(result);
}

main().catch((err) => {
  console.error('Échec de configuration QStash :', err.message);
  process.exit(1);
});
