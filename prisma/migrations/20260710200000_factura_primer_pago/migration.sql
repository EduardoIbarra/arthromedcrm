-- Track first payment (for 5-week / 60% delivery limit) and accumulated paid amount
ALTER TABLE "facturas_cliente"
  ADD COLUMN IF NOT EXISTS "primer_pago_fecha" DATE,
  ADD COLUMN IF NOT EXISTS "primer_pago_monto" DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS "total_pagado" DECIMAL(12, 2);
