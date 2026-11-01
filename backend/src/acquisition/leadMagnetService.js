import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { repository } from '../db/repository.js';
import { emailService } from '../services/emailService.js';
import { groqService } from '../services/groqService.js';
import { qstashService } from '../services/qstashService.js';
import { issueSignedProductDelivery } from '../services/storageService.js';

function hashIpForConsent(ipAddress) {
  if (!ipAddress) return null;
  return crypto
    .createHmac('sha256', env.appHmacSecret)
    .update(`consent-ip:${ipAddress}`)
    .digest('hex');
}

export function buildUnsubscribeUrl(unsubscribeToken) {
  return `${env.backendPublicUrl}/api/leads/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
}

export const leadMagnetService = {
  async requestSubscription({
    email,
    firstName,
    locale = 'fr',
    consentGiven,
    consentText,
    ipAddress,
  }) {
    if (consentGiven !== true) {
      throw new Error('Le consentement explicite est obligatoire pour recevoir nos ressources.');
    }

    const confirmToken = `cfm_${crypto.randomBytes(24).toString('hex')}`;
    const unsubscribeToken = `uns_${crypto.randomBytes(24).toString('hex')}`;
    const confirmExpiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

    const { lead, alreadyConfirmed } = await repository.upsertPendingLead({
      email,
      firstName,
      locale,
      source: 'lead_magnet',
      consentText,
      consentIpHash: hashIpForConsent(ipAddress),
      confirmToken,
      confirmExpiresAt,
      unsubscribeToken,
    });

    const unsubscribeUrl = buildUnsubscribeUrl(lead.unsubscribe_token);

    if (alreadyConfirmed) {
      // Renvoie l'accès à l'extrait gratuit sans recréer la séquence nurturing
      const delivery = await issueSignedProductDelivery({
        orderId: null,
        storagePath: env.supabase.leadMagnetStoragePath,
        fileName: 'valence-starter-kit.zip',
      });
      await emailService.sendLeadMagnetDeliveryEmail({
        email: lead.email,
        firstName: lead.first_name,
        signedDownloadUrl: delivery.signedDownloadUrl,
        unsubscribeUrl,
      });
      return {
        status: 'already_confirmed_resent',
      };
    }

    const confirmUrl = `${env.backendPublicUrl}/api/leads/confirm?token=${encodeURIComponent(confirmToken)}`;
    const relativeOrExplicitConfirmUrl = `${env.browserApiPrefix}/api/leads/confirm?token=${encodeURIComponent(confirmToken)}`;

    await emailService.sendLeadDoubleOptInEmail({
      email: lead.email,
      firstName: lead.first_name,
      confirmUrl,
      unsubscribeUrl,
    });

    return {
      status: 'confirmation_email_sent',
      // Uniquement hors production lorsque Brevo n'est pas encore branché, pour faciliter le test local
      devConfirmUrl:
        !env.isProduction && !env.brevo.isConfigured ? relativeOrExplicitConfirmUrl : undefined,
    };
  },

  async confirmDoubleOptIn(confirmToken) {
    const confirmation = await repository.confirmLeadByToken(confirmToken);
    if (confirmation.status === 'not_found' || confirmation.status === 'expired') {
      return confirmation;
    }

    const { lead } = confirmation;
    const unsubscribeUrl = buildUnsubscribeUrl(lead.unsubscribe_token);

    // 1. Générer un lien signé (24h, max 3 téléchargements) vers l'extrait gratuit sur Supabase Storage privé
    const delivery = await issueSignedProductDelivery({
      orderId: null,
      storagePath: env.supabase.leadMagnetStoragePath,
      fileName: 'valence-starter-kit.zip',
    });

    if (confirmation.status === 'already_confirmed') {
      return {
        status: 'already_confirmed',
        lead,
        signedDownloadUrl: delivery.signedDownloadUrl,
      };
    }

    // 2. Envoyer immédiatement l'extrait gratuit par Brevo
    await emailService.sendLeadMagnetDeliveryEmail({
      email: lead.email,
      firstName: lead.first_name,
      signedDownloadUrl: delivery.signedDownloadUrl,
      unsubscribeUrl,
    });

    // 3. Générer la séquence de 3 emails (J+1, J+3, J+5) via Groq (llama-3.3-70b-versatile)
    const generatedEmails = await groqService.generateNurturingSequence({
      firstName: lead.first_name,
      locale: lead.locale,
      storeUrl: env.frontendPublicUrl,
    });

    const nowMs = Date.now();
    const sequencePayload = generatedEmails.map((step) => ({
      stepDay: step.stepDay,
      subject: step.subject,
      bodyHtml: step.bodyHtml,
      bodyText: step.bodyText,
      scheduledFor: new Date(nowMs + step.stepDay * 86400 * 1000).toISOString(),
    }));

    const savedRows = await repository.saveNurturingSequence(lead.id, sequencePayload);

    // 4. Planifier chaque envoi via Upstash QStash (aucun timer en mémoire !)
    for (const row of savedRows) {
      const delaySeconds = row.step_day * 86400; // J+1 = 86400s, J+3 = 259200s, J+5 = 432000s
      const scheduled = await qstashService.scheduleDelayedHttpJob({
        path: '/api/jobs/send-nurturing-email',
        body: {
          nurturingId: row.id,
          leadId: lead.id,
          stepDay: row.step_day,
        },
        delaySeconds,
        deduplicationId: `nurturing-${lead.id}-day-${row.step_day}`,
      });
      await repository.updateNurturingMessageId(row.id, scheduled.messageId);
    }

    return {
      status: 'confirmed',
      lead,
      signedDownloadUrl: delivery.signedDownloadUrl,
    };
  },

  async executeScheduledNurturingEmail(nurturingId) {
    const step = await repository.getNurturingEmailById(nurturingId);
    if (!step) {
      return { sent: false, reason: 'step_not_found' };
    }

    // Idempotence : ne jamais renvoyer un email déjà traité
    if (step.status !== 'scheduled' || step.sent_at) {
      return { sent: false, reason: `already_${step.status}` };
    }

    const lead = await repository.getLeadById(step.lead_id);
    if (!lead || lead.status !== 'confirmed' || lead.unsubscribed_at) {
      await repository.markNurturingEmailStatus(step.id, 'skipped');
      return { sent: false, reason: 'lead_unsubscribed_or_inactive' };
    }

    const unsubscribeUrl = buildUnsubscribeUrl(lead.unsubscribe_token);
    await emailService.sendNurturingEmail({
      email: lead.email,
      firstName: lead.first_name,
      subject: step.subject,
      bodyHtml: step.body_html,
      bodyText: step.body_text,
      unsubscribeUrl,
    });

    await repository.markNurturingEmailStatus(step.id, 'sent');
    return { sent: true, stepDay: step.step_day, email: lead.email };
  },

  async unsubscribeByToken(unsubscribeToken) {
    return repository.unsubscribeLeadByToken(unsubscribeToken);
  },
};
