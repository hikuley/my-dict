-- Add updated_at column for tracking word modifications
ALTER TABLE words ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
