CREATE TABLE api_usage (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    usage_count INT NOT NULL DEFAULT 0,
    usage_limit INT NOT NULL DEFAULT 50,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT date_trunc('month', NOW()),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_api_usage_user UNIQUE (user_id)
);

CREATE INDEX idx_api_usage_user_id ON api_usage(user_id);

-- Seed a usage row for every existing user
INSERT INTO api_usage (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;
