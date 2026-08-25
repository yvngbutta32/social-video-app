const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const compose = fs.readFileSync(path.join(root, 'docker-compose.yml'), 'utf8');
const config = fs.readFileSync(path.join(root, 'workers/intelligence/config.yaml'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'workers/intelligence/package.json'), 'utf8'));
const hooks = fs.readFileSync(path.join(root, 'workers/intelligence/src/hooks/generator.js'), 'utf8');
const concepts = fs.readFileSync(path.join(root, 'workers/intelligence/src/concepts/generator.js'), 'utf8');

assert.match(compose, /OLLAMA_OPENAI_COMPATIBLE_URL=http:\/\/ollama:11434\/v1/);
assert.match(compose, /OLLAMA_MODEL=\$\{OLLAMA_MODEL:-llama3\.2:3b\}/);
assert.doesNotMatch(compose, /OPENAI_API_KEY|openai_api_key/i);
assert.match(config, /^llm:/m);
assert.doesNotMatch(config, /sk-[A-Za-z0-9_-]{12,}/);
assert.equal(packageJson.dependencies.openai, undefined);
assert.match(hooks, /LocalChatClient/);
assert.match(concepts, /LocalChatClient/);
assert.doesNotMatch(hooks, /new OpenAI/);
assert.doesNotMatch(concepts, /new OpenAI/);

console.log('Standalone deployment verification passed.');
