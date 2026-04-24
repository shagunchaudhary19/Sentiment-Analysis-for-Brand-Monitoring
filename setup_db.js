/**
 * BrandWatch Database Setup — Enhanced Schema v2
 * Adds NLP columns: emotion, intent, crisis_score, aspect, confidence, author_influence
 */

const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const dbDir = path.join(__dirname, "database");
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const dbPath = path.join(dbDir, "mentions.db");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log("⚙️  Setting up BrandWatch database...");

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password TEXT,
    name TEXT,
    subscription_status TEXT DEFAULT 'enterprise',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tracked_brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    brand_name TEXT,
    keywords TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS mentions (
    id TEXT PRIMARY KEY,
    brand TEXT,
    channel TEXT,
    text TEXT,
    author TEXT,
    author_followers INTEGER DEFAULT 0,
    author_influence REAL DEFAULT 0,
    published_at DATETIME,
    reach INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    vader_score REAL DEFAULT 0,
    vader_label TEXT DEFAULT 'neutral',
    confidence REAL DEFAULT 0.5,
    emotion TEXT DEFAULT 'neutral',
    intent TEXT DEFAULT 'neutral_mention',
    aspect TEXT DEFAULT 'general',
    crisis_score INTEGER DEFAULT 0,
    crisis_flag INTEGER DEFAULT 0,
    language TEXT DEFAULT 'en',
    geo_location TEXT DEFAULT 'Global',
    url TEXT,
    keybert_topics TEXT,
    ai_summary TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS crisis_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand TEXT,
    type TEXT,
    risk_score INTEGER,
    summary TEXT,
    recommended_action TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved INTEGER DEFAULT 0
  )`);

  console.log("✅ Database schema initialized successfully!");
});

db.close();
