
CREATE TABLE public.sync_log_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_id uuid REFERENCES public.sync_logs(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  page integer,
  attempt integer NOT NULL DEFAULT 1,
  status_code integer,
  ok boolean NOT NULL DEFAULT false,
  duration_ms integer,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sync_log_entries_sync_id_idx ON public.sync_log_entries(sync_id, created_at);
CREATE INDEX sync_log_entries_created_at_idx ON public.sync_log_entries(created_at DESC);
GRANT SELECT, INSERT ON public.sync_log_entries TO authenticated;
GRANT ALL ON public.sync_log_entries TO service_role;
ALTER TABLE public.sync_log_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view sync log entries" ON public.sync_log_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert sync log entries" ON public.sync_log_entries FOR INSERT TO authenticated WITH CHECK (true);
