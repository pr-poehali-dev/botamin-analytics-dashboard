ALTER TABLE t_p87080492_botamin_analytics_da.call_transcripts
  ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone NULL DEFAULT now();

ALTER TABLE t_p87080492_botamin_analytics_da.call_transcripts
  DROP CONSTRAINT IF EXISTS call_transcripts_comm_id_key;

ALTER TABLE t_p87080492_botamin_analytics_da.call_transcripts
  ADD CONSTRAINT call_transcripts_comm_id_key UNIQUE (comm_id);