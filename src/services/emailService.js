import { env } from '../config/env.js';

const devOutbox = [];

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapEmailLayout({ preheader, title, contentHtml, footerHtml }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F3EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111215;">
  <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader || title)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#FFFFFF;border:1px solid #E4E2DC;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:24px 32px;background:#090A0D;color:#FFFFFF;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;font-weight:700;">
              VALENCE STUDIO
            </td>
          </tr>
          <tr>
            <td style="padding:32px;line-height:1.65;font-size:15px;color:#1F2329;">
              ${contentHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#FAF9F6;border-top:1px solid #ECEAE4;font-size:12px;color:#666B75;line-height:1.5;">
              ${footerHtml || 'Valence Studio — Actifs numériques, systèmes IA &amp; données B2B internationales.'}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendViaBrevo({ toEmail, toName, subject, htmlContent, textContent, headers = {} }) {
  if (!env.brevo.isConfigured) {
    const entry = {
      id: `sim_mail_${Date.now()}`,
      to: toEmail,
      subject,
      sentAt: new Date().toISOString(),
      mode: 'simulated_no_brevo_key',
    };
    devOutbox.unshift(entry);
    if (devOutbox.length > 30) devOutbox.pop();
    console.info(`[Email:Simulation] Destinataire=${toEmail} | Sujet="${subject}"`);
    return entry;
  }

  const payload = {
    sender: {
      name: env.brevo.fromName,
      email: env.brevo.fromAddress,
    },
    to: [{ email: toEmail, name: toName || toEmail }],
    subject,
    htmlContent,
    textContent,
  };

  if (Object.keys(headers).length > 0) {
    payload.headers = headers;
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': env.brevo.apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erreur Brevo API (${response.status}): ${errText.slice(0, 300)}`);
  }

  return response.json();
}

export const emailService = {
  getRecentOutbox() {
    return devOutbox;
  },

  async sendOrderDeliveryEmail({
    order,
    signedDownloadUrl,
    thankYouUrl,
    expiresAt,
    maxDownloads,
  }) {
    const formattedAmount = `${(order.amount_cents / 100).toFixed(2)} ${order.currency}`;
    const subject = `Votre commande ${order.order_number} — Lien de téléchargement sécurisé`;
    const htmlContent = wrapEmailLayout({
      preheader: `Accédez immédiatement à ${order.product_title} (valable 24h, ${maxDownloads} téléchargements max).`,
      title: subject,
      contentHtml: `
        <h1 style="margin:0 0 12px;font-size:22px;color:#090A0D;">Merci pour votre commande.</h1>
        <p style="margin:0 0 20px;">Votre paiement de <strong>${escapeHtml(formattedAmount)}</strong> pour <strong>${escapeHtml(order.product_title)}</strong> est confirmé (référence <code>${escapeHtml(order.order_number)}</code>).</p>
        <p style="margin:0 0 24px;">
          <a href="${escapeHtml(signedDownloadUrl)}" style="display:inline-block;padding:14px 24px;background:#2546F0;color:#FFFFFF;text-decoration:none;border-radius:8px;font-weight:600;">
            Télécharger mes fichiers maintenant
          </a>
        </p>
        <div style="padding:14px 16px;background:#F4F6FF;border-left:3px solid #2546F0;border-radius:6px;font-size:13px;margin-bottom:20px;">
          <strong>Sécurité de livraison :</strong> ce lien privé est valable <strong>24 heures</strong> (jusqu'au ${escapeHtml(new Date(expiresAt).toUTCString())}) et autorise jusqu'à <strong>${maxDownloads} téléchargements</strong>. Conservez une sauvegarde locale de votre archive dès réception.
        </div>
        <p style="font-size:13px;color:#52555E;">Vous pouvez également consulter le récapitulatif et le compteur de téléchargements sur votre page de livraison : <a href="${escapeHtml(thankYouUrl)}" style="color:#2546F0;">ouvrir le récapitulatif</a>.</p>
      `,
    });

    const textContent = [
      `Merci pour votre commande ${order.order_number} (${formattedAmount}).`,
      `Produit : ${order.product_title}`,
      '',
      `Téléchargement direct (valable 24h, ${maxDownloads} téléchargements max) :`,
      signedDownloadUrl,
      '',
      `Page récapitulative : ${thankYouUrl}`,
    ].join('\n');

    return sendViaBrevo({
      toEmail: order.customer_email,
      toName: order.customer_name || order.customer_email,
      subject,
      htmlContent,
      textContent,
    });
  },

  async sendLeadDoubleOptInEmail({ email, firstName, confirmUrl, unsubscribeUrl }) {
    const greeting = firstName ? `Bonjour ${escapeHtml(firstName)},` : 'Bonjour,';
    const subject = 'Confirmez votre email pour recevoir votre Kit Opérateur gratuit';
    const htmlContent = wrapEmailLayout({
      preheader: 'Un clic suffit pour valider votre demande et débloquer votre extrait gratuit.',
      title: subject,
      contentHtml: `
        <p style="margin:0 0 12px;">${greeting}</p>
        <p style="margin:0 0 20px;">Vous avez demandé à recevoir notre extrait gratuit <strong>Kit d'Extraction Valence Studio</strong> (25 prompts calibrés + architecture Notion + échantillon B2B). Conformément aux règles de protection des données, merci de confirmer votre adresse en un clic :</p>
        <p style="margin:0 0 24px;">
          <a href="${escapeHtml(confirmUrl)}" style="display:inline-block;padding:14px 24px;background:#090A0D;color:#FFFFFF;text-decoration:none;border-radius:8px;font-weight:600;">
            Confirmer mon adresse et recevoir l'extrait
          </a>
        </p>
        <p style="font-size:13px;color:#666B75;">Si vous n'êtes pas à l'origine de cette demande, ignorez simplement ce message : aucun autre email ne vous sera envoyé.</p>
      `,
      footerHtml: `Demande d'inscription double opt-in • <a href="${escapeHtml(unsubscribeUrl)}" style="color:#52555E;">Ne plus recevoir d'emails</a>`,
    });

    const textContent = `${firstName ? `Bonjour ${firstName},` : 'Bonjour,'}\n\nConfirmez votre adresse pour recevoir votre extrait gratuit :\n${confirmUrl}\n\nSi vous n'avez rien demandé, ignorez ce message.`;

    return sendViaBrevo({
      toEmail: email,
      toName: firstName || email,
      subject,
      htmlContent,
      textContent,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
  },

  async sendLeadMagnetDeliveryEmail({ email, firstName, signedDownloadUrl, unsubscribeUrl }) {
    const greeting = firstName ? `Bienvenue ${escapeHtml(firstName)},` : 'Bienvenue,';
    const subject = 'Votre Kit d’Extraction gratuit est prêt au téléchargement';
    const htmlContent = wrapEmailLayout({
      preheader: 'Téléchargez votre extrait gratuit Valence Studio dès maintenant.',
      title: subject,
      contentHtml: `
        <h1 style="margin:0 0 12px;font-size:21px;color:#090A0D;">${greeting}</h1>
        <p style="margin:0 0 20px;">Votre adresse est confirmée. Voici votre accès privé pour télécharger immédiatement l'extrait gratuit Valence Studio :</p>
        <p style="margin:0 0 24px;">
          <a href="${escapeHtml(signedDownloadUrl)}" style="display:inline-block;padding:14px 24px;background:#2546F0;color:#FFFFFF;text-decoration:none;border-radius:8px;font-weight:600;">
            Télécharger l'extrait gratuit
          </a>
        </p>
        <p style="margin:0;font-size:14px;color:#52555E;">Au cours des prochains jours (J+1, J+3 et J+5), je vous partagerai trois protocoles concrets pour exploiter ces ressources au maximum.</p>
      `,
      footerHtml: `Vous recevez cet email suite à votre confirmation explicite. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#52555E;">Se désinscrire en 1 clic</a>.`,
    });

    const textContent = `Votre adresse est confirmée.\nTéléchargez votre extrait gratuit ici : ${signedDownloadUrl}\n\nSe désinscrire : ${unsubscribeUrl}`;

    return sendViaBrevo({
      toEmail: email,
      toName: firstName || email,
      subject,
      htmlContent,
      textContent,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
  },

  async sendNurturingEmail({ email, firstName, subject, bodyHtml, bodyText, unsubscribeUrl }) {
    const htmlContent = wrapEmailLayout({
      preheader: subject,
      title: subject,
      contentHtml: bodyHtml,
      footerHtml: `Séquence conseils Valence Studio • <a href="${escapeHtml(unsubscribeUrl)}" style="color:#52555E;">Se désinscrire immédiatement</a>`,
    });

    const fullText = `${bodyText}\n\n---\nSe désinscrire : ${unsubscribeUrl}`;

    return sendViaBrevo({
      toEmail: email,
      toName: firstName || email,
      subject,
      htmlContent,
      textContent: fullText,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
  },

  async sendMorningDigestEmail({
    ownerEmail,
    generationDate,
    article,
    postIdeas,
    shortVideoScripts,
    articlePublicUrl,
  }) {
    if (!ownerEmail) {
      console.info('[Email:Digest] OWNER_DIGEST_EMAIL non renseigné — digest conservé en base.');
      return null;
    }

    const postsHtml = postIdeas
      .map(
        (post, idx) => `
          <div style="margin-bottom:16px;padding:14px;background:#FAF9F6;border:1px solid #E5E3DC;border-radius:8px;">
            <div style="font-size:12px;font-weight:700;color:#2546F0;text-transform:uppercase;">Post #${idx + 1} — ${escapeHtml(post.channel || 'LinkedIn / X')}</div>
            <div style="font-weight:700;margin:4px 0 8px;">${escapeHtml(post.hook)}</div>
            <div style="font-size:14px;white-space:pre-line;">${escapeHtml(post.body)}</div>
            <div style="margin-top:8px;font-size:13px;color:#52555E;"><strong>CTA :</strong> ${escapeHtml(post.cta)}</div>
          </div>`
      )
      .join('');

    const videosHtml = shortVideoScripts
      .map(
        (vid, idx) => `
          <div style="margin-bottom:16px;padding:14px;background:#F4F6FF;border:1px solid #DCE2FF;border-radius:8px;">
            <div style="font-size:12px;font-weight:700;color:#090A0D;text-transform:uppercase;">Script TikTok / Reels #${idx + 1}</div>
            <p style="margin:6px 0;"><strong>Accroche (0-3s) :</strong> ${escapeHtml(vid.hook3s)}</p>
            <p style="margin:6px 0;"><strong>Corps :</strong> ${escapeHtml(vid.body)}</p>
            <p style="margin:6px 0;"><strong>Appel à l'action :</strong> ${escapeHtml(vid.cta)}</p>
          </div>`
      )
      .join('');

    const subject = `[Digest Acquisition ${generationDate}] 1 article SEO + 3 posts + 3 scripts Reels prêts`;
    const htmlContent = wrapEmailLayout({
      preheader: `Article SEO du jour : ${article.title}`,
      title: subject,
      contentHtml: `
        <h1 style="margin:0 0 8px;font-size:20px;">Digest matinal d'acquisition — ${escapeHtml(generationDate)}</h1>
        <p style="margin:0 0 20px;color:#52555E;font-size:14px;">Aucune publication automatique sur les réseaux n'a été déclenchée. Vos contenus du jour sont stockés en base et prêts à être relus/publiés.</p>

        <h2 style="font-size:16px;border-bottom:1px solid #E5E3DC;padding-bottom:6px;">1. Nouvel Article SEO généré</h2>
        <p style="margin:8px 0 4px;"><strong>Titre :</strong> ${escapeHtml(article.title)}</p>
        <p style="margin:0 0 8px;font-size:13px;color:#52555E;"><strong>Meta :</strong> ${escapeHtml(article.meta_description || article.metaDescription)}</p>
        <p style="margin:0 0 20px;"><a href="${escapeHtml(articlePublicUrl)}" style="color:#2546F0;font-weight:600;">Voir la page SEO générée &rarr;</a></p>

        <h2 style="font-size:16px;border-bottom:1px solid #E5E3DC;padding-bottom:6px;">2. Trois idées de posts à publier</h2>
        ${postsHtml}

        <h2 style="font-size:16px;border-bottom:1px solid #E5E3DC;padding-bottom:6px;">3. Trois scripts vidéos courtes (TikTok / Reels)</h2>
        ${videosHtml}
      `,
    });

    const textContent = [
      `DIGEST D'ACQUISITION — ${generationDate}`,
      '',
      `ARTICLE SEO : ${article.title}`,
      `URL : ${articlePublicUrl}`,
      '',
      '--- 3 IDÉES DE POSTS ---',
      ...postIdeas.map((p, i) => `#${i + 1} ${p.hook}\n${p.body}\nCTA: ${p.cta}\n`),
      '--- 3 SCRIPTS TIKTOK / REELS ---',
      ...shortVideoScripts.map(
        (v, i) => `#${i + 1} [0-3s] ${v.hook3s}\nCorps: ${v.body}\nCTA: ${v.cta}\n`
      ),
    ].join('\n');

    return sendViaBrevo({
      toEmail: ownerEmail,
      toName: 'Fondateur Valence Studio',
      subject,
      htmlContent,
      textContent,
    });
  },
};
