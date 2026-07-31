import json
import re

CATEGORY_MAP = {
    "MÁS VENDIDOS": "mas_vendidos",
    "MEN'S COLLECTION": "hombre",
    "UNISEX COLLECTION": "unisex",
    "WOMEN'S COLLECTION": "mujer",
    "GIFT SETS": "sets_regalo",
}

def slugify(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')

def parse():
    with open('/home/claude/perfume-bot/data/raw_catalog.txt', encoding='utf-8') as f:
        lines = [l.rstrip('\n') for l in f]

    products = []
    current_category = None
    seen_ids = {}

    line_re = re.compile(r'^(.*?)\s*\(([^)]*)\)\s*-\s*(.*)$')

    for line in lines:
        line = line.strip()
        if not line:
            continue
        if line in CATEGORY_MAP:
            current_category = CATEGORY_MAP[line]
            continue

        m = line_re.match(line)
        if not m:
            continue
        name, meta, notes = m.groups()
        name = name.strip()

        agotado = 'AGOTADO' in meta.upper()
        price_match = re.search(r'(\d+)\s*\$', meta)
        price = int(price_match.group(1)) if price_match else None

        base_id = slugify(name)
        if base_id in seen_ids:
            seen_ids[base_id] += 1
            product_id = f"{base_id}-{seen_ids[base_id]}"
        else:
            seen_ids[base_id] = 0
            product_id = base_id

        products.append({
            "id": product_id,
            "name": name,
            "price_usd": price,
            "available": not agotado,
            "category": current_category,
            "notes": notes.strip()
        })

    return products

if __name__ == '__main__':
    products = parse()
    out_path = '/home/claude/perfume-bot/data/catalog.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(products, f, ensure_ascii=False, indent=2)
    print(f"Total productos: {len(products)}")
    disponibles = sum(1 for p in products if p['available'])
    print(f"Disponibles: {disponibles} | Agotados: {len(products) - disponibles}")
