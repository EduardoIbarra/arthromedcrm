#!/usr/bin/env python3
"""
Backfill factura_productos.cantidad_entregada from remision_productos
and recompute facturas_cliente.estado_surtido.

Source of truth: remisiones linked to each factura (excluding cancelled).
Only lines that match a remisión product are rewritten; other lines keep
their existing cantidad_entregada (manual deliveries / unmatched SKUs).

Usage:
  DATABASE_URL=... python3 scripts/backfill_entregada_from_remisiones.py
  python3 scripts/backfill_entregada_from_remisiones.py --env .env.prod
  python3 scripts/backfill_entregada_from_remisiones.py --env .env.prod --dry-run
"""
from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

import psycopg2
import psycopg2.extras


def clean_dsn(raw: str) -> str:
    u = urlparse(raw)
    qs = parse_qs(u.query)
    for k in list(qs):
        if k.lower() in ("sslaccept", "sslcert", "sslkey", "sslrootcert"):
            del qs[k]
    q = urlencode({k: v[0] for k, v in qs.items()})
    return urlunparse((u.scheme, u.netloc, u.path, u.params, q, u.fragment))


def load_url(env_path: str | None) -> str:
    if env_path and os.path.exists(env_path):
        for line in open(env_path):
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    url = os.environ.get("DATABASE_URL") or os.environ.get("DIRECT_URL")
    if not url:
        raise SystemExit("DATABASE_URL not set")
    return url


def compute_estado(lines: list[tuple[int, int]]) -> str:
    """lines: list of (facturada, entregada)"""
    active = [(f, e) for f, e in lines if f > 0]
    if not active:
        return "no_surtida"
    any_d = any(e > 0 for _, e in active)
    all_d = all(e >= f for f, e in active)
    if all_d:
        return "completa"
    if any_d:
        return "parcial"
    return "no_surtida"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--env", default=None, help="Path to env file with DATABASE_URL")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    dsn = clean_dsn(load_url(args.env))
    conn = psycopg2.connect(dsn, connect_timeout=40)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    print("Loading remision deliveries...")
    # Each remision line counts once: prefer product_id, else name (avoids double-count).
    cur.execute(
        """
        SELECT r.factura_id,
               rp.producto_id,
               lower(trim(rp.producto_nombre)) AS nombre,
               sum(rp.cantidad)::int AS total
        FROM remisiones r
        JOIN remision_productos rp ON rp.remision_id = r.id
        WHERE r.factura_id IS NOT NULL
          AND lower(coalesce(r.estado, '')) NOT IN ('cancelada','cancelado','anulado','anulada')
          AND rp.cantidad > 0
        GROUP BY r.factura_id, rp.producto_id, lower(trim(rp.producto_nombre))
        """
    )
    rem_rows = cur.fetchall()

    by_factura_pid: dict = defaultdict(lambda: defaultdict(int))
    by_factura_name_all: dict = defaultdict(lambda: defaultdict(int))
    for r in rem_rows:
        fid = str(r["factura_id"])
        total = int(r["total"] or 0)
        if not total:
            continue
        if r["producto_id"]:
            by_factura_pid[fid][str(r["producto_id"])] += total
        if r["nombre"]:
            by_factura_name_all[fid][r["nombre"]] += total

    factura_ids = set(by_factura_pid.keys()) | set(by_factura_name_all.keys())
    print(f"Facturas with remision lines: {len(factura_ids)}")

    cur.execute(
        """
        SELECT id, factura_id, producto_id, producto_nombre,
               cantidad_facturada, cantidad_entregada
        FROM factura_productos
        WHERE factura_id = ANY(%s::uuid[])
        ORDER BY factura_id, producto_nombre
        """,
        (list(factura_ids),),
    )
    fps = cur.fetchall()
    by_fp: dict = defaultdict(list)
    for fp in fps:
        by_fp[str(fp["factura_id"])].append(fp)

    updates = []
    status_updates = []
    changed_lines = 0
    unchanged = 0
    skipped_no_match = 0

    for fid, lines in by_fp.items():
        # Working pools (mutable copies)
        pid_rem = dict(by_factura_pid.get(fid, {}))
        name_rem = dict(by_factura_name_all.get(fid, {}))
        new_vals = []  # (facturada, entregada) for estado

        for fp in lines:
            fact = int(fp["cantidad_facturada"] or 0)
            prev = int(fp["cantidad_entregada"] or 0)
            pid = str(fp["producto_id"]) if fp["producto_id"] else None
            name = (fp["producto_nombre"] or "").strip().lower()

            matched = False
            delivered = 0

            if pid and pid in pid_rem and pid_rem[pid] > 0:
                take = min(fact, pid_rem[pid])
                delivered += take
                pid_rem[pid] -= take
                if name:
                    # Consume same qty from name pool to prevent double-use
                    name_rem[name] = max(0, name_rem.get(name, 0) - take)
                matched = True

            if delivered < fact and name and name_rem.get(name, 0) > 0:
                take = min(fact - delivered, name_rem[name])
                delivered += take
                name_rem[name] -= take
                matched = True

            if not matched:
                # Leave manual/previous entregada alone
                new_vals.append((fact, prev))
                skipped_no_match += 1
                continue

            next_e = max(0, min(fact, delivered))
            new_vals.append((fact, next_e))
            if next_e != prev:
                updates.append((next_e, fp["id"]))
                changed_lines += 1
            else:
                unchanged += 1

        estado = compute_estado(new_vals)
        status_updates.append((estado, fid))

    print(f"Lines to update: {changed_lines} (unchanged matched {unchanged}, no remision match kept {skipped_no_match})")
    print(f"Facturas status to set: {len(status_updates)}")

    if args.dry_run:
        print("DRY RUN — no writes")
        for u in updates[:20]:
            print("  would set entregada", u[0], "on", u[1])
        conn.close()
        return

    if updates:
        psycopg2.extras.execute_batch(
            cur,
            "UPDATE factura_productos SET cantidad_entregada = %s WHERE id = %s",
            updates,
            page_size=500,
        )
    if status_updates:
        psycopg2.extras.execute_batch(
            cur,
            "UPDATE facturas_cliente SET estado_surtido = %s, updated_at = NOW() WHERE id = %s",
            status_updates,
            page_size=500,
        )
    conn.commit()

    cur.execute(
        """
        SELECT estado_surtido, count(*) FROM facturas_cliente
        WHERE id = ANY(%s::uuid[])
        GROUP BY estado_surtido ORDER BY 2 DESC
        """,
        (list(factura_ids),),
    )
    print("Estado distribution (facturas with remisiones):")
    for r in cur.fetchall():
        print(" ", dict(r) if hasattr(r, "keys") else r)

    sample = "fa1bf097-2e56-48fb-b1b0-0da8a196f436"
    cur.execute(
        "SELECT producto_nombre, cantidad_facturada, cantidad_entregada FROM factura_productos WHERE factura_id=%s ORDER BY producto_nombre",
        (sample,),
    )
    print(f"\nSample invoice {sample}:")
    rows = cur.fetchall()
    if rows:
        for r in rows:
            print(" ", dict(r))
        cur.execute("SELECT estado_surtido FROM facturas_cliente WHERE id=%s", (sample,))
        print(" estado_surtido:", dict(cur.fetchone() or {}))
    else:
        print("  (invoice not found in this DB)")

    cur.close()
    conn.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
