#!/usr/bin/env python3
"""
Re-parse the official Lista de precios PDF by anchoring on price cells,
then assign PRODUCTO / REFERENCIA / DESCRIPCIÓN from column x-positions.
Upserts into public.products for the ERP price-list export.
"""
from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass

import fitz
import psycopg2

PDF_PATH = "/Users/ed/Downloads/Lista de precios jul 2026 (1).pdf"

# Column left edges (letter-size reference PDF)
X_REF = 175
X_DESC = 275
X_PRICE = 460

# Longer / more specific names MUST come first (UBE KIT before UBE, SHAVER & BUR before SHAVER).
CATEGORIES = [
    "SPORTS MEDICINE (ARTROSCOPIA)",
    "UBE KIT (INSTRUMENTAL ENDOSCOPIA BIPORTAL UNILATERAL)",
    "UBE (ENDOSCOPIA BIPORTAL UNILATERAL)",
    "SPINE (COLUMNA)",
    "ENT (OTORRINOLARINGOLOGIA)",
    "URO&GYN (UROLOGIA Y GINECOLOGIA)",
    "SHAVER & BUR",
    "SHAVER SYSTEM",
    "PINZAS ENDOSCOPICAS",
]

PRICE_RE = re.compile(r"^\d{1,3}(?:,\d{3})*\.\d{2}$")
# Real SKUs: ARS600, AC306-306Q1, MC404C-404Q2H, BC310A-UGD, ED30-40, HC-A07, SHB1, RIC11, R-SCO…
ORDER_CODE_RE = re.compile(
    r"\b("
    r"ARS\d+"
    r"|RIC\d+"
    r"|[A-Z]{1,3}\d{2,4}[A-Z]?(?:-[A-Z0-9]{1,12})+"
    r"|HC-[A-Z]\d+"
    r"|SH[AB]\d"
    r"|MM[ABD]\d"
    r"|IT\d+"
    r"|MHQ"
    r"|ED\d{2}-\d{2}"
    r"|R-SCO(?:\s+GS)?"
    r"|HF\d{4}Z(?:\.\d{3}(?:\.\d)?)+"
    r"|BD[AJ]\d+[A-Z0-9]*"
    r"|DG[B]?-?[A-Z0-9()]+\d*[A-Z0-9()]*"
    r"|UBE\s?[A-Z0-9+]+"
    r")\b"
)


@dataclass
class Word:
    x0: float
    y0: float
    x1: float
    y1: float
    text: str

    @property
    def yc(self) -> float:
        return (self.y0 + self.y1) / 2


def col_of(x0: float) -> str:
    if x0 >= X_PRICE:
        return "price"
    if x0 >= X_DESC:
        return "desc"
    if x0 >= X_REF:
        return "ref"
    return "prod"


def detect_category(text: str) -> str | None:
    """
    Match only category *headers* from the official PDF (navy bars).

    Critical: do NOT use bare substring checks like "ENT" in "INSTRUMENTAL" —
    that mis-classified UBE KIT / SHAVER & BUR products under ENT.
    """
    raw = (text or "").strip()
    if not raw or len(raw) > 100:
        return None
    # Skip product rows, column headers, notes
    up = raw.upper()
    if up in ("PRODUCTO", "REFERENCIA", "DESCRIPCIÓN", "DESCRIPCION", "IMPORTE"):
        return None
    if up.startswith("PRECIO") or up.startswith("TIEMPO DE ENTREGA"):
        return None
    if re.search(r"\d{1,3}(?:,\d{3})*\.\d{2}", raw):
        return None

    # Only navy-bar section titles. Never match SKUs like "UBE CX" / "UBE E1X".
    # Prefer full names with parentheses (how they appear on the official PDF).
    header_patterns = [
        (r"^SPORTS\s+MEDICINE\b", "SPORTS MEDICINE (ARTROSCOPIA)"),
        (r"^UBE\s+KIT\b", "UBE KIT (INSTRUMENTAL ENDOSCOPIA BIPORTAL UNILATERAL)"),
        (r"^UBE\s*\(\s*ENDOSCOPIA", "UBE (ENDOSCOPIA BIPORTAL UNILATERAL)"),
        (r"^SPINE\s*\(\s*COLUMNA", "SPINE (COLUMNA)"),
        (r"^ENT\s*\(\s*OTORRINOLARINGOLOGIA", "ENT (OTORRINOLARINGOLOGIA)"),
        (r"^URO\s*&\s*GYN\b|^URO&GYN\b", "URO&GYN (UROLOGIA Y GINECOLOGIA)"),
        (r"^SHAVER\s*&\s*BUR\b", "SHAVER & BUR"),
        (r"^SHAVER\s+SYSTEM\b", "SHAVER SYSTEM"),
        (r"^PINZAS\s+ENDOSCOP", "PINZAS ENDOSCOPICAS"),
    ]
    for pat, cat in header_patterns:
        if re.search(pat, up):
            return cat

    # Exact full-string match fallback
    for cat in CATEGORIES:
        if up == cat.upper():
            return cat

    return None


def parse_pdf(path: str) -> list[dict]:
    doc = fitz.open(path)
    products: list[dict] = []
    current_category = "General"

    for page in doc:
        raw = page.get_text("words")
        words = [Word(w[0], w[1], w[2], w[3], w[4]) for w in raw]

        # Update category from full page text lines first
        for line in page.get_text().splitlines():
            cat = detect_category(line.strip())
            if cat:
                current_category = cat

        # Also scan words joined by y for category headers (dark bar text)
        by_y: dict[int, list[Word]] = {}
        for w in words:
            by_y.setdefault(int(round(w.y0)), []).append(w)
        for y, ws in by_y.items():
            line = " ".join(w.text for w in sorted(ws, key=lambda t: t.x0))
            cat = detect_category(line)
            if cat:
                current_category = cat

        # Price anchors = real importe cells (right column, money format)
        prices = [
            w
            for w in words
            if w.x0 >= X_PRICE and PRICE_RE.match(w.text)
        ]
        prices.sort(key=lambda w: w.y0)

        for i, price_w in enumerate(prices):
            price_val = float(price_w.text.replace(",", ""))
            if price_val < 100:  # skip measurements misread as money
                continue

            # Bound each multi-line row between midpoints of neighboring prices
            prev_yc = prices[i - 1].yc if i > 0 else price_w.yc - 28
            next_yc = prices[i + 1].yc if i + 1 < len(prices) else price_w.yc + 28
            y_lo = (prev_yc + price_w.yc) / 2
            y_hi = (price_w.yc + next_yc) / 2
            # keep a small pad but never cross midpoints
            y_lo = max(y_lo, price_w.yc - 20)
            y_hi = min(y_hi, price_w.yc + 20)

            band = [
                w
                for w in words
                if w is not price_w and y_lo < w.yc < y_hi
            ]

            prod_parts, ref_parts, desc_parts = [], [], []
            for w in sorted(band, key=lambda t: (t.y0, t.x0)):
                c = col_of(w.x0)
                if c == "prod":
                    prod_parts.append(w)
                elif c == "ref":
                    ref_parts.append(w)
                elif c == "desc":
                    desc_parts.append(w)

            def join_words(ws: list[Word]) -> str:
                if not ws:
                    return ""
                return " ".join(w.text for w in sorted(ws, key=lambda t: (round(t.y0), t.x0)))

            model = join_words(prod_parts).strip()
            order_code = join_words(ref_parts).strip()
            description = join_words(desc_parts).strip()

            # Skip footer / notes that accidentally match a money amount
            junk = f"{model} {order_code} {description}".lower()
            if any(
                s in junk
                for s in (
                    "precio sujeto",
                    "compra mínima",
                    "compra minima",
                    "tiempo de entrega",
                    "precio en mxn",
                )
            ):
                continue

            # Fallback if columns failed: recover code from band full text
            full_band = " ".join(
                w.text for w in sorted(band + [price_w], key=lambda t: (t.y0, t.x0))
            )
            if not order_code:
                m = ORDER_CODE_RE.search(full_band)
                if m:
                    order_code = m.group(1).strip()
                    if not model:
                        model = full_band[: m.start()].strip()
                    if not description:
                        description = full_band[m.start() : full_band.rfind(price_w.text)].strip()

            # Clean "de HF6518..." style where "de" leaked into code column
            if order_code.lower().startswith("de "):
                order_code = order_code[3:].strip()
            order_code = re.sub(r"\s+", " ", order_code).strip()
            model = re.sub(r"\s+", " ", model).strip()
            description = re.sub(r"\s+", " ", description).strip()

            # Prefer full description that matches reference style
            if not description:
                description = f"{model} {order_code}".strip()

            if not model and not order_code:
                continue

            # Category = last *header* above this price. Carry across pages via current_category.
            cat_for_row = current_category
            for y in sorted(by_y.keys()):
                if y > price_w.y0:
                    break
                line = " ".join(w.text for w in sorted(by_y[y], key=lambda t: t.x0))
                cat = detect_category(line)
                if cat:
                    cat_for_row = cat
                    current_category = cat

            products.append(
                {
                    "category": cat_for_row,
                    "model": model,
                    "order_code": order_code,
                    "description": description,
                    "price": price_val,
                }
            )

    return products


def get_db_url() -> str:
    url = os.environ.get("DATABASE_URL") or os.environ.get("DIRECT_URL")
    if not url:
        env_path = os.path.join(os.path.dirname(__file__), "..", ".env.local")
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    if line.startswith("DATABASE_URL="):
                        url = line.split("=", 1)[1].strip().strip('"').strip("'")
                        break
    if not url:
        raise RuntimeError("DATABASE_URL not set")
    return url


def sync_db(products: list[dict], dry_run: bool = False) -> None:
    conn = psycopg2.connect(get_db_url())
    cur = conn.cursor()

    if not dry_run:
        cur.execute("UPDATE public.products SET sort_order = NULL WHERE sort_order IS NOT NULL;")

    updated = created = 0
    sort_idx = 1
    seen_codes: set[str] = set()

    for prod in products:
        order_code = prod["order_code"] or None
        model = prod["model"] or None
        description = prod["description"] or (model or order_code or "Producto")
        price = prod["price"]
        category = prod["category"]

        # Skip exact duplicate codes in same parse (e.g. ARS900 listed under two lines)
        dedupe_key = f"{order_code}||{model}||{price}||{category}"
        if dedupe_key in seen_codes:
            print(f"[{sort_idx:03d}] SKIP-DUP {order_code!r} / {model!r}")
            continue
        seen_codes.add(dedupe_key)

        row_id = None

        # EXACT order_code + same category (allows ARS900 under UBE and SPINE)
        if order_code:
            cur.execute(
                """
                SELECT id FROM public.products
                WHERE order_code = %s AND (line = %s OR category = %s)
                LIMIT 1;
                """,
                (order_code, category, category),
            )
            row = cur.fetchone()
            if row:
                row_id = row[0]

        # EXACT order_code only — never prefix-match (BDJ13040B must not hit BDJ13040B1)
        if row_id is None and order_code:
            cur.execute(
                """
                SELECT id, line, sort_order FROM public.products
                WHERE order_code = %s
                ORDER BY sort_order NULLS LAST
                LIMIT 5;
                """,
                (order_code,),
            )
            cands = cur.fetchall()
            free = [c for c in cands if c[2] is None]
            same = [c for c in cands if (c[1] or "") == category]
            if same:
                row_id = same[0][0]
            elif free:
                row_id = free[0][0]
            elif len(cands) == 1:
                # Single global hit with a different category already claimed this run:
                # only reuse if it still has no sort_order (shouldn't happen after free check)
                pass
            # else CREATE a new row — do not steal BDJ13040B1 for BDJ13040B

        # model + free row only (no order_code collision)
        if row_id is None and model and not order_code:
            cur.execute(
                """
                SELECT id FROM public.products
                WHERE model = %s AND sort_order IS NULL
                LIMIT 1;
                """,
                (model,),
            )
            row = cur.fetchone()
            if row:
                row_id = row[0]

        if row_id is not None:
            if not dry_run:
                cur.execute(
                    """
                    UPDATE public.products
                    SET model = %s,
                        order_code = %s,
                        description = %s,
                        base_hospital_price = %s,
                        line = %s,
                        category = %s,
                        sort_order = %s,
                        updated_at = NOW()
                    WHERE id = %s;
                    """,
                    (model, order_code, description, price, category, category, sort_idx, row_id),
                )
            print(f"[{sort_idx:03d}] UPDATE {order_code!r:22} | {model!r:32} | ${price:>10,.2f}")
            updated += 1
        else:
            if not dry_run:
                cur.execute(
                    """
                    INSERT INTO public.products (
                        id, description, model, order_code, base_hospital_price,
                        line, category, sort_order, created_at, updated_at,
                        specialty_ids, image_urls
                    ) VALUES (
                        gen_random_uuid(), %s, %s, %s, %s,
                        %s, %s, %s, NOW(), NOW(),
                        '{}', '{}'
                    );
                    """,
                    (description, model, order_code, price, category, category, sort_idx),
                )
            print(f"[{sort_idx:03d}] CREATE {order_code!r:22} | {model!r:32} | ${price:>10,.2f}")
            created += 1

        sort_idx += 1

    if not dry_run:
        conn.commit()
    cur.close()
    conn.close()
    print(f"\nDone. updated={updated} created={created} listed={sort_idx-1} dry_run={dry_run}")


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    pdf = PDF_PATH
    if not os.path.exists(pdf):
        alt = "/Users/ed/Downloads/Lista de precios jul 2026.pdf"
        if os.path.exists(alt):
            pdf = alt
        else:
            raise SystemExit(f"PDF not found: {PDF_PATH}")

    print(f"Parsing {pdf} ...")
    products = parse_pdf(pdf)

    out = os.path.join(os.path.dirname(__file__), "parsed_price_list_fixed.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(products, f, indent=2, ensure_ascii=False)
    print(f"Parsed {len(products)} products → {out}\n")

    for p in products[:20]:
        print(
            f"  {p['category'][:22]:22} | {p['model']!r:28} | {p['order_code']!r:18} | {p['description'][:55]!r}"
        )

    print("\nSyncing to DB...")
    sync_db(products, dry_run=dry_run)


if __name__ == "__main__":
    main()
