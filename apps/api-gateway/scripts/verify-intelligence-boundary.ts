import { createIntelligenceRoutes } from '../src/routes/intelligence.js';

const retiredRoutes = [
  ['POST', '/predict-viral'],
  ['POST', '/generate-hooks'],
  ['POST', '/generate-concepts'],
  ['POST', '/analyze-trends'],
  ['GET', '/viral-patterns'],
  ['GET', '/optimal-posting-times'],
  ['POST', '/content-audit'],
] as const;

async function verify() {
  const app = createIntelligenceRoutes();
  for (const [method, path] of retiredRoutes) {
    const response = await app.request(`http://localhost${path}`, { method });
    if (response.status !== 410) throw new Error(`${method} ${path} must return 410 while unsupported intelligence claims are disabled.`);
    const message = await response.text();
    if (!message.includes('does not predict or guarantee')) throw new Error(`${method} ${path} must explain the evidence boundary.`);
  }

  const health = await app.request('http://localhost/health');
  if (health.status !== 503) throw new Error('Legacy intelligence health must report unavailable rather than claim models are loaded.');
  console.log('Legacy intelligence boundary verification passed.');
}

verify().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
