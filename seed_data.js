/**
 * BrandWatch Seed Data Generator v2
 * Generates 600+ rich, realistic mentions with full NLP metadata.
 */

const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const Sentiment = require("sentiment");
const sentiment = new Sentiment();

const dbPath = path.join(__dirname, "database", "mentions.db");
const db = new sqlite3.Database(dbPath);

const brands = ["Antigravity", "Apple", "Samsung", "Google", "Microsoft", "Tesla", "Sony", "Meta", "Amazon", "Nike"];
const competitors = { "Antigravity": ["Nike", "Adidas", "Lululemon"], "Apple": ["Samsung", "Google"], "Samsung": ["Apple", "Xiaomi"] };
const platforms = ["youtube", "twitter", "reddit", "instagram", "facebook", "tiktok", "linkedin", "news"];
const geos = ["United States", "United Kingdom", "India", "Germany", "Canada", "Australia", "France", "Brazil", "Japan", "UAE"];
const languages = ["en", "en", "en", "en", "en", "en", "hi", "es", "fr", "de"];

const mentionTemplates = [
  // Positive - Product Quality
  { text: "Absolutely blown away by {brand}'s latest product. The build quality is in a different league. Worth every penny! 🔥", sentiment: "positive", emotion: "joy", intent: "praise", aspect: "product_quality", crisis_score: 0, confidence: 0.91 },
  { text: "Just unboxed my new {brand} and I genuinely cannot stop smiling. This is what premium feels like.", sentiment: "positive", emotion: "joy", intent: "praise", aspect: "product_quality", crisis_score: 0, confidence: 0.88 },
  { text: "The new {brand} update is EXACTLY what we needed. Whoever runs their product team deserves a raise. 👏", sentiment: "positive", emotion: "trust", intent: "praise", aspect: "product_quality", crisis_score: 0, confidence: 0.85 },
  { text: "{brand} just set a new industry standard. Competitors are going to need years to catch up.", sentiment: "positive", emotion: "trust", intent: "comparison", aspect: "product_quality", crisis_score: 0, confidence: 0.82 },
  { text: "Been using {brand} for 3 years now. Never switching. The quality improvement every year is remarkable.", sentiment: "positive", emotion: "trust", intent: "praise", aspect: "product_quality", crisis_score: 0, confidence: 0.87 },
  // Positive - Customer Service
  { text: "{brand}'s support team resolved my issue in under 10 minutes. That's world-class service! Thank you 🙌", sentiment: "positive", emotion: "joy", intent: "praise", aspect: "customer_service", crisis_score: 0, confidence: 0.90 },
  { text: "Shoutout to {brand} customer care — they went above and beyond to fix my order. Truly exceptional!", sentiment: "positive", emotion: "joy", intent: "praise", aspect: "customer_service", crisis_score: 0, confidence: 0.86 },
  { text: "{brand}'s live chat support is the fastest I've ever experienced. 5 stars, no question.", sentiment: "positive", emotion: "trust", intent: "praise", aspect: "customer_service", crisis_score: 0, confidence: 0.84 },
  // Positive - Pricing / Value
  { text: "{brand} just announced a 20% price drop AND added more features. This is how you treat loyal customers! 🎉", sentiment: "positive", emotion: "joy", intent: "praise", aspect: "pricing", crisis_score: 0, confidence: 0.89 },
  { text: "Honestly didn't expect {brand} to be this affordable for the features you get. Incredible value.", sentiment: "positive", emotion: "surprise", intent: "praise", aspect: "pricing", crisis_score: 0, confidence: 0.82 },
  // Positive - UI/UX
  { text: "The redesigned {brand} app is gorgeous. Whoever did their UX deserves every award. So intuitive!", sentiment: "positive", emotion: "joy", intent: "praise", aspect: "ui_ux", crisis_score: 0, confidence: 0.91 },
  { text: "{brand}'s new interface is a masterclass in clean design. Love every pixel of it.", sentiment: "positive", emotion: "joy", intent: "praise", aspect: "ui_ux", crisis_score: 0, confidence: 0.87 },
  // Positive - Marketing Campaign
  { text: "That new {brand} campaign gave me CHILLS. Emotional, powerful, perfectly on-brand. Ad of the year.", sentiment: "positive", emotion: "surprise", intent: "praise", aspect: "marketing_campaign", crisis_score: 0, confidence: 0.83 },
  { text: "{brand}'s marketing team is operating at a completely different level right now. 🔥 Stunning campaign.", sentiment: "positive", emotion: "joy", intent: "praise", aspect: "marketing_campaign", crisis_score: 0, confidence: 0.80 },
  // Positive - Leadership
  { text: "The vision {brand}'s CEO just shared is exactly what the industry needs. Bold, clear, and human.", sentiment: "positive", emotion: "trust", intent: "praise", aspect: "leadership", crisis_score: 0, confidence: 0.78 },
  { text: "Impressed by {brand}'s transparent communication during the crisis. Leadership matters.", sentiment: "positive", emotion: "trust", intent: "praise", aspect: "leadership", crisis_score: 0, confidence: 0.82 },
  // Positive - CSR/Ethics
  { text: "{brand}'s commitment to sustainability isn't just PR — they're actually delivering on their carbon pledges. Respect.", sentiment: "positive", emotion: "trust", intent: "praise", aspect: "csr_ethics", crisis_score: 0, confidence: 0.81 },
  { text: "Love that {brand} is investing in community programs. This is what responsible business looks like.", sentiment: "positive", emotion: "joy", intent: "praise", aspect: "csr_ethics", crisis_score: 0, confidence: 0.79 },
  // Neutral - Question
  { text: "Does anyone know if {brand} ships to international addresses? Considering an order.", sentiment: "neutral", emotion: "neutral", intent: "question", aspect: "customer_service", crisis_score: 0, confidence: 0.72 },
  { text: "Has {brand} announced their Q4 roadmap yet? Would love to know what's coming.", sentiment: "neutral", emotion: "neutral", intent: "question", aspect: "product_quality", crisis_score: 0, confidence: 0.68 },
  { text: "Can anyone compare {brand} vs the competition for enterprise use cases? Doing due diligence.", sentiment: "neutral", emotion: "neutral", intent: "comparison", aspect: "product_quality", crisis_score: 0, confidence: 0.65 },
  { text: "Thinking about switching to {brand}. Anyone here have long-term experience with them?", sentiment: "neutral", emotion: "neutral", intent: "question", aspect: "general", crisis_score: 0, confidence: 0.70 },
  { text: "{brand} just posted their annual report. Numbers look interesting. Worth a deeper read.", sentiment: "neutral", emotion: "neutral", intent: "neutral_mention", aspect: "general", crisis_score: 0, confidence: 0.66 },
  { text: "Attended the {brand} webinar today. Good information but didn't cover pricing in detail.", sentiment: "neutral", emotion: "neutral", intent: "suggestion", aspect: "pricing", crisis_score: 0, confidence: 0.71 },
  // Neutral - Purchase Intent
  { text: "About to pull the trigger on a {brand} subscription. Anyone have a discount code?", sentiment: "neutral", emotion: "neutral", intent: "purchase_intent", aspect: "pricing", crisis_score: 0, confidence: 0.74 },
  { text: "Seriously considering {brand} for our team of 50. Booking a demo next week.", sentiment: "neutral", emotion: "neutral", intent: "purchase_intent", aspect: "product_quality", crisis_score: 0, confidence: 0.76 },
  // Negative - Customer Service
  { text: "Waited 4 days for {brand} support to respond. Zero accountability. This is unacceptable. 😤", sentiment: "negative", emotion: "anger", intent: "complaint", aspect: "customer_service", crisis_score: 55, confidence: 0.88 },
  { text: "{brand} support literally told me to 'try restarting'. Third time contacting them. Pathetic.", sentiment: "negative", emotion: "anger", intent: "complaint", aspect: "customer_service", crisis_score: 50, confidence: 0.84 },
  { text: "AVOID {brand}'s premium support plan. Worst $99/month I've ever spent. Zero human interaction.", sentiment: "negative", emotion: "anger", intent: "complaint", aspect: "customer_service", crisis_score: 58, confidence: 0.85 },
  // Negative - Product Quality
  { text: "My {brand} device stopped working after 2 months. Build quality is a DISASTER. Never again.", sentiment: "negative", emotion: "anger", intent: "complaint", aspect: "product_quality", crisis_score: 62, confidence: 0.89 },
  { text: "The new {brand} update completely broke the feature I use most. How does QA let this ship?", sentiment: "negative", emotion: "anger", intent: "complaint", aspect: "product_quality", crisis_score: 55, confidence: 0.86 },
  { text: "Regression city with {brand}. Every update fixes one bug and introduces three more. Embarrassing.", sentiment: "negative", emotion: "disgust", intent: "complaint", aspect: "product_quality", crisis_score: 52, confidence: 0.83 },
  // Negative - Pricing
  { text: "{brand} just raised prices by 40% with NO new features. Pure greed. Cancelling my subscription.", sentiment: "negative", emotion: "anger", intent: "complaint", aspect: "pricing", crisis_score: 65, confidence: 0.90 },
  { text: "How can {brand} justify charging this much? Competitors offer the same for half the price. Ridiculous.", sentiment: "negative", emotion: "anger", intent: "comparison", aspect: "pricing", crisis_score: 60, confidence: 0.86 },
  // Negative - Delivery
  { text: "{brand} promised 2-day delivery and it's been 12 days. No updates, no apology. Fraud.", sentiment: "negative", emotion: "anger", intent: "complaint", aspect: "delivery", crisis_score: 68, confidence: 0.91 },
  { text: "Package arrived damaged from {brand}. Their response? 'File a complaint online.' Zero empathy.", sentiment: "negative", emotion: "disgust", intent: "complaint", aspect: "delivery", crisis_score: 63, confidence: 0.88 },
  // Negative - UI/UX
  { text: "{brand}'s new app redesign is a UX nightmare. I literally can't find the settings anymore. Disaster.", sentiment: "negative", emotion: "anger", intent: "complaint", aspect: "ui_ux", crisis_score: 45, confidence: 0.82 },
  { text: "Who approved {brand}'s latest UI? It's confusing, slow, and ugly. Step backwards in every way.", sentiment: "negative", emotion: "disgust", intent: "complaint", aspect: "ui_ux", crisis_score: 48, confidence: 0.84 },
  // CRISIS - High Risk
  { text: "BREAKING: Multiple users reporting data breach at {brand}. Credentials exposed. Changing passwords NOW.", sentiment: "negative", emotion: "fear", intent: "complaint", aspect: "csr_ethics", crisis_score: 95, confidence: 0.97 },
  { text: "Class action lawsuit incoming for {brand}? This is the THIRD privacy violation in 2 years. Unforgivable.", sentiment: "negative", emotion: "anger", intent: "complaint", aspect: "csr_ethics", crisis_score: 92, confidence: 0.95 },
  { text: "{brand} CEO scandal is trending #1. Board needs to act immediately or this brand is done.", sentiment: "negative", emotion: "anger", intent: "complaint", aspect: "leadership", crisis_score: 88, confidence: 0.93 },
  { text: "Coordinated campaign against {brand} gaining traction. 50k signatures on petition already.", sentiment: "negative", emotion: "anger", intent: "complaint", aspect: "csr_ethics", crisis_score: 82, confidence: 0.90 },
  { text: "{brand} products CAUGHT by regulators for false advertising. This is going to be huge.", sentiment: "negative", emotion: "disgust", intent: "complaint", aspect: "marketing_campaign", crisis_score: 85, confidence: 0.91 },
  // Suggestions
  { text: "{brand} please add dark mode to the mobile app. It's 2024 and this is basic. Love the product though!", sentiment: "neutral", emotion: "neutral", intent: "suggestion", aspect: "ui_ux", crisis_score: 0, confidence: 0.74 },
  { text: "Would love to see {brand} add API access for developers. The platform is great but needs extensibility.", sentiment: "neutral", emotion: "neutral", intent: "suggestion", aspect: "product_quality", crisis_score: 0, confidence: 0.71 },
  { text: "My one wish for {brand}: better offline mode. Everything else is perfect!", sentiment: "positive", emotion: "joy", intent: "suggestion", aspect: "product_quality", crisis_score: 0, confidence: 0.75 },
  // Viral / Surprise
  { text: "Wait... {brand} just partnered with that A-list celebrity?? This is going to be MASSIVE. 🚀", sentiment: "positive", emotion: "surprise", intent: "neutral_mention", aspect: "marketing_campaign", crisis_score: 0, confidence: 0.80 },
  { text: "{brand} stock up 18% after earnings. Wall Street didn't see THAT coming. Impressive!", sentiment: "positive", emotion: "surprise", intent: "neutral_mention", aspect: "general", crisis_score: 0, confidence: 0.76 },
  { text: "Did {brand} just quietly release a feature that everyone's been begging for? Let me check... YES THEY DID!", sentiment: "positive", emotion: "surprise", intent: "praise", aspect: "product_quality", crisis_score: 0, confidence: 0.83 },
  // Mixed
  { text: "{brand} has great hardware but the software still needs a lot of work. Promising but not there yet.", sentiment: "neutral", emotion: "neutral", intent: "comparison", aspect: "product_quality", crisis_score: 0, confidence: 0.68 },
  { text: "Love the concept from {brand} but the execution is disappointing. Had higher expectations honestly.", sentiment: "negative", emotion: "sadness", intent: "complaint", aspect: "product_quality", crisis_score: 25, confidence: 0.72 },
  { text: "Great first impression with {brand}, but customer support dragged the experience down significantly.", sentiment: "neutral", emotion: "sadness", intent: "complaint", aspect: "customer_service", crisis_score: 20, confidence: 0.70 },
  // Churn Risk
  { text: "Seriously considering cancelling my {brand} subscription after the latest changes. Not happy.", sentiment: "negative", emotion: "sadness", intent: "complaint", aspect: "general", crisis_score: 40, confidence: 0.80 },
  { text: "After 5 years as a {brand} customer I'm finally making the switch. The quality just isn't there anymore.", sentiment: "negative", emotion: "sadness", intent: "complaint", aspect: "product_quality", crisis_score: 45, confidence: 0.82 },
];

const authors = [
  { name: "tech_sarah92", followers: 145000, influence: 82 },
  { name: "brandwatcher_mike", followers: 89000, influence: 74 },
  { name: "digitalNomad_v", followers: 320000, influence: 91 },
  { name: "ConsumerVoiceX", followers: 28000, influence: 58 },
  { name: "YogiMom_fitness", followers: 67000, influence: 68 },
  { name: "TechReview_Daily", followers: 512000, influence: 96 },
  { name: "everyday_shopper", followers: 1200, influence: 22 },
  { name: "fitnessFreak2024", followers: 45000, influence: 62 },
  { name: "AnonymousUser_99", followers: 300, influence: 10 },
  { name: "MarketingPro_Jess", followers: 98000, influence: 78 },
  { name: "StartupFounder_AK", followers: 210000, influence: 88 },
  { name: "DataDrivenDave", followers: 55000, influence: 65 },
  { name: "CryptoQueen_Emma", followers: 670000, influence: 97 },
  { name: "HealthyLife_Blog", followers: 32000, influence: 55 },
  { name: "ProductHunt_Fan", followers: 18000, influence: 45 },
];

const getRecentDate = (daysBack) => {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  d.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
  return d.toISOString();
};

const topics = [
  "brand quality", "customer experience", "product innovation", "pricing strategy",
  "user interface", "brand loyalty", "competitive advantage", "social responsibility",
  "delivery speed", "brand transparency", "viral marketing", "customer churn",
  "data privacy", "brand reputation", "influencer partnership"
];

const getTopics = () => {
  const count = Math.floor(Math.random() * 3) + 1;
  const shuffled = [...topics].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count).join(", ");
};

db.serialize(() => {
  console.log("🌱 Seeding BrandWatch database with rich NLP data...");

  db.run("DELETE FROM mentions");
  db.run("DELETE FROM crisis_alerts");

  const stmt = db.prepare(`INSERT OR REPLACE INTO mentions (
    id, brand, channel, text, author, author_followers, author_influence,
    published_at, reach, likes, shares, comments,
    vader_score, vader_label, confidence, emotion, intent, aspect,
    crisis_score, crisis_flag, language, geo_location, url, keybert_topics, ai_summary
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  let count = 0;

  for (const brand of brands) {
    const iterCount = brand === "Antigravity" ? 80 : 55;
    for (let i = 0; i < iterCount; i++) {
      const tmpl = mentionTemplates[Math.floor(Math.random() * mentionTemplates.length)];
      const platform = platforms[Math.floor(Math.random() * platforms.length)];
      const author = authors[Math.floor(Math.random() * authors.length)];
      const geo = geos[Math.floor(Math.random() * geos.length)];
      const lang = languages[Math.floor(Math.random() * languages.length)];

      const text = tmpl.text.replace(/\{brand\}/g, brand);
      const analysis = sentiment.analyze(text);
      const rawScore = Math.max(-1, Math.min(1, analysis.comparative * 2));

      // Bias score toward template's expected sentiment
      let finalScore = rawScore;
      if (tmpl.sentiment === "positive") finalScore = Math.max(0.1, Math.abs(rawScore));
      if (tmpl.sentiment === "negative") finalScore = Math.min(-0.1, -Math.abs(rawScore));

      const label = finalScore > 0.1 ? "positive" : (finalScore < -0.1 ? "negative" : "neutral");
      const daysBack = i < 10 ? 1 : (i < 30 ? 7 : 30); // More recent data for latest entries
      const likes = Math.floor(author.influence * Math.random() * 500);
      const shares = Math.floor(likes * 0.3);
      const comments = Math.floor(likes * 0.2);
      const reach = author.followers + likes + shares * 10;

      stmt.run(
        `m-${brand.toLowerCase()}-${Date.now()}-${count}`,
        brand, platform, text,
        author.name, author.followers, author.influence,
        getRecentDate(daysBack),
        reach, likes, shares, comments,
        parseFloat(finalScore.toFixed(3)), label,
        tmpl.confidence,
        tmpl.emotion, tmpl.intent, tmpl.aspect,
        tmpl.crisis_score,
        tmpl.crisis_score > 70 ? 1 : 0,
        lang, geo,
        `https://${platform}.com/post/${count}`,
        getTopics(),
        `AI-classified: ${tmpl.sentiment} signal with ${tmpl.emotion} emotion detected via NLP pipeline.`
      );
      count++;
    }
  }

  stmt.finalize();
  console.log(`✅ Seeded ${count} rich mentions across ${brands.length} brands.`);

  // Seed crisis alerts for Antigravity
  const crisisAlerts = [
    {
      brand: "Antigravity",
      type: "viral_negative_thread",
      risk_score: 82,
      summary: "A Reddit thread criticizing Antigravity's latest pricing hike has gone viral with 4,200 upvotes and 890 comments. Sentiment is 91% negative.",
      recommended_action: "Issue a transparent pricing explanation post within 24h. Consider a loyalty discount for existing subscribers."
    },
    {
      brand: "Antigravity",
      type: "influencer_criticism",
      risk_score: 75,
      summary: "TechReview_Daily (512k followers) published a critical video review. Reach: 340k views. Negative sentiment spike of 23% in last 6 hours.",
      recommended_action: "Reach out to the influencer for a factual correction or invite them for a product walkthrough session."
    }
  ];

  const alertStmt = db.prepare(`INSERT INTO crisis_alerts (brand, type, risk_score, summary, recommended_action) VALUES (?, ?, ?, ?, ?)`);
  for (const a of crisisAlerts) {
    alertStmt.run(a.brand, a.type, a.risk_score, a.summary, a.recommended_action);
  }
  alertStmt.finalize();
  console.log("🚨 Crisis alerts seeded.");
});

db.close(() => console.log("🎉 Seeding complete!"));
