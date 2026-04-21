import { Router } from 'express';
import pool from '../db/index.js';
import { sendToTopic } from '../kafka/producer.js';
import { trackProcessing } from '../ws/index.js';

const router = Router();

// GET /api/words — list words with pagination
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    console.log('[list] Request received: page=' + page + ', limit=' + limit);

    const [countResult, { rows }] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM words'),
      pool.query(
        'SELECT slug, title, subtitle FROM words ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    console.log('[list] Returned ' + rows.length + ' words (total: ' + total + ')');
    res.json({
      words: rows,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('[list] Error:', err.message);
    next(err);
  }
});

// GET /api/words/search?q=<term> — full-text search
router.get('/search', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();

    if (q.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    // Use prefix matching: append :* to each token for partial word matching
    const prefixQuery = q
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => token.replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ0-9]/g, ''))
      .filter((token) => token.length > 0)
      .map((token) => `${token}:*`)
      .join(' & ');

    if (!prefixQuery) {
      return res.json({ words: [] });
    }

    console.log('[search] Query: "' + q + '" -> tsquery: ' + prefixQuery);

    const { rows } = await pool.query(
      `SELECT slug, title, subtitle,
              ts_rank(search_vector, to_tsquery('simple', $1)) AS rank
       FROM words
       WHERE search_vector @@ to_tsquery('simple', $1)
       ORDER BY rank DESC, title ASC
       LIMIT 50`,
      [prefixQuery]
    );

    console.log('[search] Found ' + rows.length + ' results');
    res.json({ words: rows });
  } catch (err) {
    console.error('[search] Error:', err.message);
    next(err);
  }
});

// GET /api/words/:slug — full word detail
router.get('/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    console.log('[detail] Request received:', slug);
    const { rows } = await pool.query(
      'SELECT slug, title, phonetic, subtitle, sections FROM words WHERE slug = $1',
      [slug]
    );

    if (rows.length === 0) {
      console.log('[detail] Word not found:', slug);
      return res.status(404).json({ error: 'Word not found' });
    }

    console.log('[detail] Returned:', slug);
    res.json(rows[0]);
  } catch (err) {
    console.error('[detail] Error:', err.message);
    next(err);
  }
});

// POST /api/words/generate — queue word for async processing via Kafka
router.post('/generate', async (req, res, next) => {
  try {
    const { word } = req.body;
    console.log('[generate] Request received:', { word });

    if (!word || typeof word !== 'string' || word.trim().length === 0) {
      return res.status(400).json({ error: 'word is required' });
    }

    const sanitizedWord = word.trim().substring(0, 100);
    const slug = sanitizedWord.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Check if word already exists
    const existing = await pool.query('SELECT slug FROM words WHERE slug = $1', [slug]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'This word already exists in the dictionary' });
    }

    // Publish to Kafka for async processing
    await sendToTopic('word-generate', { word: sanitizedWord, slug });
    trackProcessing(slug, sanitizedWord);
    console.log('[generate] Word queued for processing:', slug);

    res.status(202).json({ message: 'Word queued for processing', word: sanitizedWord, slug });
  } catch (err) {
    console.error('[generate] Error:', err.message || err);
    next(err);
  }
});

// POST /api/words — add a new word
router.post('/', async (req, res, next) => {
  try {
    const { slug, title, phonetic, subtitle, sections } = req.body;
    console.log('[create] Request received:', { slug, title });

    if (!slug || !title) {
      return res.status(400).json({ error: 'slug and title are required' });
    }

    if (sections && !Array.isArray(sections)) {
      return res.status(400).json({ error: 'sections must be an array' });
    }

    const { rows } = await pool.query(
      `INSERT INTO words (slug, title, phonetic, subtitle, sections)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING slug, title, phonetic, subtitle, sections`,
      [
        slug,
        title,
        phonetic || '',
        subtitle || '',
        JSON.stringify(sections || []),
      ]
    );

    console.log('[create] Word created:', rows[0].slug);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      console.log('[create] Duplicate slug:', slug);
      return res.status(409).json({ error: 'A word with this slug already exists' });
    }
    console.error('[create] Error:', err.message);
    next(err);
  }
});

// DELETE /api/words/:slug — delete a word
router.delete('/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    console.log('[delete] Request received:', slug);
    const { rowCount } = await pool.query('DELETE FROM words WHERE slug = $1', [slug]);
    if (rowCount === 0) {
      console.log('[delete] Word not found:', slug);
      return res.status(404).json({ error: 'Word not found' });
    }
    console.log('[delete] Word deleted:', slug);
    res.json({ message: 'Word deleted', slug });
  } catch (err) {
    console.error('[delete] Error:', err.message);
    next(err);
  }
});

export default router;
