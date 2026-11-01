import { STORE_CONFIG } from './config.js';

function apiUrl(path) {
  const base = STORE_CONFIG.apiBaseUrl.replace(/\/+$/, '');
  return `${base}${path}`;
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function initAdminConsole() {
  const authForm = document.getElementById('admin-auth-form');
  const keyInput = document.getElementById('admin-api-key-input');
  const authGate = document.getElementById('admin-auth-gate');
  const dashboardPanel = document.getElementById('admin-dashboard-panel');
  const authError = document.getElementById('admin-auth-error');

  let adminKey = sessionStorage.getItem('valence_admin_key') || '';

  const adminFetch = async (path, options = {}) => {
    const res = await fetch(apiUrl(path), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminKey}`,
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Erreur HTTP ${res.status}`);
    }
    return data;
  };

  const loadDashboard = async () => {
    const [statsRes, contentsRes, contactsRes] = await Promise.all([
      adminFetch('/api/admin/stats'),
      adminFetch('/api/admin/contents'),
      adminFetch('/api/admin/b2b/contacts?limit=25'),
    ]);

    authGate.classList.add('hidden');
    dashboardPanel.classList.remove('hidden');

    const { stats, integrations } = statsRes;

    document.getElementById('stat-visits').textContent = `${stats.visits.total} (${stats.visits.unique} uniques)`;
    document.getElementById('stat-leads').textContent = `${stats.leads.confirmed} confirmés / ${stats.leads.total}`;
    document.getElementById('stat-sales').textContent = `${stats.sales.count} (${stats.sales.revenueEur} € / $${stats.sales.revenueUsd})`;
    document.getElementById('stat-conversion').textContent = `${stats.conversion.visitToSalePct}% global (${stats.conversion.visitToLeadPct}% lead)`;

    const integrationsMount = document.getElementById('admin-integrations-list');
    if (integrationsMount) {
      integrationsMount.innerHTML = Object.entries(integrations)
        .map(
          ([k, ok]) => `
          <span class="px-2.5 py-1 rounded-md text-xs font-mono border hairline-border flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-amber-500'}"></span>
            ${escapeHtml(k.toUpperCase())}: ${ok ? 'LIVE' : 'À BRANCHER'}
          </span>`
        )
        .join('');
    }

    renderDailyContents(contentsRes.contents || []);
    renderB2BContacts(contactsRes.contacts || []);
  };

  const renderDailyContents = (contents) => {
    const mount = document.getElementById('admin-daily-contents-mount');
    if (!mount) return;
    if (!contents.length) {
      mount.innerHTML = `<p class="text-sm opacity-70">Aucun digest généré pour le moment. Cliquez sur « Générer le Digest du Jour » pour lancer Groq (llama-3.3-70b-versatile).</p>`;
      return;
    }

    const latest = contents[0];
    const posts = Array.isArray(latest.post_ideas) ? latest.post_ideas : [];
    const scripts = Array.isArray(latest.short_video_scripts) ? latest.short_video_scripts : [];
    const seo = latest.seo_articles;

    mount.innerHTML = `
      <div class="space-y-5">
        <div class="p-4 rounded-xl surface-subtle flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="text-xs font-mono opacity-60">Dernier pack généré (${escapeHtml(latest.generation_date)}) &bull; Aucune publication auto</div>
            <div class="font-bold text-sm mt-0.5">${escapeHtml(seo?.title || 'Article SEO généré')}</div>
          </div>
          ${
            seo?.slug
              ? `<a href="blog.html?slug=${encodeURIComponent(seo.slug)}" class="text-xs font-semibold text-[#2546F0] dark:text-[#5B78FF]">Ouvrir l'article SEO &rarr;</a>`
              : ''
          }
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-3">
            <h4 class="text-xs font-mono uppercase opacity-60">3 Idées de Posts</h4>
            ${posts
              .map(
                (p) => `<div class="p-3.5 rounded-xl surface-subtle text-xs space-y-1">
                  <div class="font-bold">${escapeHtml(p.hook)}</div>
                  <p class="opacity-75 whitespace-pre-line">${escapeHtml(p.body)}</p>
                </div>`
              )
              .join('')}
          </div>
          <div class="space-y-3">
            <h4 class="text-xs font-mono uppercase opacity-60">3 Scripts TikTok / Reels (Accroche 3s)</h4>
            ${scripts
              .map(
                (s) => `<div class="p-3.5 rounded-xl surface-subtle text-xs space-y-1">
                  <div class="font-bold text-[#2546F0] dark:text-[#5B78FF]">[0-3s] ${escapeHtml(s.hook3s)}</div>
                  <p class="opacity-75">${escapeHtml(s.body)}</p>
                  <div class="opacity-65 font-mono">CTA : ${escapeHtml(s.cta)}</div>
                </div>`
              )
              .join('')}
          </div>
        </div>
      </div>
    `;
  };

  const renderB2BContacts = (contacts) => {
    const tbody = document.getElementById('admin-b2b-table-body');
    if (!tbody) return;
    if (!contacts.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center opacity-65 text-xs">Aucun contact B2B importé pour l'instant.</td></tr>`;
      return;
    }

    tbody.innerHTML = contacts
      .map(
        (c) => `<tr class="border-t hairline-border text-xs">
          <td class="py-2.5 pr-3 font-medium">${escapeHtml(c.company_name)}</td>
          <td class="py-2.5 pr-3 font-mono text-[#2546F0] dark:text-[#5B78FF]">${escapeHtml(c.email)}</td>
          <td class="py-2.5 pr-3">${escapeHtml(c.sector || '')}</td>
          <td class="py-2.5 pr-3 font-mono">${escapeHtml(c.country || '')}</td>
          <td class="py-2.5 font-mono">${c.mx_verified ? 'MX OK' : 'DNS A'}</td>
        </tr>`
      )
      .join('');
  };

  authForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError?.classList.add('hidden');
    adminKey = keyInput.value.trim();
    try {
      await loadDashboard();
      sessionStorage.setItem('valence_admin_key', adminKey);
    } catch (err) {
      sessionStorage.removeItem('valence_admin_key');
      if (authError) {
        authError.textContent = err.message;
        authError.classList.remove('hidden');
      }
    }
  });

  document.getElementById('btn-trigger-daily-job')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Génération Groq en cours...';
    try {
      await adminFetch('/api/admin/jobs/trigger-daily', { method: 'POST', body: '{}' });
      await loadDashboard();
    } catch (err) {
      alert(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Générer le Digest du Jour maintenant';
    }
  });

  const csvForm = document.getElementById('admin-b2b-import-form');
  const csvFileInput = document.getElementById('admin-b2b-file');
  const csvTextarea = document.getElementById('admin-b2b-csv-text');
  const csvReportBox = document.getElementById('admin-b2b-report');

  csvFileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file || !csvTextarea) return;
    csvTextarea.value = await file.text();
  });

  csvForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const csvContent = csvTextarea?.value.trim() || '';
    if (!csvContent) return;

    try {
      const { report } = await adminFetch('/api/admin/b2b/import', {
        method: 'POST',
        body: JSON.stringify({ csvContent }),
      });
      if (csvReportBox) {
        const s = report.stats;
        csvReportBox.innerHTML = `
          <div class="font-bold mb-1">Contrôle qualité terminé (${s.totalRows} lignes analysées) :</div>
          <div class="font-mono text-xs space-y-0.5">
            <div>&#10003; Insérés (emails génériques pros &amp; domaines valides) : <strong>${s.inserted}</strong></div>
            <div>&bull; Doublons écartés : ${s.duplicatesInCsv + s.duplicatesInDb}</div>
            <div>&bull; Emails nominatifs / non génériques rejetés : ${s.rejectedNonGenericPersonal}</div>
            <div>&bull; Webmails grand public (gmail/yahoo...) rejetés : ${s.rejectedFreeWebmail}</div>
            <div>&bull; Formats ou domaines DNS invalides rejetés : ${s.rejectedInvalidFormat + s.rejectedInvalidDomain}</div>
          </div>
        `;
        csvReportBox.classList.remove('hidden');
      }
      await loadDashboard();
    } catch (err) {
      if (csvReportBox) {
        csvReportBox.textContent = err.message;
        csvReportBox.classList.remove('hidden');
      }
    }
  });

  document.getElementById('btn-export-b2b')?.addEventListener('click', async () => {
    try {
      const res = await fetch(apiUrl('/api/admin/b2b/export'), {
        headers: { Authorization: `Bearer ${adminKey}` },
      });
      if (!res.ok) throw new Error('Export impossible');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'annuaire-b2b-verifie.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    }
  });

  if (adminKey) {
    loadDashboard().catch(() => {
      sessionStorage.removeItem('valence_admin_key');
    });
  }
}
