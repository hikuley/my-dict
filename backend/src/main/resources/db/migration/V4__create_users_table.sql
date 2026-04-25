-- Auth type enum
CREATE TYPE auth_type AS ENUM ('manual', 'google');

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    auth_type auth_type NOT NULL,
    google_id VARCHAR(255) UNIQUE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_code VARCHAR(6),
    verification_expiry TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index on email for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- Index on google_id for OAuth lookups
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users (google_id);

-- Check constraints: password_hash required for manual, google_id required for google
ALTER TABLE users ADD CONSTRAINT chk_manual_auth
    CHECK (auth_type != 'manual' OR password_hash IS NOT NULL);

ALTER TABLE users ADD CONSTRAINT chk_google_auth
    CHECK (auth_type != 'google' OR google_id IS NOT NULL);
