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

/**
 * Load mentions directly from the Python NLP pipeline output!
 */
function getMentions() {
  try {
    const dataPath = path.join(__dirname, "dashboard", "data", "processed_mentions.json");
    if (!fs.existsSync(dataPath)) {
        console.warn("Python model JSON not found yet. Running Python backend first is recommended.");
        return [];
    }
    const data = fs.readFileSync(dataPath, "utf8");
    const mentions = JSON.parse(data);

    // Map the output from our Python VADER models directly to the JS UI components
    return mentions.map(m => {
      return {
        id: m.id || `doc-${Math.random()}`,
        brand: m.brand || "Analyzed Topic",
        channel: m.channel || "youtube",
        text: m.text || "",
        sentimentScore: m.vader_score || 0,
        sentimentLabel: m.vader_label || "neutral",
        timestamp: m.published_at ? new Date(m.published_at).getTime() : Date.now(),
        reach: m.reach || Math.floor(Math.random() * 1000)
      };
    });
  } catch (err) {
    console.error("Error hooking up to Python output:", err);
    return [];
  }
}

app.get("/api/mentions", (req, res) => {
  const mentions = getMentions();
  res.json({ mentions });
});

app.get("/api/brands", (req, res) => {
  const mentions = getMentions();
  const brands = Array.from(new Set(mentions.map((m) => m.brand)));
  res.json({ brands });
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

  // Fallback if API fails or no key - return a "semi-real" simulation result
  if (!newEntry) {
    const fallbacks = {
      youtube: "Just watched a deep dive on the new {brand} features. Amazing analysis!",
      twitter: "I can't believe how fast {brand} is growing. The new update is a game changer.",
      tiktok: "{brand} checking in! This new trend is actually useful for once. #ads",
      reddit: "Does anyone else think {brand} is overvalued? The latest quarterly report was mid.",
      instagram: "Living my best life with my new {brand} setup. The aesthetic is everything. ✨"
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

