CREATE TABLE IF NOT EXISTS t_p87080492_botamin_analytics_da.reports (
  id          TEXT PRIMARY KEY,
  site        TEXT NOT NULL DEFAULT '',
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total       INTEGER NOT NULL DEFAULT 0,
  date_from   TEXT NOT NULL DEFAULT '',
  date_to     TEXT NOT NULL DEFAULT '',
  aggregate   JSONB NOT NULL DEFAULT '{}',
  calls       JSONB NOT NULL DEFAULT '[]'
);