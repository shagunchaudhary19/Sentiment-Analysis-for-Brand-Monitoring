const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./database/mentions.db");

db.all("PRAGMA table_info(mentions)", (err, rows) => {
  console.log("=== MENTIONS TABLE SCHEMA ===");
  if (err) console.log("Error:", err.message);
  else rows.forEach(r => console.log(`  ${r.name} (${r.type}) default=${r.dflt_value}`));

  db.all("SELECT emotion, COUNT(*) as count FROM mentions GROUP BY emotion", (err2, rows2) => {
    console.log("\n=== EMOTION DATA ===");
    if (err2) console.log("Error:", err2.message);
    else if (!rows2 || rows2.length === 0) console.log("  No emotion data found");
    else rows2.forEach(r => console.log(`  ${r.emotion}: ${r.count}`));

    db.all("SELECT COUNT(*) as total FROM mentions", (err3, rows3) => {
      console.log("\n=== TOTAL MENTIONS ===");
      console.log(`  ${rows3[0].total} mentions`);

      db.all("SELECT DISTINCT channel FROM mentions", (err4, rows4) => {
        console.log("\n=== CHANNELS ===");
        rows4.forEach(r => console.log(`  ${r.channel}`));

        db.all("SELECT DISTINCT brand FROM mentions", (err5, rows5) => {
          console.log("\n=== BRANDS ===");
          rows5.forEach(r => console.log(`  ${r.brand}`));
          db.close();
        });
      });
    });
  });
});
