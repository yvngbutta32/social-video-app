const config = require('../config');
const logger = require('../logger');
const db = require('../db');
const { OpenAI } = require('openai');
const natural = require('natural');
const compromise = require('compromise');

class HookGenerator {
  constructor() {
    this.openai = new OpenAI({ apiKey: config.openai.apiKey });
    this.tokenizer = new natural.WordTokenizer();
    this.hookTypes = config.hooks.hookTypes;
    this.platforms = config.hooks.platforms;
  }

  // Platform-specific hook strategies
  getPlatformStrategy(platform) {
    const strategies = {
      tiktok: {
        maxLength: 150,
        style: 'fast-paced, visual-first, trend-aware, uses native slang',
        structure: 'Hook (0-3s) -> Value (3-15s) -> CTA (15s+)',
        preferredTypes: ['curiosity', 'story', 'controversy', 'question'],
        emojiDensity: 'high',
        lineBreaks: true,
      },
      instagram: {
        maxLength: 2200,
        style: 'aesthetic, lifestyle-oriented, community-building',
        structure: 'Hook -> Story/Value -> Engagement Question -> Hashtags',
        preferredTypes: ['question', 'value', 'identity', 'story'],
        emojiDensity: 'medium',
        lineBreaks: true,
      },
      youtube: {
        maxLength: 5000,
        style: 'searchable, educational/entertaining, algorithm-friendly',
        structure: 'Title Hook -> Description -> Timestamps -> Links -> Hashtags',
        preferredTypes: ['value', 'curiosity', 'question', 'statement'],
        emojiDensity: 'low',
        lineBreaks: true,
      },
      twitter: {
        maxLength: 280,
        style: 'concise, conversational, thread-ready, news-aware',
        structure: 'Hook -> Key Point -> Thread Indicator -> Hashtags',
        preferredTypes: ['statement', 'controversy', 'question', 'fear'],
        emojiDensity: 'low',
        lineBreaks: false,
      },
      linkedin: {
        maxLength: 3000,
        style: 'professional, insight-driven, authority-building',
        structure: 'Hook -> Insight -> Personal Experience -> Discussion Question',
        preferredTypes: ['value', 'statement', 'identity', 'question'],
        emojiDensity: 'very-low',
        lineBreaks: true,
      },
    };
    return strategies[platform] || strategies.tiktok;
  }

  // Generate hooks using OpenAI
  async generateHooks(videoData, userData, platform, count = null) {
    const maxHooks = count || config.hooks.maxHooksPerVideo;
    const strategy = this.getPlatformStrategy(platform);
    const contentAnalysis = await this.analyzeVideoContent(videoData);

    const hooks = [];

    // Generate hooks for each preferred type
    for (const hookType of strategy.preferredTypes) {
      if (hooks.length >= maxHooks) break;

      try {
        const hook = await this.generateSingleHook(
          videoData,
          userData,
          platform,
          hookType,
          strategy,
          contentAnalysis
        );
        if (hook) {
          hooks.push(hook);
        }
      } catch (err) {
        logger.warn(`Failed to generate ${hookType} hook`, { error: err.message });
      }
    }

    // Fill remaining slots with other hook types
    const otherTypes = this.hookTypes.filter(t => !strategy.preferredTypes.includes(t));
    for (const hookType of otherTypes) {
      if (hooks.length >= maxHooks) break;

      try {
        const hook = await this.generateSingleHook(
          videoData,
          userData,
          platform,
          hookType,
          strategy,
          contentAnalysis
        );
        if (hook) {
          hooks.push(hook);
        }
      } catch (err) {
        logger.warn(`Failed to generate ${hookType} hook`, { error: err.message });
      }
    }

    // Score and rank hooks
    const scoredHooks = await this.scoreHooks(hooks, videoData, platform);

    // Save to database
    const savedHooks = [];
    for (let i = 0; i < scoredHooks.length; i++) {
      const hook = scoredHooks[i];
      const saved = await db.createGeneratedHook({
        video_id: videoData.id,
        user_id: userData.id,
        platform,
        hook_type: hook.type,
        hook_text: hook.text,
        hook_score: hook.score,
        position: i,
        metadata: {
          strategy: strategy.style,
          contentAnalysis,
          generationModel: config.openai.model,
        },
      });
      savedHooks.push(saved);
    }

    return savedHooks;
  }

  async generateSingleHook(videoData, userData, platform, hookType, strategy, contentAnalysis) {
    const prompt = this.buildHookPrompt(videoData, userData, platform, hookType, strategy, contentAnalysis);

    try {
      const completion = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: `You are an expert social media copywriter specializing in ${platform} hooks. Generate compelling, platform-native hooks that stop the scroll and drive engagement.`
          },
          { role: 'user', content: prompt }
        ],
        temperature: config.openai.temperature,
        maxTokens: 300,
      });

      const hookText = completion.choices[0].message.content.trim();
      return {
        type: hookType,
        text: hookText,
        platform,
      };
    } catch (err) {
      logger.error('Hook generation failed', { error: err.message, hookType, platform });
      return null;
    }
  }

  buildHookPrompt(videoData, userData, platform, hookType, strategy, contentAnalysis) {
    const topic = videoData.topic || videoData.caption || 'general content';
    const niche = userData.niche || 'general';

    const typePrompts = {
      question: `Ask a compelling question that makes viewers NEED to know the answer. Use the curiosity gap.`,
      statement: `Make a bold, counterintuitive, or shocking statement that challenges assumptions.`,
      story: `Start a mini-story that hooks immediately. "I was [situation] when [twist]..."`,
      controversy: `Take a polarizing stance on a relevant topic in ${niche}. Be respectful but firm.`,
      curiosity: `Tease a secret, hack, or revelation. "The one thing nobody tells you about..."`,
      value: `Promise immediate, actionable value. "How to [achieve result] in [timeframe]..."`,
      fear: `Highlight a costly mistake or risk. "Stop doing [common mistake] that's ruining your [outcome]..."`,
      identity: `Speak directly to the viewer's identity. "As a [identity], you NEED to hear this..."`,
    };

    return `
Video Context:
- Platform: ${platform}
- Topic: ${topic}
- Niche: ${niche}
- Duration: ${videoData.duration || 'unknown'}s
- Key Visual: ${videoData.keyVisual || 'not specified'}
- Audio: ${videoData.hasMusic ? 'music' : 'voiceover/speech'}

Content Analysis:
- Emotional Tone: ${contentAnalysis.emotionalTone}
- Key Themes: ${contentAnalysis.keyThemes.join(', ')}
- Target Audience: ${contentAnalysis.targetAudience}

Platform Strategy: ${strategy.style}
Structure: ${strategy.structure}
Max Length: ${strategy.maxLength} characters
Emoji Density: ${strategy.emojiDensity}

Hook Type: ${hookType}
Instruction: ${typePrompts[hookType]}

Generate ONE hook only. No explanations. No hashtags unless platform-appropriate. Make it feel native to ${platform}.
`.trim();
  }

  async analyzeVideoContent(videoData) {
    try {
      const prompt = `Analyze this video for hook generation:
Caption: "${videoData.caption || ''}"
Hashtags: ${(videoData.hashtags || []).join(', ')}
Topic: ${videoData.topic || 'unknown'}

Return JSON with:
- emotionalTone: (energetic/calm/inspiring/educational/entertaining/controversial)
- keyThemes: [array of 3-5 themes]
- targetAudience: (description of who this appeals to)
- painPoints: [array of problems this solves]
- desires: [array of outcomes viewer wants]`;

      const completion = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 400,
        responseFormat: { type: 'json_object' },
      });

      return JSON.parse(completion.choices[0].message.content);
    } catch (err) {
      logger.warn('Content analysis failed', { error: err.message });
      return {
        emotionalTone: 'engaging',
        keyThemes: ['general'],
        targetAudience: 'general audience',
        painPoints: ['unknown'],
        desires: ['value'],
      };
    }
  }

  async scoreHooks(hooks, videoData, platform) {
    // Use template performance data to score
    const templates = await db.getHookTemplates(platform);
    const templateMap = new Map(templates.map(t => [t.hook_type, t.performance_score]));

    return hooks.map(hook => {
      let score = 0.5; // Base score

      // Template performance bonus
      const templateScore = templateMap.get(hook.type) || 0.5;
      score += (templateScore - 0.5) * 0.3;

      // Length appropriateness
      const strategy = this.getPlatformStrategy(platform);
      const lengthRatio = hook.text.length / strategy.maxLength;
      if (lengthRatio > 0 && lengthRatio < 1) {
        score += 0.1 * (1 - Math.abs(lengthRatio - 0.7)); // Optimal around 70%
      }

      // Keyword relevance
      const keywords = this.extractKeywords(videoData.caption || '');
      const hookKeywords = this.extractKeywords(hook.text);
      const overlap = keywords.filter(k => hookKeywords.includes(k)).length;
      score += Math.min(overlap * 0.05, 0.15);

      // Platform-native patterns
      if (this.hasPlatformNativePatterns(hook.text, platform)) {
        score += 0.1;
      }

      return {
        ...hook,
        score: Math.min(Math.max(parseFloat(score.toFixed(3)), 0), 1),
      };
    }).sort((a, b) => b.score - a.score);
  }

  extractKeywords(text) {
    const tokens = this.tokenizer.tokenize(text.toLowerCase()) || [];
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them']);
    return tokens.filter(t => t.length > 2 && !stopWords.has(t));
  }

  hasPlatformNativePatterns(text, platform) {
    const patterns = {
      tiktok: [/pov:/i, /stitch/i, /duet/i, /fyp/i, /foryou/i, /wait for it/i, /part \d/i],
      instagram: [/link in bio/i, /save this/i, /share with/i, /tag a/i, /follow for/i],
      youtube: [/subscribe/i, /like and subscribe/i, /timestamp/i, /chapter/i, /watch next/i],
      twitter: [/thread 🧵/i, /👇/i, /retweet/i, /quote tweet/i, /\d\/\d+/],
      linkedin: [/thoughts?/i, /agree\?/i, /experience/i, /learned/i, /career/i, /leadership/i],
    };
    return (patterns[platform] || []).some(p => p.test(text));
  }

  // Generate hook variations for A/B testing
  async generateVariations(baseHook, videoData, userData, platform, count = 3) {
    const strategy = this.getPlatformStrategy(platform);

    const prompt = `
Original Hook: "${baseHook.text}"
Type: ${baseHook.type}
Platform: ${platform}

Generate ${count} variations that:
1. Keep the same core hook type (${baseHook.type})
2. Test different angles/wording
3. Are native to ${platform} (${strategy.style})
4. Stay under ${strategy.maxLength} chars

Return as JSON array of strings only.`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        maxTokens: 500,
        responseFormat: { type: 'json_object' },
      });

      const variations = JSON.parse(completion.choices[0].message.content);
      return Array.isArray(variations) ? variations : Object.values(variations);
    } catch (err) {
      logger.warn('Variation generation failed', { error: err.message });
      return [];
    }
  }
}

module.exports = new HookGenerator();