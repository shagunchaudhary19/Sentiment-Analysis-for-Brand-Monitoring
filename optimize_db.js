const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "database", "mentions.db");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("🚀 Senior Audit: Optimizing database for performance...");
    
    // Add indexes for common query patterns
    db.run("CREATE INDEX IF NOT EXISTS idx_mentions_brand ON mentions(brand)");
    db.run("CREATE INDEX IF NOT EXISTS idx_mentions_published ON mentions(published_at)");
    db.run("CREATE INDEX IF NOT EXISTS idx_mentions_vader ON mentions(vader_label)");
    db.run("CREATE INDEX IF NOT EXISTS idx_brands_user ON tracked_brands(user_id)");
    
    console.log("✅ Performance indexes created successfully.");
});

db.close();
