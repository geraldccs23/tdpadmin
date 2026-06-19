import os
import json
import sys
import pyodbc
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
load_dotenv()

BRANCH_CODE = os.getenv("RG7_BRANCH_CODE", "01").strip()
WAREHOUSES = [x.strip() for x in os.getenv("RG7_WAREHOUSES", "0101,0102").split(",") if x.strip()]
SOURCE_DB = os.getenv("PROFIT_SQLSERVER_DB") or "UNKNOWN_DB"


def conn_profit():
    host = os.getenv("PROFIT_SQLSERVER_HOST")
    port = os.getenv("PROFIT_SQLSERVER_PORT")
    db = os.getenv("PROFIT_SQLSERVER_DB")
    user = os.getenv("PROFIT_SQLSERVER_USER")
    pwd = os.getenv("PROFIT_SQLSERVER_PASSWORD")
    driver = os.getenv("PROFIT_SQLSERVER_DRIVER")

    server = f"{host},{port}"
    conn_str = (
        f"DRIVER={{{driver}}};"
        f"SERVER={server};"
        f"DATABASE={db};"
        f"UID={user};"
        f"PWD={pwd};"
        "TrustServerCertificate=yes;"
    )
    return pyodbc.connect(conn_str, timeout=30)


def fetch_stock_snapshot():
    view_name = os.getenv("PROFIT_STOCK_VIEW", "dbo.v_rg7_stock_snapshot_ext").strip()

    placeholders = ",".join("?" for _ in WAREHOUSES)

    sql = f"""
    SELECT
      RTRIM(co_art)  AS co_art,
      RTRIM(co_alma) AS co_alma,
      RTRIM(des_art) AS des_art,
      RTRIM(modelo)  AS modelo,
      RTRIM(ref)     AS ref,
      CAST(precio_usd AS decimal(18,4)) AS precio_usd,
      CAST(precio_bs  AS decimal(18,4)) AS precio_bs,
      CAST(tasa_ref   AS decimal(18,4)) AS tasa_ref,
      CAST(stock AS decimal(18,4)) AS stock
    FROM {view_name}
    WHERE branch_code = ?
      AND co_alma IN ({placeholders});
    """

    data = []
    with conn_profit() as cn:
        cur = cn.cursor()
        cur.execute(sql, (BRANCH_CODE, *WAREHOUSES))
        for r in cur.fetchall():
            data.append({
                "co_art": (str(r.co_art) if r.co_art is not None else "").strip(),
                "co_alma": (str(r.co_alma) if r.co_alma is not None else "").strip(),
                "descripcion": (str(r.des_art) if r.des_art is not None else "").strip() or None,
                "modelo": (str(r.modelo) if r.modelo is not None else "").strip() or None,
                "ref": (str(r.ref) if r.ref is not None else "").strip() or None,
                "precio_usd": float(r.precio_usd or 0),
                "precio_bs": float(r.precio_bs or 0),
                "tasa_ref": float(r.tasa_ref or 0),
                "stock": float(r.stock or 0),
            })

    return data


def debug_producto(codigo: str):
    view_name = os.getenv("PROFIT_STOCK_VIEW", "dbo.v_rg7_stock_snapshot_ext").strip()

    sql = f"""
    SELECT
      RTRIM(co_art)  AS co_art,
      RTRIM(co_alma) AS co_alma,
      RTRIM(des_art) AS des_art,
      RTRIM(modelo)  AS modelo,
      RTRIM(ref)     AS ref,
      CAST(precio_usd AS decimal(18,4)) AS precio_usd,
      CAST(precio_bs  AS decimal(18,4)) AS precio_bs,
      CAST(tasa_ref   AS decimal(18,4)) AS tasa_ref,
      CAST(stock AS decimal(18,4)) AS stock
    FROM {view_name}
    WHERE co_art = ?
    ORDER BY co_alma;
    """

    with conn_profit() as cn:
        cur = cn.cursor()
        cur.execute(sql, (codigo,))
        rows = cur.fetchall()

    print(f"\nDEBUG PRODUCTO: {codigo}\n")
    if not rows:
        print("No se encontró ese co_art en la vista.")
        return

    for r in rows:
        print({
            "co_art": (str(r.co_art) if r.co_art is not None else "").strip(),
            "co_alma": (str(r.co_alma) if r.co_alma is not None else "").strip(),
            "descripcion": (str(r.des_art) if r.des_art is not None else "").strip() or None,
            "modelo": (str(r.modelo) if r.modelo is not None else "").strip() or None,
            "ref": (str(r.ref) if r.ref is not None else "").strip() or None,
            "precio_usd": float(r.precio_usd or 0),
            "precio_bs": float(r.precio_bs or 0),
            "tasa_ref": float(r.tasa_ref or 0),
            "stock": float(r.stock or 0),
        })


def push(payload):
    url = os.getenv("RG7_PUSH_URL", "").strip()
    token = os.getenv("RG7_AGENT_TOKEN", "").strip()
    if not url or not token:
        raise SystemExit("Faltan RG7_PUSH_URL o RG7_AGENT_TOKEN en .env")

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    r = requests.post(
        url,
        headers=headers,
        data=json.dumps(payload, ensure_ascii=False),
        timeout=180,
        verify=False,
    )

    print("HTTP", r.status_code)
    print(r.text[:800])
    r.raise_for_status()


if __name__ == "__main__":
    # Si pasas un co_art: solo debug y salir (no push)
    if len(sys.argv) >= 2:
        codigo = sys.argv[1].strip()
        debug_producto(codigo)
        raise SystemExit(0)

    # Si no pasas args: push normal
    rows = fetch_stock_snapshot()
    print("Rows:", len(rows))

    sample = next((x for x in rows if x.get("modelo") or x.get("ref") or x.get("precio_usd")), None) or (rows[0] if rows else None)
    print("SAMPLE ROW ->", json.dumps(sample, ensure_ascii=False, indent=2))

    payload = {
        "source_db": SOURCE_DB,
        "branch": BRANCH_CODE,
        "warehouses": WAREHOUSES,
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "rows": rows,
    }

    push(payload)