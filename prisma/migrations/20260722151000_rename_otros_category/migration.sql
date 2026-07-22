-- Alter category name from 'Otros (Especifique)' to 'Otros'
UPDATE "public"."catalog_spending_categories"
SET "name" = 'Otros'
WHERE "name" = 'Otros (Especifique)';
