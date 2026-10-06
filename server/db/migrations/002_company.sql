ALTER TABLE users ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE roles ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE roles ADD COLUMN description TEXT NOT NULL DEFAULT '';

CREATE TABLE company_settings (
  company_id TEXT NOT NULL REFERENCES companies(id),
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (company_id, kind)
);

CREATE TABLE company_records (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);
CREATE INDEX company_records_scope_idx ON company_records(company_id, kind, id);
