const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "database", "mentions.db");
const db = new sqlite3.Database(dbPath);

const columnsToAdd = [
  { name: "author_followers", type: "INTEGER DEFAULT 0" },
  { name: "author_influence", type: "REAL DEFAULT 0" },
  { name: "likes", type: "INTEGER DEFAULT 0" },
  { name: "shares", type: "INTEGER DEFAULT 0" },
  { name: "comments", type: "INTEGER DEFAULT 0" },
  { name: "confidence", type: "REAL DEFAULT 0.5" },
  { name: "emotion", type: "TEXT DEFAULT 'neutral'" },
  { name: "intent", type: "TEXT DEFAULT 'neutral_mention'" },
  { name: "aspect", type: "TEXT DEFAULT 'general'" },
  { name: "crisis_score", type: "INTEGER DEFAULT 0" },
  { name: "crisis_flag", type: "INTEGER DEFAULT 0" },
  { name: "language", type: "TEXT DEFAULT 'en'" },
  { name: "geo_location", type: "TEXT DEFAULT 'Global'" }
];

db.serialize(() => {
  console.log("🚀 Starting database migration...");

  // Check if columns already exist first to avoid errors
  db.all("PRAGMA table_info(mentions)", (err, rows) => {
    if (err) {
      console.error("❌ Error getting table info:", err.message);
      process.exit(1);
    }

    const existingColumns = rows.map(r => r.name);
    
    columnsToAdd.forEach(col => {
      if (!existingColumns.includes(col.name)) {
        db.run(`ALTER TABLE mentions ADD COLUMN ${col.name} ${col.type}`, (alterErr) => {
          if (alterErr) {
            console.error(`❌ Error adding column ${col.name}:`, alterErr.message);
          } else {
            console.log(`✅ Added column: ${col.name}`);
          }
        });
      } else {
        console.log(`ℹ️ Column already exists: ${col.name}`);
      }
    });

    console.log("🏁 Migration script finished (async tasks might still be running).");
  });
});

// We'll close the db after a short delay to ensure all migrations finish
setTimeout(() => {
    db.close();
    console.log("💾 Database connection closed.");
}, 2000);
