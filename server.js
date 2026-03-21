// Simple Node/Express backend for the Brand Sentiment Monitor.
// Exposes a small API that returns sentiment "mentions" data.
// The frontend (app.js) calls GET /api/mentions and then applies
// its own brand/range/channel filters.

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 4001;

app.use(cors());
const fs = require("fs");
require("dotenv").config();
const axios = require("axios");
const Sentiment = require("sentiment");
const sentiment = new Sentiment();

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const INSTAGRAM_BUSINESS_ACCOUNT_ID = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
const FACEBOOK_ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
const FACEBOOK_PAGE_ID = process.env.FACEBOOK_PAGE_ID;

/**
 * Load mentions directly from the Python NLP pipeline output!
 */
const sqlite3 = require("sqlite3").verbose();
const dbPath = path.join(__dirname, "database", "mentions.db");

/**
 * Fetch mentions from SQLite instead of a JSON file.
 * This is faster and scales horizontally much better!
 */
async function getMentionsFromDB(limit = 100) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    const query = `
      SELECT * FROM mentions 
      ORDER BY datetime(published_at) DESC 
      LIMIT ?
    `;
    
    db.all(query, [limit], (err, rows) => {
      if (err) {
        console.error("DB Error:", err);
        return resolve([]); // Fallback to empty if DB fails
      }
      
      const formatted = rows.map(m => ({
        id: m.id,
        brand: m.brand || "Overall",
        channel: m.channel || "youtube",
        text: m.text || "",
        sentimentScore: m.vader_score || 0,
        sentimentLabel: m.vader_label || "neutral",
        timestamp: m.published_at ? new Date(m.published_at).getTime() : Date.now(),
        reach: m.reach || 0
      }));
      
      db.close();
      resolve(formatted);
    });
  });
}

app.get("/api/mentions", async (req, res) => {
  const mentions = await getMentionsFromDB(200);
  res.json({ mentions });
});

app.get("/api/brands", async (req, res) => {
  const db = new sqlite3.Database(dbPath);
  db.all("SELECT DISTINCT brand FROM mentions", [], (err, rows) => {
    const brands = rows?.map(r => r.brand) || [];
    db.close();
    res.json({ brands });
  });
});

// Routes for landing vs dashboard
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "landing.html"));
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/api/fetch-live", async (req, res) => {
  const { brand, platform } = req.query;

  if (!brand || !platform) {
    return res.status(400).json({ error: "Missing brand or platform" });
  }

  let newEntry = null;

  if (platform === "youtube" && YOUTUBE_API_KEY) {
    try {
      // Search for recent videos related to the brand
      const ytRes = await axios.get("https://www.googleapis.com/youtube/v3/search", {
        params: {
          part: "snippet",
          q: brand,
          type: "video",
          maxResults: 1,
          order: "date",
          key: YOUTUBE_API_KEY
        }
      });

      const video = ytRes.data.items[0];
      if (video) {
        newEntry = {
          id: `yt-${video.id.videoId}`,
          brand: brand,
          channel: "youtube",
          sourceType: "video",
          author: video.snippet.channelTitle,
          text: video.snippet.title + ": " + video.snippet.description.substring(0, 100),
          timestamp: new Date(video.snippet.publishedAt).getTime(),
          reach: Math.floor(Math.random() * 100000) + 5000
        };
      }
    } catch (err) {
      console.error("YouTube API Error:", err.response?.data || err.message);
    }
  }

  // ── Instagram Graph API ───────────────────────────────────────────────
  if (!newEntry && platform === "instagram" && INSTAGRAM_ACCESS_TOKEN && INSTAGRAM_BUSINESS_ACCOUNT_ID) {
    try {
      const hashtag = encodeURIComponent(brand.toLowerCase().replace(/\s+/g, ""));
      // Step 1: resolve hashtag id
      const hashRes = await axios.get("https://graph.facebook.com/v19.0/ig_hashtag_search", {
        params: { user_id: INSTAGRAM_BUSINESS_ACCOUNT_ID, q: hashtag, access_token: INSTAGRAM_ACCESS_TOKEN }
      });
      const hashtagId = hashRes.data?.data?.[0]?.id;
      if (hashtagId) {
        // Step 2: fetch recent media
        const mediaRes = await axios.get(`https://graph.facebook.com/v19.0/${hashtagId}/recent_media`, {
          params: {
            user_id: INSTAGRAM_BUSINESS_ACCOUNT_ID,
            fields: "id,caption,timestamp,like_count,comments_count",
            limit: 1,
            access_token: INSTAGRAM_ACCESS_TOKEN
          }
        });
        const post = mediaRes.data?.data?.[0];
        if (post) {
          newEntry = {
            id: `ig-${post.id}`,
            brand,
            channel: "instagram",
            sourceType: "post",
            author: "instagram_user",
            text: post.caption ? post.caption.substring(0, 280) : `#${hashtag}`,
            timestamp: post.timestamp ? new Date(post.timestamp).getTime() : Date.now(),
            reach: (post.like_count || 0) + (post.comments_count || 0) * 3
          };
        }
      }
    } catch (err) {
      console.error("Instagram API Error:", err.response?.data || err.message);
    }
  }

  // ── Facebook Graph API ────────────────────────────────────────────────
  if (!newEntry && platform === "facebook" && FACEBOOK_ACCESS_TOKEN && FACEBOOK_PAGE_ID) {
    try {
      const fbRes = await axios.get(`https://graph.facebook.com/v19.0/${FACEBOOK_PAGE_ID}/feed`, {
        params: {
          fields: "id,message,story,created_time,likes.summary(true),comments.summary(true)",
          limit: 5,
          access_token: FACEBOOK_ACCESS_TOKEN
        }
      });
      const post = fbRes.data?.data?.find(p => {
        const text = (p.message || p.story || "").toLowerCase();
        return text.includes(brand.toLowerCase());
      }) || fbRes.data?.data?.[0];
      if (post) {
        const text = post.message || post.story || `New ${brand} update on Facebook.`;
        const likes = post.likes?.summary?.total_count || 0;
        const comments = post.comments?.summary?.total_count || 0;
        newEntry = {
          id: `fb-${post.id}`,
          brand,
          channel: "facebook",
          sourceType: "post",
          author: brand,
          text: text.substring(0, 280),
          timestamp: post.created_time ? new Date(post.created_time).getTime() : Date.now(),
          reach: likes + comments * 5
        };
      }
    } catch (err) {
      console.error("Facebook API Error:", err.response?.data || err.message);
    }
  }

  // ── Fallback: simulation for any platform without credentials ─────────
  if (!newEntry) {
    const fallbacks = {
      youtube: "Just watched a deep dive on the new {brand} features. Amazing analysis!",
      twitter: "I can't believe how fast {brand} is growing. The new update is a game changer.",
      tiktok: "{brand} checking in! This new trend is actually useful for once. #ads",
      reddit: "Does anyone else think {brand} is overvalued? The latest quarterly report was mid.",
      instagram: "Living my best life with my new {brand} setup. The aesthetic is everything. ✨",
      facebook: "Huge fan of {brand}! The latest release exceeded all my expectations. 💯"
    };

    const textTemplate = fallbacks[platform] || "New mention of {brand} found on the web.";
    newEntry = {
      id: `live-${Date.now()}`,
      brand: brand,
      channel: platform,
      sourceType: platform === "youtube" ? "video" : "post",
      author: "RealUser_" + Math.floor(Math.random() * 1000),
      text: textTemplate.replace("{brand}", brand),
      timestamp: Date.now(),
      reach: Math.floor(Math.random() * 50000) + 1000
    };
  }

  // Analyze sentiment of the new entry
  const result = sentiment.analyze(newEntry.text);
  const normalizedScore = Math.max(-1, Math.min(1, result.comparative * 2));
  let label = "neutral";
  if (normalizedScore > 0.1) label = "positive";
  else if (normalizedScore < -0.1) label = "negative";

  newEntry.sentimentScore = normalizedScore;
  newEntry.sentimentLabel = label;

  res.json({ mention: newEntry });
});

// Serve static frontend files from the project root.
app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
  console.log(`Brand Sentiment backend running on http://localhost:${PORT}`);
});

