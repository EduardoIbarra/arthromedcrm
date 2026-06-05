import csv

def read_csv(path):
    with open(path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        return list(reader)

products = read_csv('/Users/ed/Downloads/products_rows (2).csv')
for p in products:
    if p.get('image_urls') and p['image_urls'] != '[]':
        print(f"Product: {p['description']}")
        print(f"Image URLs: {p['image_urls']}")
        break
