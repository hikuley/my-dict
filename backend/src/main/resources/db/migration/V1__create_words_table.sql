-- Words table
CREATE TABLE IF NOT EXISTS words (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    phonetic VARCHAR(255),
    subtitle TEXT,
    sections JSONB NOT NULL DEFAULT '[]',
    search_vector TSVECTOR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_words_search_vector ON words USING GIN (search_vector);

-- Index on slug for fast lookups
CREATE INDEX IF NOT EXISTS idx_words_slug ON words (slug);

-- Function to build the search vector from title + subtitle
CREATE OR REPLACE FUNCTION words_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW.subtitle, '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update search_vector on INSERT or UPDATE
DROP TRIGGER IF EXISTS trg_words_search_vector ON words;
CREATE TRIGGER trg_words_search_vector
    BEFORE INSERT OR UPDATE OF title, subtitle
    ON words
    FOR EACH ROW
    EXECUTE FUNCTION words_search_vector_update();
