import os
import json
import pyodbc
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv
from decimal import Decimal
from collections import defaultdict

load_dotenv()

AGENT_BASE = os.getenv("RG7_AGENT_BASE_URL", "").rstrip("/")
AGENT_TOKEN = os.getenv("RG7_AGENT_TOKEN", "")
SOURCE_DB = os.getenv("PROFIT_SQLSERVER_DB", "UNKNOWN_DB")

def conn_profit():
    server = f"{os.getenv('PROFIT_SQLSERVER_HOST')},{os.getenv('PROFIT_SQLSERVER_PORT')}"
    return pyodbc.connect(
        f"DRIVER={{{os.getenv('PROFIT_SQLSERVER_DRIVER')}}};"
        f"SERVER={server};"
        f"DATABASE={os.getenv('PROFIT_SQLSERVER_DB')};"
        f"UID={os.getenv('PROFIT_SQLSERVER_USER')};"
        f"PWD={os.getenv('PROFIT_SQLSERVER_PASSWORD')};"
        "TrustServerCertificate=yes;",
        timeout=60,
    )

def json_default(o):
    if isinstance(o, Decimal):
        return float(o)
    if isinstance(o, datetime):
        return o.isoformat()
    return str(o)

def post_cxc(lines):
    url = f"{AGENT_BASE}/api/agent/cxc_lines"
    headers = {
        "Authorization": f"Bearer {AGENT_TOKEN}",
        "Content-Type": "application/json",
    }
    payload = {
        "source_db": SOURCE_DB,
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "lines": lines,
    }

    r = requests.post(
        url,
        headers=headers,
        data=json.dumps(payload, default=json_default, ensure_ascii=False),
        timeout=300,
    )

    print("HTTP", r.status_code)
    print(r.text[:800])

    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:500]}")

    return r.json()

def fetch_cxc():
    # Consulta genérica para Profit Plus (ajustar si existe una vista específica)
    sql = """
      SELECT 
        RTRIM(d.co_cli) as codigo_cliente,
        RTRIM(c.cli_des) as nombre_cliente,
        RTRIM(d.tipo_doc) as tipo_documento,
        RTRIM(d.nro_doc) as numero_documento,
        d.fec_emis as fecha_emision,
        d.fec_venc as fecha_vencimiento,
        CAST(d.monto_net AS decimal(18,4)) as monto_total,
        CAST(d.saldo AS decimal(18,4)) as saldo_pendiente,
        RTRIM(d.co_ven) as codigo_vendedor,
        RTRIM(d.co_sucu) as sucursal
      FROM docum_cc d
      INNER JOIN clientes c ON d.co_cli = c.co_cli
      WHERE d.saldo > 0
      ORDER BY d.fec_emis ASC
    """

    out = []
    with conn_profit() as cn:
        cur = cn.cursor()
        cur.execute(sql)
        cols = [c[0].lower() for c in cur.description]

        for row in cur.fetchall():
            d = dict(zip(cols, row))
            # Formatear fechas
            if d.get("fecha_emision"):
                d["fecha_emision"] = d["fecha_emision"].isoformat()
            if d.get("fecha_vencimiento"):
                d["fecha_vencimiento"] = d["fecha_vencimiento"].isoformat()
            
            out.append(d)

    return out

if __name__ == "__main__":
    if not AGENT_BASE or not AGENT_TOKEN:
        print("Error: Falta RG7_AGENT_BASE_URL o RG7_AGENT_TOKEN en .env")
        exit(1)

    print("Extrayendo Cuentas por Cobrar desde Profit...")
    lines = fetch_cxc()
    print(f"CxC pendientes encontradas: {len(lines)}")

    if not lines:
        print("Nada que enviar.")
    else:
        resp = post_cxc(lines)
        print("Respuesta del Agente:", resp)
