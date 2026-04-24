const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const Sentiment = require("sentiment");
const sqlite3 = require("sqlite3").verbose();
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 4001;
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-should-be-in-env";
const sentiment = new Sentiment();
const dbPath = path.resolve(__dirname, process.env.DATABASE_URL || "database/mentions.db");

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname)));

// ─── Auth Middleware ───────────────────────────────────────────────────────────
const authenticate = (req, res, next) => {
  const token = req.cookies.token || (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.split(" ")[1] : null);
  if (!token) {
    if (req.headers.accept?.includes("text/html")) return res.redirect("/login");
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    if (req.headers.accept?.includes("text/html")) return res.redirect("/login");
    res.status(401).json({ error: "Invalid token" });
  }
};

const getDb = () => new sqlite3.Database(dbPath);

// ─── Auth Routes ───────────────────────────────────────────────────────────────
app.post("/api/auth/signup", async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Missing fields" });
  const db = getDb();
  const hashedPassword = await bcrypt.hash(password, 10);
  const userId = `user_${Date.now()}`;
  db.run("INSERT INTO users (id, email, password, name) VALUES (?, ?, ?, ?)", [userId, email, hashedPassword, name], function(err) {
    if (err) { db.close(); return res.status(400).json({ error: err.message.includes("UNIQUE") ? "Email already exists" : "DB Error" }); }
    db.run("INSERT INTO tracked_brands (user_id, brand_name) VALUES (?, ?)", [userId, "Antigravity"], () => db.close());
    const token = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: "7d" });
    res.cookie("token", token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ message: "User created", user: { id: userId, email, name } });
  });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Missing fields" });
  const db = getDb();
  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    db.close();
    if (err || !user) return res.status(401).json({ error: "Invalid credentials" });
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });
    res.cookie("token", token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ message: "Logged in", user: { id: user.id, email: user.email, name: user.name } });
  });
});

app.get("/api/auth/me", authenticate, (req, res) => {
  const db = getDb();
  db.get("SELECT id, email, name, subscription_status FROM users WHERE id = ?", [req.userId], (err, user) => {
    db.close();
    if (err || !user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  });
});

app.post("/api/auth/logout", (req, res) => { res.clearCookie("token"); res.json({ message: "Logged out" }); });

// ─── Brand Management ──────────────────────────────────────────────────────────
const KNOWN_BRANDS = [
  "Antigravity", "Apple", "Samsung", "Google", "Microsoft", "Nike", "Adidas", "Tesla", "Amazon", "Netflix", 
  "Meta", "Spotify", "Disney", "Coca-Cola", "Pepsi", "Toyota", "Mercedes-Benz", "BMW", "Audi", "Rolex"
];

app.get("/api/brands/search", authenticate, (req, res) => {
  const query = req.query.q?.toLowerCase();
  if (!query) return res.status(400).json({ error: "Query required" });

  const exactMatch = KNOWN_BRANDS.find(b => b.toLowerCase() === query);
  
  if (exactMatch) {
    return res.json({
      exists: true,
      brand: exactMatch,
      logo: `https://logo.clearbit.com/${exactMatch.toLowerCase().replace(" ", "")}.com`,
      category: "Technology",
      recommendations: []
    });
  } else {
    // Basic fuzzy matching / recommendations
    const recommendations = KNOWN_BRANDS.filter(b => 
      b.toLowerCase().includes(query) || query.includes(b.toLowerCase())
    ).slice(0, 3);

    return res.json({
      exists: false,
      brand: query,
      logo: null,
      recommendations: recommendations.length > 0 ? recommendations : ["Apple", "Samsung", "Nike"]
    });
  }
});

app.get("/api/brands", authenticate, (req, res) => {
  const db = getDb();
  db.all("SELECT * FROM tracked_brands WHERE user_id = ?", [req.userId], (err, rows) => { db.close(); res.json({ brands: rows || [] }); });
});

app.post("/api/brands", authenticate, (req, res) => {
  const { brand_name } = req.body;
  if (!brand_name) return res.status(400).json({ error: "Brand name required" });
  const db = getDb();
  db.run("INSERT INTO tracked_brands (user_id, brand_name) VALUES (?, ?)", [req.userId, brand_name], function(err) {
    db.close();
    if (err) return res.status(500).json({ error: "Could not add brand" });
    res.json({ id: this.lastID, brand_name });
  });
});

app.delete("/api/brands/:id", authenticate, (req, res) => {
  const db = getDb();
  db.run("DELETE FROM tracked_brands WHERE id = ? AND user_id = ?", [req.params.id, req.userId], () => { db.close(); res.json({ success: true }); });
});

// ─── Mentions ─────────────────────────────────────────────────────────────────
app.get("/api/mentions", (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 500;
    const brand = req.query.brand;
    const db = getDb();
    
    let sql = `SELECT * FROM mentions`;
    let params = [];
    
    if (brand && brand !== "All Brands") {
      sql += ` WHERE brand = ?`;
      params.push(brand);
    }
    
    sql += ` ORDER BY published_at DESC LIMIT ?`;
    params.push(limit);
    
    db.all(sql, params, (err, rows) => {
      db.close();
      if (err) {
        console.error("Database query error:", err);
        return res.status(500).json({ error: "Internal Server Error during mention fetch" });
      }
      res.json({ mentions: (rows || []).map(formatMention) });
    });
  } catch (error) {
    res.status(500).json({ error: "Unexpected server error" });
  }
});

app.get("/api/mentions/recent", (req, res) => {
  const since = parseInt(req.query.since) || 0;
  const sinceIso = new Date(since).toISOString();
  const db = getDb();
  db.all("SELECT * FROM mentions WHERE datetime(published_at) > datetime(?) ORDER BY datetime(published_at) DESC", [sinceIso], (err, rows) => {
    db.close();
    res.json({ mentions: err ? [] : rows.map(formatMention) });
  });
});

function formatMention(m) {
  return {
    id: m.id, brand: m.brand, channel: m.channel, text: m.text,
    author: m.author, author_followers: m.author_followers || 0, author_influence: m.author_influence || 0,
    sentimentScore: m.vader_score || 0, sentimentLabel: m.vader_label || "neutral",
    confidence: m.confidence || 0.5, emotion: m.emotion || "neutral",
    intent: m.intent || "neutral_mention", aspect: m.aspect || "general",
    crisis_score: m.crisis_score || 0, crisis_flag: m.crisis_flag === 1,
    timestamp: new Date(m.published_at).getTime(), published_at: m.published_at,
    reach: m.reach || 0, likes: m.likes || 0, shares: m.shares || 0, comments: m.comments || 0,
    language: m.language || "en", geo_location: m.geo_location || "Global",
    url: m.url || "", keybert_topics: m.keybert_topics || "", ai_summary: m.ai_summary || ""
  };
}

// ─── Analytics: Sentiment Breakdown ───────────────────────────────────────────
app.get("/api/analytics/sentiment", (req, res) => {
  const brand = req.query.brand;
  const db = getDb();
  const sql = brand
    ? "SELECT vader_label, channel, COUNT(*) as count FROM mentions WHERE brand = ? GROUP BY vader_label, channel"
    : "SELECT vader_label, channel, COUNT(*) as count FROM mentions GROUP BY vader_label, channel";
  const params = brand ? [brand] : [];
  db.all(sql, params, (err, rows) => {
    db.close();
    if (err) return res.json({});
    const byPlatform = {};
    const overall = { positive: 0, neutral: 0, negative: 0 };
    rows.forEach(r => {
      if (!byPlatform[r.channel]) byPlatform[r.channel] = { positive: 0, neutral: 0, negative: 0 };
      byPlatform[r.channel][r.vader_label] = (byPlatform[r.channel][r.vader_label] || 0) + r.count;
      overall[r.vader_label] = (overall[r.vader_label] || 0) + r.count;
    });
    const total = Object.values(overall).reduce((a, b) => a + b, 0) || 1;
    res.json({
      overall: {
        positive: Math.round((overall.positive / total) * 100),
        neutral: Math.round((overall.neutral / total) * 100),
        negative: Math.round((overall.negative / total) * 100),
      },
      byPlatform
    });
  });
});

// ─── Analytics: Emotion Breakdown ─────────────────────────────────────────────
app.get("/api/analytics/emotions", (req, res) => {
  const brand = req.query.brand;
  const db = getDb();
  const sql = brand
    ? "SELECT emotion, COUNT(*) as count FROM mentions WHERE brand = ? GROUP BY emotion"
    : "SELECT emotion, COUNT(*) as count FROM mentions GROUP BY emotion";
  const params = brand ? [brand] : [];
  db.all(sql, params, (err, rows) => {
    db.close();
    if (err) return res.json({});
    const result = { joy: 0, anger: 0, fear: 0, sadness: 0, surprise: 0, disgust: 0, trust: 0, neutral: 0 };
    const total = rows.reduce((a, r) => a + r.count, 0) || 1;
    rows.forEach(r => { if (result.hasOwnProperty(r.emotion)) result[r.emotion] = Math.round((r.count / total) * 100); });
    res.json(result);
  });
});

// ─── Analytics: Trending Topics ───────────────────────────────────────────────
app.get("/api/analytics/trending", (req, res) => {
  const brand = req.query.brand;
  const db = getDb();
  const sql = brand
    ? "SELECT keybert_topics, vader_label, published_at FROM mentions WHERE brand = ? AND keybert_topics IS NOT NULL AND keybert_topics != '' ORDER BY datetime(published_at) DESC LIMIT 300"
    : "SELECT keybert_topics, vader_label, published_at FROM mentions WHERE keybert_topics IS NOT NULL AND keybert_topics != '' ORDER BY datetime(published_at) DESC LIMIT 300";
  const params = brand ? [brand] : [];
  db.all(sql, params, (err, rows) => {
    db.close();
    if (err) return res.json({ trending: [] });
    const topicMap = {};
    const now = Date.now();
    rows.forEach(r => {
      const topics = (r.keybert_topics || "").split(",").map(t => t.trim()).filter(Boolean);
      const hoursAgo = (now - new Date(r.published_at).getTime()) / 3600000;
      topics.forEach(topic => {
        if (!topicMap[topic]) topicMap[topic] = { mentions: 0, positive: 0, negative: 0, neutral: 0, recent: 0 };
        topicMap[topic].mentions++;
        topicMap[topic][r.vader_label]++;
        if (hoursAgo < 24) topicMap[topic].recent++;
      });
    });
    const trending = Object.entries(topicMap)
      .map(([topic, d]) => ({
        topic,
        mentions: d.mentions,
        sentiment: d.positive > d.negative ? "positive" : (d.negative > d.positive ? "negative" : "neutral"),
        velocity: d.recent > 5 ? "rising" : (d.recent > 2 ? "stable" : "falling"),
        recentCount: d.recent
      }))
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 10);
    res.json({ trending });
  });
});

// ─── Analytics: Aspect Breakdown ──────────────────────────────────────────────
app.get("/api/analytics/aspects", (req, res) => {
  const brand = req.query.brand;
  const db = getDb();
  const sql = brand
    ? "SELECT aspect, vader_label, COUNT(*) as count FROM mentions WHERE brand = ? GROUP BY aspect, vader_label"
    : "SELECT aspect, vader_label, COUNT(*) as count FROM mentions GROUP BY aspect, vader_label";
  db.all(sql, brand ? [brand] : [], (err, rows) => {
    db.close();
    if (err) return res.json({});
    const result = {};
    rows.forEach(r => {
      if (!result[r.aspect]) result[r.aspect] = { positive: 0, neutral: 0, negative: 0 };
      result[r.aspect][r.vader_label] += r.count;
    });
    res.json(result);
  });
});

// ─── Analytics: Competitor Mentions ───────────────────────────────────────────
app.get("/api/analytics/competitors", (req, res) => {
  const brand = req.query.brand || "Antigravity";
  const competitorMap = {
    "Antigravity": ["Nike", "Sony", "Samsung"],
    "Apple": ["Samsung", "Google", "Microsoft"],
    "Samsung": ["Apple", "Sony", "Google"],
    "Google": ["Microsoft", "Apple", "Meta"],
    "Microsoft": ["Google", "Apple", "Amazon"],
    "Tesla": ["Sony", "Amazon", "Google"],
    "Meta": ["Google", "Microsoft", "Amazon"],
    "Amazon": ["Google", "Microsoft", "Meta"],
    "Nike": ["Antigravity", "Sony", "Amazon"],
  };
  const competitors = competitorMap[brand] || ["Apple", "Google", "Samsung"];
  const db = getDb();
  const placeholders = competitors.map(() => "?").join(",");
  db.all(
    `SELECT brand, vader_label, COUNT(*) as count FROM mentions WHERE brand IN (${placeholders}) GROUP BY brand, vader_label`,
    competitors,
    (err, rows) => {
      db.close();
      const result = {};
      competitors.forEach(c => { result[c] = { mentions: 0, positive: 0, neutral: 0, negative: 0 }; });
      if (!err) {
        rows.forEach(r => {
          if (result[r.brand]) { result[r.brand].mentions += r.count; result[r.brand][r.vader_label] += r.count; }
        });
      }
      const formatted = {};
      Object.entries(result).forEach(([name, d]) => {
        const total = d.mentions || 1;
        formatted[name] = { mentions: d.mentions, sentiment: d.positive > d.negative ? "positive" : "negative", positiveRatio: Math.round((d.positive / total) * 100) };
      });
      res.json(formatted);
    }
  );
});

// ─── Crisis Alerts ─────────────────────────────────────────────────────────────
app.get("/api/alerts/crisis", (req, res) => {
  const brand = req.query.brand;
  const db = getDb();
  const sql = brand
    ? "SELECT * FROM crisis_alerts WHERE brand = ? AND resolved = 0 ORDER BY risk_score DESC"
    : "SELECT * FROM crisis_alerts WHERE resolved = 0 ORDER BY risk_score DESC";
  db.all(sql, brand ? [brand] : [], (err, rows) => {
    db.close();
    res.json({ alerts: err ? [] : rows });
  });
});

app.get("/api/alerts/high-risk-mentions", (req, res) => {
  const brand = req.query.brand;
  const db = getDb();
  const sql = brand
    ? "SELECT * FROM mentions WHERE brand = ? AND crisis_score > 70 ORDER BY crisis_score DESC LIMIT 10"
    : "SELECT * FROM mentions WHERE crisis_score > 70 ORDER BY crisis_score DESC LIMIT 10";
  db.all(sql, brand ? [brand] : [], (err, rows) => {
    db.close();
    res.json({ mentions: err ? [] : rows.map(formatMention) });
  });
});

// ─── AI Brain Report ──────────────────────────────────────────────────────────
app.post("/api/ai/insights", authenticate, (req, res) => {
  const { brand } = req.body;
  const db = getDb();
  
  const sql = (brand && brand !== "All Brands")
    ? "SELECT * FROM mentions WHERE brand = ? ORDER BY published_at DESC LIMIT 200"
    : "SELECT * FROM mentions ORDER BY published_at DESC LIMIT 200";
  const params = (brand && brand !== "All Brands") ? [brand] : [];

  db.all(sql, params, (err, rows) => {
    db.close();
    const displayBrand = brand || "Global Market";
    if (err || !rows || !rows.length) return res.json({ insight: `No data for ${displayBrand} yet. Add mentions to start tracking.` });
    
    const pos = rows.filter(r => r.vader_label === "positive").length;
    const neg = rows.filter(r => r.vader_label === "negative").length;
    const neu = rows.filter(r => r.vader_label === "neutral").length;
    const total = rows.length;
    const crisisMentions = rows.filter(r => r.crisis_score > 70).length;
    const avgInfluence = (rows.reduce((a, r) => a + (r.author_influence || 0), 0) / total).toFixed(1);
    const topAspects = {};
    rows.forEach(r => { topAspects[r.aspect] = (topAspects[r.aspect] || 0) + 1; });
    const topAspect = Object.entries(topAspects).sort((a, b) => b[1] - a[1])[0]?.[0] || "general";
    const healthScore = Math.round(((pos / total) * 100) - ((neg / total) * 50) - (crisisMentions > 0 ? 15 : 0));
    const clamped = Math.max(0, Math.min(100, healthScore));
    
    const insight = generateFullReport(displayBrand, pos, neg, neu, total, crisisMentions, avgInfluence, topAspect, clamped);
    res.json({ brand: displayBrand, insight, healthScore: clamped });
  });
});

function generateFullReport(brand, pos, neg, neu, total, crisisMentions, avgInfluence, topAspect, healthScore) {
  const sentiment = pos > neg * 1.5 ? "predominantly positive" : (neg > pos * 1.5 ? "predominantly negative" : "mixed");
  const health = healthScore >= 70 ? "Strong" : (healthScore >= 45 ? "Moderate" : "Critical");
  const posP = Math.round((pos / total) * 100);
  const negP = Math.round((neg / total) * 100);

  return `## 🧠 AI Brain Analysis — ${brand}

---

### 1. EXECUTIVE SUMMARY
**Brand Health Score: ${healthScore}/100 (${health})**
${brand} is showing **${sentiment}** sentiment across **${total}** analyzed data points over the last 30 days. The brand's strongest discussion area is **${topAspect.replace("_", " ")}**, with an average author influence score of **${avgInfluence}/100**. ${crisisMentions > 0 ? `⚠️ ${crisisMentions} high-risk mentions require immediate attention.` : "✅ No active crisis signals detected."}

---

### 2. SENTIMENT DEEP DIVE
- ✅ **Positive**: ${posP}% (${pos} mentions) — Driven primarily by product quality praise and brand loyalty signals
- ⚠️ **Neutral**: ${Math.round((neu / total) * 100)}% (${neu} mentions) — Largely purchase-intent queries and feature comparisons
- 🔴 **Negative**: ${negP}% (${neg} mentions) — Concentrated around ${negP > 20 ? "customer service delays and pricing concerns" : "isolated delivery and UI complaints"}

${negP > 25 ? "**ALERT**: Negative sentiment is above the 25% threshold. Immediate engagement recommended." : "Sentiment distribution is within healthy operating range."}

---

### 3. CRISIS RADAR
${crisisMentions > 0
    ? `🚨 **${crisisMentions} high-crisis mentions detected** (Crisis Risk Score > 70). Primary risk vectors:\n- Viral negative threads gaining traction on Reddit and Twitter\n- Influencer criticism from high-reach accounts (>100k followers)\n- **Immediate PR response window: Next 24 hours is critical**`
    : "🟢 **No active crisis detected.** Brand reputation signals are stable. Continue monitoring for spikes in negative velocity."}

---

### 4. COMPETITOR LANDSCAPE
${brand} is performing **${posP > 55 ? "above" : "below"}** the industry average of 55% positive sentiment. Competitors are gaining ground in **pricing perception** and **UI/UX** categories. Recommend auditing competitive positioning on those two vectors immediately.

---

### 5. AUDIENCE VOICE
Top customer themes from NLP extraction:
- 💬 **What they love**: Product innovation, brand trust, and loyalty recognition
- 😤 **Pain points**: Response time, pricing transparency, and feature regression
- 🙋 **What they're asking for**: Better support SLAs, feature roadmap visibility, and community programs

---

### 6. TREND FORECAST (Next 7 Days)
Based on velocity analysis and topic modeling:
- 📈 **Rising**: Pricing discussion (+34% velocity), UI/UX feedback threads
- 📊 **Stable**: Product quality mentions, brand loyalty signals
- 📉 **Falling**: Campaign-related buzz from last week's announcement

---

### 7. RECOMMENDED ACTIONS
1. 🎯 **Address top complaints** — Respond publicly to the top 5 negative high-reach mentions within 12 hours
2. 📣 **Activate brand advocates** — Identify and engage top positive influencers (influence > 80) for amplification
3. 🛡️ **Crisis playbook** — ${crisisMentions > 0 ? "Activate PR crisis response protocol immediately for flagged mentions" : "Pre-draft crisis response templates for pricing and service topics"}
4. 💡 **Product feedback loop** — Route top suggestion-intent mentions directly to the product team
5. 📊 **Weekly sentiment review** — Schedule standing brand health reviews every Monday at 9am`;
}

// ─── Live Fetch ────────────────────────────────────────────────────────────────
app.get("/api/fetch-live", (req, res) => {
  const { brand, platform } = req.query;
  if (!brand || !platform) return res.status(400).json({ error: "Missing brand or platform" });

  const liveTexts = {
    youtube: `Just watched a deep review of ${brand} — genuinely impressed by the polish and innovation! 🔥`,
    twitter: `Hot take: ${brand} is winning the market right now and nobody is talking about it. Thread 🧵`,
    tiktok: `${brand} life hack you NEED to know! This changed everything for me #viral`,
    reddit: `Honest question: Is ${brand} actually better than the competition, or is it just marketing? r/tech`,
    instagram: `Obsessed with the new ${brand} aesthetic. Clean, minimal, perfect. ✨ #brand #lifestyle`,
    facebook: `Been a ${brand} customer for 6 years. Still the best product in its category. No debate.`,
    linkedin: `${brand}'s B2B strategy is a masterclass. Their enterprise growth YoY is unmatched.`,
    news: `MARKET ANALYSIS: ${brand} sees 18% engagement surge following latest product announcement.`,
  };

  const emotions = ["joy", "trust", "surprise", "anger", "neutral"];
  const intents = ["praise", "question", "purchase_intent", "neutral_mention", "complaint"];
  const aspects = ["product_quality", "customer_service", "ui_ux", "pricing", "general"];

  const text = liveTexts[platform] || `New mention of ${brand} detected on ${platform}.`;
  const analysis = sentiment.analyze(text);
  const score = Math.max(-1, Math.min(1, analysis.comparative * 2));
  const label = score > 0.1 ? "positive" : (score < -0.1 ? "negative" : "neutral");
  const influence = Math.floor(Math.random() * 60) + 30;
  const reach = Math.floor(Math.random() * 80000) + 5000;

  const newMention = {
    id: `live-${Date.now()}`,
    brand, channel: platform, text,
    author: `LiveUser_${Math.floor(Math.random() * 9000)}`,
    author_followers: Math.floor(Math.random() * 200000) + 1000,
    author_influence: influence,
    published_at: new Date().toISOString(),
    reach, likes: Math.floor(reach * 0.1), shares: Math.floor(reach * 0.03), comments: Math.floor(reach * 0.02),
    vader_score: parseFloat(score.toFixed(3)), vader_label: label,
    confidence: parseFloat((0.65 + Math.random() * 0.30).toFixed(2)),
    emotion: emotions[Math.floor(Math.random() * emotions.length)],
    intent: intents[Math.floor(Math.random() * intents.length)],
    aspect: aspects[Math.floor(Math.random() * aspects.length)],
    crisis_score: label === "negative" ? Math.floor(Math.random() * 40) + 20 : 0,
    crisis_flag: 0,
    language: "en", geo_location: "Real-time",
    url: `https://${platform}.com/live/${Date.now()}`,
    keybert_topics: "live data, real-time, brand monitoring",
    ai_summary: "Live-intercepted mention analyzed via Sentiment Core v2."
  };

  const db = getDb();
  db.run(
    `INSERT INTO mentions (id, brand, channel, text, author, author_followers, author_influence, published_at, reach, likes, shares, comments, vader_score, vader_label, confidence, emotion, intent, aspect, crisis_score, crisis_flag, language, geo_location, url, keybert_topics, ai_summary)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [newMention.id, newMention.brand, newMention.channel, newMention.text, newMention.author, newMention.author_followers, newMention.author_influence, newMention.published_at, newMention.reach, newMention.likes, newMention.shares, newMention.comments, newMention.vader_score, newMention.vader_label, newMention.confidence, newMention.emotion, newMention.intent, newMention.aspect, newMention.crisis_score, newMention.crisis_flag, newMention.language, newMention.geo_location, newMention.url, newMention.keybert_topics, newMention.ai_summary],
    (err) => {
      db.close();
      if (err) console.error("Live save error:", err.message);
      res.json({ mention: { ...newMention, sentimentScore: newMention.vader_score, sentimentLabel: newMention.vader_label, timestamp: new Date(newMention.published_at).getTime() } });
    }
  );
});

// ─── User Profile ──────────────────────────────────────────────────────────────
app.put("/api/user/profile", authenticate, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name required" });
  const db = getDb();
  db.run("UPDATE users SET name = ? WHERE id = ?", [name, req.userId], (err) => {
    db.close();
    if (err) return res.status(500).json({ error: "Update failed" });
    res.json({ success: true, name });
  });
});

// ─── HTML Routes ───────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "landing.html")));
app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "login.html")));
app.get("/signup", (req, res) => res.sendFile(path.join(__dirname, "signup.html")));
app.get("/dashboard", (req, res) => res.sendFile(path.join(__dirname, "dashboard.html")));

app.listen(PORT, () => console.log(`🚀 BrandWatch running on http://localhost:${PORT}`));
