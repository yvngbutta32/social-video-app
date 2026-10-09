import { runStagingPreflight } from '../src/staging-preflight.js';

const result = await runStagingPreflight();
console.log(JSON.stringify(result, null, 2));
if (!result.healthy) process.exitCode = 1;
