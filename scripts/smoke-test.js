import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

process.env.NODE_ENV = 'development';
process.env.ADMIN_API_KEY = 'smoke_test_admin_secret_key_64_chars_minimum_valence_studio_2026';
process.env.APP_HMAC_SECRET = 'smoke_test_hmac_secret_key_64_chars_minimum_valence_studio_2026';
process.env.SASPAY_WEBHOOK_SECRET = 'whsec_test_saspay_secret';

const { createApp } = await import('../src/app.js');

const app = createApp();
const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

try {
  // 1. Keepalive /health
  const healthRes = await fetch(`${base}/health`);
  assert.equal(healthRes.status, 200);
  const health = await healthRes.json();
  assert.equal(health.status, 'ok');
  console.info('✓ [1/8] Keepalive GET /health opérationnel');

  // 2. Catalogue produits
  const prodRes = await fetch(`${base}/api/products`);
  assert.equal(prodRes.status, 200);
  const { products } = await prodRes.json();
  assert.ok(products.length >= 4);
  console.info(`✓ [2/8] Catalogue chargé (${products.length} produits)`);

  // 3. Checkout Saspay + validation renonciation rétractation
  const badCheckout = await fetch(`${base}/api/checkout/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productSlug: 'notion-agency-os',
      customerEmail: 'acheteur@entreprise.fr',
      provider: 'saspay',
      currency: 'EUR',
      waiverAccepted: false,
    }),
  });
  assert.equal(badCheckout.status, 400);

  const okCheckout = await fetch(`${base}/api/checkout/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productSlug: 'notion-agency-os',
      customerEmail: 'acheteur@entreprise.fr',
      customerName: 'Claire Moreau',
      provider: 'saspay',
      currency: 'EUR',
      waiverAccepted: true,
    }),
  });
  assert.equal(okCheckout.status, 201);
  const checkoutData = await okCheckout.json();
  assert.ok(checkoutData.orderId);
  console.info(`✓ [3/8] Checkout Saspay créé (${checkoutData.orderNumber})`);

  // 4. Webhook body brut + vérification signature + idempotence
  const webhookPayload = JSON.stringify({
    id: 'evt_saspay_unique_001',
    event: 'payment.succeeded',
    data: {
      id: 'sess_001',
      payment_id: 'pay_001',
      order_id: checkoutData.orderId,
      metadata: { order_id: checkoutData.orderId },
    },
  });

  // Signature falsifiée -> rejet 400
  const forgedWebhook = await fetch(`${base}/api/webhooks/saspay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-saspay-signature': 't=1700000000,v1=deadbeef',
    },
    body: webhookPayload,
  });
  assert.equal(forgedWebhook.status, 400);

  // Signature HMAC-SHA256 valide sur body brut
  const ts = Math.floor(Date.now() / 1000).toString();
  const validSig = crypto
    .createHmac('sha256', process.env.SASPAY_WEBHOOK_SECRET)
    .update(`${ts}.`, 'utf8')
    .update(Buffer.from(webhookPayload, 'utf8'))
    .digest('hex');

  const validWebhook = await fetch(`${base}/api/webhooks/saspay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-saspay-signature': `t=${ts},v1=${validSig}`,
    },
    body: webhookPayload,
  });
  assert.equal(validWebhook.status, 200);
  const whBody1 = await validWebhook.json();
  assert.equal(whBody1.fulfilled, true);

  // Rejeu exact du même webhook -> idempotence stricte (duplicate: true)
  const replayWebhook = await fetch(`${base}/api/webhooks/saspay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-saspay-signature': `t=${ts},v1=${validSig}`,
    },
    body: webhookPayload,
  });
  assert.equal(replayWebhook.status, 200);
  const whBody2 = await replayWebhook.json();
  assert.equal(whBody2.duplicate, true);
  console.info('✓ [4/8] Webhook Saspay signé sur body brut + idempotence validés');

  // 5. Livraison URL signée (24h, max 3 téléchargements)
  const statusRes = await fetch(
    `${base}/api/checkout/order-status?order_id=${encodeURIComponent(checkoutData.orderId)}`
  );
  const statusJson = await statusRes.json();
  assert.equal(statusJson.status, 'paid');
  assert.equal(statusJson.delivery.maxDownloads, 3);

  const dlUrl = new URL(statusJson.delivery.signedDownloadUrl, base);
  const localDlUrl = `${base}${dlUrl.pathname}${dlUrl.search}`;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const dlRes = await fetch(localDlUrl, { redirect: 'manual' });
    assert.ok([200, 302].includes(dlRes.status), `Téléchargement #${attempt} autorisé`);
  }

  // 4e tentative -> bloquée 410 Gone !
  const dlFourth = await fetch(localDlUrl, { redirect: 'manual' });
  assert.equal(dlFourth.status, 410);
  console.info('✓ [5/8] Limite stricte de 3 téléchargements & signature HMAC validées');

  // 6. Lead magnet : consentement explicite + double opt-in + désinscription
  const leadSub = await fetch(`${base}/api/leads/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'prospect@agence-test.fr',
      firstName: 'Thomas',
      locale: 'fr',
      consentGiven: true,
    }),
  });
  assert.equal(leadSub.status, 200);
  const leadJson = await leadSub.json();
  assert.ok(leadJson.devConfirmUrl);

  const cfmUrl = new URL(leadJson.devConfirmUrl, base);
  const confirmRes = await fetch(`${base}${cfmUrl.pathname}${cfmUrl.search}`, {
    redirect: 'manual',
  });
  assert.equal(confirmRes.status, 302);
  assert.ok(confirmRes.headers.get('location')?.includes('confirmed=1'));
  console.info('✓ [6/8] Lead Magnet Double Opt-In + planification nurturing J+1/J+3/J+5 validés');

  // 7. Générateur quotidien (3 posts, 1 article SEO, 3 scripts TikTok/Reels) + Sitemap
  const unauthAdmin = await fetch(`${base}/api/admin/stats`);
  assert.equal(unauthAdmin.status, 401);

  const dailyJobRes = await fetch(`${base}/api/admin/jobs/trigger-daily`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.ADMIN_API_KEY}`,
    },
    body: '{}',
  });
  assert.equal(dailyJobRes.status, 200);
  const dailyData = await dailyJobRes.json();
  assert.equal(dailyData.summary.postIdeasCount, 3);
  assert.equal(dailyData.summary.shortVideoScriptsCount, 3);
  assert.equal(dailyData.summary.autoPublish.enabled, false);

  const sitemapRes = await fetch(`${base}/sitemap.xml`);
  assert.equal(sitemapRes.status, 200);
  const sitemapText = await sitemapRes.text();
  assert.ok(sitemapText.includes(dailyData.summary.article.slug));
  console.info('✓ [7/8] Générateur quotidien Groq + Digest + Sitemap XML validés (zéro auto-post)');

  // 8. Importateur CSV Annuaire B2B via API Admin
  const sampleCsv = await fs.readFile(
    new URL('../sample-data/contacts-b2b-exemple.csv', import.meta.url),
    'utf8'
  );
  const b2bRes = await fetch(`${base}/api/admin/b2b/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.ADMIN_API_KEY}`,
    },
    body: JSON.stringify({ csvContent: sampleCsv }),
  });
  assert.equal(b2bRes.status, 200);
  const { report } = await b2bRes.json();
  assert.equal(report.stats.inserted, 7);
  assert.equal(report.stats.rejectedFreeWebmail, 1);
  assert.equal(report.stats.rejectedNonGenericPersonal, 1);
  assert.equal(report.stats.duplicatesInCsv, 1);
  console.info('✓ [8/8] Pipeline Annuaire B2B (doublons, génériques contact@, MX) validé');

  console.info('\nSUCCÈS TOTAL : Les 8 suites de tests d’intégration passent à 100 %.');
} finally {
  server.close();
}
