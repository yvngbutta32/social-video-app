/**
 * Viral Prediction Model - TensorFlow.js with fallback to heuristic scoring
 * Predicts viral potential of videos based on content features
 * Includes training pipeline for continuous learning from post_metrics
 */

import { config } from '../config.js';
import { logger } from '../logger.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Try to load TensorFlow.js, fallback to heuristic if not available
let tf = null;
let tfLoadAttempted = false;

async function loadTensorFlow() {
  if (tfLoadAttempted) return tf;
  tfLoadAttempted = true;
  
  try {
    tf = await import('@tensorflow/tfjs-node');
    logger.info('TensorFlow.js loaded successfully');
  } catch (err) {
    logger.warn('TensorFlow.js not available, using heuristic viral scoring', { error: err.message });
    tf = null;
  }
  return tf;
}

export class ViralPredictor {
  constructor() {
    this.model = null;
    this.isLoaded = false;
    this.modelVersion = '1.0.0';
    this.useHeuristic = !tf;
    this.featureNames = [
      'durationSec',
      'hasCaptions',
      'hasMusic',
      'hasTextOverlay',
      'hashtagCount',
      'mentionCount',
      'isSeries',
      'postingHour',
      'postingDayOfWeek',
      'followerCount',
      'previousAvgViews',
      'previousAvgEngagementRate',
      'contentType_educational',
      'contentType_entertainment',
      'contentType_promotional',
      'contentType_behind_scenes',
      'contentType_user_generated',
      'contentType_news',
      'contentType_lifestyle',
      'contentType_comedy',
      'contentType_dance',
      'contentType_beauty',
      'contentType_fitness',
      'contentType_tech',
      'contentType_finance',
      'contentType_travel',
      'contentType_food',
      'contentType_pets',
      'contentType_gaming',
      'contentType_diy',
      'platform_tiktok',
      'platform_instagram',
      'platform_youtube',
      'platform_facebook',
      'platform_x',
      'platform_linkedin',
    ];
  }

  /**
   * Load or create the model
   */
  async load() {
    if (this.isLoaded) return;

    // Try to load TensorFlow.js if not already attempted
    if (!tfLoadAttempted) {
      await loadTensorFlow();
      this.useHeuristic = !tf;
    }

    if (this.useHeuristic) {
      logger.info('Using heuristic viral scoring (TensorFlow.js not available)');
      this.isLoaded = true;
      return;
    }

    try {
      // Try to load existing model
      this.model = await tf.loadLayersModel(`file://${config.MODEL_PATH}/model.json`);
      this.isLoaded = true;
      logger.info('Viral prediction model loaded from disk');
    } catch (err) {
      logger.warn('No existing model found, creating new model');
      await this.createModel();
    }
  }

  /**
   * Create a new neural network model
   */
  async createModel() {
    if (!tf) {
      this.useHeuristic = true;
      this.isLoaded = true;
      return;
    }

    const model = tf.sequential();

    // Input layer
    model.add(tf.layers.dense({
      inputShape: [this.featureNames.length],
      units: 128,
      activation: 'relu',
      kernelRegularizer: tf.regularizers.l2({ l2: 0.01 }),
    }));

    model.add(tf.layers.dropout({ rate: 0.3 }));

    // Hidden layers
    model.add(tf.layers.dense({
      units: 64,
      activation: 'relu',
      kernelRegularizer: tf.regularizers.l2({ l2: 0.01 }),
    }));

    model.add(tf.layers.dropout({ rate: 0.2 }));

    model.add(tf.layers.dense({
      units: 32,
      activation: 'relu',
    }));

    // Output layer - viral score (0-1)
    model.add(tf.layers.dense({
      units: 1,
      activation: 'sigmoid',
    }));

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy', 'AUC'],
    });

    this.model = model;
    this.isLoaded = true;
    logger.info('New viral prediction model created');
  }

  /**
   * Prepare features for prediction
   */
  prepareFeatures(input) {
    const features = new Array(this.featureNames.length).fill(0);

    // Numerical features
    features[0] = input.durationSec / 600; // Normalize to 0-1 (max 10 min)
    features[1] = input.hasCaptions ? 1 : 0;
    features[2] = input.hasMusic ? 1 : 0;
    features[3] = input.hasTextOverlay ? 1 : 0;
    features[4] = Math.min(input.hashtagCount / 30, 1);
    features[5] = Math.min(input.mentionCount / 10, 1);
    features[6] = input.isSeries ? 1 : 0;
    features[7] = (input.postingHour || 12) / 23;
    features[8] = (input.postingDayOfWeek || 0) / 6;
    features[9] = Math.min((input.followerCount || 1000) / 1000000, 1);
    features[10] = Math.min((input.previousAvgViews || 1000) / 1000000, 1);
    features[11] = (input.previousAvgEngagementRate || 0) / 100;

    // Content type one-hot encoding
    const contentTypes = [
      'educational', 'entertainment', 'promotional', 'behind_scenes',
      'user_generated', 'news', 'lifestyle', 'comedy', 'dance',
      'beauty', 'fitness', 'tech', 'finance', 'travel', 'food',
      'pets', 'gaming', 'diy'
    ];
    const contentTypeIndex = contentTypes.indexOf(input.contentType);
    if (contentTypeIndex >= 0) {
      features[12 + contentTypeIndex] = 1;
    }

    // Platform one-hot encoding
    const platforms = ['tiktok', 'instagram', 'youtube', 'facebook', 'x', 'linkedin'];
    const platformIndex = platforms.indexOf(input.platform);
    if (platformIndex >= 0) {
      features[30 + platformIndex] = 1;
    }

    return tf.tensor2d([features], [1, this.featureNames.length]);
  }

  /**
   * Predict viral score for a video
   */
  async predict(input) {
    if (!this.isLoaded) {
      await this.load();
    }

    const features = this.prepareFeatures(input);
    const prediction = this.model.predict(features);
    const viralScore = prediction.dataSync()[0];
    
    features.dispose();
    prediction.dispose();

    // Calculate confidence based on feature completeness
    const confidence = this.calculateConfidence(input);

    // Predict views based on follower count and viral score
    const baseViews = input.followerCount || 1000;
    const predictedViews = Math.round(baseViews * (0.1 + viralScore * 2));
    const predictedEngagementRate = viralScore * 10;
    const predictedCompletionRate = viralScore * 0.8;

    return {
      viralScore,
      confidence,
      predictedViews,
      predictedEngagementRate,
      predictedCompletionRate,
      factors: this.getFactorAnalysis(input, viralScore),
      recommendations: this.getRecommendations(input, viralScore),
      riskFactors: this.getRiskFactors(input),
      benchmarkPercentile: Math.round(viralScore * 100),
    };
  }

  /**
   * Calculate prediction confidence
   */
  calculateConfidence(input) {
    let confidence = 0.5;
    
    if (input.previousAvgViews && input.previousAvgViews > 1000) confidence += 0.2;
    if (input.previousAvgEngagementRate && input.previousAvgEngagementRate > 2) confidence += 0.15;
    if (input.followerCount && input.followerCount > 10000) confidence += 0.1;
    if (input.hasCaptions) confidence += 0.05;
    
    return Math.min(confidence, 0.95);
  }

  /**
   * Analyze contributing factors
   */
  getFactorAnalysis(input, viralScore) {
    return {
      duration: input.durationSec >= 15 && input.durationSec <= 30 ? 'optimal' : 'suboptimal',
      captions: input.hasCaptions ? 'present' : 'missing',
      hashtags: input.hashtagCount >= 3 && input.hashtagCount <= 10 ? 'optimal' : 'suboptimal',
      postingTime: input.postingHour !== undefined && [9,10,11,12,13,17,18,19,20,21].includes(input.postingHour) ? 'optimal' : 'suboptimal',
    };
  }

  /**
   * Get optimization recommendations
   */
  getRecommendations(input, viralScore) {
    const recs = [];
    
    if (!input.hasCaptions) recs.push('Add captions for better retention');
    if (input.hashtagCount < 3) recs.push('Add 3-10 relevant hashtags');
    if (input.postingHour === undefined) recs.push('Post during peak hours (9-13, 17-21)');
    if (input.durationSec > 60) recs.push('Consider shortening to 15-30 seconds for better completion');
    if (!input.hasMusic && viralScore < 0.5) recs.push('Add trending background music');
    
    return recs;
  }

  /**
   * Get risk factors
   */
  getRiskFactors(input) {
    const risks = [];
    
    if (input.durationSec > 60) risks.push('Video too long for short-form platform');
    if (input.hashtagCount > 15) risks.push('Too many hashtags may look spammy');
    if (input.followerCount && input.followerCount < 100) risks.push('Low follower count limits initial reach');
    
    return risks;
  }

  /**
   * Train the model on historical data from post_metrics
   * This is the main training pipeline that should be run nightly
   */
  async trainFromPostMetrics(workspaceId, options = {}) {
    if (!this.isLoaded) {
      await this.load();
    }

    const { 
      epochs = 50, 
      batchSize = 32, 
      validationSplit = 0.2,
      daysBack = 90,
      minSamples = 100 
    } = options;

    logger.info('Starting model training from post_metrics', { workspaceId, daysBack });

    // Fetch training data from post_metrics hypertable
    const trainingData = await this.fetchTrainingData(workspaceId, daysBack);
    
    if (trainingData.length < minSamples) {
      logger.warn('Insufficient training data', { samples: trainingData.length, minSamples });
      return { success: false, reason: 'Insufficient training data' };
    }

    const { features, labels } = this.prepareTrainingData(trainingData);
    
    const history = await this.model.fit(features, labels, {
      epochs,
      batchSize,
      validationSplit,
      callbacks: [
        tf.callbacks.earlyStopping({ patience: 10, restoreBestWeights: true }),
        tf.callbacks.reduceLROnPlateau({ patience: 5, factor: 0.5 }),
        tf.callbacks.modelCheckpoint(`file://${config.MODEL_PATH}/checkpoint`, { saveBestOnly: true }),
      ],
      verbose: 1,
    });

    // Increment model version
    this.modelVersion = this.incrementVersion(this.modelVersion);
    
    // Save model with new version
    await this.model.save(`file://${config.MODEL_PATH}/model_v${this.modelVersion}.json`);
    await this.model.save(`file://${config.MODEL_PATH}/model.json`); // Latest
    
    logger.info('Model trained and saved', { 
      version: this.modelVersion, 
      epochs: history.epoch.length, 
      finalLoss: history.history.loss[history.history.loss.length - 1],
      samples: trainingData.length 
    });

    features.dispose();
    labels.dispose();

    return { 
      success: true, 
      version: this.modelVersion,
      history: {
        loss: history.history.loss,
        valLoss: history.history.val_loss,
        accuracy: history.history.accuracy,
        valAccuracy: history.history.val_accuracy,
      }
    };
  }

  /**
   * Nightly training job - should be scheduled via cron
   * Trains model on all workspaces with sufficient data
   */
  async runNightlyTraining() {
    logger.info('Starting nightly training job');
    
    // Get all workspaces with sufficient posted content
    const workspaces = await prisma.workspace.findMany({
      where: {
        scheduledPosts: {
          some: {
            status: 'posted',
            postedAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
          },
        },
      },
      select: { id: true },
    });

    const results = [];
    for (const ws of workspaces) {
      try {
        const result = await this.trainFromPostMetrics(ws.id, { daysBack: 90 });
        results.push({ workspaceId: ws.id, ...result });
      } catch (err) {
        logger.error('Nightly training failed for workspace', { workspaceId: ws.id, error: err.message });
        results.push({ workspaceId: ws.id, success: false, error: err.message });
      }
    }

    logger.info('Nightly training job completed', { results });
    return results;
  }

  /**
   * Fetch training data from post_metrics hypertable
   */
  async fetchTrainingData(workspaceId, daysBack) {
    const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    
    // Get posts with metrics
    const posts = await prisma.scheduledPost.findMany({
      where: {
        workspaceId,
        status: 'posted',
        postedAt: { gte: cutoffDate },
      },
      include: {
        variant: {
          include: {
            video: true,
            scheduledPosts: {
              include: {
                metrics: { orderBy: { recordedAt: 'desc' }, take: 1 },
                socialAccount: true,
              },
            },
          },
        },
        socialAccount: true,
      },
    });

    const trainingData = [];
    
    for (const post of posts) {
      const variant = post.variant;
      const video = variant?.video;
      const latestMetric = post.metrics[0];
      
      if (!latestMetric || !video) continue;
      
      // Calculate viral label: 1 if views > 2x follower count (viral threshold)
      const followerCount = post.socialAccount?.followerCount || 1000;
      const views = Number(latestMetric.views);
      const isViral = views > followerCount * 2;
      
      trainingData.push({
        // Features
        durationSec: Number(variant.durationSeconds || 30),
        hasCaptions: !!variant.caption,
        hasMusic: true, // Would need audio analysis
        hasTextOverlay: !!variant.hookText,
        hashtagCount: variant.hashtags?.length || 0,
        mentionCount: 0, // Would need caption parsing
        isSeries: false,
        postingHour: post.postedAt ? new Date(post.postedAt).getHours() : 12,
        postingDayOfWeek: post.postedAt ? new Date(post.postedAt).getDay() : 0,
        followerCount,
        previousAvgViews: 1000, // Would need historical aggregation
        previousAvgEngagementRate: 0,
        contentType: 'entertainment', // Would need classification
        platform: post.socialAccount?.platform || 'tiktok',
        
        // Label
        viral: isViral ? 1 : 0,
        views,
        engagementRate: latestMetric.views > 0 
          ? (Number(latestMetric.likes) + Number(latestMetric.comments) + Number(latestMetric.shares)) / Number(latestMetric.views)
          : 0,
      });
    }
    
    return trainingData;
  }

  /**
   * Prepare features for prediction
   */
  prepareFeatures(input) {
    const features = new Array(this.featureNames.length).fill(0);

    // Numerical features
    features[0] = input.durationSec / 600; // Normalize to 0-1 (max 10 min)
    features[1] = input.hasCaptions ? 1 : 0;
    features[2] = input.hasMusic ? 1 : 0;
    features[3] = input.hasTextOverlay ? 1 : 0;
    features[4] = Math.min(input.hashtagCount / 30, 1);
    features[5] = Math.min(input.mentionCount / 10, 1);
    features[6] = input.isSeries ? 1 : 0;
    features[7] = (input.postingHour || 12) / 23;
    features[8] = (input.postingDayOfWeek || 0) / 6;
    features[9] = Math.min((input.followerCount || 1000) / 1000000, 1);
    features[10] = Math.min((input.previousAvgViews || 1000) / 1000000, 1);
    features[11] = (input.previousAvgEngagementRate || 0) / 100;

    // Content type one-hot encoding
    const contentTypes = [
      'educational', 'entertainment', 'promotional', 'behind_scenes',
      'user_generated', 'news', 'lifestyle', 'comedy', 'dance',
      'beauty', 'fitness', 'tech', 'finance', 'travel', 'food',
      'pets', 'gaming', 'diy'
    ];
    const contentTypeIndex = contentTypes.indexOf(input.contentType);
    if (contentTypeIndex >= 0) {
      features[12 + contentTypeIndex] = 1;
    }

    // Platform one-hot encoding
    const platforms = ['tiktok', 'instagram', 'youtube', 'facebook', 'x', 'linkedin'];
    const platformIndex = platforms.indexOf(input.platform);
    if (platformIndex >= 0) {
      features[30 + platformIndex] = 1;
    }

    return tf.tensor2d([features], [1, this.featureNames.length]);
  }

  /**
   * Prepare training data from historical posts
   */
  prepareTrainingData(posts) {
    const featureArrays = [];
    const labelArrays = [];

    for (const post of posts) {
      const features = this.prepareFeatures(post);
      featureArrays.push(features);
      
      // Label: 1 if viral, 0 otherwise
      labelArrays.push(tf.tensor2d([[post.viral]], [1, 1]));
    }

    return {
      features: tf.concat(featureArrays, 0),
      labels: tf.concat(labelArrays, 0),
    };
  }

  /**
   * Increment model version
   */
  incrementVersion(version) {
    const parts = version.split('.').map(Number);
    parts[2] += 1; // Increment patch version
    return parts.join('.');
  }

  /**
   * Calculate prediction confidence
   */
  calculateConfidence(input) {
    let confidence = 0.5;
    
    if (input.previousAvgViews && input.previousAvgViews > 1000) confidence += 0.2;
    if (input.previousAvgEngagementRate && input.previousAvgEngagementRate > 2) confidence += 0.15;
    if (input.followerCount && input.followerCount > 10000) confidence += 0.1;
    if (input.hasCaptions) confidence += 0.05;
    
    return Math.min(confidence, 0.95);
  }

  /**
   * Analyze contributing factors
   */
  getFactorAnalysis(input, viralScore) {
    return {
      duration: input.durationSec >= 15 && input.durationSec <= 30 ? 'optimal' : 'suboptimal',
      captions: input.hasCaptions ? 'present' : 'missing',
      hashtags: input.hashtagCount >= 3 && input.hashtagCount <= 10 ? 'optimal' : 'suboptimal',
      postingTime: input.postingHour !== undefined && [9,10,11,12,13,17,18,19,20,21].includes(input.postingHour) ? 'optimal' : 'suboptimal',
    };
  }

  /**
   * Get optimization recommendations
   */
  getRecommendations(input, viralScore) {
    const recs = [];
    
    if (!input.hasCaptions) recs.push('Add captions for better retention');
    if (input.hashtagCount < 3) recs.push('Add 3-10 relevant hashtags');
    if (input.postingHour === undefined) recs.push('Post during peak hours (9-13, 17-21)');
    if (input.durationSec > 60) recs.push('Consider shortening to 15-30 seconds for better completion');
    if (!input.hasMusic && viralScore < 0.5) recs.push('Add trending background music');
    
    return recs;
  }

  /**
   * Get risk factors
   */
  getRiskFactors(input) {
    const risks = [];
    
    if (input.durationSec > 60) risks.push('Video too long for short-form platform');
    if (input.hashtagCount > 15) risks.push('Too many hashtags may look spammy');
    if (input.followerCount && input.followerCount < 100) risks.push('Low follower count limits initial reach');
    
    return risks;
  }

  /**
   * Retrain model with new data (incremental learning)
   */
  async retrain(newPosts) {
    if (!this.isLoaded) {
      await this.load();
    }

    const { features, labels } = this.prepareTrainingData(newPosts);
    
    await this.model.fit(features, labels, {
      epochs: 10,
      batchSize: 16,
      verbose: 0,
    });

    // Save updated model
    await this.model.save(`file://${config.MODEL_PATH}`);
    logger.info('Model retrained with new data');

    features.dispose();
    labels.dispose();
  }

  /**
   * Evaluate model performance on test set
   */
  async evaluate(testWorkspaceId, daysBack = 30) {
    if (!this.isLoaded) {
      await this.load();
    }

    const testData = await this.fetchTrainingData(testWorkspaceId, daysBack);
    
    if (testData.length === 0) {
      return { success: false, reason: 'No test data available' };
    }

    const { features, labels } = this.prepareTrainingData(testData);
    const evaluation = await this.model.evaluate(features, labels, { verbose: 0 });
    
    features.dispose();
    labels.dispose();

    return {
      success: true,
      loss: evaluation[0],
      accuracy: evaluation[1],
      auc: evaluation[2],
      samples: testData.length,
    };
  }

  /**
   * Export model for deployment (TensorFlow.js format)
   */
  async exportForDeployment(exportPath) {
    if (!this.isLoaded) {
      await this.load();
    }

    await this.model.save(`file://${exportPath}`);
    logger.info('Model exported for deployment', { path: exportPath });
  }

  /**
   * Get model summary for debugging
   */
  getModelSummary() {
    if (!this.isLoaded) {
      return { loaded: false };
    }

    return {
      loaded: true,
      version: this.modelVersion,
      inputShape: this.model.inputs[0].shape,
      outputShape: this.model.outputs[0].shape,
      totalParams: this.model.countParams(),
      trainableParams: this.model.trainableParams,
      nonTrainableParams: this.model.nonTrainableParams,
      layers: this.model.layers.map(l => ({
        name: l.name,
        inputShape: l.inputShape,
        outputShape: l.outputShape,
        params: l.countParams(),
      })),
    };
  }
}

export default new ViralPredictor();
