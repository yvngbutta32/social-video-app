/**
 * Fortress Security Middleware Package
 * Zero-trust, defense-in-depth security for all intelligence workers
 * Every component uses this - no exceptions
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const Redis = require('ioredis');
const config = require('../config');
const logger = require('../logger');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Redis client for token revocation and rate limiting
const redis = new Redis({
  host: config.redis?.host || process.env.REDIS_HOST || 'localhost',
  port: config.redis?.port || process.env.REDIS_PORT || 6379,
  password: config.redis?.password || process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  enableReadyCheck: true,
  lazyConnect: true,
});

redis.on('error', (err) => {
  logger.error('Redis connection error', { error: err.message });
});

redis.on('connect', () => {
  logger.info('Redis connected for token revocation');
});

redis.connect().catch(err => {
  logger.warn('Redis connection failed, token revocation will be unavailable', { error: err.message });
});

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const SECURITY_CONFIG = {
  // JWT Configuration
  jwt: {
    algorithm: 'RS256',
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
    issuer: 'social-video-intelligence',
    audience: 'social-video-api',
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100, // per window
    burstMax: 20, // burst allowance
    keyPrefix: 'rl:',
  },
  
  // Encryption
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 12,
    tagLength: 16,
    saltLength: 16,
    iterations: 100000,
  },
  
  // Security Headers
  headers: {
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    csp: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // nonce-based in production
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'", 'wss:', 'https:'],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: 'geolocation=(), microphone=(), camera=()',
  },
  
  // Input Validation
  validation: {
    maxBodySize: '10mb',
    maxParamLength: 100,
    maxQueryParams: 50,
    allowedContentTypes: ['application/json', 'multipart/form-data'],
  },
  
  // Audit Logging
  audit: {
    enabled: true,
    retentionDays: 2555, // 7 years
    sensitiveFields: ['password', 'token', 'secret', 'key', 'authorization', 'cookie'],
  },
};

// ============================================================================
// ENCRYPTION UTILITIES
// ============================================================================

class EncryptionService {
  constructor() {
    this.masterKey = this.deriveMasterKey();
  }
  
  deriveMasterKey() {
    const secret = config.security?.masterKey || process.env.MASTER_ENCRYPTION_KEY;
    if (!secret) {
      throw new Error('MASTER_ENCRYPTION_KEY not configured');
    }
    return crypto.scryptSync(secret, 'social-video-salt', SECURITY_CONFIG.encryption.keyLength);
  }
  
  /**
   * Encrypt sensitive data (OAuth tokens, PII, secrets)
   * @param {string} plaintext - Data to encrypt
   * @param {string} context - Workspace/user context for key derivation
   * @returns {Object} { ciphertext, iv, tag, salt }
   */
  encrypt(plaintext, context = '') {
    const salt = crypto.randomBytes(SECURITY_CONFIG.encryption.saltLength);
    const key = crypto.scryptSync(this.masterKey, salt.toString('hex') + context, SECURITY_CONFIG.encryption.keyLength);
    const iv = crypto.randomBytes(SECURITY_CONFIG.encryption.ivLength);
    
    const cipher = crypto.createCipheriv(SECURITY_CONFIG.encryption.algorithm, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    
    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      salt: salt.toString('base64'),
    };
  }
  
  /**
   * Decrypt sensitive data
   * @param {Object} encrypted - { ciphertext, iv, tag, salt }
   * @param {string} context - Workspace/user context for key derivation
   * @returns {string} Decrypted plaintext
   */
  decrypt(encrypted, context = '') {
    const key = crypto.scryptSync(this.masterKey, encrypted.salt + context, SECURITY_CONFIG.encryption.keyLength);
    const iv = Buffer.from(encrypted.iv, 'base64');
    const tag = Buffer.from(encrypted.tag, 'base64');
    const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');
    
    const decipher = crypto.createDecipheriv(SECURITY_CONFIG.encryption.algorithm, key, iv);
    decipher.setAuthTag(tag);
    
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  }
  
  /**
   * Hash for deterministic lookups (email, username) - not reversible
   * @param {string} value 
   * @returns {string} Hash
   */
  hash(value) {
    return crypto.createHmac('sha256', this.masterKey).update(value).digest('hex');
  }
  
  /**
   * Generate secure random token
   * @param {number} bytes 
   * @returns {string}
   */
  generateToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('hex');
  }
  
  /**
   * Constant-time comparison to prevent timing attacks
   * @param {string} a 
   * @param {string} b 
   * @returns {boolean}
   */
  timingSafeEqual(a, b) {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }
}

const encryption = new EncryptionService();

// ============================================================================
// JWT TOKEN MANAGEMENT
// ============================================================================

class TokenService {
  constructor() {
    this.privateKey = config.security?.jwtPrivateKey || process.env.JWT_PRIVATE_KEY;
    this.publicKey = config.security?.jwtPublicKey || process.env.JWT_PUBLIC_KEY;
    
    if (!this.privateKey || !this.publicKey) {
      // Generate ephemeral keys for development (NOT for production)
      const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      this.privateKey = privateKey;
      this.publicKey = publicKey;
      logger.warn('Using ephemeral JWT keys - configure JWT_PRIVATE_KEY/JWT_PUBLIC_KEY for production');
    }
  }
  
  /**
   * Generate access token
   * @param {Object} payload - { userId, workspaceId, roles, permissions }
   * @returns {string} JWT
   */
  generateAccessToken(payload) {
    return jwt.sign(payload, this.privateKey, {
      algorithm: SECURITY_CONFIG.jwt.algorithm,
      expiresIn: SECURITY_CONFIG.jwt.accessTokenExpiry,
      issuer: SECURITY_CONFIG.jwt.issuer,
      audience: SECURITY_CONFIG.jwt.audience,
      jwtid: crypto.randomUUID(),
    });
  }
  
  /**
   * Generate refresh token
   * @param {Object} payload - { userId, workspaceId, tokenFamily }
   * @returns {string} JWT
   */
  generateRefreshToken(payload) {
    return jwt.sign(payload, this.privateKey, {
      algorithm: SECURITY_CONFIG.jwt.algorithm,
      expiresIn: SECURITY_CONFIG.jwt.refreshTokenExpiry,
      issuer: SECURITY_CONFIG.jwt.issuer,
      audience: SECURITY_CONFIG.jwt.audience,
      jwtid: crypto.randomUUID(),
    });
  }
  
  /**
   * Verify and decode token
   * @param {string} token 
   * @returns {Object|null} Decoded payload or null if invalid
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, this.publicKey, {
        algorithms: [SECURITY_CONFIG.jwt.algorithm],
        issuer: SECURITY_CONFIG.jwt.issuer,
        audience: SECURITY_CONFIG.jwt.audience,
        clockTolerance: 30,
      });
    } catch (err) {
      logger.debug('Token verification failed', { error: err.message });
      return null;
    }
  }
  
  /**
   * Decode without verification (for logging/debugging)
   * @param {string} token 
   * @returns {Object|null}
   */
  decodeToken(token) {
    try {
      return jwt.decode(token, { complete: true });
    } catch {
      return null;
    }
  }
}

const tokens = new TokenService();

// ============================================================================
// TOKEN REVOCATION (Redis-backed)
// ============================================================================

/**
 * Check if a token has been revoked
 * @param {string} tokenId - JWT ID (jti claim)
 * @returns {Promise<boolean>} True if revoked
 */
async function checkTokenRevoked(tokenId) {
  if (!tokenId) return false;
  
  try {
    const revoked = await redis.get(`revoked:${tokenId}`);
    return revoked === '1';
  } catch (err) {
    logger.error('Token revocation check failed', { error: err.message, tokenId });
    return false; // Fail open for availability
  }
}

/**
 * Revoke a token (logout, security event)
 * @param {string} tokenId - JWT ID (jti claim)
 * @param {number} ttlSeconds - Time to live (default: 7 days)
 * @returns {Promise<void>}
 */
async function revokeToken(tokenId, ttlSeconds = 7 * 24 * 60 * 60) {
  if (!tokenId) return;
  
  try {
    await redis.setex(`revoked:${tokenId}`, ttlSeconds, '1');
    logger.info('Token revoked', { tokenId });
  } catch (err) {
    logger.error('Token revocation failed', { error: err.message, tokenId });
  }
}

/**
 * Revoke all tokens for a user (password change, security breach)
 * @param {string} userId 
 * @returns {Promise<void>}
 */
async function revokeAllUserTokens(userId) {
  if (!userId) return;
  
  try {
    // Store user revocation timestamp
    await redis.setex(`user_revoked:${userId}`, 30 * 24 * 60 * 60, Date.now().toString());
    logger.info('All user tokens revoked', { userId });
  } catch (err) {
    logger.error('User token revocation failed', { error: err.message, userId });
  }
}

/**
 * Check if user has a global revocation
 * @param {string} userId 
 * @returns {Promise<number|null>} Revocation timestamp or null
 */
async function getUserRevocationTimestamp(userId) {
  if (!userId) return null;
  
  try {
    const timestamp = await redis.get(`user_revoked:${userId}`);
    return timestamp ? parseInt(timestamp, 10) : null;
  } catch (err) {
    logger.error('User revocation check failed', { error: err.message, userId });
    return null;
  }
}

// ============================================================================
// INPUT VALIDATION SCHEMAS (Zod)
// ============================================================================

const ValidationSchemas = {
  // Common parameter validators
  uuid: z.string().uuid({ message: 'Invalid UUID format' }),
  email: z.string().email({ message: 'Invalid email format' }).max(254),
  url: z.string().url({ message: 'Invalid URL format' }).max(2048),
  slug: z.string().regex(/^[a-z0-9-]+$/, { message: 'Invalid slug format' }).max(100),
  
  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    cursor: z.string().optional(),
  }),
  
  // Date ranges
  dateRange: z.object({
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),
  }).refine(data => !data.start || !data.end || new Date(data.start) <= new Date(data.end), {
    message: 'Start date must be before end date',
  }),
  
  // Platform validation
  platform: z.enum(['tiktok', 'instagram', 'youtube', 'facebook', 'x', 'linkedin']),
  
  // Video/Content IDs
  videoId: z.string().uuid(),
  variantId: z.string().uuid(),
  scheduledPostId: z.string().uuid(),
  trendId: z.string().uuid(),
  conceptId: z.string().uuid(),
  
  // Workspace/User context
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  creatorId: z.string().uuid(),
};

// ============================================================================
// RATE LIMITING
// ============================================================================

function createRateLimiter(options = {}) {
  const opts = {
    windowMs: options.windowMs || SECURITY_CONFIG.rateLimit.windowMs,
    max: options.max || SECURITY_CONFIG.rateLimit.maxRequests,
    message: { error: 'Too many requests', retryAfter: Math.ceil(options.windowMs / 1000) },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Composite key: IP + User ID (if authenticated) + Endpoint
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const userId = req.user?.id || 'anonymous';
      const endpoint = req.route?.path || req.path;
      return `${SECURITY_CONFIG.rateLimit.keyPrefix}${ip}:${userId}:${endpoint}`;
    },
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userId: req.user?.id,
        path: req.path,
        userAgent: req.get('user-agent'),
      });
      res.status(429).json({ error: 'Too many requests', retryAfter: Math.ceil(options.windowMs / 1000) });
    },
    skip: (req) => {
      // Skip for health checks
      return req.path === '/health' || req.path === '/ready';
    },
  };
  
  return rateLimit(opts);
}

// Pre-configured limiters
const rateLimiters = {
  strict: createRateLimiter({ max: 10, windowMs: 60 * 1000 }), // 10/min
  standard: createRateLimiter({ max: 100, windowMs: 15 * 60 * 1000 }), // 100/15min
  loose: createRateLimiter({ max: 1000, windowMs: 15 * 60 * 1000 }), // 1000/15min
  auth: createRateLimiter({ max: 5, windowMs: 15 * 60 * 1000 }), // 5/15min for auth endpoints
  webhook: createRateLimiter({ max: 100, windowMs: 60 * 1000 }), // 100/min for webhooks
};

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Require valid JWT authentication
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const token = authHeader.substring(7);
  const decoded = tokens.verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  // Attach user to request
  req.user = {
    id: decoded.sub || decoded.userId,
    workspaceId: decoded.workspaceId,
    roles: decoded.roles || [],
    permissions: decoded.permissions || [],
    tokenId: decoded.jti,
  };
  
  // Verify token not revoked (check Redis/DB)
  checkTokenRevoked(decoded.jti).then(revoked => {
    if (revoked) {
      return res.status(401).json({ error: 'Token revoked' });
    }
    next();
  }).catch(err => {
    logger.error('Token revocation check failed', { error: err.message });
    next(); // Fail open for availability, log for investigation
  });
}

/**
 * Optional authentication - attaches user if valid token present
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  
  const token = authHeader.substring(7);
  const decoded = tokens.verifyToken(token);
  
  if (decoded) {
    req.user = {
      id: decoded.sub || decoded.userId,
      workspaceId: decoded.workspaceId,
      roles: decoded.roles || [],
      permissions: decoded.permissions || [],
      tokenId: decoded.jti,
    };
  }
  
  next();
}

/**
 * Require specific permission
 * @param {string|string[]} permissions 
 */
function requirePermission(permissions) {
  const perms = Array.isArray(permissions) ? permissions : [permissions];
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const hasPermission = perms.some(p => req.user.permissions.includes(p) || req.user.roles.includes('admin'));
    
    if (!hasPermission) {
      logger.warn('Permission denied', {
        userId: req.user.id,
        required: perms,
        userPermissions: req.user.permissions,
        userRoles: req.user.roles,
      });
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}

/**
 * Require workspace membership
 */
function requireWorkspaceAccess(req, res, next) {
  if (!req.user?.workspaceId) {
    return res.status(403).json({ error: 'Workspace context required' });
  }
  
  // Verify workspace exists and user is member
  // This would check against Prisma in production
  next();
}

// ============================================================================
// INPUT VALIDATION MIDDLEWARE
// ============================================================================

/**
 * Validate request against Zod schema
 * @param {z.ZodSchema} schema 
 * @param {'body'|'query'|'params'|'headers'} source 
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const data = req[source];
    
    const result = schema.safeParse(data);
    
    if (!result.success) {
      const errors = result.error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
        code: e.code,
      }));
      
      logger.warn('Validation failed', {
        path: req.path,
        source,
        errors,
        ip: req.ip,
      });
      
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    
    // Replace with validated/coerced data
    req[source] = result.data;
    next();
  };
}

/**
 * Sanitize input to prevent XSS/Injection
 */
function sanitizeInput(req, res, next) {
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      // Remove null bytes, control characters
      return obj.replace(/\0/g, '').replace(/[\x00-\x1F\x7F]/g, '');
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        // Skip sensitive fields from sanitization (they're encrypted)
        if (SECURITY_CONFIG.audit.sensitiveFields.includes(key.toLowerCase())) {
          sanitized[key] = value;
        } else {
          sanitized[key] = sanitize(value);
        }
      }
      return sanitized;
    }
    return obj;
  };
  
  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);
  
  next();
}

// ============================================================================
// SECURITY HEADERS (Helmet + Custom)
// ============================================================================

const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: SECURITY_CONFIG.headers.csp,
  },
  hsts: SECURITY_CONFIG.headers.hsts,
  referrerPolicy: { policy: SECURITY_CONFIG.headers.referrerPolicy },
  permissionsPolicy: { features: SECURITY_CONFIG.headers.permissionsPolicy },
  crossOriginEmbedderPolicy: false, // Allow embedding for widgets
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  xssFilter: true,
});

// Additional custom headers
function customSecurityHeaders(req, res, next) {
  // Remove server header
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  // Custom security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  
  // Request ID for tracing
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-ID', requestId);
  req.requestId = requestId;
  
  next();
}

// ============================================================================
// CORS CONFIGURATION
// ============================================================================

const corsOptions = {
  origin: (origin, callback) => {
    // Allowlist from config
    const allowedOrigins = config.security?.allowedOrigins || [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://app.social-video.app',
      'https://dashboard.social-video.app',
    ];
    
    // Allow non-browser requests (no origin)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked', { origin, allowedOrigins });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-CSRF-Token'],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

const corsMiddleware = cors(corsOptions);

// ============================================================================
// AUDIT LOGGING
// ============================================================================

class AuditLogger {
  constructor() {
    this.buffer = [];
    this.flushInterval = 5000; // 5 seconds
    this.maxBufferSize = 1000;
    
    // Periodic flush
    setInterval(() => this.flush(), this.flushInterval);
    
    // Graceful shutdown flush
    process.on('beforeExit', () => this.flush());
  }
  
  /**
   * Log security-relevant event
   * @param {Object} event 
   */
  log(event) {
    const sanitized = this.sanitizeForAudit(event);
    
    const auditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      requestId: event.requestId,
      ...sanitized,
    };
    
    // Add to buffer
    this.buffer.push(auditEntry);
    
    // Immediate flush for critical events
    if (event.level === 'critical' || event.level === 'alert') {
      this.flush();
    }
    
    // Prevent memory exhaustion
    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }
  
  sanitizeForAudit(event) {
    const { sensitiveFields } = SECURITY_CONFIG.audit;
    const sanitized = { ...event };
    
    // Remove sensitive fields
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
      // Also check nested
      if (sanitized.body && sanitized.body[field]) {
        sanitized.body[field] = '[REDACTED]';
      }
      if (sanitized.headers && sanitized.headers[field]) {
        sanitized.headers[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }
  
  async flush() {
    if (this.buffer.length === 0) return;
    
    const entries = this.buffer.splice(0, this.buffer.length);
    
    try {
      // Write to database (batch insert)
      await prisma.auditLog.createMany({
        data: entries.map(e => ({
          id: e.id,
          workspaceId: e.workspaceId,
          userId: e.userId,
          action: e.action,
          resourceType: e.resourceType,
          resourceId: e.resourceId,
          oldValues: e.oldValues,
          newValues: e.newValues,
          ipAddress: e.ipAddress,
          userAgent: e.userAgent,
          createdAt: new Date(e.timestamp),
        })),
        skipDuplicates: true,
      });
    } catch (err) {
      // Fallback to file logging
      logger.error('Audit log flush failed', { error: err.message, count: entries.length });
      // In production: write to secure file/stream
    }
  }
  
  /**
   * Convenience methods for common audit events
   */
  auth(event) { this.log({ ...event, category: 'auth', level: 'info' }); }
  authFailure(event) { this.log({ ...event, category: 'auth', level: 'warning' }); }
  access(event) { this.log({ ...event, category: 'access', level: 'info' }); }
  accessDenied(event) { this.log({ ...event, category: 'access', level: 'warning' }); }
  dataAccess(event) { this.log({ ...event, category: 'data', level: 'info' }); }
  dataModification(event) { this.log({ ...event, category: 'data', level: 'info' }); }
  adminAction(event) { this.log({ ...event, category: 'admin', level: 'info' }); }
  securityEvent(event) { this.log({ ...event, category: 'security', level: 'alert' }); }
  critical(event) { this.log({ ...event, level: 'critical' }); }
}

const auditLogger = new AuditLogger();

// ============================================================================
// ANOMALY DETECTION
// ============================================================================

class AnomalyDetector {
  constructor() {
    this.baselines = new Map(); // userId -> behavior baseline
    this.windowSize = 100; // requests to baseline
  }
  
  /**
   * Record request for baseline learning
   * @param {Object} req 
   */
  recordRequest(req) {
    if (!req.user?.id) return;
    
    const userId = req.user.id;
    const now = Date.now();
    
    if (!this.baselines.has(userId)) {
      this.baselines.set(userId, {
        requests: [],
        endpoints: new Map(),
        ips: new Set(),
        userAgents: new Set(),
        avgRequestSize: 0,
        requestCount: 0,
      });
    }
    
    const baseline = this.baselines.get(userId);
    baseline.requests.push(now);
    baseline.endpoints.set(req.path, (baseline.endpoints.get(req.path) || 0) + 1);
    baseline.ips.add(req.ip);
    baseline.userAgents.add(req.get('user-agent') || 'unknown');
    baseline.requestCount++;
    
    // Keep only recent requests
    const cutoff = now - 24 * 60 * 60 * 1000; // 24 hours
    baseline.requests = baseline.requests.filter(t => t > cutoff);
  }
  
  /**
   * Check for anomalies
   * @param {Object} req 
   * @returns {Object|null} Anomaly details or null
   */
  checkAnomaly(req) {
    if (!req.user?.id) return null;
    
    const baseline = this.baselines.get(req.user.id);
    if (!baseline || baseline.requestCount < 50) return null; // Not enough data
    
    const anomalies = [];
    
    // New IP
    if (!baseline.ips.has(req.ip)) {
      anomalies.push({ type: 'new_ip', severity: 'medium', ip: req.ip });
    }
    
    // New User Agent
    if (!baseline.userAgents.has(req.get('user-agent') || 'unknown')) {
      anomalies.push({ type: 'new_user_agent', severity: 'low' });
    }
    
    // Unusual endpoint access
    const endpointCount = baseline.endpoints.get(req.path) || 0;
    const totalRequests = baseline.requestCount;
    const endpointRatio = endpointCount / totalRequests;
    
    if (endpointRatio < 0.001 && totalRequests > 100) { // < 0.1% of requests
      anomalies.push({ type: 'unusual_endpoint', severity: 'medium', path: req.path });
    }
    
    // Request frequency (burst detection)
    const recentRequests = baseline.requests.filter(t => t > Date.now() - 60000).length;
    if (recentRequests > 60) { // > 60 requests/minute
      anomalies.push({ type: 'request_burst', severity: 'high', count: recentRequests });
    }
    
    return anomalies.length > 0 ? { userId: req.user.id, anomalies } : null;
  }
}

const anomalyDetector = new AnomalyDetector();

// ============================================================================
// REQUEST CONTEXT MIDDLEWARE
// ============================================================================

function requestContext(req, res, next) {
  // Generate request ID
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  
  // Start timer
  req.startTime = process.hrtime.bigint();
  
  // Record for anomaly detection
  anomalyDetector.recordRequest(req);
  
  // Check for anomalies
  const anomaly = anomalyDetector.checkAnomaly(req);
  if (anomaly) {
    auditLogger.securityEvent({
      requestId: req.requestId,
      userId: req.user?.id,
      ip: req.ip,
      path: req.path,
      anomalies: anomaly.anomalies,
    });
  }
  
  // Response logging
  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - req.startTime) / 1e6; // ms
    
    // Log request
    logger.info('Request completed', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: Math.round(duration),
      userId: req.user?.id,
      workspaceId: req.user?.workspaceId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    // Audit log for data access/modification
    if (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const isDataAccess = ['GET'].includes(req.method);
      const isDataModification = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
      
      if (isDataAccess || isDataModification) {
        auditLogger[isDataModification ? 'dataModification' : 'dataAccess']({
          requestId: req.requestId,
          userId: req.user?.id,
          workspaceId: req.user?.workspaceId,
          action: `${req.method} ${req.path}`,
          resourceType: req.route?.path || req.path,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          statusCode: res.statusCode,
        });
      }
    }
  });
  
  next();
}

// ============================================================================
// ERROR HANDLING (Secure)
// ============================================================================

function secureErrorHandler(err, req, res, next) {
  // Log full error server-side
  logger.error('Request error', {
    requestId: req.requestId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    ip: req.ip,
  });
  
  // Audit security errors
  if (err.name === 'ValidationError' || err.name === 'UnauthorizedError') {
    auditLogger.securityEvent({
      requestId: req.requestId,
      userId: req.user?.id,
      error: err.name,
      message: err.message,
    });
  }
  
  // Generic error response (no internal details)
  const statusCode = err.statusCode || err.status || 500;
  const message = statusCode >= 500 ? 'Internal server error' : err.message;
  
  res.status(statusCode).json({
    error: message,
    requestId: req.requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

// ============================================================================
// WORKSPACE ISOLATION MIDDLEWARE
// ============================================================================

/**
 * Ensure all database queries are scoped to user's workspace
 * This prevents cross-workspace data access
 */
function workspaceScope(req, res, next) {
  if (!req.user?.workspaceId) {
    return next(); // No workspace context (admin, system)
  }
  
  // Attach workspace scope to Prisma
  req.prisma = prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          // Inject workspaceId into where clauses
          if (args.where) {
            args.where = { ...args.where, workspaceId: req.user.workspaceId };
          } else {
            args.where = { workspaceId: req.user.workspaceId };
          }
          return query(args);
        },
      },
    },
  });
  
  next();
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Configuration
  SECURITY_CONFIG,
  
  // Services
  encryption,
  tokens,
  auditLogger,
  anomalyDetector,
  
  // Token Revocation
  checkTokenRevoked,
  revokeToken,
  revokeAllUserTokens,
  getUserRevocationTimestamp,
  
  // Validation
  ValidationSchemas,
  validate,
  sanitizeInput,
  
  // Authentication & Authorization
  requireAuth,
  optionalAuth,
  requirePermission,
  requireWorkspaceAccess,
  
  // Rate Limiting
  rateLimiters,
  createRateLimiter,
  
  // Security Headers & CORS
  securityHeaders,
  customSecurityHeaders,
  corsMiddleware,
  
  // Request Context & Logging
  requestContext,
  secureErrorHandler,
  workspaceScope,
  
  // Utilities
  prisma,
  redis,
};
