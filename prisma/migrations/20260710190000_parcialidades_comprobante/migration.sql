-- Allow attaching a payment proof document to each installment
ALTER TABLE "parcialidades"
  ADD COLUMN IF NOT EXISTS "comprobante_url" TEXT,
  ADD COLUMN IF NOT EXISTS "comprobante_nombre" TEXT;
