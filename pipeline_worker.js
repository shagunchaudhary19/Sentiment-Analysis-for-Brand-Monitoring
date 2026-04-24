/**
 * BrandWatch Data Pipeline Worker
 * Uses the Unified Schema to ingest data from social platform prompts.
 */

const { normalizeMention } = require('./utils/normalizer');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database', 'mentions.db');

/**
 * Simulates processing a batch of raw social data pulled using the Prompt Library.
 * @param {Array} rawData - Array of diverse platform responses.
 * @param {string} brandName - The brand these mentions belong to.
 */
async function processPipelineBatch(rawData, brandName) {
    const db = new sqlite3.Database(dbPath);
    
    console.log(`--- Starting Pipeline Worker for ${brandName} ---`);
    console.log(`Processing ${rawData.length} mentions...`);

    const stmt = db.prepare(`
        INSERT OR REPLACE INTO mentions (
            id, brand, channel, text, author, published_at, reach, vader_score, vader_label, url, ai_summary
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    rawData.forEach(item => {
        const normalized = normalizeMention(item, brandName);
        
        stmt.run(
            normalized.id,
            normalized.brand,
            normalized.channel,
            normalized.text,
            normalized.author,
            normalized.published_at,
            normalized.reach,
            normalized.sentiment.score,
            normalized.sentiment.label,
            normalized.url,
            normalized.ai_summary || "Synthesized via Unified Pipeline Worker"
        );
    });

    stmt.finalize();
    db.close();
    console.log(`✅ Pipeline Batch Complete for ${brandName}`);
}

// Example usage:
// const rawData = [{ id: "yt-1", source: "YouTube", content: "Great camera on this phone!", likes: 500 }];
// processPipelineBatch(rawData, "Apple");

module.exports = { processPipelineBatch };
