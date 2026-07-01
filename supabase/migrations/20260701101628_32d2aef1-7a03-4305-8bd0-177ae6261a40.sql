
-- Roles system
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Seed admin for the existing superadmin employee
INSERT INTO public.user_roles (user_id, role)
VALUES ('a916fe86-4a1c-4cfb-9420-536a6e70fc1e', 'admin')
ON CONFLICT DO NOTHING;

-- ============ Tighten policies to admin-only ============

-- products
DROP POLICY IF EXISTS "Authenticated can view products" ON public.products;
DROP POLICY IF EXISTS "Authenticated can insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated can update products" ON public.products;
DROP POLICY IF EXISTS "Authenticated can delete products" ON public.products;
CREATE POLICY "Admins can view products" ON public.products FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update products" ON public.products FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete products" ON public.products FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- machines
DROP POLICY IF EXISTS "Authenticated can view machines" ON public.machines;
DROP POLICY IF EXISTS "Authenticated can insert machines" ON public.machines;
DROP POLICY IF EXISTS "Authenticated can update machines" ON public.machines;
DROP POLICY IF EXISTS "Authenticated can delete machines" ON public.machines;
CREATE POLICY "Admins can view machines" ON public.machines FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert machines" ON public.machines FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update machines" ON public.machines FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete machines" ON public.machines FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- machine_products
DROP POLICY IF EXISTS "Authenticated can view machine_products" ON public.machine_products;
DROP POLICY IF EXISTS "Authenticated can insert machine_products" ON public.machine_products;
DROP POLICY IF EXISTS "Authenticated can update machine_products" ON public.machine_products;
DROP POLICY IF EXISTS "Authenticated can delete machine_products" ON public.machine_products;
CREATE POLICY "Admins can view machine_products" ON public.machine_products FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert machine_products" ON public.machine_products FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update machine_products" ON public.machine_products FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete machine_products" ON public.machine_products FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- price_changes (read-only for admins; writes via service_role)
DROP POLICY IF EXISTS "Authenticated can read price changes" ON public.price_changes;
CREATE POLICY "Admins can read price changes" ON public.price_changes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- sync_log_entries
DROP POLICY IF EXISTS "Authenticated can view sync log entries" ON public.sync_log_entries;
DROP POLICY IF EXISTS "Authenticated can insert sync log entries" ON public.sync_log_entries;
CREATE POLICY "Admins can view sync log entries" ON public.sync_log_entries FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert sync log entries" ON public.sync_log_entries FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- sync_logs (scope by user_id)
DROP POLICY IF EXISTS "Authenticated can view sync_logs" ON public.sync_logs;
DROP POLICY IF EXISTS "Authenticated can insert sync_logs" ON public.sync_logs;
CREATE POLICY "Users view own sync_logs or admins view all" ON public.sync_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own sync_logs" ON public.sync_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
