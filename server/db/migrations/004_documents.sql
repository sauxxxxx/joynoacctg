CREATE UNIQUE INDEX company_records_tenant_id_idx ON company_records(company_id, id);
CREATE TABLE document_contents (
  company_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  content_base64 TEXT NOT NULL CHECK (length(content_base64) <= 13981016),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  PRIMARY KEY (company_id, document_id),
  FOREIGN KEY (company_id, document_id) REFERENCES company_records(company_id, id)
);
