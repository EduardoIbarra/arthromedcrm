import csv
import json

def read_csv(path):
    with open(path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        return list(reader)

productos = read_csv('/Users/ed/Downloads/productos_rows (1).csv')
products = read_csv('/Users/ed/Downloads/products_rows (3).csv')

sql = []

sql.append("-- 1. Add new columns to productos if they don't exist")
sql.append("""
ALTER TABLE public.productos
ADD COLUMN IF NOT EXISTS model text,
ADD COLUMN IF NOT EXISTS order_code text,
ADD COLUMN IF NOT EXISTS invoice_concept text,
ADD COLUMN IF NOT EXISTS generic_description text,
ADD COLUMN IF NOT EXISTS new_alg_description text,
ADD COLUMN IF NOT EXISTS measurements text,
ADD COLUMN IF NOT EXISTS alg_description text,
ADD COLUMN IF NOT EXISTS base_hospital_price numeric(10,2),
ADD COLUMN IF NOT EXISTS line text,
ADD COLUMN IF NOT EXISTS specialty_ids text[] DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}'::text[];
""")

sql.append("-- 2. Update productos with data from products")

def esc(val):
    return val.replace("'", "''")

# Match logic
for prod in products:
    desc = prod.get('description', '').lower().strip()
    invoice = prod.get('invoice_concept', '').lower().strip()
    
    matched_producto = None
    for po in productos:
        nombre = po.get('nombre', '').lower().strip()
        if desc and desc in nombre:
            matched_producto = po
            break
        if invoice and invoice in nombre:
            matched_producto = po
            break
            
    if matched_producto:
        # Generate UPDATE
        pid = matched_producto['id']
        
        updates = []
        if prod.get('model'):
            updates.append(f"model = '{esc(prod['model'])}'")
        if prod.get('order_code'):
            updates.append(f"order_code = '{esc(prod['order_code'])}'")
        if prod.get('invoice_concept'):
            updates.append(f"invoice_concept = '{esc(prod['invoice_concept'])}'")
        if prod.get('generic_description'):
            updates.append(f"generic_description = '{esc(prod['generic_description'])}'")
        if prod.get('new_alg_description'):
            updates.append(f"new_alg_description = '{esc(prod['new_alg_description'])}'")
        if prod.get('measurements'):
            updates.append(f"measurements = '{esc(prod['measurements'])}'")
        if prod.get('alg_description'):
            updates.append(f"alg_description = '{esc(prod['alg_description'])}'")
        if prod.get('base_hospital_price') and prod['base_hospital_price'].strip():
            updates.append(f"base_hospital_price = {prod['base_hospital_price']}")
        if prod.get('line'):
            updates.append(f"line = '{esc(prod['line'])}'")
        
        if prod.get('specialty_ids'):
            try:
                s_ids = json.loads(prod['specialty_ids'].replace("'", '"'))
                if s_ids:
                    ids_str = ", ".join([f"'{s}'" for s in s_ids])
                    updates.append(f"specialty_ids = ARRAY[{ids_str}]::text[]")
            except:
                pass
                
        if prod.get('image_urls'):
            try:
                i_urls = json.loads(prod['image_urls'].replace("'", '"'))
                if i_urls:
                    urls_str = ", ".join([f"'{u}'" for u in i_urls])
                    updates.append(f"image_urls = ARRAY[{urls_str}]::text[]")
            except:
                pass
                
        if updates:
            sql.append(f"UPDATE public.productos SET {', '.join(updates)} WHERE id = '{pid}';")
    else:
        # Not found, insert
        cols = ['id', 'nombre']
        vals = [f"'{prod['id']}'", f"'{esc(prod['description'])}'"]
        
        if prod.get('sale_price') and prod['sale_price'].strip():
            cols.append('precio_unitario')
            vals.append(prod['sale_price'])
        else:
            cols.append('precio_unitario')
            vals.append("0")
            
        if prod.get('model'):
            cols.append('model')
            vals.append(f"'{esc(prod['model'])}'")
        if prod.get('order_code'):
            cols.append('order_code')
            vals.append(f"'{esc(prod['order_code'])}'")
        if prod.get('invoice_concept'):
            cols.append('invoice_concept')
            vals.append(f"'{esc(prod['invoice_concept'])}'")
        if prod.get('generic_description'):
            cols.append('generic_description')
            vals.append(f"'{esc(prod['generic_description'])}'")
        if prod.get('new_alg_description'):
            cols.append('new_alg_description')
            vals.append(f"'{esc(prod['new_alg_description'])}'")
        if prod.get('measurements'):
            cols.append('measurements')
            vals.append(f"'{esc(prod['measurements'])}'")
        if prod.get('alg_description'):
            cols.append('alg_description')
            vals.append(f"'{esc(prod['alg_description'])}'")
        if prod.get('base_hospital_price') and prod['base_hospital_price'].strip():
            cols.append('base_hospital_price')
            vals.append(prod['base_hospital_price'])
        if prod.get('line'):
            cols.append('line')
            vals.append(f"'{esc(prod['line'])}'")
        if prod.get('category'):
            cols.append('categoria')
            vals.append(f"'{esc(prod['category'])}'")
        if prod.get('type'):
            cols.append('tipo')
            vals.append(f"'{esc(prod['type'])}'")
            
        if prod.get('specialty_ids'):
            try:
                s_ids = json.loads(prod['specialty_ids'].replace("'", '"'))
                if s_ids:
                    ids_str = ", ".join([f"'{s}'" for s in s_ids])
                    cols.append('specialty_ids')
                    vals.append(f"ARRAY[{ids_str}]::text[]")
            except:
                pass
                
        if prod.get('image_urls'):
            try:
                i_urls = json.loads(prod['image_urls'].replace("'", '"'))
                if i_urls:
                    urls_str = ", ".join([f"'{u}'" for u in i_urls])
                    cols.append('image_urls')
                    vals.append(f"ARRAY[{urls_str}]::text[]")
            except:
                pass
        
        sql.append(f"INSERT INTO public.productos ({', '.join(cols)}) VALUES ({', '.join(vals)});")


with open('supabase/production_productos_migration.sql', 'w') as f:
    f.write('\\n'.join(sql))

print("SQL migration generated at supabase/production_productos_migration.sql")
