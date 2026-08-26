import { Hono, type Handler } from 'hono';

import type { Variables } from '../index.js';

const retiredIntelligenceMessage = 'This legacy intelligence capability is unavailable until it is rebuilt around creator-authorized platform metrics, transparent evidence, and deployment-verified local processing. ViralBoost does not predict or guarantee reach, virality, fame, or platform placement.';

const evidenceRequired: Handler<{ Variables: Variables }> = (c) => c.json({ error: retiredIntelligenceMessage }, 410);

/**
 * Retains the historical route namespace without exposing unsupported scoring,
 * timing, trend, or synthetic-growth claims. Creator workflows use the
 * evidence-backed growth, adaptation, and analytics routes instead.
 */
export function createIntelligenceRoutes() {
  const app = new Hono<{ Variables: Variables }>();

  app.post('/predict-viral', evidenceRequired);
  app.post('/generate-hooks', evidenceRequired);
  app.post('/generate-concepts', evidenceRequired);
  app.post('/analyze-trends', evidenceRequired);
  app.get('/viral-patterns', evidenceRequired);
  app.get('/optimal-posting-times', evidenceRequired);
  app.post('/content-audit', evidenceRequired);
  app.get('/health', (c) => c.json({
    success: false,
    data: {
      status: 'unavailable',
      reason: 'Legacy intelligence routes are intentionally disabled until evidence-backed local processing and authorized metric inputs are deployed.',
    },
  }, 503));

  return app;
}
