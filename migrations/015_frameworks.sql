-- Migration 015: frameworks table
-- Stores compliance framework metadata including tier/IG configuration

CREATE TABLE IF NOT EXISTS frameworks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code         VARCHAR(50) UNIQUE NOT NULL,
  name         VARCHAR(255) NOT NULL,
  version      VARCHAR(50),
  description  TEXT,
  tier_config  JSONB       NOT NULL DEFAULT '[]',
  domain_label VARCHAR(50) NOT NULL DEFAULT 'Domain',
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO frameworks (code, name, version, description, tier_config, domain_label)
VALUES (
  'SMB1001:2026',
  'SMB1001:2026',
  '2026',
  'NZ small business cybersecurity standard — 39 controls across 5 domains and 5 certification tiers.',
  '[
    {"tier":1,"name":"Bronze",  "color":"#92400e","bg":"#fef3c7","maxControls":7},
    {"tier":2,"name":"Silver",  "color":"#374151","bg":"#f3f4f6","maxControls":17},
    {"tier":3,"name":"Gold",    "color":"#854d0e","bg":"#fef08a","maxControls":27},
    {"tier":4,"name":"Platinum","color":"#1e3a5f","bg":"#dbeafe","maxControls":32},
    {"tier":5,"name":"Diamond", "color":"#5b21b6","bg":"#ede9fe","maxControls":39}
  ]',
  'Domain'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO frameworks (code, name, version, description, tier_config, domain_label)
VALUES (
  'CIS-V8',
  'CIS Controls v8',
  '8',
  'Center for Internet Security Controls v8 — 153 safeguards across 18 controls, grouped by Implementation Group (IG1/IG2/IG3).',
  '[
    {"tier":1,"name":"IG1","color":"#065f46","bg":"#d1fae5","maxControls":56},
    {"tier":2,"name":"IG2","color":"#1e40af","bg":"#dbeafe","maxControls":130},
    {"tier":3,"name":"IG3","color":"#5b21b6","bg":"#ede9fe","maxControls":153}
  ]',
  'Control Group'
)
ON CONFLICT (code) DO NOTHING;
