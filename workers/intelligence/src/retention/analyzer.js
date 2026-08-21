/**
 * Retention Curve Analyzer - Phase 1 Algorithmic Intelligence Core
 * 
 * Analyzes per-second watch time data from PostMetric hypertable to:
 * 1. Identify scene-level drop-off points
 * 2. Calculate hook effectiveness (first 3 seconds)
 * 3. Determine optimal cut points for content flywheel (Shorts/Reels/TikToks)
 * 4. Build per-creator retention fingerprints for CreatorAlgorithmProfile
 */

import config from '../config.js';
import logger from '../logger.js';
import db from '../db/index.js';

class RetentionAnalyzer {
  constructor() {
    this.minDataPoints = 100; // Minimum views for reliable analysis
    this.sceneWindowSeconds = 5; // Analyze in 5-second windows
  }

  /**
   * Analyze retention for a single scheduled post
   * @param {string} scheduledPostId 
   * @returns {Promise<Object>} Retention analysis results
   */
  async analyzePost(scheduledPostId) {
    const startTime = Date.now();
    logger.info({ scheduledPostId }, 'Starting retention analysis');

    try {
      // Get post metrics with per-second granularity
      const metrics = await this.getPerSecondMetrics(scheduledPostId);
      
      if (metrics.length < this.minDataPoints) {
        logger.warn({ scheduledPostId, dataPoints: metrics.length }, 'Insufficient data for retention analysis');
        return { success: false, reason: 'insufficient_data', dataPoints: metrics.length };
      }

      // Get post details
      const post = await db.getScheduledPost(scheduledPostId);
      if (!post) {
        throw new Error(`Post not found: ${scheduledPostId}`);
      }

      // Analyze retention curve
      const analysis = this.analyzeRetentionCurve(metrics, post.durationSeconds);
      
      // Calculate hook effectiveness (first 3 seconds)
      const hookEffectiveness = this.calculateHookEffectiveness(metrics);
      
      // Find optimal cut points for flywheel
      const optimalCutPoints = this.findOptimalCutPoints(metrics, post.durationSeconds);
      
      // Identify drop-off points
      const dropOffPoints = this.identifyDropOffPoints(metrics);

      // Prepare scene data (5-second windows)
      const sceneData = this.generateSceneData(metrics, post.durationSeconds);

      const result = {
        scheduledPostId,
        workspaceId: post.workspaceId,
        creatorId: post.creatorId,
        platform: post.platform,
        sceneData,
        dropOffPoints,
        hookEffectiveness,
        optimalCutPoints,
        analyzedAt: new Date(),
        dataPoints: metrics.length,
        videoDuration: post.durationSeconds
      };

      // Save to database
      await this.saveAnalysis(result);

      // Update CreatorAlgorithmProfile with retention pattern
      await this.updateCreatorProfile(post.creatorId, result);

      const duration = Date.now() - startTime;
      logger.info({ 
        scheduledPostId, 
        duration, 
        hookEffectiveness, 
        dropOffCount: dropOffPoints.length,
        cutPointsCount: optimalCutPoints.length 
      }, 'Retention analysis completed');

      return { success: true, ...result };

    } catch (error) {
      logger.error({ scheduledPostId, err: error }, 'Retention analysis failed');
      throw error;
    }
  }

  /**
   * Get per-second watch time metrics from PostMetric hypertable
   */
  async getPerSecondMetrics(scheduledPostId) {
    const query = `
      SELECT 
        recorded_at,
        watch_time_seconds,
        views,
        completion_rate,
        avg_watch_time
      FROM post_metrics 
      WHERE scheduled_post_id = $1 
      ORDER BY recorded_at ASC
    `;
    const result = await db.query(query, [scheduledPostId]);
    return result.rows;
  }

  /**
   * Analyze retention curve from metrics
   */
  analyzeRetentionCurve(metrics, videoDuration) {
    if (!videoDuration || videoDuration <= 0) {
      videoDuration = 60; // Default assumption
    }

    // Aggregate by time buckets (per second)
    const retentionBySecond = {};
    const totalViews = metrics.reduce((sum, m) => sum + (m.views || 0), 0);

    for (const m of metrics) {
      const second = Math.floor(m.recorded_at / 1000) % Math.ceil(videoDuration);
      if (!retentionBySecond[second]) {
        retentionBySecond[second] = { views: 0, watchTime: 0 };
      }
      retentionBySecond[second].views += m.views || 0;
      retentionBySecond[second].watchTime += m.watch_time_seconds || 0;
    }

    // Calculate retention rate per second
    const retentionCurve = [];
    let cumulativeViews = totalViews;
    
    for (let i = 0; i < Math.ceil(videoDuration); i++) {
      const data = retentionBySecond[i] || { views: 0, watchTime: 0 };
      const retentionRate = totalViews > 0 ? (cumulativeViews / totalViews) : 0;
      
      retentionCurve.push({
        second: i,
        retentionRate: Math.round(retentionRate * 10000) / 10000,
        views: data.views,
        avgWatchTime: data.views > 0 ? data.watchTime / data.views : 0
      });
      
      cumulativeViews -= data.views;
    }

    return retentionCurve;
  }

  /**
   * Calculate hook effectiveness (first 3 seconds critical for TikTok/Reels/Shorts)
   */
  calculateHookEffectiveness(metrics) {
    const first3Seconds = metrics.filter(m => {
      const second = Math.floor(m.recorded_at / 1000) % 60;
      return second < 3;
    });

    if (first3Seconds.length === 0) return 0;

    const totalViews = metrics.reduce((sum, m) => sum + (m.views || 0), 0);
    const hookViews = first3Seconds.reduce((sum, m) => sum + (m.views || 0), 0);
    const hookWatchTime = first3Seconds.reduce((sum, m) => sum + (m.watch_time_seconds || 0), 0);

    // Hook effectiveness = (retention at 3s) * (avg watch time in first 3s / 3)
    const retentionAt3s = totalViews > 0 ? hookViews / totalViews : 0;
    const avgWatchTimeFirst3s = hookViews > 0 ? hookWatchTime / hookViews : 0;
    const normalizedWatchTime = Math.min(avgWatchTimeFirst3s / 3, 1);

    return Math.round((retentionAt3s * 0.7 + normalizedWatchTime * 0.3) * 1000) / 1000;
  }

  /**
   * Identify significant drop-off points (>15% drop in 5-second window)
   */
  identifyDropOffPoints(metrics) {
    const dropOffPoints = [];
    const windowSize = 5; // 5-second windows
    
    // Aggregate by 5-second windows
    const windows = {};
    for (const m of metrics) {
      const window = Math.floor((Math.floor(m.recorded_at / 1000) % 3600) / windowSize);
      if (!windows[window]) {
        windows[window] = { views: 0, watchTime: 0 };
      }
      windows[window].views += m.views || 0;
      windows[window].watchTime += m.watch_time_seconds || 0;
    }

    const sortedWindows = Object.keys(windows).map(k => parseInt(k)).sort((a, b) => a - b);
    
    for (let i = 1; i < sortedWindows.length; i++) {
      const prev = windows[sortedWindows[i - 1]];
      const curr = windows[sortedWindows[i]];
      
      if (prev.views > 0) {
        const dropRate = 1 - (curr.views / prev.views);
        if (dropRate > 0.15) { // 15% drop threshold
          dropOffPoints.push({
            windowStart: sortedWindows[i] * windowSize,
            windowEnd: (sortedWindows[i] + 1) * windowSize,
            dropRate: Math.round(dropRate * 1000) / 1000,
            prevViews: prev.views,
            currViews: curr.views,
            severity: dropRate > 0.3 ? 'critical' : dropRate > 0.2 ? 'high' : 'medium'
          });
        }
      }
    }

    return dropOffPoints;
  }

  /**
   * Find optimal cut points for content flywheel (high retention segments)
   */
  findOptimalCutPoints(metrics, videoDuration) {
    const cutPoints = [];
    const windowSize = 5;
    const minSegmentDuration = 15; // Minimum 15 seconds for a clip
    const maxSegmentDuration = 60; // Maximum 60 seconds

    // Aggregate by 5-second windows
    const windows = {};
    for (const m of metrics) {
      const window = Math.floor((Math.floor(m.recorded_at / 1000) % 3600) / windowSize);
      if (!windows[window]) {
        windows[window] = { views: 0, watchTime: 0, completionRate: 0 };
      }
      windows[window].views += m.views || 0;
      windows[window].watchTime += m.watch_time_seconds || 0;
      windows[window].completionRate = m.completion_rate || 0;
    }

    const sortedWindows = Object.keys(windows).map(k => parseInt(k)).sort((a, b) => a - b);
    
    // Find high-retention segments
    for (let i = 0; i < sortedWindows.length; i++) {
      const window = windows[sortedWindows[i]];
      const retentionRate = window.views > 0 ? window.watchTime / (window.views * windowSize) : 0;
      const completionRate = window.completionRate || 0;
      
      // High retention + high completion = good clip candidate
      const score = (retentionRate * 0.6) + (completionRate * 0.4);
      
      if (score > 0.7 && window.views > 10) { // Threshold for quality
        // Try to extend segment
        let segmentEnd = i;
        let segmentScore = score;
        
        for (let j = i + 1; j < Math.min(i + maxSegmentDuration / windowSize, sortedWindows.length); j++) {
          const nextWindow = windows[sortedWindows[j]];
          const nextRetention = nextWindow.views > 0 ? nextWindow.watchTime / (nextWindow.views * windowSize) : 0;
          const nextCompletion = nextWindow.completionRate || 0;
          const nextScore = (nextRetention * 0.6) + (nextCompletion * 0.4);
          
          if (nextScore > 0.6) {
            segmentEnd = j;
            segmentScore = (segmentScore + nextScore) / 2;
          } else {
            break;
          }
        }
        
        const duration = (segmentEnd - i + 1) * windowSize;
        if (duration >= minSegmentDuration && duration <= maxSegmentDuration) {
          cutPoints.push({
            startSecond: i * windowSize,
            endSecond: (segmentEnd + 1) * windowSize,
            duration,
            score: Math.round(segmentScore * 1000) / 1000,
            avgRetention: Math.round(segmentScore * 100) / 100,
            platform: this.recommendPlatform(duration)
          });
        }
        
        i = segmentEnd; // Skip analyzed windows
      }
    }

    // Sort by score descending, return top 5
    return cutPoints
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  /**
   * Recommend platform based on clip duration
   */
  recommendPlatform(duration) {
    if (duration <= 15) return 'tiktok';
    if (duration <= 30) return 'instagram';
    if (duration <= 60) return 'youtube';
    return 'linkedin';
  }

  /**
   * Generate scene data for detailed analysis
   */
  generateSceneData(metrics, videoDuration) {
    const sceneData = [];
    const windowSize = this.sceneWindowSeconds;
    const numWindows = Math.ceil((videoDuration || 60) / windowSize);

    for (let i = 0; i < numWindows; i++) {
      const windowMetrics = metrics.filter(m => {
        const second = Math.floor(m.recorded_at / 1000) % 3600;
        return second >= i * windowSize && second < (i + 1) * windowSize;
      });

      const views = windowMetrics.reduce((sum, m) => sum + (m.views || 0), 0);
      const watchTime = windowMetrics.reduce((sum, m) => sum + (m.watch_time_seconds || 0), 0);
      const avgCompletion = windowMetrics.length > 0 
        ? windowMetrics.reduce((sum, m) => sum + (m.completion_rate || 0), 0) / windowMetrics.length 
        : 0;

      sceneData.push({
        sceneIndex: i,
        startSecond: i * windowSize,
        endSecond: (i + 1) * windowSize,
        views,
        totalWatchTime: watchTime,
        avgWatchTime: views > 0 ? watchTime / views : 0,
        avgCompletionRate: Math.round(avgCompletion * 10000) / 10000,
        retentionScore: views > 0 ? Math.min(watchTime / (views * windowSize), 1) : 0
      });
    }

    return sceneData;
  }

  /**
   * Save retention analysis to database
   */
  async saveAnalysis(analysis) {
    const query = `
      INSERT INTO retention_analyses (
        scheduled_post_id, workspace_id, creator_id, platform,
        scene_data, drop_off_points, hook_effectiveness, optimal_cut_points, analyzed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (scheduled_post_id) DO UPDATE SET
        scene_data = EXCLUDED.scene_data,
        drop_off_points = EXCLUDED.drop_off_points,
        hook_effectiveness = EXCLUDED.hook_effectiveness,
        optimal_cut_points = EXCLUDED.optimal_cut_points,
        analyzed_at = EXCLUDED.analyzed_at
      RETURNING *
    `;

    await db.query(query, [
      analysis.scheduledPostId,
      analysis.workspaceId,
      analysis.creatorId,
      analysis.platform,
      JSON.stringify(analysis.sceneData),
      JSON.stringify(analysis.dropOffPoints),
      analysis.hookEffectiveness,
      JSON.stringify(analysis.optimalCutPoints),
      analysis.analyzedAt
    ]);
  }

  /**
   * Update CreatorAlgorithmProfile with retention pattern
   */
  async updateCreatorProfile(creatorId, analysis) {
    // Get existing profile
    const existing = await db.query(
      'SELECT * FROM creator_algorithm_profiles WHERE creator_id = $1',
      [creatorId]
    );

    let retentionPattern = {};
    if (existing.rows.length > 0) {
      retentionPattern = existing.rows[0].retention_pattern || {};
    }

    // Update with new analysis (exponential moving average)
    const alpha = 0.3; // Weight for new data
    const platform = analysis.platform;
    
    if (!retentionPattern[platform]) {
      retentionPattern[platform] = {
        avgHookEffectiveness: 0,
        avgDropOffPoints: [],
        commonCutPoints: [],
        totalAnalyses: 0
      };
    }

    const platformPattern = retentionPattern[platform];
    platformPattern.avgHookEffectiveness = 
      platformPattern.avgHookEffectiveness * (1 - alpha) + analysis.hookEffectiveness * alpha;
    platformPattern.avgDropOffPoints = analysis.dropOffPoints;
    platformPattern.commonCutPoints = analysis.optimalCutPoints.map(c => ({
      start: c.startSecond,
      end: c.endSecond,
      score: c.score
    }));
    platformPattern.totalAnalyses += 1;
    platformPattern.lastAnalyzedAt = new Date().toISOString();

    // Update database
    await db.query(
      `INSERT INTO creator_algorithm_profiles (creator_id, retention_pattern, training_data_points, last_trained_at, updated_at)
       VALUES ($1, $2, 1, NOW(), NOW())
       ON CONFLICT (creator_id) DO UPDATE SET
         retention_pattern = EXCLUDED.retention_pattern,
         training_data_points = creator_algorithm_profiles.training_data_points + 1,
         last_trained_at = NOW(),
         updated_at = NOW()`,
      [creatorId, JSON.stringify(retentionPattern)]
    );
  }

  /**
   * Batch analyze all posts for a creator (nightly job)
   */
  async analyzeCreatorPosts(creatorId, limit = 50) {
    logger.info({ creatorId }, 'Starting batch retention analysis for creator');

    const posts = await db.query(
      `SELECT sp.id FROM scheduled_posts sp
       JOIN videos v ON sp.variant_id = v.id
       WHERE v.uploaded_by = $1 AND sp.status = 'posted' AND sp.posted_at IS NOT NULL
       ORDER BY sp.posted_at DESC
       LIMIT $2`,
      [creatorId, limit]
    );

    const results = [];
    for (const post of posts.rows) {
      try {
        const result = await this.analyzePost(post.id);
        if (result.success) {
          results.push(result);
        }
      } catch (error) {
        logger.error({ creatorId, postId: post.id, err: error }, 'Failed to analyze post in batch');
      }
    }

    logger.info({ creatorId, analyzed: results.length, total: posts.rows.length }, 'Batch retention analysis completed');
    return results;
  }

  /**
   * Get retention insights for a creator (for dashboard)
   */
  async getCreatorInsights(creatorId) {
    const analyses = await db.query(
      `SELECT * FROM retention_analyses WHERE creator_id = $1 ORDER BY analyzed_at DESC LIMIT 20`,
      [creatorId]
    );

    if (analyses.rows.length === 0) {
      return { hasData: false, message: 'No retention data available yet' };
    }

    // Aggregate insights
    const platformInsights = {};
    for (const a of analyses.rows) {
      const platform = a.platform;
      if (!platformInsights[platform]) {
        platformInsights[platform] = {
          avgHookEffectiveness: 0,
          commonDropOffs: [],
          bestCutPoints: [],
          analysisCount: 0
        };
      }
      platformInsights[platform].avgHookEffectiveness += a.hook_effectiveness || 0;
      platformInsights[platform].commonDropOffs.push(...(a.drop_off_points || []));
      platformInsights[platform].bestCutPoints.push(...(a.optimal_cut_points || []));
      platformInsights[platform].analysisCount++;
    }

    // Average the hook effectiveness
    for (const platform of Object.keys(platformInsights)) {
      const p = platformInsights[platform];
      p.avgHookEffectiveness = Math.round((p.avgHookEffectiveness / p.analysisCount) * 1000) / 1000;
      
      // Get top 3 drop-off patterns
      const dropOffCounts = {};
      for (const d of p.commonDropOffs) {
        const key = `${d.windowStart}-${d.windowEnd}`;
        dropOffCounts[key] = (dropOffCounts[key] || 0) + 1;
      }
      p.topDropOffPatterns = Object.entries(dropOffCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([range, count]) => ({ range, frequency: count }));

      // Get top 5 cut points
      const cutPointScores = {};
      for (const c of p.bestCutPoints) {
        const key = `${c.startSecond}-${c.endSecond}`;
        if (!cutPointScores[key] || c.score > cutPointScores[key].score) {
          cutPointScores[key] = c;
        }
      }
      p.topCutPoints = Object.values(cutPointScores)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    }

    return {
      hasData: true,
      creatorId,
      platformInsights,
      totalAnalyses: analyses.rows.length,
      lastAnalyzed: analyses.rows[0].analyzed_at
    };
  }
}

export default new RetentionAnalyzer();