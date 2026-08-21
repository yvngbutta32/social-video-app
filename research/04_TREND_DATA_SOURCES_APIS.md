# Trend Data Sources & APIs Research
**Goal: Comprehensive inventory of real-time trend data sources for automated trend-to-concept pipeline**

---

## 🎯 TIER 1: OFFICIAL PLATFORM APIs (Reliable, Rate-Limited)

### **TikTok**
| API/Source | Access | Data | Rate Limits | Cost | Use Case |
|------------|--------|------|-------------|------|----------|
| **TikTok Creative Center** | Free (login) | Trending hashtags, sounds, creators, videos, commercial music library | Web UI only | Free | Manual research, trend validation |
| **TikTok Creative Center API** | Application required | Programmatic access to trending data | 100 req/min | Free (approved) | Automated trend ingestion |
| **TikTok Business API** | Business account | Ad performance, audience insights | Standard | Free | Competitor ad tracking |
| **TikTok Research API** | Academic/Institutional | Public video data, metadata | Strict | Free (approved) | Large-scale analysis |
| **RapidAPI TikTok** | Paid tiers | Unofficial, scraped data | Varies | $10-500/mo | Fallback when official unavailable |

**Key Endpoints (Creative Center API):**
```
GET /api/trending/hashtags?region=US&period=7d
GET /api/trending/sounds?region=US&period=24h
GET /api/trending/creators?category=fitness&limit=50
GET /api/trending/videos?hashtag=fitness&period=7d
GET /api/commercial-music/library?genre=workout
```

### **Instagram/Meta**
| API/Source | Access | Data | Rate Limits | Cost |
|------------|--------|------|-------------|------|
| **Meta Graph API** | Business verification | Hashtag search, media insights, public profiles | 200 req/hr/user | Free |
| **Instagram Basic Display API** | App review | User media, profile | 200 req/hr | Free |
| **Meta Ads Library API** | Free | Active ads, spending, targeting | Standard | Free |
| **CrowdTangle** | Application (Meta-owned) | Historical engagement, leaderboards | High | Free (approved) |
| **RapidAPI Instagram** | Paid | Unofficial scraped data | Varies | $10-500/mo |

**Key Endpoints (Graph API):**
```
GET /{hashtag_id}/recent_media?fields=id,media_type,like_count,comments_count
GET /{user_id}/media?fields=id,caption,media_url,timestamp,insights
GET /ads_library?search_terms=fitness&ad_active_status=ACTIVE
```

### **YouTube**
| API/Source | Access | Data | Rate Limits | Cost |
|------------|--------|------|-------------|------|
| **YouTube Data API v3** | API key | Search, trending, videos, channels, comments | 10,000 units/day | Free |
| **YouTube Analytics API** | OAuth + channel owner | Detailed metrics, traffic sources | Standard | Free |
| **YouTube Reporting API** | Content owner | Bulk reports, revenue | High | Free |
| **YouTube Trending API** | Data API | Regional trending videos | 10,000 units/day | Free |

**Key Endpoints:**
```
GET /videos?chart=mostPopular&regionCode=US&videoCategoryId=17&maxResults=50
GET /search?q=fitness&type=video&order=viewCount&publishedAfter=2024-01-01
GET /channels?part=statistics,snippet&id={channel_id}
```

### **LinkedIn**
| API/Source | Access | Data | Rate Limits | Cost |
|------------|--------|------|-------------|------|
| **LinkedIn Marketing API** | Partner application | Ad analytics, audience insights | Strict | Free (partner) |
| **LinkedIn Share API** | OAuth | Share content, get engagement | Standard | Free |
| **LinkedIn Sales Navigator API** | Enterprise | Lead data, company insights | High | $$$ |
| **RapidAPI LinkedIn** | Paid | Unofficial profile/post data | Varies | $50-1000/mo |

### **X (Twitter)**
| API/Source | Access | Data | Rate Limits | Cost |
|------------|--------|------|-------------|------|
| **X API v2 (Free)** | Developer portal | 1,500 tweets/mo, basic search | 1,500/mo | Free |
| **X API v2 (Basic)** | $100/mo | 10K tweets/mo, filtered stream | 10K/mo | $100/mo |
| **X API v2 (Pro)** | $5,000/mo | 1M tweets/mo, full archive | 1M/mo | $5,000/mo |
| **X API v2 (Enterprise)** | Custom | Firehose, historical | Custom | $$$$ |

**Key Endpoints (v2):**
```
GET /2/tweets/search/recent?query=fitness&tweet.fields=public_metrics,created_at
GET /2/tweets/search/recent?query=from:username&max_results=100
GET /2/users/by/username/username?user.fields=public_metrics,verified
```

### **Facebook**
| API/Source | Access | Data | Rate Limits | Cost |
|------------|--------|------|-------------|------|
| **Meta Graph API** | Business verification | Page insights, post metrics, video metrics | 200 req/hr | Free |
| **Facebook Video API** | Page owner | Video insights, retention curves | Standard | Free |
| **CrowdTangle** | Application | Historical, leaderboards, viral posts | High | Free (approved) |

---

## 🎯 TIER 2: THIRD-PARTY TREND AGGREGATORS (Commercial, Rich Data)

### **Trend Discovery Platforms**

| Platform | Focus | Platforms Covered | Price | Key Features |
|----------|-------|-------------------|-------|--------------|
| **Exploding Topics** | Emerging trends | All (web-wide) | $39-999/mo | Trend velocity, forecasting, API |
| **TrendHunter** | Consumer trends | All | $199-3999/mo | Trend reports, custom research |
| **Google Trends API** | Search trends | Web, YouTube, Shopping | Free (unofficial) | Real-time, related queries |
| **Glimpse** | Google Trends + | Web, TikTok, Amazon | $49-499/mo | Trend alerts, keyword clustering |
| **AnswerThePublic** | Question trends | Search engines | $99-999/mo | Question visualization, API |
| **AlsoAsked** | People Also Ask | Google | Free/$19/mo | Question trees, export |

### **Social-Specific Trend Tools**

| Platform | Focus | Platforms | Price | Key Features |
|----------|-------|-----------|-------|--------------|
| **VidIQ** | YouTube SEO/Trends | YouTube | $17-415/mo | Keyword research, competitor tracking, trend alerts |
| **TubeBuddy** | YouTube SEO/Trends | YouTube | $9-49/mo | A/B testing, keyword explorer, trending tags |
| **Metricool** | Social Analytics | All major | $12-149/mo | Competitor analysis, best times, hashtag tracking |
| **Hootsuite Insights** | Social Listening | All major | $$$ | Brand monitoring, trend detection |
| **Sprout Social** | Social Analytics | All major | $249-499/mo | Trend reports, competitor benchmarking |
| **Brandwatch** | Consumer Intelligence | All + web | $$$$ | AI trend detection, sentiment |
| **Talkwalker** | Social Listening | All + web | $$$$ | Viral prediction, image recognition |
| **Meltwater** | Media Intelligence | All + news | $$$$ | Trend tracking, PR analytics |

### **Creator Economy Platforms**

| Platform | Focus | Data | Price |
|----------|-------|------|-------|
| **CreatorIQ** | Influencer marketing | Creator discovery, campaign tracking | $$$$ |
| **Upfluence** | Influencer search | 3M+ creators, audience data | $$$ |
| **AspireIQ** | Creator management | UGC, campaigns, analytics | $$$ |
| **Grin** | Creator CRM | Relationship management, tracking | $$$ |
| **Modash** | Influencer discovery | 250M+ profiles, fake follower check | $99-599/mo |
| **Heepsy** | Influencer search | 11M+ influencers | $49-269/mo |

---

## 🎯 TIER 3: NICHE-SPECIFIC TREND SOURCES

### **Fitness/Health**
- **Strava Metro** - Activity trends by location
- **MyFitnessPal Blog** - Nutrition trends
- **Garmin/Whoop/Apple Health** - Aggregated wellness trends (partner)
- **PubMed/ClinicalTrials.gov** - Emerging research trends
- **Examine.com** - Supplement trend analysis

### **Beauty/Fashion**
- **Sephora/Ulta Trending** - Product trends
- **Pinterest Predicts** - Annual trend forecast (high accuracy)
- **Lyst Index** - Fashion demand data
- **Edited** - Retail analytics, trend forecasting
- **WGSN** - Professional trend forecasting ($$$)

### **Tech/AI**
- **GitHub Trending** - Repo stars, language trends
- **Hacker News API** - Tech discussions
- **Product Hunt API** - New product launches
- **Papers With Code** - ML research trends
- **Hugging Face Trending** - Model/dataset trends

### **Finance/Crypto**
- **CoinGecko/CoinMarketCap API** - Crypto trends, trending coins
- **TradingView** - Technical analysis trends
- **Fear & Greed Index** - Market sentiment
- **Whale Alert** - Large transaction tracking
- **DeFi Llama** - TVL trends by protocol

### **Gaming**
- **Steam Charts** - Player count trends
- **TwitchTracker** - Streamer/viewer trends
- **SteamSpy** - Game ownership trends
- **Newzoo** - Market intelligence ($$$)

---

## 🎯 TIER 4: REAL-TIME SIGNAL SOURCES (For Immediate Detection)

### **Social Listening Signals**
```javascript
// Real-time trend detection signals
const trendSignals = {
  // Velocity signals (sudden spikes)
  velocity: {
    hashtagGrowthRate: 'hashtag_mentions_per_hour > 10x baseline',
    soundAdoptionRate: 'sound_uses_per_hour > 5x baseline',
    creatorGrowthRate: 'follower_gain_per_hour > 100x baseline',
    topicMentionSurge: 'keyword_mentions > 3 sigma above mean'
  },
  
  // Cross-platform signals
  crossPlatform: {
    simultaneousTrend: 'same_hashtag trending on 3+ platforms',
    formatMigration: 'TikTok trend → Reels/Shorts within 24h',
    creatorCrossPost: 'top_creator posts same content multi-platform'
  },
  
  // Engagement quality signals
  quality: {
    saveRateSpike: 'save_rate > 2x niche_average',
    shareRateSpike: 'share_rate > 3x niche_average',
    commentDepth: 'avg_comment_length > 50 chars + thread_depth > 3',
    duetStitchRate: 'duet_stitch_count > 100 in 1hr'
  },
  
  // Commercial signals
  commercial: {
    brandAdoption: 'brand_accounts using trend > 10 in 24h',
    affiliateLinks: 'affiliate_link_clicks > threshold',
    productMentions: 'specific_product mentions spike',
    searchVolume: 'google_trends + platform_search spike'
  }
};
```

### **Webhook/Streaming Sources**
| Source | Type | Latency | Data |
|--------|------|---------|------|
| **Twitter Filtered Stream** | WebSocket | <1s | Real-time tweets matching rules |
| **Reddit Pushshift** | API/Stream | ~1min | Subreddit activity, trends |
| **YouTube PubSubHubbub** | Webhook | ~1min | New uploads, live starts |
| **TikTok Webhooks** | Webhook | ~5min | Video uploads, live events (Business API) |
| **Instagram Real-time** | Webhook | ~1min | New media, comments (subscriptions) |

---

## 🔧 OUR TREND INGESTION ARCHITECTURE

### **Multi-Source Aggregation Pipeline**
```javascript
// TrendIngestionService.js
class TrendIngestionService {
  constructor() {
    this.sources = {
      // Tier 1: Official APIs (primary)
      tiktok: new TikTokCreativeCenterAPI(),
      instagram: new MetaGraphAPI(),
      youtube: new YouTubeDataAPI(),
      linkedin: new LinkedInAPI(),
      x: new XAPI(),
      facebook: new MetaGraphAPI(),
      
      // Tier 2: Commercial aggregators (enrichment)
      explodingTopics: new ExplodingTopicsAPI(),
      vidIQ: new VidIQAPI(),
      metricool: new MetricoolAPI(),
      
      // Tier 3: Niche sources (specialization)
      nicheSources: new Map(), // populated per niche
      
      // Tier 4: Real-time signals (immediate)
      webhooks: new WebhookManager(),
      streams: new StreamManager()
    };
    
    this.trendCache = new Map(); // trendId -> TrendObject
    this.deduplicationWindow = 6 * 60 * 60 * 1000; // 6 hours
  }
  
  async ingestAllSources() {
    const allTrends = [];
    
    // Parallel ingestion from all sources
    const promises = Object.entries(this.sources).map(async ([name, source]) => {
      try {
        const trends = await source.fetchTrends({
          niches: this.getActiveNiches(),
          regions: ['US', 'GB', 'CA', 'AU'],
          timeWindow: '24h',
          minVelocity: 2 // 2x baseline
        });
        
        // Normalize to common schema
        return trends.map(t => this.normalizeTrend(t, name));
      } catch (error) {
        logger.error(`Trend ingestion failed: ${name}`, { error: error.message });
        return [];
      }
    });
    
    const results = await Promise.allSettled(promises);
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allTrends.push(...result.value);
      }
    }
    
    // Deduplicate and score
    const uniqueTrends = this.deduplicateAndScore(allTrends);
    
    // Store and emit
    await this.storeTrends(uniqueTrends);
    this.emit('trends:ingested', uniqueTrends);
    
    return uniqueTrends;
  }
  
  normalizeTrend(rawTrend, source) {
    return {
      id: this.generateTrendId(rawTrend, source),
      source,
      platform: rawTrend.platform || this.inferPlatform(source),
      type: rawTrend.type, // 'hashtag', 'sound', 'topic', 'format', 'challenge', 'creator'
      name: rawTrend.name,
      displayName: rawTrend.displayName,
      description: rawTrend.description,
      category: rawTrend.category,
      niche: this.classifyNiche(rawTrend),
      
      // Velocity metrics
      velocity: {
        current: rawTrend.currentVelocity || 0,
        baseline: rawTrend.baselineVelocity || 0,
        growthRate: rawTrend.growthRate || 0,
        acceleration: rawTrend.acceleration || 0
      },
      
      // Volume metrics
      volume: {
        mentions: rawTrend.mentions || 0,
        views: rawTrend.views || 0,
        uses: rawTrend.uses || 0,
        creators: rawTrend.uniqueCreators || 0
      },
      
      // Quality metrics
      quality: {
        engagementRate: rawTrend.engagementRate || 0,
        saveRate: rawTrend.saveRate || 0,
        shareRate: rawTrend.shareRate || 0,
        sentiment: rawTrend.sentiment || 0
      },
      
      // Lifecycle
      lifecycle: {
        stage: rawTrend.stage || 'emerging', // emerging, rising, peak, declining, dead
        firstSeen: rawTrend.firstSeen || new Date(),
        peakPredicted: rawTrend.peakPredicted,
        lifespanEstimate: rawTrend.lifespanEstimate
      },
      
      // Cross-platform
      crossPlatform: {
        platforms: rawTrend.platforms || [this.inferPlatform(source)],
        platformData: rawTrend.platformData || {}
      },
      
      // Commercial
      commercial: {
        brandAdoption: rawTrend.brandAdoption || 0,
        affiliatePotential: rawTrend.affiliatePotential || 0,
        productMentions: rawTrend.productMentions || []
      },
      
      // Metadata
      metadata: {
        rawData: rawTrend,
        ingestedAt: new Date(),
        confidence: this.calculateConfidence(rawTrend, source)
      }
    };
  }
  
  deduplicateAndScore(trends) {
    // Group by normalized name + platform + type
    const groups = new Map();
    
    for (const trend of trends) {
      const key = `${trend.platform}:${trend.type}:${trend.name.toLowerCase()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(trend);
    }
    
    const deduplicated = [];
    
    for (const [key, group] of groups.entries()) {
      // Merge data from multiple sources
      const merged = this.mergeTrendGroup(group);
      
      // Calculate composite trend score
      merged.score = this.calculateTrendScore(merged);
      
      // Filter by minimum score
      if (merged.score > 0.3) {
        deduplicated.push(merged);
      }
    }
    
    // Sort by score descending
    return deduplicated.sort((a, b) => b.score - a.score);
  }
  
  calculateTrendScore(trend) {
    const weights = {
      velocity: 0.30,
      volume: 0.20,
      quality: 0.20,
      crossPlatform: 0.15,
      commercial: 0.10,
      novelty: 0.05
    };
    
    const velocityScore = Math.min(1, trend.velocity.growthRate / 10);
    const volumeScore = Math.min(1, Math.log10(trend.volume.mentions + 1) / 6);
    const qualityScore = (trend.quality.engagementRate + trend.quality.saveRate + trend.quality.shareRate) / 3;
    const crossPlatformScore = Math.min(1, trend.crossPlatform.platforms.length / 6);
    const commercialScore = Math.min(1, (trend.commercial.brandAdoption + trend.commercial.affiliatePotential) / 20);
    const noveltyScore = trend.lifecycle.stage === 'emerging' ? 1 : 
                        trend.lifecycle.stage === 'rising' ? 0.7 : 0.3;
    
    return (
      velocityScore * weights.velocity +
      volumeScore * weights.volume +
      qualityScore * weights.quality +
      crossPlatformScore * weights.crossPlatform +
      commercialScore * weights.commercial +
      noveltyScore * weights.novelty
    );
  }
}
```

### **Trend-to-Concept Pipeline Integration**
```javascript
// TrendToConceptPipeline.js
class TrendToConceptPipeline {
  constructor() {
    this.ingestion = new TrendIngestionService();
    this.conceptGenerator = new ConceptGenerator();
    this.hookGenerator = new HookGenerator();
    this.scheduler = new SmartScheduler();
  }
  
  async processTrends() {
    // 1. Ingest trends from all sources
    const trends = await this.ingestion.ingestAllSources();
    
    // 2. Filter for user's niches
    const relevantTrends = trends.filter(t => 
      this.userNiches.includes(t.niche) && 
      t.score > 0.5 &&
      t.lifecycle.stage !== 'dead'
    );
    
    // 3. Generate concepts for top trends
    const concepts = [];
    for (const trend of relevantTrends.slice(0, 20)) {
      const trendConcepts = await this.conceptGenerator.generateFromTrend(trend, {
        count: 3,
        includeHooks: true,
        includeFormats: true,
        platformSpecific: true
      });
      concepts.push(...trendConcepts);
    }
    
    // 4. Score concepts with Viral Predictor
    for (const concept of concepts) {
      concept.viralScore = await this.viralPredictor.predict(concept);
      concept.hooks = await this.hookGenerator.generate(concept, { count: 5 });
    }
    
    // 5. Rank and select best
    const ranked = concepts
      .filter(c => c.viralScore > 0.6)
      .sort((a, b) => b.viralScore - a.viralScore)
      .slice(0, 10);
    
    // 6. Auto-schedule or present for approval
    for (const concept of ranked) {
      await this.scheduler.scheduleOptimal(concept);
    }
    
    return ranked;
  }
}
```

---

## 📊 TREND SCORING ALGORITHM (Our Proprietary)

### **Composite Trend Score (0-1)**
```
TREND_SCORE = 
  0.30 × Velocity_Score (growth rate vs baseline)
+ 0.20 × Volume_Score (log-scale mentions/views)
+ 0.20 × Quality_Score (engagement + save + share rates)
+ 0.15 × Cross_Platform_Score (platforms trending on)
+ 0.10 × Commercial_Score (brand adoption + affiliate potential)
+ 0.05 × Novelty_Score (lifecycle stage bonus)
```

### **Lifecycle Stage Detection**
| Stage | Criteria | Action |
|-------|----------|--------|
| **Emerging** | Velocity > 5x, Volume < 1K, Age < 6h | **IMMEDIATE** - Generate concepts now |
| **Rising** | Velocity > 2x, Volume 1K-100K, Age 6-48h | **URGENT** - Schedule within 24h |
| **Peak** | Velocity ~1x, Volume > 100K, Age 2-7d | **STANDARD** - Schedule this week |
| **Declining** | Velocity < 0.5x, Volume stable/declining | **SKIP** - Unless evergreen angle |
| **Dead** | Velocity < 0.1x, Age > 14d | **ARCHIVE** - Reference only |

### **Niche Relevance Scoring**
```javascript
function calculateNicheRelevance(trend, userNicheProfile) {
  // Direct niche match
  if (trend.niche === userNicheProfile.primaryNiche) return 1.0;
  
  // Sub-niche match
  if (userNicheProfile.subNiches.includes(trend.niche)) return 0.8;
  
  // Adjacent niche (fitness ↔ health, beauty ↔ fashion)
  const adjacency = getNicheAdjacency(userNicheProfile.primaryNiche);
  if (adjacency.includes(trend.niche)) return 0.6;
  
  // Audience overlap (from audience intelligence)
  const overlap = calculateAudienceOverlap(trend.audience, userNicheProfile.audience);
  return overlap * 0.5;
}
```

---

## 🚀 IMPLEMENTATION ROADMAP

### **Week 1: Core Ingestion**
- [ ] TikTok Creative Center API integration
- [ ] YouTube Data API trending endpoint
- [ ] Instagram Graph API hashtag search
- [ ] X API v2 recent search
- [ ] Normalization + deduplication pipeline

### **Week 2: Enrichment & Scoring**
- [ ] Commercial aggregator APIs (Exploding Topics, VidIQ)
- [ ] Niche-specific sources per user
- [ ] Trend scoring algorithm
- [ ] Lifecycle stage detection
- [ ] Cross-platform correlation

### **Week 3: Concept Generation**
- [ ] Trend → Concept mapping (AI)
- [ ] Platform-specific format selection
- [ ] Hook generation per concept
- [ ] Viral Predictor pre-scoring
- [ ] Smart scheduling integration

### **Week 4: Intelligence Layer**
- [ ] Competitor trend tracking
- [ ] Trend forecasting (7-day prediction)
- [ ] Personalized trend feed per creator
- [ ] Alert system (webhook + dashboard)
- [ ] A/B test: auto-schedule vs manual approval

---

## 📈 SUCCESS METRICS

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Trend Detection Latency** | <1 hour from emergence | Timestamp comparison |
| **Niche Relevance Precision** | >85% | User feedback + engagement |
| **Concept Generation Rate** | 50 concepts/day per creator | Pipeline throughput |
| **Viral Hit Rate from Trends** | >40% of trend-based posts viral | Post_metrics tracking |
| **Time-to-Post from Trend** | <4 hours (emerging) | Pipeline latency |
| **False Positive Rate** | <15% | Manual review sampling |

---

**This research directly feeds into: Trend-to-Concept Pipeline, Concept Generator, Hook Generator, Smart Scheduler, Viral Predictor, Campaign Orchestrator**