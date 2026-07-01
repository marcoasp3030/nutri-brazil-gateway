
CREATE TABLE public.price_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  logical_locator TEXT,
  change_type TEXT NOT NULL CHECK (change_type IN ('inserted','updated')),
  old_price NUMERIC,
  new_price NUMERIC,
  sync_id UUID REFERENCES public.sync_logs(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX price_changes_created_at_idx ON public.price_changes (created_at DESC);
CREATE INDEX price_changes_machine_idx ON public.price_changes (machine_id);

GRANT SELECT ON public.price_changes TO authenticated;
GRANT ALL ON public.price_changes TO service_role;

ALTER TABLE public.price_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read price changes"
ON public.price_changes FOR SELECT
TO authenticated
USING (true);
