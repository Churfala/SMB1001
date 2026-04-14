-- Migration 010: Ensure default MSP admin tenant and user exist
-- Upserts both records so login always works regardless of prior DB state.
-- Password: password123 (bcrypt hash, 10 rounds)

INSERT INTO tenants (name, slug, status)
VALUES ('Test Organization', 'test-org', 'active')
ON CONFLICT (slug) DO UPDATE SET status = 'active';

INSERT INTO users (tenant_id, email, password_hash, role, first_name, last_name, is_active)
SELECT
  t.id,
  'test@example.com',
  '$2b$10$blV02z5mKwRBeEX7XwWQoOk5wgQfkp3SLKKB.OI5aGND3Wp8WoD6G',
  'admin',
  'Test',
  'User',
  true
FROM tenants t
WHERE t.slug = 'test-org'
ON CONFLICT (tenant_id, email) DO UPDATE
  SET password_hash = '$2b$10$blV02z5mKwRBeEX7XwWQoOk5wgQfkp3SLKKB.OI5aGND3Wp8WoD6G',
      is_active     = true,
      role          = 'admin';
