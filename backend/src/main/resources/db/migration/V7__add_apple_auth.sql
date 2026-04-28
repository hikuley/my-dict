-- Add 'apple' to auth_type enum
-- ALTER TYPE ... ADD VALUE cannot be used in a transaction with other statements
-- that reference the new value, so this migration only adds the enum value.
-- Column and constraint additions are in V8.
ALTER TYPE auth_type ADD VALUE IF NOT EXISTS 'apple';
