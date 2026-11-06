import crypto from 'node:crypto';
import { getSupabase } from './supabase.js';
import { INITIAL_PRODUCTS, INITIAL_SEO_ARTICLES } from './seedData.js';

// État mémoire utilisé uniquement en développement local tant que SUPABASE_URL n'est pas renseigné
const memoryStore = {
  products: structuredClone(INITIAL_PRODUCTS),
  orders: [],
  webhookEvents: new Map(),
  downloadTokens: new Map(),
  leads: new Map(),
  nurturingEmails: [],
  seoArticles: structuredClone(INITIAL_SEO_ARTICLES),
  dailyContents: [],
  pageVisits: [],
  b2bContacts: new Map(),
};

export const repository = {
  isDatabaseConnected() {
    return Boolean(getSupabase());
  },

  // ---------------------------------------------------------------------------
  // PRODUITS
  // ---------------------------------------------------------------------------
  async listProducts({ category } = {}) {
    const sb = getSupabase();
    if (sb) {
      let query = sb
        .from('products')
        .select('*')
        .eq('active', true)
        .order('featured', { ascending: false })
        .order('created_at', { ascending: true });
      if (category && category !== 'all') {
        query = query.eq('category', category);
      }
      const { data, error } = await query;
      if (error) throw new Error(`Supabase listProducts: ${error.message}`);
      return data || [];
    }

    return memoryStore.products.filter(
      (p) => p.active && (!category || category === 'all' || p.category === category)
    );
  },

  async getProductBySlug(slug) {
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb
        .from('products')
        .select('*')
        .eq('slug', slug)
        .eq('active', true)
        .maybeSingle();
      if (error) throw new Error(`Supabase getProductBySlug: ${error.message}`);
      return data;
    }

    return memoryStore.products.find((p) => p.slug === slug && p.active) || null;
  },

  // ---------------------------------------------------------------------------
  // COMMANDES & IDEMPOTENCE WEBHOOKS
  // ---------------------------------------------------------------------------
  async createOrder(orderData) {
    const sb = getSupabase();
    const record = {
      id: crypto.randomUUID(),
      order_number: orderData.orderNumber,
      product_id: orderData.productId,
      product_slug: orderData.productSlug,
      product_title: orderData.productTitle,
      customer_email: orderData.customerEmail.toLowerCase().trim(),
      customer_name: orderData.customerName || null,
      company_name: orderData.companyName || null,
      country_code: orderData.countryCode || 'FR',
      currency: orderData.currency,
      amount_cents: orderData.amountCents,
      provider: orderData.provider,
      provider_session_id: orderData.providerSessionId || null,
      status: 'pending',
      waiver_accepted: Boolean(orderData.waiverAccepted),
      metadata: orderData.metadata || {},
      created_at: new Date().toISOString(),
    };

    if (sb) {
      const { data, error } = await sb.from('orders').insert(record).select('*').single();
      if (error) throw new Error(`Supabase createOrder: ${error.message}`);
      return data;
    }

    memoryStore.orders.push(record);
    return record;
  },

  async updateOrderSession(orderId, providerSessionId) {
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb
        .from('orders')
        .update({ provider_session_id: providerSessionId })
        .eq('id', orderId)
        .select('*')
        .single();
      if (error) throw new Error(`Supabase updateOrderSession: ${error.message}`);
      return data;
    }

    const found = memoryStore.orders.find((o) => o.id === orderId);
    if (found) found.provider_session_id = providerSessionId;
    return found || null;
  },

  async getOrderByIdOrSession({ orderId, orderNumber, provider, providerSessionId }) {
    const sb = getSupabase();
    if (sb) {
      if (orderId) {
        const { data } = await sb.from('orders').select('*').eq('id', orderId).maybeSingle();
        if (data) return data;
      }
      if (orderNumber) {
        const { data } = await sb
          .from('orders')
          .select('*')
          .eq('order_number', orderNumber)
          .maybeSingle();
        if (data) return data;
      }
      if (provider && providerSessionId) {
        const { data } = await sb
          .from('orders')
          .select('*')
          .eq('provider', provider)
          .eq('provider_session_id', providerSessionId)
          .maybeSingle();
        if (data) return data;
      }
      return null;
    }

    return (
      memoryStore.orders.find(
        (o) =>
          (orderId && o.id === orderId) ||
          (orderNumber && o.order_number === orderNumber) ||
          (provider && providerSessionId && o.provider === provider && o.provider_session_id === providerSessionId)
      ) || null
    );
  },

  /**
   * Enregistre l'événement webhook de façon atomique et idempotente.
   * Retourne `{ isDuplicate: true }` si l'événement a déjà été traité.
   */
  async registerWebhookEvent({ provider, eventId, eventType, payloadHash }) {
    const sb = getSupabase();
    if (sb) {
      const { error } = await sb.from('webhook_events').insert({
        provider,
        event_id: eventId,
        event_type: eventType,
        payload_hash: payloadHash,
      });
      if (error) {
        if (error.code === '23505') {
          return { isDuplicate: true };
        }
        throw new Error(`Supabase registerWebhookEvent: ${error.message}`);
      }
      return { isDuplicate: false };
    }

    const key = `${provider}:${eventId}`;
    if (memoryStore.webhookEvents.has(key)) {
      return { isDuplicate: true };
    }
    memoryStore.webhookEvents.set(key, {
      provider,
      event_id: eventId,
      event_type: eventType,
      payload_hash: payloadHash,
      processed_at: new Date().toISOString(),
    });
    return { isDuplicate: false };
  },

  async markOrderPaidAndDelivered(orderId, { providerPaymentId }) {
    const nowIso = new Date().toISOString();
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb
        .from('orders')
        .update({
          status: 'paid',
          provider_payment_id: providerPaymentId || null,
          paid_at: nowIso,
          delivered_at: nowIso,
        })
        .eq('id', orderId)
        .select('*')
        .single();
      if (error) throw new Error(`Supabase markOrderPaidAndDelivered: ${error.message}`);
      return data;
    }

    const order = memoryStore.orders.find((o) => o.id === orderId);
    if (!order) return null;
    order.status = 'paid';
    order.provider_payment_id = providerPaymentId || null;
    order.paid_at = nowIso;
    order.delivered_at = nowIso;
    return order;
  },

  // ---------------------------------------------------------------------------
  // JETONS DE TÉLÉCHARGEMENT (24H, MAX 3 TÉLÉCHARGEMENTS)
  // ---------------------------------------------------------------------------
  async createDownloadToken({ token, orderId, storagePath, fileName, maxDownloads, expiresAt }) {
    const record = {
      id: crypto.randomUUID(),
      token,
      order_id: orderId || null,
      storage_path: storagePath,
      file_name: fileName,
      max_downloads: maxDownloads,
      download_count: 0,
      expires_at: expiresAt,
      last_downloaded_at: null,
      created_at: new Date().toISOString(),
    };

    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb
        .from('download_tokens')
        .insert(record)
        .select('*')
        .single();
      if (error) throw new Error(`Supabase createDownloadToken: ${error.message}`);
      return data;
    }

    memoryStore.downloadTokens.set(token, record);
    return record;
  },

  async getDownloadTokenInfo(token) {
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb
        .from('download_tokens')
        .select('*, orders(order_number, product_title, product_slug, customer_email, amount_cents, currency, paid_at)')
        .eq('token', token)
        .maybeSingle();
      if (error) throw new Error(`Supabase getDownloadTokenInfo: ${error.message}`);
      return data;
    }

    const entry = memoryStore.downloadTokens.get(token);
    if (!entry) return null;
    const order = entry.order_id
      ? memoryStore.orders.find((o) => o.id === entry.order_id) || null
      : null;
    return {
      ...entry,
      orders: order
        ? {
            order_number: order.order_number,
            product_title: order.product_title,
            product_slug: order.product_slug,
            customer_email: order.customer_email,
            amount_cents: order.amount_cents,
            currency: order.currency,
            paid_at: order.paid_at,
          }
        : null,
    };
  },

  async getDownloadTokenByOrderId(orderId) {
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb
        .from('download_tokens')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`Supabase getDownloadTokenByOrderId: ${error.message}`);
      return data;
    }

    for (const tokenEntry of memoryStore.downloadTokens.values()) {
      if (tokenEntry.order_id === orderId) return tokenEntry;
    }
    return null;
  },

  async consumeDownloadSlot(token) {
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb.rpc('consume_download_slot', { p_token: token });
      if (error) throw new Error(`Supabase consume_download_slot: ${error.message}`);
      const updated = Array.isArray(data) ? data[0] : data;
      return updated || null;
    }

    const entry = memoryStore.downloadTokens.get(token);
    if (!entry) return null;
    if (new Date(entry.expires_at).getTime() <= Date.now()) return null;
    if (entry.download_count >= entry.max_downloads) return null;
    entry.download_count += 1;
    entry.last_downloaded_at = new Date().toISOString();
    return { ...entry };
  },

  // ---------------------------------------------------------------------------
  // LEADS & SÉQUENCE NURTURING
  // ---------------------------------------------------------------------------
  async upsertPendingLead({
    email,
    firstName,
    locale,
    source,
    consentText,
    consentIpHash,
    confirmToken,
    confirmExpiresAt,
    unsubscribeToken,
  }) {
    const normalizedEmail = email.toLowerCase().trim();
    const sb = getSupabase();

    if (sb) {
      const { data: existing } = await sb
        .from('leads')
        .select('*')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (existing && existing.status === 'confirmed') {
        return { lead: existing, alreadyConfirmed: true };
      }

      const payload = {
        email: normalizedEmail,
        first_name: firstName || null,
        locale: locale || 'fr',
        source: source || 'lead_magnet',
        consent_given: true,
        consent_text: consentText,
        consent_ip_hash: consentIpHash,
        consent_at: new Date().toISOString(),
        status: 'pending',
        confirm_token: confirmToken,
        confirm_expires_at: confirmExpiresAt,
        unsubscribe_token: existing?.unsubscribe_token || unsubscribeToken,
        unsubscribed_at: null,
      };

      const { data, error } = await sb
        .from('leads')
        .upsert(payload, { onConflict: 'email' })
        .select('*')
        .single();
      if (error) throw new Error(`Supabase upsertPendingLead: ${error.message}`);
      return { lead: data, alreadyConfirmed: false };
    }

    const existing = memoryStore.leads.get(normalizedEmail);
    if (existing && existing.status === 'confirmed') {
      return { lead: existing, alreadyConfirmed: true };
    }

    const lead = {
      id: existing?.id || crypto.randomUUID(),
      email: normalizedEmail,
      first_name: firstName || null,
      locale: locale || 'fr',
      source: source || 'lead_magnet',
      consent_given: true,
      consent_text: consentText,
      consent_ip_hash: consentIpHash,
      consent_at: new Date().toISOString(),
      status: 'pending',
      confirm_token: confirmToken,
      confirm_expires_at: confirmExpiresAt,
      confirmed_at: null,
      unsubscribe_token: existing?.unsubscribe_token || unsubscribeToken,
      unsubscribed_at: null,
      created_at: existing?.created_at || new Date().toISOString(),
    };
    memoryStore.leads.set(normalizedEmail, lead);
    return { lead, alreadyConfirmed: false };
  },

  async confirmLeadByToken(confirmToken) {
    const nowIso = new Date().toISOString();
    const sb = getSupabase();

    if (sb) {
      const { data: lead, error } = await sb
        .from('leads')
        .select('*')
        .eq('confirm_token', confirmToken)
        .maybeSingle();
      if (error) throw new Error(`Supabase confirmLeadByToken: ${error.message}`);
      if (!lead) return { status: 'not_found' };
      if (lead.status === 'confirmed') return { status: 'already_confirmed', lead };
      if (lead.confirm_expires_at && new Date(lead.confirm_expires_at).getTime() <= Date.now()) {
        return { status: 'expired', lead };
      }

      const { data: updated, error: updateErr } = await sb
        .from('leads')
        .update({
          status: 'confirmed',
          confirmed_at: nowIso,
          confirm_token: null,
        })
        .eq('id', lead.id)
        .select('*')
        .single();
      if (updateErr) throw new Error(`Supabase update lead confirm: ${updateErr.message}`);
      return { status: 'confirmed', lead: updated };
    }

    for (const lead of memoryStore.leads.values()) {
      if (lead.confirm_token === confirmToken) {
        if (lead.status === 'confirmed') return { status: 'already_confirmed', lead };
        if (lead.confirm_expires_at && new Date(lead.confirm_expires_at).getTime() <= Date.now()) {
          return { status: 'expired', lead };
        }
        lead.status = 'confirmed';
        lead.confirmed_at = nowIso;
        lead.confirm_token = null;
        return { status: 'confirmed', lead };
      }
    }
    return { status: 'not_found' };
  },

  async unsubscribeLeadByToken(unsubscribeToken) {
    const nowIso = new Date().toISOString();
    const sb = getSupabase();

    if (sb) {
      const { data: lead, error } = await sb
        .from('leads')
        .update({
          status: 'unsubscribed',
          unsubscribed_at: nowIso,
        })
        .eq('unsubscribe_token', unsubscribeToken)
        .select('*')
        .maybeSingle();
      if (error) throw new Error(`Supabase unsubscribeLead: ${error.message}`);
      if (!lead) return null;

      await sb
        .from('nurturing_emails')
        .update({ status: 'skipped' })
        .eq('lead_id', lead.id)
        .eq('status', 'scheduled');

      return lead;
    }

    for (const lead of memoryStore.leads.values()) {
      if (lead.unsubscribe_token === unsubscribeToken) {
        lead.status = 'unsubscribed';
        lead.unsubscribed_at = nowIso;
        for (const item of memoryStore.nurturingEmails) {
          if (item.lead_id === lead.id && item.status === 'scheduled') {
            item.status = 'skipped';
          }
        }
        return lead;
      }
    }
    return null;
  },

  async getLeadById(leadId) {
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb.from('leads').select('*').eq('id', leadId).maybeSingle();
      if (error) throw new Error(`Supabase getLeadById: ${error.message}`);
      return data;
    }

    for (const lead of memoryStore.leads.values()) {
      if (lead.id === leadId) return lead;
    }
    return null;
  },

  async saveNurturingSequence(leadId, sequenceItems) {
    const sb = getSupabase();
    const rows = sequenceItems.map((item) => ({
      id: crypto.randomUUID(),
      lead_id: leadId,
      step_day: item.stepDay,
      subject: item.subject,
      body_html: item.bodyHtml,
      body_text: item.bodyText,
      scheduled_for: item.scheduledFor,
      qstash_message_id: item.qstashMessageId || null,
      status: 'scheduled',
      created_at: new Date().toISOString(),
    }));

    if (sb) {
      const { data, error } = await sb
        .from('nurturing_emails')
        .upsert(rows, { onConflict: 'lead_id,step_day' })
        .select('*');
      if (error) throw new Error(`Supabase saveNurturingSequence: ${error.message}`);
      return data || [];
    }

    memoryStore.nurturingEmails = memoryStore.nurturingEmails.filter((e) => e.lead_id !== leadId);
    memoryStore.nurturingEmails.push(...rows);
    return rows;
  },

  async updateNurturingMessageId(nurturingId, qstashMessageId) {
    const sb = getSupabase();
    if (sb) {
      await sb
        .from('nurturing_emails')
        .update({ qstash_message_id: qstashMessageId })
        .eq('id', nurturingId);
      return;
    }
    const found = memoryStore.nurturingEmails.find((e) => e.id === nurturingId);
    if (found) found.qstash_message_id = qstashMessageId;
  },

  async getNurturingEmailById(nurturingId) {
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb
        .from('nurturing_emails')
        .select('*')
        .eq('id', nurturingId)
        .maybeSingle();
      if (error) throw new Error(`Supabase getNurturingEmailById: ${error.message}`);
      return data;
    }
    return memoryStore.nurturingEmails.find((e) => e.id === nurturingId) || null;
  },

  async markNurturingEmailStatus(nurturingId, status) {
    const updates = {
      status,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    };
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb
        .from('nurturing_emails')
        .update(updates)
        .eq('id', nurturingId)
        .select('*')
        .maybeSingle();
      if (error) throw new Error(`Supabase markNurturingEmailStatus: ${error.message}`);
      return data;
    }

    const found = memoryStore.nurturingEmails.find((e) => e.id === nurturingId);
    if (found) Object.assign(found, updates);
    return found || null;
  },

  // ---------------------------------------------------------------------------
  // ARTICLES SEO & CONTENU QUOTIDIEN D'ACQUISITION
  // ---------------------------------------------------------------------------
  async listSeoArticles({ limit = 50 } = {}) {
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb
        .from('seo_articles')
        .select('*')
        .eq('published', true)
        .order('published_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(`Supabase listSeoArticles: ${error.message}`);
      return data || [];
    }

    return [...memoryStore.seoArticles]
      .filter((a) => a.published)
      .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
      .slice(0, limit);
  },

  async getSeoArticleBySlug(slug) {
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb
        .from('seo_articles')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .maybeSingle();
      if (error) throw new Error(`Supabase getSeoArticleBySlug: ${error.message}`);
      return data;
    }

    return memoryStore.seoArticles.find((a) => a.slug === slug && a.published) || null;
  },

  async saveDailyGeneratedContent({ generationDate, article, postIdeas, shortVideoScripts }) {
    const sb = getSupabase();
    const nowIso = new Date().toISOString();

    const articleRecord = {
      id: crypto.randomUUID(),
      slug: article.slug,
      title: article.title,
      meta_title: article.metaTitle,
      meta_description: article.metaDescription,
      keywords: article.keywords || [],
      outline: article.outline || [],
      content_markdown: article.contentMarkdown,
      content_html: article.contentHtml,
      faq_items: article.faqItems || [],
      reading_time_minutes: article.readingTimeMinutes || 5,
      published: true,
      published_at: nowIso,
      created_at: nowIso,
    };

    if (sb) {
      const { data: savedArticle, error: artErr } = await sb
        .from('seo_articles')
        .upsert(articleRecord, { onConflict: 'slug' })
        .select('*')
        .single();
      if (artErr) throw new Error(`Supabase save seo_article: ${artErr.message}`);

      const dailyRecord = {
        generation_date: generationDate,
        post_ideas: postIdeas,
        short_video_scripts: shortVideoScripts,
        seo_article_id: savedArticle.id,
        digest_sent_at: nowIso,
        publish_status: 'digest_only',
      };

      const { data: savedDaily, error: dailyErr } = await sb
        .from('daily_contents')
        .upsert(dailyRecord, { onConflict: 'generation_date' })
        .select('*')
        .single();
      if (dailyErr) throw new Error(`Supabase save daily_contents: ${dailyErr.message}`);

      return { article: savedArticle, dailyContent: savedDaily };
    }

    const existingIdx = memoryStore.seoArticles.findIndex((a) => a.slug === articleRecord.slug);
    if (existingIdx >= 0) {
      memoryStore.seoArticles[existingIdx] = articleRecord;
    } else {
      memoryStore.seoArticles.unshift(articleRecord);
    }

    const dailyRecord = {
      id: crypto.randomUUID(),
      generation_date: generationDate,
      post_ideas: postIdeas,
      short_video_scripts: shortVideoScripts,
      seo_article_id: articleRecord.id,
      digest_sent_at: nowIso,
      publish_status: 'digest_only',
      created_at: nowIso,
    };
    memoryStore.dailyContents = memoryStore.dailyContents.filter(
      (d) => d.generation_date !== generationDate
    );
    memoryStore.dailyContents.unshift(dailyRecord);

    return { article: articleRecord, dailyContent: dailyRecord };
  },

  async listDailyContents({ limit = 14 } = {}) {
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb
        .from('daily_contents')
        .select('*, seo_articles(slug, title, meta_description, published_at)')
        .order('generation_date', { ascending: false })
        .limit(limit);
      if (error) throw new Error(`Supabase listDailyContents: ${error.message}`);
      return data || [];
    }

    return memoryStore.dailyContents.slice(0, limit).map((d) => ({
      ...d,
      seo_articles: memoryStore.seoArticles.find((a) => a.id === d.seo_article_id) || null,
    }));
  },

  // ---------------------------------------------------------------------------
  // ANALYTICS & TABLEAU DE STATS
  // ---------------------------------------------------------------------------
  async recordPageVisit({ path, visitorHash, referrer, countryHint }) {
    const record = {
      id: crypto.randomUUID(),
      path,
      visitor_hash: visitorHash,
      referrer: referrer || null,
      country_hint: countryHint || null,
      created_at: new Date().toISOString(),
    };

    const sb = getSupabase();
    if (sb) {
      const { error } = await sb.from('page_visits').insert(record);
      if (error) throw new Error(`Supabase recordPageVisit: ${error.message}`);
      return;
    }

    memoryStore.pageVisits.push(record);
    if (memoryStore.pageVisits.length > 10000) {
      memoryStore.pageVisits.shift();
    }
  },

  async getDashboardStats() {
    const sb = getSupabase();
    if (sb) {
      const [visitsRes, leadsRes, confirmedLeadsRes, paidOrdersRes, b2bRes, articlesRes] =
        await Promise.all([
          sb.from('page_visits').select('visitor_hash', { count: 'exact' }),
          sb.from('leads').select('id', { count: 'exact', head: true }),
          sb.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
          sb.from('orders').select('amount_cents, currency, created_at, product_title').eq('status', 'paid'),
          sb.from('b2b_contacts').select('id', { count: 'exact', head: true }),
          sb.from('seo_articles').select('id', { count: 'exact', head: true }).eq('published', true),
        ]);

      const totalVisits = visitsRes.count || 0;
      const uniqueVisitors = new Set((visitsRes.data || []).map((v) => v.visitor_hash)).size;
      const totalLeads = leadsRes.count || 0;
      const confirmedLeads = confirmedLeadsRes.count || 0;
      const paidOrders = paidOrdersRes.data || [];
      const salesCount = paidOrders.length;

      const revenueEurCents = paidOrders
        .filter((o) => o.currency === 'EUR')
        .reduce((acc, o) => acc + o.amount_cents, 0);
      const revenueUsdCents = paidOrders
        .filter((o) => o.currency === 'USD')
        .reduce((acc, o) => acc + o.amount_cents, 0);

      const baseVisits = Math.max(uniqueVisitors, totalVisits);
      const visitToLeadRate = baseVisits > 0 ? Number(((confirmedLeads / baseVisits) * 100).toFixed(2)) : 0;
      const leadToSaleRate =
        confirmedLeads > 0 ? Number(((salesCount / confirmedLeads) * 100).toFixed(2)) : 0;
      const visitToSaleRate = baseVisits > 0 ? Number(((salesCount / baseVisits) * 100).toFixed(2)) : 0;

      return {
        visits: { total: totalVisits, unique: uniqueVisitors },
        leads: { total: totalLeads, confirmed: confirmedLeads },
        sales: {
          count: salesCount,
          revenueEur: Number((revenueEurCents / 100).toFixed(2)),
          revenueUsd: Number((revenueUsdCents / 100).toFixed(2)),
          recent: paidOrders.slice(-5).reverse(),
        },
        conversion: {
          visitToLeadPct: visitToLeadRate,
          leadToSalePct: leadToSaleRate,
          visitToSalePct: visitToSaleRate,
        },
        catalog: {
          b2bContactsCount: b2bRes.count || 0,
          seoArticlesCount: articlesRes.count || 0,
        },
      };
    }

    const totalVisits = memoryStore.pageVisits.length;
    const uniqueVisitors = new Set(memoryStore.pageVisits.map((v) => v.visitor_hash)).size;
    const allLeads = Array.from(memoryStore.leads.values());
    const totalLeads = allLeads.length;
    const confirmedLeads = allLeads.filter((l) => l.status === 'confirmed').length;
    const paidOrders = memoryStore.orders.filter((o) => o.status === 'paid');
    const salesCount = paidOrders.length;

    const revenueEurCents = paidOrders
      .filter((o) => o.currency === 'EUR')
      .reduce((acc, o) => acc + o.amount_cents, 0);
    const revenueUsdCents = paidOrders
      .filter((o) => o.currency === 'USD')
      .reduce((acc, o) => acc + o.amount_cents, 0);

    const baseVisits = Math.max(uniqueVisitors, totalVisits);
    return {
      visits: { total: totalVisits, unique: uniqueVisitors },
      leads: { total: totalLeads, confirmed: confirmedLeads },
      sales: {
        count: salesCount,
        revenueEur: Number((revenueEurCents / 100).toFixed(2)),
        revenueUsd: Number((revenueUsdCents / 100).toFixed(2)),
        recent: paidOrders.slice(-5).reverse(),
      },
      conversion: {
        visitToLeadPct: baseVisits > 0 ? Number(((confirmedLeads / baseVisits) * 100).toFixed(2)) : 0,
        leadToSalePct:
          confirmedLeads > 0 ? Number(((salesCount / confirmedLeads) * 100).toFixed(2)) : 0,
        visitToSalePct: baseVisits > 0 ? Number(((salesCount / baseVisits) * 100).toFixed(2)) : 0,
      },
      catalog: {
        b2bContactsCount: memoryStore.b2bContacts.size,
        seoArticlesCount: memoryStore.seoArticles.filter((a) => a.published).length,
      },
    };
  },

  // ---------------------------------------------------------------------------
  // ANNUAIRE B2B
  // ---------------------------------------------------------------------------
  async getExistingB2BEmails(emails) {
    if (!emails.length) return new Set();
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb
        .from('b2b_contacts')
        .select('email')
        .in('email', emails);
      if (error) throw new Error(`Supabase getExistingB2BEmails: ${error.message}`);
      return new Set((data || []).map((row) => row.email.toLowerCase()));
    }

    const existing = new Set();
    for (const email of emails) {
      if (memoryStore.b2bContacts.has(email.toLowerCase())) {
        existing.add(email.toLowerCase());
      }
    }
    return existing;
  },

  async insertB2BContacts(contacts) {
    if (!contacts.length) return [];
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb
        .from('b2b_contacts')
        .upsert(contacts, { onConflict: 'email', ignoreDuplicates: true })
        .select('*');
      if (error) throw new Error(`Supabase insertB2BContacts: ${error.message}`);
      return data || [];
    }

    const inserted = [];
    for (const c of contacts) {
      const key = c.email.toLowerCase();
      if (!memoryStore.b2bContacts.has(key)) {
        const row = { id: crypto.randomUUID(), ...c, created_at: new Date().toISOString() };
        memoryStore.b2bContacts.set(key, row);
        inserted.push(row);
      }
    }
    return inserted;
  },

  async listB2BContacts({ limit = 200, sector, country } = {}) {
    const sb = getSupabase();
    if (sb) {
      let query = sb
        .from('b2b_contacts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (sector) query = query.eq('sector', sector);
      if (country) query = query.eq('country', country);
      const { data, error } = await query;
      if (error) throw new Error(`Supabase listB2BContacts: ${error.message}`);
      return data || [];
    }

    return Array.from(memoryStore.b2bContacts.values())
      .filter((c) => (!sector || c.sector === sector) && (!country || c.country === country))
      .slice(0, limit);
  },
};
