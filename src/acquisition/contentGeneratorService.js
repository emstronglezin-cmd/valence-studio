import { env } from '../config/env.js';
import { repository } from '../db/repository.js';
import { groqService } from '../services/groqService.js';
import { emailService } from '../services/emailService.js';
import { defaultPublishAdapter } from './PublishAdapter.js';

export const contentGeneratorService = {
  async runDailyAcquisitionCycle({
    generationDate = new Date().toISOString().split('T')[0],
    publishAdapter = defaultPublishAdapter,
  } = {}) {
    const existingArticles = await repository.listSeoArticles({ limit: 20 });
    const recentSlugs = existingArticles.map((a) => a.slug);

    const generated = await groqService.generateDailyAcquisitionPack({
      generationDate,
      recentSlugs,
    });

    const { article, dailyContent } = await repository.saveDailyGeneratedContent({
      generationDate,
      article: generated.seoArticle,
      postIdeas: generated.postIdeas,
      shortVideoScripts: generated.shortVideoScripts,
    });

    // AUCUNE publication automatique à ce stade : publishAdapter.isEnabled() retourne false.
    // L'architecture PublishAdapter est déjà branchée pour une activation future (ex. TikTok).
    let externalPublication = { enabled: false, results: [] };
    if (publishAdapter && publishAdapter.isEnabled()) {
      const results = [];
      for (const script of generated.shortVideoScripts) {
        results.push(await publishAdapter.publishShortVideo(script));
      }
      externalPublication = {
        enabled: true,
        platform: publishAdapter.getPlatformName(),
        results,
      };
    }

    const articlePublicUrl = `${env.frontendPublicUrl}/blog.html?slug=${encodeURIComponent(article.slug)}`;

    await emailService.sendMorningDigestEmail({
      ownerEmail: env.brevo.ownerDigestEmail,
      generationDate,
      article,
      postIdeas: generated.postIdeas,
      shortVideoScripts: generated.shortVideoScripts,
      articlePublicUrl,
    });

    return {
      generationDate,
      article: {
        id: article.id,
        slug: article.slug,
        title: article.title,
        metaDescription: article.meta_description,
        url: articlePublicUrl,
      },
      postIdeasCount: generated.postIdeas.length,
      shortVideoScriptsCount: generated.shortVideoScripts.length,
      digestSentTo: env.brevo.ownerDigestEmail || '(mode local / OWNER_DIGEST_EMAIL non configuré)',
      autoPublish: externalPublication,
      dailyContentId: dailyContent.id,
    };
  },
};
