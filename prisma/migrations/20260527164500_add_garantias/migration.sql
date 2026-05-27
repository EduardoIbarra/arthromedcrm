-- CreateTable
CREATE TABLE "public"."garantias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" UUID,
    "cliente_nombre" TEXT NOT NULL,
    "producto_id" UUID,
    "producto_nombre" TEXT NOT NULL,
    "numero_serie" TEXT,
    "modelo" TEXT,
    "descripcion_falla" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'recibido',
    "fecha_recepcion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_resolucion" TIMESTAMPTZ(6),
    "diagnostico" TEXT,
    "resolucion" TEXT,
    "costo_reparacion" DECIMAL(12,2),
    "notas" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "garantias_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."garantias" ADD CONSTRAINT "garantias_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."garantias" ADD CONSTRAINT "garantias_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
