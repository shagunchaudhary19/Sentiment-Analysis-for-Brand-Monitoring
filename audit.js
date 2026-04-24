const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database/mentions.db');
db.get('SELECT count(*) as count FROM mentions WHERE brand = ?', ["Antigravity"], (err, row) => {
    if (err) console.error(err);
    else console.log('Antigravity Mentions Total:', row.count);
    db.close();
});
