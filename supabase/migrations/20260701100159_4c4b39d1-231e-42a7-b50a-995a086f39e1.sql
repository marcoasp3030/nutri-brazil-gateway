ALTER TABLE public.sync_logs 
  ADD COLUMN IF NOT EXISTS prices_inserted integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prices_updated integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prices_skipped integer DEFAULT 0;