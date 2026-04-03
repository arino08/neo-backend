async function migrate() {
  const fs = require('fs');
  const db = require('./db');
  const files = ['001_init.sql', '002_voice_logs.sql'];
  for (const f of files) {
    const sql = fs.readFileSync(`./src/migrations/${f}`, 'utf8');
    await db.query(sql);
    console.log(`✓ ${f}`);
  }
  process.exit(0);
}
migrate().catch(e => { console.error(e); process.exit(1); });
