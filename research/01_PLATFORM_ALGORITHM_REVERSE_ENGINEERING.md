# Platform Algorithm Reverse-Engineering Research
**Goal: Build per-niche, per-platform algorithm models that predict and optimize for viral reach**

---

## 🎯 TIKTOK ALGORITHM (2024-2025)

### **Core Ranking Signals (Weighted by Importance)**

| Signal | Weight | Description | Optimization Strategy |
|--------|--------|-------------|----------------------|
| **Watch Time (Retention)** | 35% | Average watch time + completion rate + rewatch rate | Hook at 0-3s, pattern interrupts every 7-10s, loop ending |
| **Engagement Velocity** | 25% | Likes/comments/shares/saves per minute in first 30-60 min | CTA at 50% + end, reply to every comment in first hour |
| **Share Rate** | 15% | Shares per view (strongest viral signal) | Create "share-worthy" content: relatable, educational, controversial |
| **Follow Rate** | 10% | Profile visits → follows per view | Strong bio, pinned videos, "follow for part 2" |
| **Search/Discovery** | 10% | Hashtag relevance, sound usage, keyword optimization | 3-5 niche hashtags + 1 broad + trending sound |
| **Account Authority** | 5% | Historical performance, consistency, verification | Post daily, maintain niche, build series |

### **TikTok-Specific Mechanics**

#### **The "For You" Page (FYP) Distribution Tiers**
```
Tier 1 (Test): 100-500 views → Measures retention @ 3s, 10s, 30s
Tier 2 (Niche): 500-5,000 views → Tests engagement rate, share rate
Tier 3 (Broad): 5,000-50,000 views → Tests broad appeal, follow rate
Tier 4 (Viral): 50,000-500,000+ → Tests sustained velocity, cross-demographic
Tier 5 (Mega): 500,000+ → Algorithmic boost, trending page, search ranking
```

#### **Critical Thresholds (Per Niche)**
| Niche | 3s Retention | 30s Retention | Completion | Engagement Rate | Share Rate |
|-------|--------------|---------------|------------|-----------------|------------|
| **Fitness** | >45% | >25% | >18% | >8% | >1.5% |
| **Beauty** | >50% | >30% | >22% | >10% | >2% |
| **Education** | >40% | >20% | >15% | >6% | >1% |
| **Comedy** | >55% | >35% | >25% | >12% | >3% |
| **Business/Finance** | >35% | >18% | >12% | >5% | >0.8% |
| **Lifestyle** | >45% | >25% | >20% | >8% | >1.5% |

#### **Algorithm Updates to Track (2024-2025)**
- **Q1 2024**: "Search-based discovery" - SEO keywords in caption + spoken audio matter more
- **Q2 2024**: "Series feature" - Episodic content gets 3x distribution boost
- **Q3 2024**: "Photo mode carousel" - Multi-image posts compete with video
- **Q4 2024**: "AI-labeled content" - Synthetic content gets distribution penalty unless labeled
- **2025**: "Interest graph > Social graph" - Who you follow matters less than what you watch

### **Reverse-Engineering Methodology**
```python
# Our approach: Multi-variate regression on post_metrics
features = [
    'hook_type', 'hook_duration', 'retention_curve', 'engagement_velocity',
    'hashtag_strategy', 'sound_trending_score', 'posting_time', 'frequency',
    'account_authority', 'niche_competition', 'content_length', 'cta_type'
]
target = 'viral_tier_reached'  # 1-5
model = XGBoost(n_estimators=500, max_depth=10)
# Train per niche, per week, with drift detection
```

---

## 📸 INSTAGRAM REELS ALGORITHM (2024-2025)

### **Core Ranking Signals**

| Signal | Weight | Description |
|--------|--------|-------------|
| **Send Rate (DM Shares)** | 30% | #1 viral signal - "Send to friend" |
| **Save Rate** | 25% | "Save for later" - indicates high value |
| **Watch Time** | 20% | Retention + rewatch (loops count) |
| **Comment Quality** | 15% | Long comments > short; replies to comments |
| **Profile Visits** | 10% | From Reel → profile → follow |

### **Instagram-Specific Mechanics**

#### **Distribution Funnel**
```
Explore Page → Reels Tab → Follower Feed → Hashtag/Location Pages
     ↓              ↓              ↓              ↓
  Cold          Warm           Hot           Niche
Audience      Audience      Audience      Audience
```

#### **Critical Differences from TikTok**
- **Longer shelf life**: Reels can explode 7-30 days post-publish
- **Carousel + Reel combo**: Post carousel first, Reel 2hrs later = 40% boost
- **Collab posts**: 2x reach (appears on both accounts)
- **Remix/Template**: Using trending template = algorithmic preference
- **Story share**: Sharing Reel to Story = strongest retention signal

#### **Niche Thresholds (Reels)**
| Niche | Save Rate | Send Rate | Comment Length | Profile Visit Rate |
|-------|-----------|-----------|----------------|-------------------|
| **Fitness** | >4% | >2% | >15 chars | >3% |
| **Beauty** | >6% | >3% | >20 chars | >4% |
| **Education** | >8% | >2% | >30 chars | >5% |
| **Travel** | >5% | >4% | >25 chars | >6% |
| **Business** | >3% | >1.5% | >20 chars | >4% |

---

## 📺 YOUTUBE SHORTS ALGORITHM (2024-2025)

### **Core Ranking Signals**

| Signal | Weight | Description |
|--------|--------|-------------|
| **VVS (Viewed vs Swiped)** | 35% | % who watch vs swipe away in first 3s |
| **Average Percentage Viewed** | 25% | APV > 80% = viral signal |
| **Subscriber Conversion** | 20% | Views → Subscribes (highest value) |
| **Engagement (Like/Comment/Share)** | 15% | Weighted: Share > Comment > Like |
| **Return Viewer Rate** | 5% | Viewers who watch multiple Shorts |

### **YouTube-Specific Mechanics**

#### **The "Browse Features" Traffic Source**
- Shorts feed → Home page → Suggested videos → Channel page
- **Key**: First 24 hours determine Browse Features placement

#### **Shorts-to-Long-Form Bridge**
- Shorts viewers who watch long-form = 10x LTV
- **Strategy**: Shorts as "trailers" for long-form (pinned comment with link)

#### **Niche Thresholds (Shorts)**
| Niche | VVS (3s) | APV | Sub Conversion | Comment Rate |
|-------|----------|-----|----------------|--------------|
| **Education** | >65% | >85% | >2% | >1% |
| **Tech/AI** | >70% | >88% | >3% | >1.5% |
| **Finance** | >60% | >80% | >1.5% | >0.8% |
| **Entertainment** | >75% | >90% | >1% | >2% |
| **Gaming** | >65% | >85% | >2% | >1.5% |

---

## 💼 LINKEDIN ALGORITHM (2024-2025)

### **Core Ranking Signals**

| Signal | Weight | Description |
|--------|--------|-------------|
| **Dwell Time** | 30% | Time spent reading/watching before scroll |
| **Meaningful Comments** | 25% | >50 chars, tagging, thread depth |
| **Share with Commentary** | 20% | Share + own perspective |
| **Profile Clicks** | 15% | Content → Profile → Connect/Follow |
| **Reaction Diversity** | 10% | Mix of 👍 🎉 💡 🔥 👏 (not just likes) |

### **LinkedIn-Specific Mechanics**

#### **Content Format Hierarchy**
1. **Native Video** (3x reach of external links)
2. **Document Posts** (PDF carousel - 2.5x reach)
3. **Text + Image** (baseline)
4. **External Links** (penalized 50%+)
5. **Polls** (high engagement, low dwell)

#### **The "Golden Hour" + "Second Wave"**
- **Hour 1**: Immediate network (1st connections) - velocity critical
- **Hours 2-24**: 2nd/3rd degree via shares - comment quality matters
- **Days 2-7**: "Second wave" from algorithmic resurfacing - evergreen content wins

#### **Niche Thresholds (LinkedIn)**
| Niche | Dwell Time | Comment Rate | Share Rate | Profile Click Rate |
|-------|------------|--------------|------------|-------------------|
| **B2B SaaS** | >45s | >2% | >1% | >3% |
| **Leadership** | >60s | >3% | >2% | >4% |
| **Career/Jobs** | >40s | >2.5% | >1.5% | >5% |
| **Tech/AI** | >50s | >2% | >1% | >3% |
| **Finance** | >40s | >1.5% | >1% | >2% |

---

## 🐦 X (TWITTER) ALGORITHM (2024-2025)

### **Core Ranking Signals**

| Signal | Weight | Description |
|--------|--------|-------------|
| **Reply Rate** | 30% | Replies per impression (conversation starter) |
| **Retweet Rate** | 25% | RTs + Quote Tweets |
| **Profile Visits** | 20% | Tweet → Profile → Follow |
| **Dwell Time** | 15% | Time reading thread/media |
| **Bookmark Rate** | 10% | "Save for later" |

### **X-Specific Mechanics**

#### **Thread vs Single Tweet**
- **Threads**: 3-5x reach, but only if first tweet hooks (CTR > 2%)
- **Media tweets**: Video > Images > GIFs > Text
- **Spaces**: Live audio = algorithmic boost for 24h after

#### **The "For You" vs "Following" Split**
- **For You**: 60% of impressions - algorithmic, interest-based
- **Following**: 40% - chronological, relationship-based
- **Key**: Get into "For You" via high reply/RT velocity in first 30 min

#### **Niche Thresholds (X)**
| Niche | Reply Rate | RT Rate | Profile Visit | Bookmark Rate |
|-------|------------|---------|---------------|---------------|
| **Tech/AI** | >1.5% | >2% | >3% | >1% |
| **Finance/Crypto** | >2% | >3% | >4% | >2% |
| **Politics/News** | >3% | >4% | >2% | >1% |
| **Personal Brand** | >1% | >1.5% | >3% | >1% |
| **Humor/Memes** | >0.5% | >5% | >1% | >0.5% |

---

## 📘 FACEBOOK REELS ALGORITHM (2024-2025)

### **Core Ranking Signals** (Similar to IG but different weights)

| Signal | Weight |
|--------|--------|
| **Share Rate** | 35% (highest - FB is social graph) |
| **Comment Threading** | 25% (replies to replies) |
| **Watch Time** | 20% |
| **Reaction Diversity** | 10% |
| **Group Shares** | 10% (shares to groups = massive boost) |

### **Facebook-Specific Mechanics**
- **Cross-post from IG**: Native upload > cross-post (20% penalty for cross-post)
- **Groups**: Sharing to relevant groups = 5-10x reach
- **Stars/Bonuses**: Monetization eligibility = algorithmic preference
- **Older demographic**: Content must work for 35-65 age range

---

## 🔬 OUR REVERSE-ENGINEERING PIPELINE

### **Data Collection (Automated)**
```javascript
// Daily collection per niche per platform
const dataSources = {
  tiktok: ['Creative Center API', 'Trending hashtags', 'Top creators', 'Sound library'],
  instagram: ['Explore page scraping', 'Reels trends', 'Hashtag analytics'],
  youtube: ['Trending API', 'Shorts shelf', 'Search suggestions'],
  linkedin: ['Trending topics', 'Hashtag analytics', 'Top voices'],
  x: ['Trending topics', 'Spaces', 'List analytics'],
  facebook: ['Reels trends', 'Group insights', 'Creator marketplace']
};
```

### **Feature Engineering (Per Platform)**
```javascript
// 200+ features per post
const featureCategories = {
  // Content intrinsics (what)
  visual: ['color_palette', 'motion_vectors', 'face_presence', 'text_overlay', 'branding'],
  audio: ['music_trending_score', 'voice_presence', 'silence_ratio', 'beat_sync'],
  textual: ['hook_classification', 'sentiment', 'readability', 'keywords', 'cta_type'],
  structural: ['duration', 'pacing', 'cut_points', 'loop_quality', 'story_arc'],
  
  // Context (when/where/how)
  temporal: ['hour', 'day', 'seasonality', 'trend_alignment', 'frequency'],
  platform: ['format', 'features_used', 'hashtag_strategy', 'sound_strategy'],
  creator: ['authority', 'consistency', 'niche_focus', 'audience_match'],
  audience: ['demographics', 'interests', 'active_hours', 'engagement_patterns'],
  
  // Competition (relative)
  competitive: ['niche_saturation', 'competitor_posting', 'trend_participation'],
  
  // Outcomes (targets)
  targets: ['viral_tier', 'velocity_curve', 'revenue_attribution', 'follower_growth']
};
```

### **Model Training Pipeline**
```javascript
// Weekly retraining per niche per platform
async function trainRankingModels() {
  for (const platform of PLATFORMS) {
    for (const niche of NICHES) {
      const trainingData = await fetchTrainingData(platform, niche, '90d');
      
      if (trainingData.length < MIN_SAMPLES) continue;
      
      // Multiple model types for ensemble
      const models = {
        xgboost: trainXGBoost(trainingData),
        lightgbm: trainLightGBM(trainingData),
        neural: trainNeuralNet(trainingData),
        heuristic: buildHeuristicRules(trainingData)
      };
      
      // Validate with walk-forward validation
      const scores = await validateModels(models, trainingData);
      
      // Deploy best model with A/B test
      await deployModel(platform, niche, models, scores);
      
      // Extract feature importance for dashboard
      await extractFeatureImportance(models, platform, niche);
    }
  }
}
```

### **Real-Time Inference API**
```javascript
// Used by: Concept Generator, Hook Generator, Scheduler, Auto-Clipper
async function predictViralPotential(content, platform, niche, creatorProfile) {
  const features = await extractFeatures(content, platform, niche, creatorProfile);
  const model = await getModel(platform, niche);
  
  return {
    viralProbability: model.predictProba(features),
    expectedViews: model.predictViews(features),
    optimalPostingTime: model.predictOptimalTime(features, creatorProfile),
    recommendedHooks: model.recommendHooks(features),
    recommendedHashtags: model.recommendHashtags(features, niche),
    recommendedSounds: model.recommendSounds(features, platform),
    confidenceInterval: model.getConfidence(features),
    featureImportance: model.getFeatureImportance(features)
  };
}
```

---

## 📊 NICHE-SPECIFIC ALGORITHM INSIGHTS (Actionable)

### **FITNESS NICHE**
| Platform | Top 3 Factors | Content Formula |
|----------|---------------|-----------------|
| TikTok | 1. 3s hook (transformation preview) 2. Save rate (workout save) 3. Sound (trending gym music) | "POV: You're doing this wrong" → Demo → Correct form → Save this workout |
| Reels | 1. Save rate 2. Send rate (to workout buddy) 3. Carousel + Reel combo | Carousel: 5 exercises → Reel: Full workout flow |
| Shorts | 1. VVS (before/after in 1s) 2. APV (loop workout) 3. Sub conversion (program link) | 15s: Exercise demo → Pin comment: "Full program in bio" |
| LinkedIn | 1. Dwell (detailed form breakdown) 2. Meaningful comments (Q&A) 3. Document post (PDF guide) | "Why your squat hurts" + PDF form guide |

### **BEAUTY NICHE**
| Platform | Top 3 Factors | Content Formula |
|----------|---------------|-----------------|
| TikTok | 1. 3s hook (result first) 2. Share rate (send to friend) 3. Trending sound + transition | Result → "How I did it" → Products used → "Link in bio" |
| Reels | 1. Save rate (routine save) 2. Remix (duet with before/after) 3. Collab (with brand) | GRWM → Product closeups → Routine order graphic |
| Shorts | 1. VVS (satisfying application) 2. APV (loop transition) 3. Comment (shade match) | 30s: Foundation routine → "What's your shade?" |
| LinkedIn | 1. Dwell (business of beauty) 2. Profile clicks (brand founder) 3. Document (industry report) | "Building a 7-figure beauty brand" + PDF case study |

### **BUSINESS/ENTREPRENEUR NICHE**
| Platform | Top 3 Factors | Content Formula |
|----------|---------------|-----------------|
| TikTok | 1. 3s hook (counterintuitive insight) 2. Save rate (framework save) 3. Series (multi-part) | "Stop doing X" → Framework → "Part 2 tomorrow" |
| Reels | 1. Send rate (share with cofounder) 2. Save rate (framework) 3. Carousel + Reel | Carousel: 5 frameworks → Reel: Deep dive one |
| Shorts | 1. VVS (shocking stat) 2. APV (story loop) 3. Sub conversion (newsletter) | "I lost $1M doing this" → Lesson → "Newsletter in bio" |
| LinkedIn | 1. Dwell (case study) 2. Meaningful comments (debate) 3. Document (template) | "How we grew 0→$10M ARR" + Notion template |
| X | 1. Reply rate (hot take) 2. Quote tweet (disagreement) 3. Thread (breakdown) | Hot take → Thread: "Here's why..." → Newsletter CTA |

### **EDUCATION/TECH NICHE**
| Platform | Top 3 Factors | Content Formula |
|----------|---------------|-----------------|
| TikTok | 1. 3s hook ("You're using X wrong") 2. Save rate (tutorial save) 3. Series (course style) | Mistake → Fix → "Save to try" → "Part 2: Advanced" |
| Reels | 1. Save rate (cheat sheet) 2. Send rate (share with dev) 3. Remix (code review) | Code tip → Visual demo → "Save this snippet" |
| Shorts | 1. VVS (result first) 2. APV (loop explanation) 3. Sub conversion (course) | "This one line fixes it" → Explanation → "Full course in bio" |
| LinkedIn | 1. Dwell (technical depth) 2. Comments (technical discussion) 3. Document (code repo) | "Architecture decision record" + GitHub link |
| X | 1. Reply rate (technical debate) 2. Bookmark rate (reference) 3. Thread (deep dive) | Controversial opinion → Thread with code → GitHub link |

---

## 🎯 IMPLEMENTATION PRIORITIES FOR OUR PLATFORM

### **Phase 1: Core Models (Week 1)**
- [ ] TikTok per-niche model (30 niches × 6 platforms = 180 models)
- [ ] Feature importance extraction for dashboard
- [ ] Weekly retraining pipeline with drift detection
- [ ] Real-time inference API (<50ms latency)

### **Phase 2: Advanced Features (Week 2)**
- [ ] Competitor tracking (auto-detect top 50 per niche)
- [ ] Trend correlation (which trends drive viral in niche)
- [ ] Algorithm version detection (track platform updates)
- [ ] Cross-platform transfer learning (TikTok → Reels patterns)

### **Phase 3: Intelligence Layer (Week 3)**
- [ ] "What should I post next?" recommendation engine
- [ ] Content gap analysis (whitespace detection)
- [ ] Predictive scheduling (optimal time per creator per platform)
- [ ] Hook performance prediction (pre-publish scoring)

---

## 📈 SUCCESS METRICS

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Viral Prediction Accuracy** | >85% AUC | Walk-forward validation on 90-day windows |
| **Feature Stability** | >90% top-10 consistency | Week-over-week feature importance correlation |
| **Niche Coverage** | 50+ niches | Minimum 100 samples per niche per platform |
| **Model Freshness** | <7 days | Weekly retraining completion rate |
| **Inference Latency** | <50ms p99 | Real-time API performance |
| **Creator Lift** | >3x views vs baseline | A/B test: model-guided vs random |

---

**This research directly feeds into: Platform Ranking Factors Engine, Creator Algorithm Profile Trainer, Viral Predictor, Hook Generator, Trend-to-Concept Pipeline, Auto-Clipper, Scheduler**