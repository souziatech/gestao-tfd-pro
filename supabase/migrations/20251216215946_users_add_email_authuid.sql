-- Add email and auth_uid to users for Supabase Auth integration
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_uid TEXT UNIQUE;

-- Ensure seeded admin has an email matching the Auth user we will create
UPDATE users SET email = 'admin@example.com' WHERE login = 'admin' AND (email IS NULL OR email = '');
