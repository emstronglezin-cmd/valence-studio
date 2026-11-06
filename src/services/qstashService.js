import { Client } from '@upstash/qstash';
import { env } from '../config/env.js';

let qstashClient = null;

function getClient() {
  if (!env.qstash.token) {
    return null;
  }
  if (!qstashClient) {
    qstashClient = new Client({
      token: env.qstash.token,
      baseUrl: env.qstash.url,
    });
  }
  return qstashClient;
}

export const qstashService = {
  isConfigured() {
    return Boolean(env.qstash.token);
  },

  /**
   * Planifie l'exécution différée d'un job HTTP via Upstash QStash (zéro timer en mémoire).
   * Exemple : J+1 (86400s), J+3 (259200s), J+5 (432000s).
   */
  async scheduleDelayedHttpJob({ path, body, delaySeconds, deduplicationId }) {
    const client = getClient();
    const destination = `${env.backendPublicUrl}${path}`;

    if (!client) {
      console.info(
        `[QStash:Simulation] Job différé enregistré en base (délai=${delaySeconds}s -> ${destination})`
      );
      return {
        messageId: `sim_qstash_${deduplicationId || Date.now()}`,
        simulated: true,
      };
    }

    const res = await client.publishJSON({
      url: destination,
      body,
      delay: delaySeconds,
      deduplicationId,
      retries: 3,
    });

    return {
      messageId: res.messageId,
      simulated: false,
    };
  },

  /**
   * Configure de manière idempotente sur Upstash QStash :
   * 1) Le keepalive Render Free toutes les 5 minutes (`*\/5 * * * *`) vers `GET /health`
   * 2) Le générateur quotidien de contenu + digest email (`0 7 * * *`) vers `POST /api/jobs/daily-content`
   */
  async setupProductionSchedules() {
    const client = getClient();
    if (!client) {
      throw new Error('QSTASH_TOKEN manquant dans .env : impossible de enregistrer les crons Upstash.');
    }

    const healthSchedule = await client.schedules.create({
      scheduleId: 'valence-keepalive-health',
      destination: `${env.backendPublicUrl}/health`,
      cron: '*/5 * * * *',
      method: 'GET',
      retries: 1,
    });

    const dailyContentSchedule = await client.schedules.create({
      scheduleId: 'valence-daily-acquisition',
      destination: `${env.backendPublicUrl}/api/jobs/daily-content`,
      cron: env.qstash.dailyContentCron,
      method: 'POST',
      body: JSON.stringify({ trigger: 'qstash_daily_cron' }),
      headers: { 'Content-Type': 'application/json' },
      retries: 2,
    });

    return {
      keepaliveScheduleId: healthSchedule.scheduleId,
      dailyContentScheduleId: dailyContentSchedule.scheduleId,
      backendPublicUrl: env.backendPublicUrl,
      keepaliveCron: '*/5 * * * *',
      dailyContentCron: env.qstash.dailyContentCron,
    };
  },
};
