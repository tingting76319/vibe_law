const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function addIndexes() {
  const client = await pool.connect();
  try {
    await client.query('CREATE INDEX IF NOT EXISTS idx_extracted_judges_judge_name ON extracted_judges(judge_name)');
    console.log('Index created!');
  } finally {
    client.release();
    await pool.end();
  }
}
addIndexes();
