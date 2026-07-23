-- Update evitar_linea_duplicada function to ignore soft-deleted products
CREATE OR REPLACE FUNCTION public.evitar_linea_duplicada()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
begin
  if coalesce(new.manual, false) then
    return new;
  end if;
  -- Linea IDENTICA creada hace mas de 30 minutos => re-sync duplicando: se
  -- ignora. Los dobles legitimos de un mismo XML entran en segundos y pasan.
  if exists (
    select 1 from factura_productos fp
    where fp.factura_id = new.factura_id
      and lower(trim(fp.producto_nombre)) = lower(trim(new.producto_nombre))
      and fp.cantidad_facturada = new.cantidad_facturada
      and coalesce(fp.manual, false) = false
      and fp.deleted_at is null
      and fp.created_at < coalesce(new.created_at, now()) - interval '30 minutes'
  ) then
    return null;
  end if;
  return new;
end
$function$;
