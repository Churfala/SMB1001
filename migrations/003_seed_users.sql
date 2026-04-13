-- SMB1001 Audit Platform – Seed Data
-- Migration 003: Create test tenant and user

-- Insert test tenant
INSERT INTO tenants (name, slug, status)
VALUES ('Test Organization', 'test-org', 'active')
ON CONFLICT DO NOTHING;

-- Insert test user (email: test@example.com, password: password123)
-- Password hash for "password123" using bcrypt with 10 rounds
INSERT INTO users (tenant_id, email, password_hash, role, first_name, last_name, is_active)
SELECT 
  id,
  'test@example.com',
  '$2b$10$slYQmyNdGzin7olVN3/p2OPST9/PgBkqquzi.Ss8KIUgO2t0jKMm2', -- bcrypt hash of "password123"
  'admin',
  'Test',
  'User',
  true
FROM tenants
WHERE slug = 'test-org'
ON CONFLICT DO NOTHING;
