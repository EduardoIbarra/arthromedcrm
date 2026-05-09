-- ============================================================
-- Pricing System Schema
-- ============================================================

-- 1. Products Table
DROP TABLE IF EXISTS public.hospital_prices CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.hospitals CASCADE;

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  model text,
  order_code text,
  invoice_concept text,
  generic_description text,
  new_alg_description text,
  measurements text,
  alg_description text,
  sale_price numeric(10,2),
  base_hospital_price numeric(10,2),
  line text,
  type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at for products
DROP TRIGGER IF EXISTS set_products_updated_at ON public.products;
CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS for products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all products" ON public.products FOR ALL USING (true) WITH CHECK (true);

-- 2. Hospitals Table
CREATE TABLE IF NOT EXISTS public.hospitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at for hospitals
DROP TRIGGER IF EXISTS set_hospitals_updated_at ON public.hospitals;
CREATE TRIGGER set_hospitals_updated_at
  BEFORE UPDATE ON public.hospitals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS for hospitals
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all hospitals" ON public.hospitals FOR ALL USING (true) WITH CHECK (true);

-- 3. Hospital Prices Table
CREATE TABLE public.hospital_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  price numeric(10,2) NOT NULL,
  pending boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, hospital_id)
);

-- Auto-update updated_at for hospital_prices
DROP TRIGGER IF EXISTS set_hospital_prices_updated_at ON public.hospital_prices;
CREATE TRIGGER set_hospital_prices_updated_at
  BEFORE UPDATE ON public.hospital_prices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS for hospital_prices
ALTER TABLE public.hospital_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all hospital_prices" ON public.hospital_prices FOR ALL USING (true) WITH CHECK (true);
