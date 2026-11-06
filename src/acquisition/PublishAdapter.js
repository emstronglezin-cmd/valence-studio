/**
 * Interface abstraite de publication sociale externe.
 * Conformément au cahier des charges, AUCUNE publication automatique n'est active à ce stade :
 * le système utilise NoopPublishAdapter par défaut et se limite au stockage en base + digest email.
 * Pour brancher TikTok Content Posting API plus tard, implémentez les méthodes ci-dessous.
 */
export class PublishAdapter {
  constructor() {
    if (new.target === PublishAdapter) {
      throw new Error('PublishAdapter est une interface abstraite.');
    }
  }

  /**
   * @returns {string} Nom du réseau cible ('noop', 'tiktok', 'instagram_reels', 'linkedin')
   */
  getPlatformName() {
    throw new Error('getPlatformName() doit être implémenté.');
  }

  /**
   * @returns {boolean} Indique si la publication automatique est autorisée
   */
  isEnabled() {
    return false;
  }

  /**
   * @param {{ hook3s: string, body: string, cta: string, videoAssetUrl?: string }} _scriptPayload
   * @returns {Promise<{ published: boolean, externalId: string | null, reason?: string }>}
   */
  async publishShortVideo(_scriptPayload) {
    throw new Error('publishShortVideo() doit être implémenté.');
  }

  /**
   * @param {{ channel: string, hook: string, body: string, cta: string }} _postPayload
   * @returns {Promise<{ published: boolean, externalId: string | null, reason?: string }>}
   */
  async publishPost(_postPayload) {
    throw new Error('publishPost() doit être implémenté.');
  }
}

/**
 * Adaptateur inerte actif par défaut : garantit zéro publication automatique sur les réseaux.
 */
export class NoopPublishAdapter extends PublishAdapter {
  getPlatformName() {
    return 'noop';
  }

  isEnabled() {
    return false;
  }

  async publishShortVideo() {
    return {
      published: false,
      externalId: null,
      reason: 'auto_publish_disabled_by_design',
    };
  }

  async publishPost() {
    return {
      published: false,
      externalId: null,
      reason: 'auto_publish_disabled_by_design',
    };
  }
}

/**
 * Point d'extension prêt à recevoir l'intégration TikTok Content Posting API v2
 * (https://open.tiktokapis.com/v2/post/publish/video/init/) lorsque vous souhaiterez l'activer.
 */
export class TikTokPublishAdapter extends PublishAdapter {
  constructor({ accessToken = '' } = {}) {
    super();
    this.accessToken = accessToken;
  }

  getPlatformName() {
    return 'tiktok';
  }

  isEnabled() {
    return false;
  }

  async publishShortVideo() {
    return {
      published: false,
      externalId: null,
      reason: 'tiktok_adapter_not_enabled',
    };
  }

  async publishPost() {
    return {
      published: false,
      externalId: null,
      reason: 'tiktok_adapter_not_enabled',
    };
  }
}

export const defaultPublishAdapter = new NoopPublishAdapter();
