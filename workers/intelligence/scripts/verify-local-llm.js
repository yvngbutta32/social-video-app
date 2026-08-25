const assert = require('node:assert/strict');
const { LocalChatClient } = require('../src/lib/local-llm');

async function main() {
  const originalFetch = global.fetch;
  let capturedRequest;

  global.fetch = async (url, options) => {
    capturedRequest = { url, options };
    return {
      ok: true,
      json: async () => ({
        id: 'local-completion-1',
        choices: [{ message: { role: 'assistant', content: '{"status":"local"}' } }],
      }),
    };
  };

  try {
    const client = new LocalChatClient({
      baseUrl: 'http://ollama:11434/v1/',
      model: 'llama3.2:3b',
      timeoutMs: 1000,
    });
    const completion = await client.chat.completions.create({
      messages: [{ role: 'user', content: 'Return JSON only.' }],
      responseFormat: { type: 'json_object' },
    });

    const body = JSON.parse(capturedRequest.options.body);
    assert.equal(capturedRequest.url, 'http://ollama:11434/v1/chat/completions');
    assert.equal(body.model, 'llama3.2:3b');
    assert.equal(body.stream, false);
    assert.deepEqual(body.response_format, { type: 'json_object' });
    assert.equal(completion.choices[0].message.content, '{"status":"local"}');

    console.log('Self-hosted local-model adapter verification passed.');
  } finally {
    global.fetch = originalFetch;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
