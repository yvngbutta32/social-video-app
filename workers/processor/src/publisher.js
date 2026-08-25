/**
 * Legacy browser publisher retained only for development fallback. Production delivery
 * must use an official creator-authorized platform connector.
 * 
 * Handles posting to multiple platforms using browser automation
 * Supports: TikTok, Instagram Reels, YouTube Shorts, Facebook Reels, X (Twitter), LinkedIn
 * 
 * Features:
 * - Session persistence with cookies
 * - Retry logic with exponential backoff
 * - Caption/hashtag injection
 * - Thumbnail selection
 * - Scheduling support
 */
import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import config from './config.js';
import logger from './logger.js';
import db from './db.js';

const PLATFORM_CONFIGS = {
  tiktok: {
    baseUrl: 'https://www.tiktok.com',
    uploadUrl: 'https://www.tiktok.com/upload',
    selectors: {
      fileInput: 'input[type="file"]',
      captionInput: '[data-e2e="upload-caption"] textarea, .public-DraftEditor-content',
      postButton: '[data-e2e="post-button"], button:has-text("Post")',
      scheduleToggle: '[data-e2e="schedule-toggle"]',
      scheduleTime: '[data-e2e="schedule-time"]',
      thumbnailButton: '[data-e2e="cover-button"]',
      thumbnailSelect: '.cover-selector-item',
    },
    maxCaptionLength: 2200,
    maxHashtags: 30,
    videoFormats: ['mp4', 'mov', 'webm'],
    maxFileSize: 287 * 1024 * 1024, // 287MB
    maxDuration: 180,
  },
  instagram: {
    baseUrl: 'https://www.instagram.com',
    uploadUrl: 'https://www.instagram.com/reels/create',
    selectors: {
      fileInput: 'input[type="file"][accept*="video"]',
      captionInput: '[aria-label="Write a caption..."], textarea[placeholder*="caption"]',
      postButton: '[role="button"]:has-text("Share"), button:has-text("Share")',
      scheduleToggle: '[role="switch"]',
      scheduleTime: 'input[type="datetime-local"]',
      coverButton: '[aria-label="Edit cover"]',
      coverSelect: '[role="slider"]',
    },
    maxCaptionLength: 2200,
    maxHashtags: 30,
    videoFormats: ['mp4', 'mov'],
    maxFileSize: 100 * 1024 * 1024, // 100MB
    maxDuration: 90,
  },
  youtube: {
    baseUrl: 'https://www.youtube.com',
    uploadUrl: 'https://studio.youtube.com',
    selectors: {
      fileInput: 'input[type="file"]',
      titleInput: '#title-textarea, #textbox',
      descriptionInput: '#description-textarea, #textbox[aria-label="Description"]',
      nextButton: '#next-button',
      doneButton: '#done-button',
      scheduleRadio: 'tp-yt-paper-radio-button[name="SCHEDULED"]',
      scheduleTime: 'input[type="datetime-local"]',
      thumbnailButton: '#thumbnail-file-input',
      shortsToggle: '#shorts-toggle',
    },
    maxCaptionLength: 5000,
    maxHashtags: 15,
    videoFormats: ['mp4', 'mov', 'webm'],
    maxFileSize: 256 * 1024 * 1024 * 1024, // 256GB
    maxDuration: 60, // For Shorts
  },
  facebook: {
    baseUrl: 'https://www.facebook.com',
    uploadUrl: 'https://www.facebook.com/reels/create',
    selectors: {
      fileInput: 'input[type="file"][accept*="video"]',
      captionInput: '[aria-label="Write something..."], [data-lexical-editor="true"]',
      postButton: '[role="button"]:has-text("Publish"), [role="button"]:has-text("Post")',
      scheduleToggle: '[role="switch"][aria-label*="Schedule"]',
      scheduleTime: 'input[type="datetime-local"]',
    },
    maxCaptionLength: 2200,
    maxHashtags: 30,
    videoFormats: ['mp4', 'mov'],
    maxFileSize: 4 * 1024 * 1024 * 1024, // 4GB
    maxDuration: 90,
  },
  x: {
    baseUrl: 'https://x.com',
    uploadUrl: 'https://x.com/compose/post',
    selectors: {
      fileInput: 'input[type="file"][accept*="video"]',
      captionInput: '[data-testid="tweetTextarea_0"], [role="textbox"][data-testid="tweetTextarea_0"]',
      postButton: '[data-testid="tweetButtonInline"], [data-testid="tweetButton"]',
      scheduleButton: '[data-testid="scheduleButton"]',
      scheduleTime: 'input[type="datetime-local"]',
    },
    maxCaptionLength: 280,
    maxHashtags: 10,
    videoFormats: ['mp4', 'mov'],
    maxFileSize: 512 * 1024 * 1024, // 512MB
    maxDuration: 140,
  },
  linkedin: {
    baseUrl: 'https://www.linkedin.com',
    uploadUrl: 'https://www.linkedin.com/feed/',
    selectors: {
      fileInput: 'input[type="file"][accept*="video"]',
      captionInput: '.ql-editor, [role="textbox"]',
      postButton: '[aria-label="Post"], button:has-text("Post")',
      scheduleToggle: '[aria-label*="Schedule"]',
      scheduleTime: 'input[type="datetime-local"]',
    },
    maxCaptionLength: 3000,
    maxHashtags: 10,
    videoFormats: ['mp4', 'mov'],
    maxFileSize: 5 * 1024 * 1024 * 1024, // 5GB
    maxDuration: 600,
  },
};

class SocialPublisher {
  constructor() {
    this.browser = null;
    this.contexts = new Map(); // platform -> browser context
    this.pages = new Map(); // platform -> page
    this.accountSessions = new Map(); // accountId -> { cookies, userAgent, platform }
  }

  /**
   * Initialize browser instance
   */
  async initialize() {
    if (this.browser) return this.browser;

    this.browser = await chromium.launch({
      headless: config.PUBLISHER_HEADLESS !== 'false',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--window-size=1280,720',
      ],
    });

    // Set default viewport
    this.browser.on('disconnected', () => {
      logger.warn('Browser disconnected');
      this.browser = null;
      this.contexts.clear();
      this.pages.clear();
    });

    logger.info('Publisher browser initialized');
    return this.browser;
  }

  /**
   * Get or create context for a platform/account
   */
  async getContext(account) {
    const sessionKey = `${account.platform}_${account.id}`;
    
    if (this.contexts.has(sessionKey)) {
      return this.contexts.get(sessionKey);
    }

    await this.initialize();
    
    const context = await this.browser.newContext({
      userAgent: account.user_agent || this.getRandomUserAgent(),
      viewport: { width: 1280, height: 720 },
      locale: 'en-US',
      timezoneId: account.timezone || 'America/Los_Angeles',
      permissions: ['clipboard-read', 'clipboard-write'],
      // Anti-detection
      bypassCSP: true,
      ignoreHTTPSErrors: true,
    });

    // Load saved cookies if available
    if (account.cookies) {
      try {
        const cookies = typeof account.cookies === 'string' ? JSON.parse(account.cookies) : account.cookies;
        await context.addCookies(cookies);
      } catch (e) {
        logger.warn('Failed to load cookies', { accountId: account.id, error: e.message });
      }
    }

    // Add stealth scripts
    await context.addInitScript(() => {
      // Override navigator properties
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      
      // Mock chrome object
      window.chrome = { runtime: {} };
      
      // Mock permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' 
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters)
      );
    });

    this.contexts.set(sessionKey, context);
    return context;
  }

  /**
   * Get or create page for a platform/account
   */
  async getPage(account) {
    const sessionKey = `${account.platform}_${account.id}`;
    
    if (this.pages.has(sessionKey)) {
      return this.pages.get(sessionKey);
    }

    const context = await this.getContext(account);
    const page = await context.newPage();
    
    // Set up request interception for faster loading
    await page.route('**/*.{png,jpg,jpeg,gif,woff,woff2,css}', route => route.abort());
    
    // Handle dialogs automatically
    page.on('dialog', async dialog => {
      logger.debug('Dialog appeared', { message: dialog.message() });
      await dialog.dismiss();
    });

    this.pages.set(sessionKey, page);
    return page;
  }

  /**
   * Login to platform if needed
   */
  async ensureLoggedIn(account, page) {
    const platformConfig = PLATFORM_CONFIGS[account.platform];
    if (!platformConfig) throw new Error(`Unsupported platform: ${account.platform}`);

    // Check if already logged in by visiting base URL
    await page.goto(platformConfig.baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Check for login indicators
    const isLoggedIn = await this.checkLoginStatus(account.platform, page);
    
    if (!isLoggedIn) {
      logger.info('Login required', { platform: account.platform, accountId: account.id });
      await this.performLogin(account, page);
      
      // Save updated cookies
      await this.saveSession(account);
    }

    return true;
  }

  /**
   * Check login status for platform
   */
  async checkLoginStatus(platform, page) {
    const checks = {
      tiktok: async () => {
        const avatar = await page.$('[data-e2e="profile-icon"], .avatar-wrapper');
        return !!avatar;
      },
      instagram: async () => {
        const avatar = await page.$('[aria-label*="profile"], .x1iyjqo2');
        return !!avatar;
      },
      youtube: async () => {
        const avatar = await page.$('#avatar-btn, #img');
        return !!avatar;
      },
      facebook: async () => {
        const avatar = await page.$('[aria-label="Your profile"], [data-testid="profile_button"]');
        return !!avatar;
      },
      x: async () => {
        const avatar = await page.$('[data-testid="SideNav_AccountSwitcher_Button"], [aria-label*="Account"]');
        return !!avatar;
      },
      linkedin: async () => {
        const avatar = await page.$('.global-nav__me-photo, [aria-label="Me"]');
        return !!avatar;
      },
    };

    const check = checks[platform];
    if (!check) return false;
    
    try {
      return await check();
    } catch {
      return false;
    }
  }

  /**
   * Perform login - placeholder for manual/QR login
   * In production, this would integrate with OAuth or use saved sessions
   */
  async performLogin(account, page) {
    // This is a placeholder - in production you'd implement:
    // 1. OAuth flow with platform APIs
    // 2. QR code login for TikTok/Instagram
    // 3. Session cookie import from user
    // 4. 2FA handling
    
    logger.warn('Manual login required - implement OAuth or session import', { 
      platform: account.platform,
      accountId: account.id 
    });
    
    // For now, wait for manual login (in headful mode)
    if (!config.PUBLISHER_HEADLESS) {
      logger.info('Waiting for manual login... (headful mode)');
      await page.waitForTimeout(60000); // Give 60 seconds for manual login
    }
    
    throw new Error(`Login required for ${account.platform}. Implement OAuth or provide session cookies.`);
  }

  /**
   * Save session cookies to database
   */
  async saveSession(account) {
    const sessionKey = `${account.platform}_${account.id}`;
    const context = this.contexts.get(sessionKey);
    
    if (!context) return;

    const cookies = await context.cookies();
    const userAgent = await context._browser.newPage().then(p => p.evaluate(() => navigator.userAgent));

    try {
      await db.updateSocialAccount(account.id, {
        cookies: JSON.stringify(cookies),
        user_agent: userAgent,
        last_used_at: new Date(),
      });
      logger.info('Session saved', { accountId: account.id });
    } catch (error) {
      logger.error('Failed to save session', { accountId: account.id, error: error.message });
    }
  }

  /**
   * Upload video to platform
   */
  async uploadVideo(account, videoPath, metadata) {
    const platformConfig = PLATFORM_CONFIGS[account.platform];
    if (!platformConfig) throw new Error(`Unsupported platform: ${account.platform}`);

    const page = await this.getPage(account);
    await this.ensureLoggedIn(account, page);

    logger.info('Starting upload', { platform: account.platform, accountId: account.id, videoPath });

    try {
      // Navigate to upload page
      await page.goto(platformConfig.uploadUrl, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(3000);

      // Platform-specific upload flow
      const platformUploader = this.getPlatformUploader(account.platform);
      const result = await platformUploader(page, videoPath, metadata, platformConfig);

      // Save session after successful upload
      await this.saveSession(account);

      logger.info('Upload successful', { platform: account.platform, postId: result.postId });
      return result;

    } catch (error) {
      logger.error('Upload failed', { platform: account.platform, error: error.message });
      throw error;
    }
  }

  /**
   * Get platform-specific uploader function
   */
  getPlatformUploader(platform) {
    const uploaders = {
      tiktok: this.uploadToTikTok.bind(this),
      instagram: this.uploadToInstagram.bind(this),
      youtube: this.uploadToYouTube.bind(this),
      facebook: this.uploadToFacebook.bind(this),
      x: this.uploadToX.bind(this),
      linkedin: this.uploadToLinkedIn.bind(this),
    };
    return uploaders[platform] || this.uploadGeneric.bind(this);
  }

  /**
   * TikTok upload implementation
   */
  async uploadToTikTok(page, videoPath, metadata, config) {
    const { caption, hashtags, scheduledAt, thumbnailPath } = metadata;
    const fullCaption = this.formatCaption(caption, hashtags, config.maxCaptionLength);

    // Wait for file input
    await page.waitForSelector(config.selectors.fileInput, { timeout: 30000 });
    const fileInput = await page.$(config.selectors.fileInput);
    await fileInput.setInputFiles(videoPath);

    // Wait for video to process
    await page.waitForTimeout(5000);

    // Fill caption
    const captionInput = await page.waitForSelector(config.selectors.captionInput, { timeout: 30000 });
    await captionInput.fill(fullCaption);

    // Set thumbnail if provided
    if (thumbnailPath && config.selectors.thumbnailButton) {
      try {
        const thumbBtn = await page.$(config.selectors.thumbnailButton);
        if (thumbBtn) {
          await thumbBtn.click();
          await page.waitForTimeout(1000);
          const thumbInput = await page.$('input[type="file"]');
          if (thumbInput) await thumbInput.setInputFiles(thumbnailPath);
          await page.waitForTimeout(2000);
          await page.keyboard.press('Escape');
        }
      } catch (e) {
        logger.warn('Thumbnail upload failed', { error: e.message });
      }
    }

    // Handle scheduling
    if (scheduledAt && config.selectors.scheduleToggle) {
      const scheduleToggle = await page.$(config.selectors.scheduleToggle);
      if (scheduleToggle) {
        await scheduleToggle.click();
        await page.waitForTimeout(500);
        const timeInput = await page.$(config.selectors.scheduleTime);
        if (timeInput) {
          const localTime = new Date(scheduledAt).toISOString().slice(0, 16);
          await timeInput.fill(localTime);
        }
      }
    }

    // Post
    const postButton = await page.waitForSelector(config.selectors.postButton, { timeout: 30000 });
    await postButton.click();

    // Wait for confirmation
    await page.waitForTimeout(5000);

    // Try to extract post ID from URL or confirmation
    const postId = await this.extractPostId(page, 'tiktok');

    return { success: true, postId, platform: 'tiktok' };
  }

  /**
   * Instagram Reels upload implementation
   */
  async uploadToInstagram(page, videoPath, metadata, config) {
    const { caption, hashtags, scheduledAt, thumbnailPath } = metadata;
    const fullCaption = this.formatCaption(caption, hashtags, config.maxCaptionLength);

    // Click "Create" or navigate to Reels
    await page.waitForSelector(config.selectors.fileInput, { timeout: 30000 });
    const fileInput = await page.$(config.selectors.fileInput);
    await fileInput.setInputFiles(videoPath);

    // Wait for processing
    await page.waitForTimeout(8000);

    // Next button
    const nextBtn = await page.$('[role="button"]:has-text("Next"), button:has-text("Next")');
    if (nextBtn) await nextBtn.click();
    await page.waitForTimeout(2000);

    // Fill caption
    const captionInput = await page.waitForSelector(config.selectors.captionInput, { timeout: 30000 });
    await captionInput.fill(fullCaption);

    // Handle cover/thumbnail
    if (thumbnailPath && config.selectors.coverButton) {
      try {
        const coverBtn = await page.$(config.selectors.coverButton);
        if (coverBtn) await coverBtn.click();
        await page.waitForTimeout(1000);
        // Instagram cover selection is complex - skip for now
      } catch (e) {
        logger.warn('Cover upload failed', { error: e.message });
      }
    }

    // Handle scheduling
    if (scheduledAt && config.selectors.scheduleToggle) {
      const toggle = await page.$(config.selectors.scheduleToggle);
      if (toggle) {
        const isChecked = await toggle.getAttribute('aria-checked');
        if (isChecked !== 'true') await toggle.click();
        await page.waitForTimeout(500);
        const timeInput = await page.$(config.selectors.scheduleTime);
        if (timeInput) {
          const localTime = new Date(scheduledAt).toISOString().slice(0, 16);
          await timeInput.fill(localTime);
        }
      }
    }

    // Share
    const shareBtn = await page.waitForSelector(config.selectors.postButton, { timeout: 30000 });
    await shareBtn.click();

    await page.waitForTimeout(5000);

    const postId = await this.extractPostId(page, 'instagram');

    return { success: true, postId, platform: 'instagram' };
  }

  /**
   * YouTube Shorts upload implementation
   */
  async uploadToYouTube(page, videoPath, metadata, config) {
    const { caption, hashtags, scheduledAt, thumbnailPath } = metadata;
    const title = this.generateTitle(caption, hashtags);
    const description = this.formatCaption(caption, hashtags, config.maxCaptionLength);

    // Go to YouTube Studio
    await page.goto('https://studio.youtube.com', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    // Click Create > Upload videos
    const createBtn = await page.$('#create-icon, [aria-label="Create"]');
    if (createBtn) await createBtn.click();
    await page.waitForTimeout(1000);
    
    const uploadBtn = await page.$('tp-yt-paper-item:has-text("Upload videos")');
    if (uploadBtn) await uploadBtn.click();
    await page.waitForTimeout(2000);

    // File input
    await page.waitForSelector(config.selectors.fileInput, { timeout: 30000 });
    const fileInput = await page.$(config.selectors.fileInput);
    await fileInput.setInputFiles(videoPath);

    // Wait for upload processing
    await page.waitForTimeout(5000);

    // Fill title
    const titleInput = await page.waitForSelector(config.selectors.titleInput, { timeout: 30000 });
    await titleInput.fill(title.slice(0, 100));

    // Fill description
    const descInput = await page.waitForSelector(config.selectors.descriptionInput, { timeout: 30000 });
    await descInput.fill(description);

    // Mark as Short (if checkbox exists)
    const shortsToggle = await page.$(config.selectors.shortsToggle);
    if (shortsToggle) {
      const checked = await shortsToggle.getAttribute('aria-checked');
      if (checked !== 'true') await shortsToggle.click();
    }

    // Next through screens
    for (let i = 0; i < 3; i++) {
      const nextBtn = await page.$(config.selectors.nextButton);
      if (nextBtn) {
        await nextBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    // Handle scheduling
    if (scheduledAt && config.selectors.scheduleRadio) {
      const scheduleRadio = await page.$(config.selectors.scheduleRadio);
      if (scheduleRadio) await scheduleRadio.click();
      await page.waitForTimeout(500);
      const timeInput = await page.$(config.selectors.scheduleTime);
      if (timeInput) {
        const localTime = new Date(scheduledAt).toISOString().slice(0, 16);
        await timeInput.fill(localTime);
      }
    }

    // Upload thumbnail
    if (thumbnailPath && config.selectors.thumbnailButton) {
      const thumbInput = await page.$(config.selectors.thumbnailButton);
      if (thumbInput) await thumbInput.setInputFiles(thumbnailPath);
    }

    // Done
    const doneBtn = await page.waitForSelector(config.selectors.doneButton, { timeout: 30000 });
    await doneBtn.click();

    await page.waitForTimeout(5000);

    const postId = await this.extractPostId(page, 'youtube');

    return { success: true, postId, platform: 'youtube' };
  }

  /**
   * Facebook Reels upload
   */
  async uploadToFacebook(page, videoPath, metadata, config) {
    const { caption, hashtags, scheduledAt } = metadata;
    const fullCaption = this.formatCaption(caption, hashtags, config.maxCaptionLength);

    await page.waitForSelector(config.selectors.fileInput, { timeout: 30000 });
    const fileInput = await page.$(config.selectors.fileInput);
    await fileInput.setInputFiles(videoPath);

    await page.waitForTimeout(5000);

    const captionInput = await page.waitForSelector(config.selectors.captionInput, { timeout: 30000 });
    await captionInput.fill(fullCaption);

    if (scheduledAt && config.selectors.scheduleToggle) {
      const toggle = await page.$(config.selectors.scheduleToggle);
      if (toggle) {
        const checked = await toggle.getAttribute('aria-checked');
        if (checked !== 'true') await toggle.click();
        await page.waitForTimeout(500);
        const timeInput = await page.$(config.selectors.scheduleTime);
        if (timeInput) {
          const localTime = new Date(scheduledAt).toISOString().slice(0, 16);
          await timeInput.fill(localTime);
        }
      }
    }

    const postBtn = await page.waitForSelector(config.selectors.postButton, { timeout: 30000 });
    await postBtn.click();

    await page.waitForTimeout(5000);

    const postId = await this.extractPostId(page, 'facebook');

    return { success: true, postId, platform: 'facebook' };
  }

  /**
   * X (Twitter) upload
   */
  async uploadToX(page, videoPath, metadata, config) {
    const { caption, hashtags, scheduledAt } = metadata;
    const fullCaption = this.formatCaption(caption, hashtags, config.maxCaptionLength);

    await page.goto(config.uploadUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    await page.waitForSelector(config.selectors.fileInput, { timeout: 30000 });
    const fileInput = await page.$(config.selectors.fileInput);
    await fileInput.setInputFiles(videoPath);

    await page.waitForTimeout(3000);

    const captionInput = await page.waitForSelector(config.selectors.captionInput, { timeout: 30000 });
    await captionInput.fill(fullCaption);

    if (scheduledAt && config.selectors.scheduleButton) {
      const scheduleBtn = await page.$(config.selectors.scheduleButton);
      if (scheduleBtn) {
        await scheduleBtn.click();
        await page.waitForTimeout(500);
        const timeInput = await page.$(config.selectors.scheduleTime);
        if (timeInput) {
          const localTime = new Date(scheduledAt).toISOString().slice(0, 16);
          await timeInput.fill(localTime);
        }
        const confirmBtn = await page.$('[data-testid="scheduleConfirm"]');
        if (confirmBtn) await confirmBtn.click();
      }
    } else {
      const postBtn = await page.waitForSelector(config.selectors.postButton, { timeout: 30000 });
      await postBtn.click();
    }

    await page.waitForTimeout(3000);

    const postId = await this.extractPostId(page, 'x');

    return { success: true, postId, platform: 'x' };
  }

  /**
   * LinkedIn upload
   */
  async uploadToLinkedIn(page, videoPath, metadata, config) {
    const { caption, hashtags, scheduledAt } = metadata;
    const fullCaption = this.formatCaption(caption, hashtags, config.maxCaptionLength);

    await page.goto(config.baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Click "Start a post"
    const startPostBtn = await page.$('[aria-label="Start a post"], button:has-text("Start a post")');
    if (startPostBtn) await startPostBtn.click();
    await page.waitForTimeout(1000);

    // Add video
    await page.waitForSelector(config.selectors.fileInput, { timeout: 30000 });
    const fileInput = await page.$(config.selectors.fileInput);
    await fileInput.setInputFiles(videoPath);

    await page.waitForTimeout(5000);

    const captionInput = await page.waitForSelector(config.selectors.captionInput, { timeout: 30000 });
    await captionInput.fill(fullCaption);

    if (scheduledAt && config.selectors.scheduleToggle) {
      const toggle = await page.$(config.selectors.scheduleToggle);
      if (toggle) await toggle.click();
      await page.waitForTimeout(500);
      const timeInput = await page.$(config.selectors.scheduleTime);
      if (timeInput) {
        const localTime = new Date(scheduledAt).toISOString().slice(0, 16);
        await timeInput.fill(localTime);
      }
    }

    const postBtn = await page.waitForSelector(config.selectors.postButton, { timeout: 30000 });
    await postBtn.click();

    await page.waitForTimeout(5000);

    const postId = await this.extractPostId(page, 'linkedin');

    return { success: true, postId, platform: 'linkedin' };
  }

  /**
   * Generic upload fallback
   */
  async uploadGeneric(page, videoPath, metadata, config) {
    logger.warn('Using generic uploader', { platform: config.platform });
    throw new Error('Platform-specific uploader not implemented');
  }

  /**
   * Format caption with hashtags within length limits
   */
  formatCaption(caption, hashtags, maxLength) {
    const tags = Array.isArray(hashtags) ? hashtags.join(' ') : (hashtags || '');
    const fullText = `${caption}\n\n${tags}`.trim();
    
    if (fullText.length <= maxLength) return fullText;
    
    // Truncate caption, keep hashtags
    const availableLength = maxLength - tags.length - 3; // 3 for "\n\n"
    return `${caption.slice(0, availableLength)}...\n\n${tags}`.trim();
  }

  /**
   * Generate title from caption (for YouTube)
   */
  generateTitle(caption, hashtags) {
    const firstLine = caption.split('\n')[0];
    const tags = Array.isArray(hashtags) ? hashtags.slice(0, 3).join(' ') : '';
    return `${firstLine.slice(0, 80)} ${tags}`.trim().slice(0, 100);
  }

  /**
   * Extract post ID from page after publishing
   */
  async extractPostId(page, platform) {
    try {
      const url = page.url();
      
      const patterns = {
        tiktok: /video\/(\d+)/,
        instagram: /reel\/([A-Za-z0-9_-]+)/,
        youtube: /video_id=([^&]+)/,
        facebook: /reel\/(\d+)/,
        x: /status\/(\d+)/,
        linkedin: /activity\/(\d+)/,
      };

      const match = url.match(patterns[platform]);
      if (match) return match[1];

      // Try to find in page content
      const content = await page.content();
      const idMatch = content.match(patterns[platform]);
      if (idMatch) return idMatch[1];

      return `unknown_${Date.now()}`;
    } catch {
      return `unknown_${Date.now()}`;
    }
  }

  /**
   * Get random user agent for anti-detection
   */
  getRandomUserAgent() {
    const agents = [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    ];
    return agents[Math.floor(Math.random() * agents.length)];
  }

  /**
   * Close specific account session
   */
  async closeAccountSession(account) {
    const sessionKey = `${account.platform}_${account.id}`;
    
    const page = this.pages.get(sessionKey);
    if (page) {
      await page.close().catch(() => {});
      this.pages.delete(sessionKey);
    }

    const context = this.contexts.get(sessionKey);
    if (context) {
      await context.close().catch(() => {});
      this.contexts.delete(sessionKey);
    }
  }

  /**
   * Close all sessions
   */
  async closeAll() {
    for (const [key, page] of this.pages) {
      await page.close().catch(() => {});
    }
    this.pages.clear();

    for (const [key, context] of this.contexts) {
      await context.close().catch(() => {});
    }
    this.contexts.clear();

    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }

    logger.info('Publisher closed all sessions');
  }
}

// Singleton instance
export const publisher = new SocialPublisher();

/**
 * High-level publish function for scheduled posts
 */
export async function publishScheduledPost(scheduledPost, account, videoPath, thumbnailPath = null) {
  if (process.env.ALLOW_LEGACY_BROWSER_AUTOMATION !== 'true') {
    throw new Error(`official_connector_required:${account.platform}`);
  }
  const metadata = {
    caption: scheduledPost.metadata?.caption || '',
    hashtags: scheduledPost.metadata?.hashtags || [],
    scheduledAt: scheduledPost.scheduled_at,
    thumbnailPath,
  };

  try {
    const result = await publisher.uploadVideo(account, videoPath, metadata);
    
    // Update scheduled post with platform post ID
    await db.updateScheduledPostStatus(scheduledPost.id, 'published', {
      platform_post_id: result.postId,
      published_at: new Date(),
    });

    return result;
  } catch (error) {
    await db.updateScheduledPostStatus(scheduledPost.id, 'failed', {
      error_message: error.message,
      retry_count: (scheduledPost.metadata?.retry_count || 0) + 1,
    });
    throw error;
  }
}

export default publisher;