import csv

def read_csv(path):
    with open(path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        return list(reader)

products = read_csv('/Users/ed/Downloads/products_rows (2).csv')
productos = read_csv('/Users/ed/Downloads/productos_rows.csv')

producto_names = [p['nombre'].lower().strip() for p in productos]

matches = 0
for p in products:
    desc = p['description'].lower().strip()
    invoice = p.get('invoice_concept', '').lower().strip()
    
    found = False
    for p_name in producto_names:
        if desc in p_name or (invoice and invoice in p_name):
            found = True
            break
    if found:
        matches += 1

print(f"Matches found: {matches} out of {len(products)}")
