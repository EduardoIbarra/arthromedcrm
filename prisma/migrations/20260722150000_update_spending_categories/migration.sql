-- Migration: 20260722150000_update_spending_categories
-- Create new spending categories if not exist and backfill obsolete ones to 'Otros (Especifique)'

-- 1. Insert new categories
INSERT INTO "public"."catalog_spending_categories" ("name") VALUES
  ('Renta de espacio congreso'),
  ('Diseño del stand'),
  ('Comidas personal'),
  ('Comidas externos'),
  ('Vuelos personales'),
  ('Vuelos externos'),
  ('Movilidad del personal'),
  ('Fletes'),
  ('Gasolinas'),
  ('Material taller'),
  ('Consumibles'),
  ('Hospedaje personal'),
  ('Hospedaje externos'),
  ('Material congreso'),
  ('Insumos'),
  ('Otros (Especifique)')
ON CONFLICT ("name") DO NOTHING;

-- 2. Backfill: For any spending category no longer in the list above, migrate gastos referencing them to 'Otros (Especifique)'
DO $$
DECLARE
  v_otros_id UUID;
BEGIN
  SELECT "id" INTO v_otros_id FROM "public"."catalog_spending_categories" WHERE "name" = 'Otros (Especifique)' LIMIT 1;

  IF v_otros_id IS NOT NULL THEN
    -- Update description of gastos whose category is obsolete
    UPDATE "public"."gastos" g
    SET 
      "description" = CASE 
        WHEN g."description" IS NULL OR g."description" = '' THEN 'Categoría original: ' || c."name"
        ELSE g."description" || ' (Categoría original: ' || c."name" || ')'
      END,
      "category_id" = v_otros_id
    FROM "public"."catalog_spending_categories" c
    WHERE g."category_id" = c."id"
      AND c."name" NOT IN (
        'Renta de espacio congreso',
        'Diseño del stand',
        'Comidas personal',
        'Comidas externos',
        'Vuelos personales',
        'Vuelos externos',
        'Movilidad del personal',
        'Fletes',
        'Gasolinas',
        'Material taller',
        'Consumibles',
        'Hospedaje personal',
        'Hospedaje externos',
        'Material congreso',
        'Insumos',
        'Otros (Especifique)'
      );

    -- Also update congreso_gastos_estimados if any exist with obsolete categories
    UPDATE "public"."congreso_gastos_estimados" cge
    SET "category_id" = v_otros_id
    FROM "public"."catalog_spending_categories" c
    WHERE cge."category_id" = c."id"
      AND c."name" NOT IN (
        'Renta de espacio congreso',
        'Diseño del stand',
        'Comidas personal',
        'Comidas externos',
        'Vuelos personales',
        'Vuelos externos',
        'Movilidad del personal',
        'Fletes',
        'Gasolinas',
        'Material taller',
        'Consumibles',
        'Hospedaje personal',
        'Hospedaje externos',
        'Material congreso',
        'Insumos',
        'Otros (Especifique)'
      );

    -- Delete obsolete categories
    DELETE FROM "public"."catalog_spending_categories"
    WHERE "name" NOT IN (
      'Renta de espacio congreso',
      'Diseño del stand',
      'Comidas personal',
      'Comidas externos',
      'Vuelos personales',
      'Vuelos externos',
      'Movilidad del personal',
      'Fletes',
      'Gasolinas',
      'Material taller',
      'Consumibles',
      'Hospedaje personal',
      'Hospedaje externos',
      'Material congreso',
      'Insumos',
      'Otros (Especifique)'
    );
  END IF;
END $$;
