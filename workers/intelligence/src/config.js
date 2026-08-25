const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

let config = {};

try {
  const configPath = path.join(__dirname, '..', 'config.yaml');
  if (fs.existsSync(configPath)) {
    const fileContents = fs.readFileSync(configPath, 'utf8');
    config = yaml.load(fileContents);
  }
} catch (e) {
  console.warn('Could not load config.yaml, using environment variables');
}

module.exports = {
  // Server
  port: config.port || process.env.PORT || 3005,
  nodeEnv: config.nodeEnv || process.env.NODE_ENV || 'development',

  // Database
  database: {
    host: config.database?.host || process.env.DB_HOST || 'localhost',
    port: config.database?.port || process.env.DB_PORT || 5432,
    name: config.database?.name || process.env.DB_NAME || 'social_video',
    user: config.database?.user || process.env.DB_USER || 'postgres',
    password: config.database?.password || process.env.DB_PASSWORD || 'postgres',
    ssl: config.database?.ssl || process.env.DB_SSL === 'true',
    poolSize: config.database?.poolSize || parseInt(process.env.DB_POOL_SIZE) || 20,
  },

  // Redis
  redis: {
    host: config.redis?.host || process.env.REDIS_HOST || 'localhost',
    port: config.redis?.port || process.env.REDIS_PORT || 6379,
    password: config.redis?.password || process.env.REDIS_PASSWORD || undefined,
    db: config.redis?.db || parseInt(process.env.REDIS_DB) || 0,
  },

  // RabbitMQ
  rabbitmq: {
    url: config.rabbitmq?.url || process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
    queues: {
      viralPrediction: 'viral.prediction',
      hookGeneration: 'hook.generation',
      trendToConcept: 'trend.to.concept',
      conceptOptimization: 'concept.optimization',
    },
  },

  // Self-hosted local model endpoint (Ollama OpenAI-compatible API)
  llm: {
    baseUrl: config.llm?.baseUrl || process.env.OLLAMA_OPENAI_COMPATIBLE_URL || 'http://ollama:11434/v1',
    model: config.llm?.model || process.env.OLLAMA_MODEL || 'llama3.2:3b',
    maxTokens: config.llm?.maxTokens || parseInt(process.env.OLLAMA_MAX_TOKENS) || 4096,
    temperature: config.llm?.temperature || parseFloat(process.env.OLLAMA_TEMPERATURE) || 0.7,
    timeoutMs: config.llm?.timeoutMs || parseInt(process.env.OLLAMA_TIMEOUT_MS) || 120000,
  },

  // TensorFlow
  tensorflow: {
    modelPath: config.tensorflow?.modelPath || process.env.TF_MODEL_PATH || './models/viral-predictor',
    enableGpu: config.tensorflow?.enableGpu || process.env.TF_ENABLE_GPU === 'true',
  },

  // Trends worker connection
  trendsWorker: {
    url: config.trendsWorker?.url || process.env.TRENDS_WORKER_URL || 'http://localhost:3004',
  },

  // Processor worker connection
  processorWorker: {
    url: config.processorWorker?.url || process.env.PROCESSOR_WORKER_URL || 'http://localhost:3003',
  },

  // API Gateway
  apiGateway: {
    url: config.apiGateway?.url || process.env.API_GATEWAY_URL || 'http://localhost:3001',
  },

  // Viral prediction thresholds
  viralThresholds: {
    highPotential: config.viralThresholds?.highPotential || 0.75,
    mediumPotential: config.viralThresholds?.mediumPotential || 0.5,
    lowPotential: config.viralThresholds?.lowPotential || 0.25,
  },

  // Hook generation
  hooks: {
    maxHooksPerVideo: config.hooks?.maxHooksPerVideo || 5,
    hookTypes: config.hooks?.hookTypes || ['question', 'statement', 'story', 'controversy', 'curiosity', 'value', 'fear', 'identity'],
    platforms: config.hooks?.platforms || ['tiktok', 'instagram', 'youtube', 'twitter', 'linkedin'],
  },

  // Concept generation
  concepts: {
    maxConceptsPerTrend: config.concepts?.maxConceptsPerTrend || 3,
    minTrendScore: config.concepts?.minTrendScore || 0.6,
    platforms: config.concepts?.platforms || ['tiktok', 'instagram', 'youtube', 'twitter', 'linkedin'],
  },

  // Logging
  logging: {
    level: config.logging?.level || process.env.LOG_LEVEL || 'info',
    format: config.logging?.format || 'json',
  },

  // Health check
  health: {
    interval: config.health?.interval || 30000,
    timeout: config.health?.timeout || 5000,
  },
};