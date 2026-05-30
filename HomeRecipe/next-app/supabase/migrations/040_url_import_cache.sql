CREATE TABLE IF NOT EXISTS url_import_cache (
  url_hash   text        PRIMARY KEY,
  url        text        NOT NULL,
  scraped    jsonb       NOT NULL,
  cached_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS url_import_cache_cached_at_idx
  ON url_import_cache (cached_at);

ALTER TABLE url_import_cache ENABLE ROW LEVEL SECURITY;
