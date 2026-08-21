/**
 * Engagement Velocity Tracker
 * Real-time viral detection from post_metrics hypertable
 * <60s latency, fortress-grade security
 */

const { PrismaClient } = require('@prisma/client');
const { EventEmitter } = require('events');
const security = require('../security');
const logger = require('../logger');
const config = require('../config');

const prisma = new PrismaClient();

// ============================================================================
// CONFIGURATION
// ============================================================================

const VELOCITY_CONFIG = {
  // Polling intervals
  pollIntervalMs: 30000, // 30 seconds
  batchSize: 1000,
  
  // Velocity calculation windows
  windows: {
    immediate: 5 * 60 * 1000,      // 5 minutes
    short: 15 * 60 * 1000,         // 15 minutes
    medium: 60 * 60 * 1000,        // 1 hour
    long: 4 * 60 * 60 * 1000,      // 4 hours
  },
  
  // Viral thresholds (configurable per platform/niche)
  thresholds: {
    tiktok: {
      velocity: { low: 100, medium: 500, high: 2000, viral: 10000 }, // views/min
      acceleration: { low: 10, medium: 50, high: 200, viral: 1000 }, // views/min²
      engagementRate: { low: 0.02, medium: 0.05, high: 0.10, viral: 0.20 },
    },
    instagram: {
      velocity: { low: 50, medium: 200, high: 1000, viral: 5000 },
      acceleration: { low: 5, medium: 20, high: 100, viral: 500 },
      engagementRate: { low: 0.015, medium: 0.04, high: 0.08, viral: 0.15 },
    },
    youtube: {
      velocity: { low: 30, medium: 150, high: 800, viral: 4000 },
      acceleration: { low: 3, medium: 15, high: 80, viral: 400 },
      engagementRate: { low: 0.01, medium: 0.03, high: 0.06, viral: 0.12 },
    },
    linkedin: {
      velocity: { low: 10, medium: 50, high: 200, viral: 1000 },
      acceleration: { low: 1, medium: 5, high: 20, viral: 100 },
      engagementRate: { low: 0.02, medium: 0.05, high: 0.10, viral: 0.18 },
    },
    x: {
      velocity: { low: 20, medium: 100, high: 500, viral: 2500 },
      acceleration: { low: 2, medium: 10, high: 50, viral: 250 },
      engagementRate: { low: 0.01, medium: 0.03, high: 0.07, viral: 0.15 },
    },
    facebook: {
      velocity: { low: 15, medium: 80, high: 400, viral: 2000 },
      acceleration: { low: 1.5, medium: 8, high: 40, viral: 200 },
      engagementRate: { low: 0.01, medium: 0.03, high: 0.06, viral: 0.12 },
    },
  },
  
  // Scoring weights
  weights: {
    velocity: 0.35,
    acceleration: 0.25,
    engagementRate: 0.20,
    retentionScore: 0.10,
    shareVelocity: 0.10,
  },
  
  // Alerting
  alerts: {
    viralThreshold: 0.85, // Viral probability > 85%
    risingThreshold: 0.60, // Rising fast > 60%
    cooldownMs: 5 * 60 * 1000, // 5 min between alerts for same post
  },
};

// ============================================================================
// VELOCITY CALCULATOR
// ============================================================================

class VelocityCalculator {
  constructor() {
    this.metricsCache = new Map(); // postId -> recent metrics
  }
  
  /**
   * Calculate velocity (views per minute) for a time window
   * @param {Array} metrics - Array of { timestamp, views, likes, comments, shares, retention }
   * @param {number} windowMs - Time window in milliseconds
   * @returns {number} Views per minute
   */
  calculateVelocity(metrics, windowMs) {
    if (metrics.length < 2) return 0;
    
    const now = Date.now();
    const cutoff = now - windowMs;
    const recent = metrics.filter(m => m.timestamp > cutoff);
    
    if (recent.length < 2) return 0;
    
    // Sort by timestamp
    recent.sort((a, b) => a.timestamp - b.timestamp);
    
    const first = recent[0];
    const last = recent[recent.length - 1];
    const timeDiffMinutes = (last.timestamp - first.timestamp) / 60000;
    
    if (timeDiffMinutes <= 0) return 0;
    
    const viewsDiff = last.views - first.views;
    return Math.max(0, viewsDiff / timeDiffMinutes);
  }
  
  /**
   * Calculate acceleration (change in velocity per minute)
   * @param {Array} metrics 
   * @param {number} windowMs 
   * @returns {number} Views per minute squared
   */
  calculateAcceleration(metrics, windowMs) {
    if (metrics.length < 3) return 0;
    
    const now = Date.now();
    const cutoff = now - windowMs;
    const recent = metrics.filter(m => m.timestamp > cutoff);
    
    if (recent.length < 3) return 0;
    
    recent.sort((a, b) => a.timestamp - b.timestamp);
    
    // Split into two halves and compare velocities
    const mid = Math.floor(recent.length / 2);
    const firstHalf = recent.slice(0, mid);
    const secondHalf = recent.slice(mid);
    
    const v1 = this.calculateVelocityFromPoints(firstHalf);
    const v2 = this.calculateVelocityFromPoints(secondHalf);
    
    const timeDiffMinutes = (secondHalf[secondHalf.length - 1].timestamp - firstHalf[0].timestamp) / 60000;
    if (timeDiffMinutes <= 0) return 0;
    
    return (v2 - v1) / timeDiffMinutes;
  }
  
  calculateVelocityFromPoints(points) {
    if (points.length < 2) return 0;
    const first = points[0];
    const last = points[points.length - 1];
    const timeDiffMinutes = (last.timestamp - first.timestamp) / 60000;
    if (timeDiffMinutes <= 0) return 0;
    return (last.views - first.views) / timeDiffMinutes;
  }
  
  /**
   * Calculate engagement rate
   * @param {Object} latest - Latest metrics point
   * @returns {number} Engagement rate (0-1)
   */
  calculateEngagementRate(latest) {
    if (!latest || latest.views === 0) return 0;
    const engagements = (latest.likes || 0) + (latest.comments || 0) + (latest.shares || 0) + (latest.saves || 0);
    return engagements / latest.views;
  }
  
  /**
   * Calculate share velocity (shares per minute)
   * @param {Array} metrics 
   * @param {number} windowMs 
   * @returns {number}
   */
  calculateShareVelocity(metrics, windowMs) {
    if (metrics.length < 2) return 0;
    
    const now = Date.now();
    const cutoff = now - windowMs;
    const recent = metrics.filter(m => m.timestamp > cutoff);
    
    if (recent.length < 2) return 0;
    
    recent.sort((a, b) => a.timestamp - b.timestamp);
    const first = recent[0];
    const last = recent[recent.length - 1];
    const timeDiffMinutes = (last.timestamp - first.timestamp) / 60000;
    
    if (timeDiffMinutes <= 0) return 0;
    
    const sharesDiff = (last.shares || 0) - (first.shares || 0);
    return Math.max(0, sharesDiff / timeDiffMinutes);
  }
  
  /**
   * Get platform-specific thresholds
   * @param {string} platform 
   * @returns {Object}
   */
  getThresholds(platform) {
    return VELOCITY_CONFIG.thresholds[platform] || VELOCITY_CONFIG.thresholds.tiktok;
  }
  
  /**
   * Score a metric against thresholds (0-1)
   * @param {number} value 
   * @param {Object} thresholds 
   * @returns {number}
   */
  scoreMetric(value, thresholds) {
    if (value >= thresholds.viral) return 1.0;
    if (value >= thresholds.high) return 0.75;
    if (value >= thresholds.medium) return 0.5;
    if (value >= thresholds.low) return 0.25;
    return 0;
  }
  
  /**
   * Calculate viral probability (0-1)
   * @param {Object} params - { velocity, acceleration, engagementRate, shareVelocity, retentionScore, platform }
   * @returns {number}
   */
  calculateViralProbability(params) {
    const { velocity, acceleration, engagementRate, shareVelocity, retentionScore, platform } = params;
    const thresholds = this.getThresholds(platform);
    const weights = VELOCITY_CONFIG.weights;
    
    const velocityScore = this.scoreMetric(velocity, thresholds.velocity);
    const accelerationScore = this.scoreMetric(acceleration, thresholds.acceleration);
    const engagementScore = this.scoreMetric(engagementRate, thresholds.engagementRate);
    const shareScore = this.scoreMetric(shareVelocity, { low: 1, medium: 5, high: 20, viral: 100 });
    const retentionScoreNorm = retentionScore || 0; // Already 0-1
    
    const weightedScore = 
      velocityScore * weights.velocity +
      accelerationScore * weights.acceleration +
      engagementScore * weights.engagementRate +
      shareScore * weights.shareVelocity +
      retentionScoreNorm * weights.retentionScore;
    
    // Apply sigmoid for smooth probability
    return 1 / (1 + Math.exp(-10 * (weightedScore - 0.5)));
  }
  
  /**
   * Classify viral stage
   * @param {number} probability 
   * @returns {string}
   */
  classifyStage(probability) {
    if (probability >= 0.85) return 'viral';
    if (probability >= 0.65) return 'rising';
    if (probability >= 0.40) return 'growing';
    if (probability >= 0.20) return 'early';
    return 'dormant';
  }
  
  /**
   * Update cache with new metrics
   * @param {string} postId 
   * @param {Object} metric 
   */
  updateCache(postId, metric) {
    if (!this.metricsCache.has(postId)) {
      this.metricsCache.set(postId, []);
    }
    
    const cache = this.metricsCache.get(postId);
    cache.push({
      timestamp: metric.timestamp || Date.now(),
      views: metric.views || 0,
      likes: metric.likes || 0,
      comments: metric.comments || 0,
      shares: metric.shares || 0,
      saves: metric.saves || 0,
      retention: metric.retention || 0,
    });
    
    // Keep only last 4 hours
    const cutoff = Date.now() - 4 * 60 * 60 * 1000;
    const filtered = cache.filter(m => m.timestamp > cutoff);
    this.metricsCache.set(postId, filtered);
  }
  
  /**
   * Get cached metrics for a post
   * @param {string} postId 
   * @returns {Array}
   */
  getCache(postId) {
    return this.metricsCache.get(postId) || [];
  }
  
  /**
   * Clear old cache entries
   */
  cleanupCache() {
    const cutoff = Date.now() - 4 * 60 * 60 * 1000;
    for (const [postId, metrics] of this.metricsCache.entries()) {
      const filtered = metrics.filter(m => m.timestamp > cutoff);
      if (filtered.length === 0) {
        this.metricsCache.delete(postId);
      } else {
        this.metricsCache.set(postId, filtered);
      }
    }
  }
}

// ============================================================================
// ENGAGEMENT VELOCITY TRACKER
// ============================================================================

class EngagementVelocityTracker extends EventEmitter {
  constructor(options = {}) {
    super();
    this.calculator = new VelocityCalculator();
    this.pollInterval = null;
    this.isRunning = false;
    this.alertCooldowns = new Map(); // postId -> lastAlertTime
    this.wsServer = options.wsServer; // WebSocket server for real-time alerts
    
    // Bind methods
    this.poll = this.poll.bind(this);
    this.processPost = this.processPost.bind(this);
    this.emitAlert = this.emitAlert.bind(this);
  }
  
  /**
   * Start the tracker
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Velocity tracker already running');
      return;
    }
    
    this.isRunning = true;
    logger.info('Starting Engagement Velocity Tracker');
    
    // Initial poll
    await this.poll();
    
    // Schedule recurring polls
    this.pollInterval = setInterval(this.poll, VELOCITY_CONFIG.pollIntervalMs);
    
    // Cache cleanup every 10 minutes
    setInterval(() => this.calculator.cleanupCache(), 10 * 60 * 1000);
    
    logger.info('Engagement Velocity Tracker started', {
      pollIntervalMs: VELOCITY_CONFIG.pollIntervalMs,
    });
  }
  
  /**
   * Stop the tracker
   */
  async stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    
    logger.info('Engagement Velocity Tracker stopped');
  }
  
  /**
   * Main polling function - fetches recent metrics and processes
   */
  async poll() {
    const startTime = Date.now();
    
    try {
      // Fetch recent post metrics (last 5 minutes)
      const cutoff = new Date(Date.now() - 5 * 60 * 1000);
      
      const metrics = await prisma.postMetric.findMany({
        where: {
          timestamp: { gte: cutoff },
        },
        include: {
          scheduledPost: {
            include: {
              variant: {
                include: {
                  content: true,
                },
              },
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        take: VELOCITY_CONFIG.batchSize,
      });
      
      if (metrics.length === 0) {
        logger.debug('No new metrics to process');
        return;
      }
      
      // Group by post
      const postsMap = new Map();
      for (const metric of metrics) {
        const postId = metric.scheduledPostId;
        if (!postsMap.has(postId)) {
          postsMap.set(postId, {
            post: metric.scheduledPost,
            metrics: [],
          });
        }
        postsMap.get(postId).metrics.push(metric);
      }
      
      // Process each post
      const results = [];
      for (const [postId, data] of postsMap.entries()) {
        const result = await this.processPost(postId, data.post, data.metrics);
        if (result) results.push(result);
      }
      
      // Store velocity records
      if (results.length > 0) {
        await this.storeVelocityRecords(results);
      }
      
      const duration = Date.now() - startTime;
      logger.debug('Velocity poll completed', {
        postsProcessed: results.length,
        durationMs: duration,
      });
      
    } catch (error) {
      logger.error('Velocity poll failed', { error: error.message, stack: error.stack });
    }
  }
  
  /**
   * Process a single post's metrics
   * @param {string} postId 
   * @param {Object} post 
   * @param {Array} metrics 
   */
  async processPost(postId, post, metrics) {
    if (!post || !post.variant || !post.variant.content) {
      logger.warn('Invalid post data', { postId });
      return null;
    }
    
    const platform = post.platform || 'tiktok';
    const content = post.variant.content;
    
    // Update calculator cache
    for (const metric of metrics) {
      this.calculator.updateCache(postId, metric);
    }
    
    // Get all cached metrics (including historical)
    const allMetrics = this.calculator.getCache(postId);
    if (allMetrics.length < 2) return null;
    
    // Get latest metric
    const latest = allMetrics[allMetrics.length - 1];
    
    // Calculate metrics for each window
    const windows = VELOCITY_CONFIG.windows;
    const velocity = {};
    const acceleration = {};
    
    for (const [windowName, windowMs] of Object.entries(windows)) {
      velocity[windowName] = this.calculator.calculateVelocity(allMetrics, windowMs);
      acceleration[windowName] = this.calculator.calculateAcceleration(allMetrics, windowMs);
    }
    
    // Current engagement rate
    const engagementRate = this.calculator.calculateEngagementRate(latest);
    
    // Share velocity (1 hour window)
    const shareVelocity = this.calculator.calculateShareVelocity(allMetrics, windows.medium);
    
    // Retention score (from retention analysis if available)
    const retentionScore = latest.retention || 0;
    
    // Calculate viral probability
    const viralProbability = this.calculator.calculateViralProbability({
      velocity: velocity.immediate,
      acceleration: acceleration.immediate,
      engagementRate,
      shareVelocity,
      retentionScore,
      platform,
    });
    
    const stage = this.calculator.classifyStage(viralProbability);
    
    // Determine if alert needed
    const shouldAlert = this.shouldAlert(postId, viralProbability, stage);
    
    const result = {
      postId,
      workspaceId: content.workspaceId,
      creatorId: content.creatorId,
      platform,
      contentId: content.id,
      scheduledPostId: postId,
      
      // Velocity metrics (views/min)
      velocityImmediate: velocity.immediate,
      velocityShort: velocity.short,
      velocityMedium: velocity.medium,
      velocityLong: velocity.long,
      
      // Acceleration metrics (views/min²)
      accelerationImmediate: acceleration.immediate,
      accelerationShort: acceleration.short,
      accelerationMedium: acceleration.medium,
      accelerationLong: acceleration.long,
      
      // Engagement
      engagementRate,
      shareVelocity,
      retentionScore,
      
      // Viral scoring
      viralProbability,
      viralStage: stage,
      
      // Current totals
      currentViews: latest.views,
      currentLikes: latest.likes,
      currentComments: latest.comments,
      currentShares: latest.shares,
      currentSaves: latest.saves,
      
      // Timestamp
      calculatedAt: new Date(),
    };
    
    // Emit real-time event
    this.emit('velocity:calculated', result);
    
    // Send WebSocket alert if needed
    if (shouldAlert && this.wsServer) {
      this.emitAlert(result);
    }
    
    return result;
  }
  
  /**
   * Check if we should alert for this post
   * @param {string} postId 
   * @param {number} probability 
   * @param {string} stage 
   * @returns {boolean}
   */
  shouldAlert(postId, probability, stage) {
    const now = Date.now();
    const cooldown = VELOCITY_CONFIG.alerts.cooldownMs;
    const lastAlert = this.alertCooldowns.get(postId) || 0;
    
    if (now - lastAlert < cooldown) return false;
    
    const viralThreshold = VELOCITY_CONFIG.alerts.viralThreshold;
    const risingThreshold = VELOCITY_CONFIG.alerts.risingThreshold;
    
    if (probability >= viralThreshold && stage === 'viral') {
      this.alertCooldowns.set(postId, now);
      return true;
    }
    
    if (probability >= risingThreshold && stage === 'rising') {
      this.alertCooldowns.set(postId, now);
      return true;
    }
    
    return false;
  }
  
  /**
   * Emit WebSocket alert
   * @param {Object} result 
   */
  emitAlert(result) {
    const alert = {
      type: 'velocity_alert',
      severity: result.viralStage === 'viral' ? 'high' : 'medium',
      postId: result.postId,
      workspaceId: result.workspaceId,
      creatorId: result.creatorId,
      platform: result.platform,
      viralProbability: result.viralProbability,
      viralStage: result.viralStage,
      currentViews: result.currentViews,
      velocity: result.velocityImmediate,
      acceleration: result.accelerationImmediate,
      message: this.generateAlertMessage(result),
      timestamp: new Date().toISOString(),
    };
    
    // Emit to WebSocket server
    this.wsServer.emitToWorkspace(result.workspaceId, 'velocity_alert', alert);
    
    // Also emit locally
    this.emit('velocity:alert', alert);
    
    logger.info('Velocity alert emitted', {
      postId: result.postId,
      stage: result.viralStage,
      probability: result.viralProbability,
    });
  }
  
  generateAlertMessage(result) {
    const stage = result.viralStage;
    const prob = Math.round(result.viralProbability * 100);
    const views = result.currentViews.toLocaleString();
    const velocity = Math.round(result.velocityImmediate);
    
    if (stage === 'viral') {
      return `🚀 VIRAL DETECTED: ${prob}% probability | ${views} views | ${velocity} views/min`;
    }
    if (stage === 'rising') {
      return `📈 RISING FAST: ${prob}% viral probability | ${views} views | ${velocity} views/min`;
    }
    return `📊 Engagement update: ${prob}% viral probability | ${views} views`;
  }
  
  /**
   * Store velocity records in database
   * @param {Array} results 
   */
  async storeVelocityRecords(results) {
    try {
      await prisma.engagementVelocity.createMany({
        data: results.map(r => ({
          postId: r.postId,
          workspaceId: r.workspaceId,
          creatorId: r.creatorId,
          platform: r.platform,
          contentId: r.contentId,
          scheduledPostId: r.scheduledPostId,
          velocityImmediate: r.velocityImmediate,
          velocityShort: r.velocityShort,
          velocityMedium: r.velocityMedium,
          velocityLong: r.velocityLong,
          accelerationImmediate: r.accelerationImmediate,
          accelerationShort: r.accelerationShort,
          accelerationMedium: r.accelerationMedium,
          accelerationLong: r.accelerationLong,
          engagementRate: r.engagementRate,
          shareVelocity: r.shareVelocity,
          retentionScore: r.retentionScore,
          viralProbability: r.viralProbability,
          viralStage: r.viralStage,
          currentViews: r.currentViews,
          currentLikes: r.currentLikes,
          currentComments: r.currentComments,
          currentShares: r.currentShares,
          currentSaves: r.currentSaves,
          calculatedAt: r.calculatedAt,
        })),
        skipDuplicates: true,
      });
    } catch (error) {
      logger.error('Failed to store velocity records', { error: error.message });
    }
  }
  
  /**
   * Get velocity for a specific post (API endpoint)
   * @param {string} postId 
   * @returns {Object|null}
   */
  async getPostVelocity(postId) {
    const record = await prisma.engagementVelocity.findFirst({
      where: { postId },
      orderBy: { calculatedAt: 'desc' },
    });
    
    if (!record) return null;
    
    // Also get recent history
    const history = await prisma.engagementVelocity.findMany({
      where: { postId },
      orderBy: { calculatedAt: 'desc' },
      take: 20,
    });
    
    return {
      current: record,
      history: history.map(h => ({
        calculatedAt: h.calculatedAt,
        viralProbability: h.viralProbability,
        viralStage: h.viralStage,
        velocityImmediate: h.velocityImmediate,
        currentViews: h.currentViews,
      })),
    };
  }
  
  /**
   * Get top viral posts for a workspace
   * @param {string} workspaceId 
   * @param {number} limit 
   * @returns {Array}
   */
  async getTopViralPosts(workspaceId, limit = 10) {
    return prisma.engagementVelocity.findMany({
      where: {
        workspaceId,
        viralProbability: { gte: 0.5 },
        calculatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { viralProbability: 'desc' },
      take: limit,
      distinct: ['postId'],
    });
  }
  
  /**
   * Get velocity stats for dashboard
   * @param {string} workspaceId 
   * @returns {Object}
   */
  async getWorkspaceStats(workspaceId) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const [totalPosts, viralPosts, risingPosts, avgProbability] = await Promise.all([
      prisma.engagementVelocity.count({ where: { workspaceId, calculatedAt: { gte: since } } }),
      prisma.engagementVelocity.count({ where: { workspaceId, viralStage: 'viral', calculatedAt: { gte: since } } }),
      prisma.engagementVelocity.count({ where: { workspaceId, viralStage: 'rising', calculatedAt: { gte: since } } }),
      prisma.engagementVelocity.aggregate({
        where: { workspaceId, calculatedAt: { gte: since } },
        _avg: { viralProbability: true },
      }),
    ]);
    
    return {
      totalPostsTracked: totalPosts,
      viralPosts,
      risingPosts,
      averageViralProbability: avgProbability._avg.viralProbability || 0,
      viralRate: totalPosts > 0 ? viralPosts / totalPosts : 0,
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  EngagementVelocityTracker,
  VelocityCalculator,
  VELOCITY_CONFIG,
};