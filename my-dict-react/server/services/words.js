import pool from '../db/index.js';

export async function wordExists(slug) {
  const { rows } = await pool.query('SELECT slug FROM words WHERE slug = $1', [slug]);
  return rows.length > 0;
}

export async function insertWord(wordData, fallbackSlug, fallbackWord) {
  const { rows } = await pool.query(
    `INSERT INTO words (slug, title, phonetic, subtitle, sections)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING slug, title`,
    [
      wordData.slug || fallbackSlug,
      wordData.title || fallbackWord.toUpperCase(),
      wordData.phonetic || '',
      wordData.subtitle || '',
      JSON.stringify(wordData.sections || []),
    ]
  );
  return rows[0];
}
