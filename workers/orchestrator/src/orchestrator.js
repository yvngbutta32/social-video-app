/**
 * Campaign Orchestrator - Core Engine
 * 
 * Takes 1 video and creates an optimal multi-platform campaign:
 * 1. Analyzes video content & niche
 * 2. Generates platform-specific variants (hooks, captions, aspect ratios)
 * 3. Predicts viral potential per variant
 * 4. Schedules at optimal times per platform/account
 * 5. Sets up A/B tests for hooks/thumbnails
 * 6. Queues for processing & publishing
 * 7. Tracks real-time metrics
 */
import config from './config.js';
import logger from './logger.js';
import db from './db.js';
import { publishToQueue } from './queue.js';
import { viralPredictorClient } from './clients/intelligence.js';
import { processorClient } from './clients/processor.js';

const PLATFORM_SPECS = {
  tiktok: { aspectRatio: '9:16', maxDuration: 180, optimalDuration: '15-60s', format: 'mp4' },
  instagram: { aspectRatio: '9:16', maxDuration: 90, optimalDuration: '15-30s', format: 'mp4' },
  youtube: { aspectRatio: '9:16', maxDuration: 60, optimalDuration: '15-60s', format: 'mp4' },
  facebook: { aspectRatio: '9:16', maxDuration: 90, optimalDuration: '15-30s', format: 'mp4' },
  x: { aspectRatio: '9:16', maxDuration: 140, optimalDuration: '15-60s', format: 'mp4' },
  linkedin: { aspectRatio: '9:16', maxDuration: 600, optimalDuration: '30-90s', format: 'mp4' },
};

const HOOK_TEMPLATES = {
  curiosity: [
    "You won't believe what happens when...",
    "The secret to {topic} that nobody tells you...",
    "Why {common_belief} is actually wrong...",
    "I tested {trending_thing} so you don't have to...",
  ],
  authority: [
    "As a {credential}, here's what you need to know about {topic}...",
    "After {years} years in {industry}, this is the #1 mistake...",
    "My {dollar_amount} mistake so you don't make it...",
    "The {topic} framework that {result}...",
  ],
  story: [
    "I used to struggle with {problem} until...",
    "The day everything changed for my {topic}...",
    "From {bad_state} to {good_state} in {timeframe}...",
    "Nobody believed I could {achievement}...",
  ],
  value: [
    "Save {time/money} with this {topic} hack...",
    "Free {resource} that {benefit}...",
    "Stop wasting time on {bad_approach}, do this instead...",
    "The only {topic} guide you'll ever need...",
  ],
  controversial: [
    "Unpopular opinion: {controversial_take}...",
    "Everyone's doing {common_approach} but it's wrong because...",
    "Why {popular_tool/method} is overrated...",
    "The truth about {topic} they don't want you to know...",
  ],
};

/**
 * Main orchestrator class
 */
export class CampaignOrchestrator {
  constructor() {
    this.activeCampaigns = new Map();
  }

  /**
   * Create and execute a viral boost campaign
   */
  async createCampaign(input) {
    const {
      workspaceId,
      videoId,
      name,
      platforms = config.DEFAULT_PLATFORMS.split(','),
      niche,
      goal = 'viral_reach', // viral_reach, engagement, followers, traffic
      budget,
      abTestEnabled = config.ENABLE_AB_TESTING,
      customHooks = [],
      scheduleStrategy = 'optimal', // optimal, immediate, spread
    } = input;

    logger.info('Creating viral boost campaign', { workspaceId, videoId, name, platforms });

    // 1. Create campaign record
    const campaign = await db.createCampaign({
      workspaceId,
      videoId,
      name: name || `Viral Boost - ${new Date().toLocaleDateString()}`,
      platforms,
      status: 'processing',
      settings: { niche, goal, budget, scheduleStrategy, customHooks },
      abTestEnabled,
    });

    this.activeCampaigns.set(campaign.id, { ...campaign, startTime: Date.now() });

    try {
      // 2. Get video details
      const video = await this.getVideoDetails(videoId);
      if (!video) throw new Error(`Video ${videoId} not found`);

      // 3. Generate platform-specific variants
      const variants = await this.generateVariants(campaign, video, niche, customHooks);
      
      // 4. Get viral predictions for each variant
      const predictions = await this.predictViralPotential(campaign, variants, video);
      
      // 5. Select best variants per platform
      const selectedVariants = this.selectBestVariants(variants, predictions);
      
      // 6. Get social accounts for platforms
      const accounts = await db.getActiveSocialAccounts(workspaceId, platforms);
      
      // 7. Calculate optimal posting schedule
      const schedule = await this.calculateSchedule(selectedVariants, accounts, scheduleStrategy);
      
      // 8. Create A/B tests if enabled
      let abTest = null;
      if (abTestEnabled && selectedVariants.length >= 2) {
        abTest = await this.setupABTest(campaign, selectedVariants, niche);
      }
      
      // 9. Create scheduled posts
      const scheduledPosts = await this.createScheduledPosts(
        campaign, 
        selectedVariants, 
        accounts, 
        schedule, 
        abTest
      );
      
      // 10. Queue for processing (FFmpeg variants)
      await this.queueForProcessing(campaign, selectedVariants);
      
      // 11. Queue for publishing
      await this.queueForPublishing(scheduledPosts);
      
      // 12. Update campaign status
      await db.updateCampaignStatus(campaign.id, 'active', {
        variant_count: selectedVariants.length,
        scheduled_post_count: scheduledPosts.length,
        ab_test_id: abTest?.id,
      });

      logger.info('Campaign created successfully', { 
        campaignId: campaign.id, 
        variants: selectedVariants.length,
        posts: scheduledPosts.length,
        abTest: abTest?.id,
      });

      return {
        campaign,
        variants: selectedVariants,
        predictions,
        scheduledPosts,
        abTest,
      };

    } catch (error) {
      logger.error('Campaign creation failed', { campaignId: campaign.id, error: error.message });
      await db.updateCampaignStatus(campaign.id, 'failed', { error_message: error.message });
      throw error;
    } finally {
      this.activeCampaigns.delete(campaign.id);
    }
  }

  /**
   * Generate platform-specific variants with hooks
   */
  async generateVariants(campaign, video, niche, customHooks) {
    const platforms = campaign.platforms;
    const settings = campaign.settings;
    const variants = [];

    for (const platform of platforms) {
      const spec = PLATFORM_SPECS[platform];
      const platformHooks = await this.generateHooksForPlatform(platform, niche, video, customHooks);
      
      // Create multiple variants per platform (different hooks)
      const maxVariants = Math.min(config.MAX_VARIANTS_PER_PLATFORM, platformHooks.length);
      
      for (let i = 0; i < maxVariants; i++) {
        const hook = platformHooks[i];
        const variant = {
          campaignId: campaign.id,
          platform,
          variantType: `hook_${hook.type}_${i + 1}`,
          aspectRatio: spec.aspectRatio,
          hookId: hook.id,
          hookText: hook.text,
          caption: this.generateCaption(hook.text, platform, niche, video),
          hashtags: this.generateHashtags(platform, niche, video),
        };
        variants.push(variant);
      }
    }

    // Save variants to DB
    const savedVariants = await db.createCampaignVariants(campaign.id, variants);
    logger.info('Generated campaign variants', { campaignId: campaign.id, count: savedVariants.length });
    
    return savedVariants;
  }

  /**
   * Generate hooks optimized for each platform
   */
  async generateHooksForPlatform(platform, niche, video, customHooks) {
    const hooks = [];
    
    // Add custom hooks first
    for (const customHook of customHooks) {
      hooks.push({
        id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: customHook,
        type: 'custom',
        source: 'user',
      });
    }

    // Generate platform-specific hooks using templates
    const platformStyles = this.getPlatformHookStyles(platform);
    
    for (const style of platformStyles) {
      const templates = HOOK_TEMPLATES[style] || HOOK_TEMPLATES.curiosity;
      for (const template of templates.slice(0, 2)) {
        const hookText = this.fillHookTemplate(template, niche, platform);
        hooks.push({
          id: `generated_${style}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          text: hookText,
          type: style,
          source: 'ai_template',
        });
      }
    }

    // TODO: Call intelligence worker for AI-generated hooks
    // const aiHooks = await intelligenceClient.generateHooks({ niche, platform, videoContext: video });
    
    return hooks.slice(0, config.MAX_VARIANTS_PER_PLATFORM);
  }

  /**
   * Get platform-preferred hook styles
   */
  getPlatformHookStyles(platform) {
    const styles = {
      tiktok: ['curiosity', 'story', 'controversial'],
      instagram: ['value', 'curiosity', 'authority'],
      youtube: ['authority', 'value', 'story'],
      facebook: ['story', 'value', 'curiosity'],
      x: ['controversial', 'authority', 'curiosity'],
      linkedin: ['authority', 'value', 'story'],
    };
    return styles[platform] || ['curiosity', 'value', 'authority'];
  }

  /**
   * Fill hook template with niche-specific content
   */
  fillHookTemplate(template, niche, platform) {
    const replacements = {
      '{topic}': niche || 'this',
      '{common_belief}': 'what most people think',
      '{trending_thing}': 'the latest trend',
      '{credential}': 'expert',
      '{years}': '5',
      '{industry}': niche || 'this field',
      '{dollar_amount}': '$10K',
      '{result}': 'gets results',
      '{problem}': 'this challenge',
      '{bad_state}': 'zero',
      '{good_state}': 'hero',
      '{timeframe}': '30 days',
      '{achievement}': 'this result',
      '{time/money}': 'hours',
      '{resource}': 'guide',
      '{benefit}': 'saves time',
      '{bad_approach}': 'the old way',
      '{controversial_take}': 'the popular advice is wrong',
      '{common_approach}': 'what everyone does',
      '{popular_tool/method}': 'the standard method',
    };

    let result = template;
    for (const [key, value] of Object.entries(replacements)) {
      result = result.replace(key, value);
    }
    return result;
  }

  /**
   * Generate platform-optimized caption
   */
  generateCaption(hookText, platform, niche, video) {
    const baseCaption = `${hookText}\n\n`;
    const cta = this.getPlatformCTA(platform);
    const tags = this.generateHashtags(platform, niche, video).join(' ');
    
    return `${baseCaption}${cta}\n\n${tags}`.trim();
  }

  /**
   * Get platform-specific call-to-action
   */
  getPlatformCTA(platform) {
    const ctas = {
      tiktok: 'Follow for more! 👆',
      instagram: 'Save this for later! 💾',
      youtube: 'Subscribe for more content! 🔔',
      facebook: 'Share if this helped! 🤝',
      x: 'Retweet to save this! 🔁',
      linkedin: 'Connect for more insights! 🤝',
    };
    return ctas[platform] || 'Follow for more!';
  }

  /**
   * Generate relevant hashtags
   */
  generateHashtags(platform, niche, video) {
    const nicheTags = niche ? niche.split(' ').map(w => w.toLowerCase()).filter(w => w.length > 2) : [];
    const platformTags = {
      tiktok: ['fyp', 'viral', 'trending', 'foryou', 'foryoupage'],
      instagram: ['reels', 'explore', 'viralreels', 'instagramreels'],
      youtube: ['shorts', 'youtubeshorts', 'viral', 'subscribe'],
      facebook: ['reels', 'viral', 'facebookreels'],
      x: ['viral', 'trending', 'thread'],
      linkedin: ['linkedin', 'professional', 'insights', 'growth'],
    };
    
    const allTags = [...new Set([...nicheTags, ...(platformTags[platform] || [])])];
    return allTags.slice(0, 10).map(tag => `#${tag.replace(/[^a-z0-9]/gi, '')}`);
  }

  /**
   * Predict viral potential for each variant
   */
  async predictViralPotential(campaign, variants, video) {
    const predictions = [];

    for (const variant of variants) {
      try {
        // Call intelligence service for viral prediction
        const prediction = await viralPredictorClient.predict({
          variantId: variant.id,
          workspaceId: campaign.workspace_id,
          platform: variant.platform,
          hookText: variant.hook_text,
          caption: variant.caption,
          hashtags: variant.hashtags,
          aspectRatio: variant.aspect_ratio,
          videoDuration: video.duration_seconds,
          videoMetadata: video.metadata,
        });

        // Save prediction
        await db.saveViralPrediction({
          workspaceId: campaign.workspace_id,
          variantId: variant.id,
          predictedViralScore: prediction.viralScore,
          predictedViews: prediction.predictedViews,
          predictedEngagementRate: prediction.engagementRate,
          confidence: prediction.confidence,
          modelVersion: prediction.modelVersion,
          features: prediction.features,
        });

        predictions.push({ variantId: variant.id, ...prediction });
      } catch (error) {
        logger.warn('Viral prediction failed for variant', { variantId: variant.id, error: error.message });
        predictions.push({ variantId: variant.id, viralScore: 0.5, predictedViews: 1000, confidence: 0.3 });
      }
    }

    return predictions;
  }

  /**
   * Select best variants per platform based on predictions
   */
  selectBestVariants(variants, predictions) {
    const predictionMap = new Map(predictions.map(p => [p.variantId, p]));
    
    // Group by platform
    const byPlatform = new Map();
    for (const variant of variants) {
      const pred = predictionMap.get(variant.id);
      if (!byPlatform.has(variant.platform)) {
        byPlatform.set(variant.platform, []);
      }
      byPlatform.get(variant.platform).push({ variant, prediction: pred });
    }

    // Select top variant per platform (or top 2 for A/B testing)
    const selected = [];
    for (const [platform, items] of byPlatform) {
      items.sort((a, b) => (b.prediction?.viralScore || 0) - (a.prediction?.viralScore || 0));
      selected.push(items[0].variant);
      if (items.length > 1 && config.ENABLE_AB_TESTING) {
        selected.push(items[1].variant); // Second best for A/B test
      }
    }

    return selected;
  }

  /**
   * Calculate optimal posting schedule
   */
  async calculateSchedule(variants, accounts, strategy) {
    const schedule = [];
    const windows = JSON.parse(config.OPTIMAL_POSTING_WINDOWS);
    const now = new Date();

    // Group accounts by platform
    const accountsByPlatform = new Map();
    for (const account of accounts) {
      if (!accountsByPlatform.has(account.platform)) {
        accountsByPlatform.set(account.platform, []);
      }
      accountsByPlatform.get(account.platform).push(account);
    }

    for (const variant of variants) {
      const platformAccounts = accountsByPlatform.get(variant.platform) || [];
      if (platformAccounts.length === 0) continue;

      const platformWindows = windows[variant.platform] || ['12:00-14:00', '19:00-21:00'];
      
      for (const account of platformAccounts) {
        let scheduledAt;
        
        if (strategy === 'immediate') {
          scheduledAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 min from now
        } else if (strategy === 'spread') {
          // Spread over 24-48 hours
          const hoursOffset = Math.random() * 48;
          scheduledAt = new Date(now.getTime() + hoursOffset * 60 * 60 * 1000);
        } else {
          // Optimal: next available window
          scheduledAt = this.getNextOptimalWindow(now, platformWindows, account.timezone || 'UTC');
        }

        schedule.push({
          variantId: variant.id,
          socialAccountId: account.id,
          scheduledAt,
          platform: variant.platform,
        });
      }
    }

    return schedule;
  }

  /**
   * Get next optimal posting window
   */
  getNextOptimalWindow(now, windows, timezone) {
    // Simplified: find next window today or tomorrow
    for (const window of windows) {
      const [startStr] = window.split('-');
      const [hours, minutes] = startStr.split(':').map(Number);
      
      const target = new Date(now);
      target.setHours(hours, minutes, 0, 0);
      
      if (target > now) {
        return target;
      }
    }
    
    // Next day first window
    const [startStr] = windows[0].split('-');
    const [hours, minutes] = startStr.split(':').map(Number);
    const target = new Date(now);
    target.setDate(target.getDate() + 1);
    target.setHours(hours, minutes, 0, 0);
    return target;
  }

  /**
   * Set up A/B test for campaign
   */
  async setupABTest(campaign, variants, niche) {
    // Group variants by platform for A/B testing
    const byPlatform = new Map();
    for (const variant of variants) {
      if (!byPlatform.has(variant.platform)) {
        byPlatform.set(variant.platform, []);
      }
      byPlatform.get(variant.platform).push(variant);
    }

    // Create A/B test for each platform with multiple variants
    for (const [platform, platformVariants] of byPlatform) {
      if (platformVariants.length >= 2) {
        const abTest = await db.createABTest({
          campaignId: campaign.id,
          workspaceId: campaign.workspace_id,
          name: `${campaign.name} - ${platform} Hook Test`,
          hypothesis: `Different hook styles will perform differently on ${platform} for ${niche} content`,
          testType: 'hook',
          trafficSplit: { 
            [platformVariants[0].id]: config.AB_TEST_TRAFFIC_SPLIT,
            [platformVariants[1].id]: 1 - config.AB_TEST_TRAFFIC_SPLIT,
          },
          confidenceLevel: 0.95,
          minimumDetectableEffect: 0.1,
        });
        return abTest;
      }
    }
    return null;
  }

  /**
   * Create scheduled posts in database
   */
  async createScheduledPosts(campaign, variants, accounts, schedule, abTest) {
    const posts = [];

    for (const item of schedule) {
      const variant = variants.find(v => v.id === item.variantId);
      const account = accounts.find(a => a.id === item.socialAccountId);
      if (!variant || !account) continue;

      const isVariantA = abTest && abTest.traffic_split[item.variantId] === config.AB_TEST_TRAFFIC_SPLIT;
      const isVariantB = abTest && abTest.traffic_split[item.variantId] === 1 - config.AB_TEST_TRAFFIC_SPLIT;

      posts.push({
        workspaceId: campaign.workspace_id,
        variantId: variant.id,
        socialAccountId: account.id,
        scheduledAt: item.scheduledAt,
        status: 'scheduled',
        abTestId: abTest?.id,
        abTestVariant: isVariantA ? 'A' : isVariantB ? 'B' : null,
        metadata: {
          campaignId: campaign.id,
          platform: item.platform,
          accountUsername: account.username,
        },
      });
    }

    const savedPosts = await db.createScheduledPosts(posts);
    logger.info('Created scheduled posts', { campaignId: campaign.id, count: savedPosts.length });
    return savedPosts;
  }

  /**
   * Queue campaign variants for FFmpeg processing
   */
  async queueForProcessing(campaign, variants) {
    for (const variant of variants) {
      await publishToQueue(config.RABBITMQ_QUEUE_PROCESSOR, {
        type: 'create_variant',
        campaignId: campaign.id,
        variantId: variant.id,
        videoId: campaign.video_id,
        platform: variant.platform,
        aspectRatio: variant.aspect_ratio,
        hookText: variant.hook_text,
        caption: variant.caption,
        hashtags: variant.hashtags,
      });
    }
  }

  /**
   * Queue scheduled posts for publishing
   */
  async queueForPublishing(scheduledPosts) {
    for (const post of scheduledPosts) {
      await publishToQueue(config.RABBITMQ_QUEUE_PUBLISHER, {
        type: 'publish_scheduled',
        postId: post.id,
        scheduledAt: post.scheduled_at,
      });
    }
  }

  /**
   * Get video details from database
   */
  async getVideoDetails(videoId) {
    // This would typically call the API gateway or query videos table directly
    // For now, return mock - in production, query the video table
    const result = await db.query('SELECT * FROM videos WHERE id = $1', [videoId]);
    return result.rows[0] || null;
  }
}

export default new CampaignOrchestrator();