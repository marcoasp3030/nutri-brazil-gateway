
-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- PRODUCTS
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vmpay_good_id BIGINT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  upc_code TEXT,
  barcode TEXT,
  category_id BIGINT,
  manufacturer_id BIGINT,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_barcode ON public.products(barcode);
CREATE INDEX idx_products_upc_code ON public.products(upc_code);
CREATE INDEX idx_products_name ON public.products USING GIN (to_tsvector('portuguese', name));

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update products" ON public.products FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete products" ON public.products FOR DELETE TO authenticated USING (true);

CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- MACHINES
CREATE TABLE public.machines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vmpay_machine_id BIGINT UNIQUE NOT NULL,
  asset_number TEXT,
  installation_id BIGINT,
  location_id BIGINT,
  place TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_machines_asset_number ON public.machines(asset_number);

ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view machines" ON public.machines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert machines" ON public.machines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update machines" ON public.machines FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete machines" ON public.machines FOR DELETE TO authenticated USING (true);

CREATE TRIGGER machines_updated_at BEFORE UPDATE ON public.machines
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- MACHINE_PRODUCTS (preço por máquina)
CREATE TABLE public.machine_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  desired_price NUMERIC(10,2),
  logical_locator TEXT,
  current_balance NUMERIC(10,2),
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(machine_id, product_id, logical_locator)
);
CREATE INDEX idx_mp_machine ON public.machine_products(machine_id);
CREATE INDEX idx_mp_product ON public.machine_products(product_id);

ALTER TABLE public.machine_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view machine_products" ON public.machine_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert machine_products" ON public.machine_products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update machine_products" ON public.machine_products FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete machine_products" ON public.machine_products FOR DELETE TO authenticated USING (true);

CREATE TRIGGER mp_updated_at BEFORE UPDATE ON public.machine_products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SYNC_LOGS
CREATE TABLE public.sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  status TEXT NOT NULL,
  machines_count INTEGER DEFAULT 0,
  products_count INTEGER DEFAULT 0,
  prices_count INTEGER DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view sync_logs" ON public.sync_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert sync_logs" ON public.sync_logs FOR INSERT TO authenticated WITH CHECK (true);
