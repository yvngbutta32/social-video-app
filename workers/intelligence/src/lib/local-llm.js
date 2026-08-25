class LocalChatClient {
  constructor({ baseUrl, model, timeoutMs = 120000 }) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.model = model;
    this.timeoutMs = timeoutMs;
    this.chat = {
      completions: {
        create: (payload) => this.createChatCompletion(payload),
      },
    };
  }

  async createChatCompletion(payload) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: payload.model || this.model,
          messages: payload.messages,
          temperature: payload.temperature,
          max_tokens: payload.max_tokens,
          response_format: payload.response_format || payload.responseFormat,
          stream: false,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Local model request failed (${response.status}): ${body.slice(0, 500)}`);
      }

      const completion = await response.json();
      if (!completion?.choices?.[0]?.message?.content) {
        throw new Error('Local model response did not contain a chat completion');
      }

      return completion;
    } finally {
      clearTimeout(timeout);
    }
  }
}

module.exports = { LocalChatClient };
