-- Add surname column to users
ALTER TABLE users ADD COLUMN surname VARCHAR(255);

-- Add columns for email change verification (separate from signup verification)
ALTER TABLE users ADD COLUMN pending_email VARCHAR(255);
ALTER TABLE users ADD COLUMN email_verification_code VARCHAR(6);
ALTER TABLE users ADD COLUMN email_verification_expiry TIMESTAMP WITH TIME ZONE;
