CREATE TABLE companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  email TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  permissions_json TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  system INTEGER NOT NULL DEFAULT 0 CHECK (system IN (0, 1)),
  UNIQUE (company_id, name)
);

CREATE TABLE company_memberships (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role_id TEXT NOT NULL REFERENCES roles(id),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  UNIQUE (company_id, user_id)
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX sessions_user_idx ON sessions(user_id, expires_at);

CREATE TABLE account_categories (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_code TEXT NOT NULL DEFAULT '',
  remarks TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  account_type TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (company_id, code)
);

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_code TEXT NOT NULL,
  type TEXT NOT NULL,
  remarks TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  itr TEXT NOT NULL DEFAULT '',
  legal_basis TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (company_id, code)
);
CREATE INDEX accounts_company_parent_idx ON accounts(company_id, parent_code);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  request_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX audit_company_time_idx ON audit_events(company_id, created_at);
