CREATE UNIQUE INDEX accounts_company_id_unique ON accounts(company_id, id);
CREATE TABLE journal_entries (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  kind TEXT NOT NULL CHECK (kind IN ('general-journal','sales-journal','purchase-journal','cash-receipt-journal','cash-disbursement-journal')),
  journal_number INTEGER NOT NULL,
  entry_date TEXT NOT NULL,
  reference_number TEXT NOT NULL DEFAULT '',
  party TEXT NOT NULL DEFAULT '',
  remarks TEXT NOT NULL DEFAULT '',
  journal_type TEXT,
  source_key TEXT,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Posted','Voided')),
  created_by TEXT NOT NULL REFERENCES users(id),
  posted_at TEXT,
  voided_at TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (company_id, kind, journal_number),
  UNIQUE (company_id, source_key),
  UNIQUE (company_id, id)
);
CREATE INDEX journal_scope_date_idx ON journal_entries(company_id, entry_date, status);
CREATE TABLE journal_lines (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  journal_entry_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  debit_cents BIGINT NOT NULL DEFAULT 0,
  credit_cents BIGINT NOT NULL DEFAULT 0,
  subsidiary TEXT NOT NULL DEFAULT '',
  remarks TEXT NOT NULL DEFAULT '',
  CHECK ((debit_cents > 0 AND credit_cents = 0) OR (credit_cents > 0 AND debit_cents = 0)),
  FOREIGN KEY (company_id, journal_entry_id) REFERENCES journal_entries(company_id, id),
  FOREIGN KEY (company_id, account_id) REFERENCES accounts(company_id, id),
  UNIQUE (journal_entry_id, position)
);
CREATE INDEX journal_lines_account_idx ON journal_lines(company_id, account_id);
