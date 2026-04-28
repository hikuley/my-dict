-- Add apple_id column to users
ALTER TABLE users ADD COLUMN apple_id VARCHAR(255) UNIQUE;

-- Index on apple_id for OAuth lookups
CREATE INDEX IF NOT EXISTS idx_users_apple_id ON users (apple_id);

-- Check constraint: apple_id required for apple auth
ALTER TABLE users ADD CONSTRAINT chk_apple_auth
    CHECK (auth_type != 'apple' OR apple_id IS NOT NULL);
