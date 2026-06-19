// /root/rg7-agent/app/server.js
// RG7 Agent API (Sales + Purchases + Stock Snapshot)
// - Auth via Bearer AGENT_TOKEN
// - /api/agent/ping
// - /api/agent/sales_lines (rg7_hist.sales_lines) idempotent by uniq_key
// - /api/agent/purchase_lines (public.purchase_lines) idempotent by uniq_key
// - /api/agent/stock_snapshot (public.stock_snapshots + public.stock_snapshot_lines)

require('dotenv').config();
const express = require("express");
const { Pool } = require("pg");
const crypto = require("crypto");

const app = express();
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (_req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
const PORT = process.env.PORT || 3003;
const AGENT_TOKEN = process.env.AGENT_TOKEN || "";

// --------------------
// Auth middleware
// --------------------
function requireAuth(req, res, next) {
    const h = req.headers["authorization"] || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : "";
    if (!AGENT_TOKEN || token !== AGENT_TOKEN) {
        return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    next();
}

// --------------------
// PG Pool
// --------------------
const pool = new Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    max: Number(process.env.PGPOOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.PGPOOL_IDLE || 30000),
    connectionTimeoutMillis: Number(process.env.PGPOOL_CONN_TIMEOUT || 10000),
});

// --------------------
// Ping
// --------------------
app.get("/api/agent/ping", async (_req, res) => {
    try {
        const r = await pool.query("select now() as now");
        res.json({ ok: true, now: r.rows[0].now });
    } catch (e) {
        res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
});

// --------------------
// Sales lines
// payload: { source_db, extracted_at, lines: [] }
// writes to rg7_hist.sales_lines
// --------------------
app.post("/api/agent/sales_lines", requireAuth, async (req, res) => {
    const { extracted_at, lines } = req.body || {};
    if (!Array.isArray(lines)) {
        return res.status(400).json({ ok: false, error: "lines must be array" });
    }

    const source_db = (req.body?.source_db || "UNKNOWN_DB").toString().trim();

    const client = await pool.connect();
    try {
        await client.query("begin");

        const sql = `
      insert into rg7_hist.sales_lines
      (uniq_key,
       fuente, fecha_hora, tipo_documento, numero_documento,
       codigo_cliente, nombre_cliente, codigo_vendedor, vendedor, sucursal,
       codigo_producto, line_seq,
       descripcion, barra_referencia, marca_producto, categoria_mapeada, categoria_tipo,
       tasa, precio_bs, precio_usd, cantidad, total_bs, total_usd, raw, extracted_at)
      values
      ($1,
       $2,$3,$4,$5,
       $6,$7,$8,$9,$10,
       $11,$12,
       $13,$14,$15,$16,$17,
       $18,$19,$20,$21,$22,$23,$24::jsonb,$25)
      on conflict (uniq_key) do nothing
      returning id
    `;

        let inserted = 0;

        for (const l of lines) {
            const fuente = (l.fuente || l.source || "UNKNOWN").toString().trim();
            const fecha_hora = l.fecha_hora || l.fec_emis || null;

            const tipo_documento =
                ((l.tipo_documento || "UNKNOWN").toString().trim()) || "UNKNOWN";
            const numero_documento =
                ((l.numero_documento || l.doc_num || "UNKNOWN").toString().trim()) ||
                "UNKNOWN";
            const sucursal =
                ((l.sucursal || l.nombre_sucursal || "UNKNOWN").toString().trim()) ||
                "UNKNOWN";
            const codigo_producto =
                ((l.codigo_producto || l.co_art || "UNKNOWN").toString().trim()) ||
                "UNKNOWN";

            const line_seq = Number.isFinite(Number(l.line_seq))
                ? Number(l.line_seq)
                : null;

            const uniq_key = [
                source_db,
                fuente,
                sucursal,
                tipo_documento,
                numero_documento,
                codigo_producto,
                line_seq ?? "",
                fecha_hora || "",
            ].join("|");

            const r = await client.query(sql, [
                uniq_key,
                fuente,
                fecha_hora,
                tipo_documento,
                numero_documento,

                l.codigo_cliente ?? l.co_cli ?? null,
                l.nombre_cliente ?? null,
                l.codigo_vendedor ?? l.co_ven ?? null,
                l.vendedor ?? l.nombre_vendedor ?? null,
                sucursal,

                codigo_producto,
                line_seq,

                l.descripcion ?? l.des_art ?? null,
                l.barra_referencia ?? l.co_bar ?? l.co_art ?? null,
                l.marca_producto ?? null,
                l.categoria_mapeada ?? null,
                l.categoria_tipo ?? null,

                l.tasa ?? null,
                l.precio_bs ?? l.prec_vta ?? null,
                l.precio_usd ?? null,
                l.cantidad ?? null,
                l.total_bs ?? l.reng_neto ?? null,
                l.total_usd ?? null,

                JSON.stringify(l),
                extracted_at ? new Date(extracted_at) : new Date(),
            ]);

            if (r.rowCount === 1) inserted++;
        }

        await client.query("commit");
        res.json({ ok: true, inserted });
    } catch (e) {
        try {
            await client.query("rollback");
        } catch { }
        res.status(500).json({ ok: false, error: String(e?.message || e) });
    } finally {
        client.release();
    }
});

// --------------------
// Purchase lines
// payload: { source_db, extracted_at, lines: [] }
// writes to public.purchase_lines
// --------------------
app.post("/api/agent/purchase_lines", requireAuth, async (req, res) => {
    const { extracted_at, lines } = req.body || {};
    if (!Array.isArray(lines)) {
        return res.status(400).json({ ok: false, error: "lines must be array" });
    }

    const source_db = (req.body?.source_db || "UNKNOWN_DB").toString().trim();

    const client = await pool.connect();
    try {
        await client.query("begin");

        const sql = `
      insert into public.purchase_lines
      (uniq_key,
       fuente, fecha_hora, tipo_documento, numero_documento, sucursal,
       proveedor_codigo, proveedor_nombre,
       codigo_producto, line_seq,
       descripcion, cantidad,
       costo_bs, costo_usd,
       tasa_original, tasa_ref_dia, tasa_final, tasa_es_valida,
       status, origen, tasa_historica, total_costo_bs, total_costo_usd,
       raw, extracted_at)
      values
      ($1,
       $2,$3,$4,$5,$6,
       $7,$8,
       $9,$10,
       $11,$12,
       $13,$14,
       $15,$16,$17,$18,
       $19,$20,$21,$22,$23,
       $24::jsonb,$25)
      on conflict (uniq_key) do update set
        status = excluded.status,
        origen = excluded.origen,
        tasa_historica = excluded.tasa_historica,
        total_costo_bs = excluded.total_costo_bs,
        total_costo_usd = excluded.total_costo_usd,
        extracted_at = excluded.extracted_at,
        raw = excluded.raw
      returning id
    `;

        let inserted = 0;

        for (const l of lines) {
            const fuente = (l.fuente || l.source || "UNKNOWN").toString().trim();
            const fecha_hora = l.fecha_hora || l.fecha || null;

            const tipo_documento =
                ((l.tipo_documento || "UNKNOWN").toString().trim()) || "UNKNOWN";
            const numero_documento =
                ((l.numero_documento || "UNKNOWN").toString().trim()) || "UNKNOWN";

            const sucursal = (
                l.sucursal ||
                l.codigo_sucursal ||
                l.co_alma ||
                "UNKNOWN"
            )
                .toString()
                .trim();

            const codigo_producto =
                ((l.codigo_producto || l.co_art || "UNKNOWN").toString().trim()) ||
                "UNKNOWN";

            const line_seq = Number.isFinite(Number(l.line_seq))
                ? Number(l.line_seq)
                : null;

            const uniq_key = [
                source_db,
                fuente,
                sucursal,
                tipo_documento,
                numero_documento,
                codigo_producto,
                line_seq ?? "",
                fecha_hora || "",
            ].join("|");

            const r = await client.query(sql, [
                uniq_key,
                fuente,
                fecha_hora,
                tipo_documento,
                numero_documento,
                sucursal,

                l.proveedor_codigo ?? l.co_prov ?? l.codprov ?? null,
                l.proveedor_nombre ?? l.proveedor ?? null,

                codigo_producto,
                line_seq,

                l.descripcion ?? l.des_art ?? null,
                l.cantidad ?? null,

                l.costo_bs ?? l.costo ?? null,
                l.costo_usd ?? null,

                l.tasa_original ?? null,
                l.tasa_ref_dia ?? null,
                l.tasa_final ?? null,
                l.tasa_es_valida ?? null,

                l.status ?? null,
                l.origen ?? null,
                l.tasa_historica ?? null,
                l.total_costo_bs ?? null,
                l.total_costo_usd ?? null,

                JSON.stringify(l),
                extracted_at ? new Date(extracted_at) : new Date(),
            ]);

            if (r.rowCount === 1) inserted++;
        }

        await client.query("commit");
        res.json({ ok: true, inserted });
    } catch (e) {
        try {
            await client.query("rollback");
        } catch { }
        res.status(500).json({ ok: false, error: String(e?.message || e) });
    } finally {
        client.release();
    }
});

// --------------------
// Stock snapshot
// payload: { source_db, branch, warehouses:[], captured_at, rows:[{co_art,co_alma,stock,descripcion}] }
// writes to public.stock_snapshots + public.stock_snapshot_lines
// --------------------
app.post("/api/agent/stock_snapshot", requireAuth, async (req, res) => {
    const { branch, warehouses, captured_at, rows } = req.body || {};

    if (!branch || typeof branch !== "string") {
        return res.status(400).json({ ok: false, error: "branch is required" });
    }

    if (!Array.isArray(warehouses)) {
        return res.status(400).json({ ok: false, error: "warehouses must be array" });
    }

    if (!Array.isArray(rows)) {
        return res.status(400).json({ ok: false, error: "rows must be array" });
    }

    const client = await pool.connect();

    try {
        await client.query("begin");

        // HEADER (warehouses es text[])
        const headerSql = `
      insert into public.stock_snapshots
        (branch, captured_at, warehouses, rows_count)
      values
        ($1, $2, $3::text[], $4)
      returning id
    `;

        const capturedAt = captured_at ? new Date(captured_at) : new Date();

        // --- CLEANUP: dejar solo snapshots del día (por sucursal) ---
        await client.query(
            `   
            delete from public.stock_snapshots
            where branch = $1
            and captured_at < date_trunc('day', $2::timestamptz)
            `,
            [branch.trim(), capturedAt]
        );

        const header = await client.query(headerSql, [
            branch.trim(),
            capturedAt,
            warehouses,
            rows.length,
        ]);

        const snapshot_id = header.rows[0].id;

        // LINES (incluye descripcion)
        const lineSql = `
      insert into public.stock_snapshot_lines
        (snapshot_id, codigo_producto, codigo_almacen, stock, descripcion, modelo, ref, precio_usd, precio_bs, tasa_ref)
      values
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;

        let inserted_lines = 0;

        // Debug: Log keys of first row to see what's actually arriving
        if (rows.length > 0) {
            try {
                const fs = require('fs');
                const path = require('path');
                fs.writeFileSync(path.join(__dirname, 'snapshot_debug.json'), JSON.stringify({
                    keys: Object.keys(rows[0]),
                    sample: rows[0]
                }, null, 2));
            } catch (e) { }
        }

        for (const r of rows) {
            const codigo_producto =
                ((r.co_art || r.codigo_producto || "").toString().trim()) || null;

            const codigo_almacen =
                ((r.co_alma || r.codigo_almacen || "").toString().trim()) || null;

            const descripcionRaw = r.descripcion || r.des_art || null;
            const descripcion =
                descripcionRaw !== null && descripcionRaw !== undefined
                    ? String(descripcionRaw).trim() || null
                    : null;

            const modeloRaw = r.modelo || null;
            const modelo =
                modeloRaw !== null && modeloRaw !== undefined
                    ? String(modeloRaw).trim() || null
                    : null;

            // Use || to prioritize any non-zero value across potential keys
            // Added fallbacks for Profit Plus common fields
            const precio_usd_num = Number(r.precio_usd || r.precioUsd || r.prec_vta1 || r.monto_vta1 || r.monto || 0);
            const precio_usd = Number.isFinite(precio_usd_num) ? precio_usd_num : 0;

            const precio_bs_num = Number(r.precio_bs || r.precioBs || r.montoadi1 || r.prec_vta1_bs || 0);
            const precio_bs = Number.isFinite(precio_bs_num) ? precio_bs_num : 0;

            const tasa_ref_num = Number(r.tasa_ref || r.tasaRef || r.montoadi5 || r.tasa || 0);
            const tasa_ref = Number.isFinite(tasa_ref_num) ? tasa_ref_num : 0;

            const refRaw = r.ref || null;
            const ref =
                refRaw !== null && refRaw !== undefined
                    ? String(refRaw).trim() || null
                    : null;

            const stock = Number(r.stock);

            if (!codigo_producto || !codigo_almacen || !Number.isFinite(stock)) {
                continue;
            }

            const rr = await client.query(lineSql, [
                snapshot_id,
                codigo_producto,
                codigo_almacen,
                stock,
                descripcion,
                modelo,
                ref,
                precio_usd,
                precio_bs,
                tasa_ref,
            ]);

            if (rr.rowCount === 1) inserted_lines++;
        }

        await client.query("commit");

        return res.json({
            ok: true,
            snapshot_id,
            inserted_lines,
            rows_in_payload: rows.length,
        });

    } catch (e) {
        try { await client.query("rollback"); } catch { }
        return res.status(500).json({ ok: false, error: String(e?.message || e) });
    } finally {
        client.release();
    }
});

// --------------------
// CxC lines (Accounts Receivable)
// payload: { source_db, extracted_at, lines: [] }
// writes to rg7_hist.cxc_lines
// --------------------
app.post("/api/agent/cxc_lines", requireAuth, async (req, res) => {
    const { extracted_at, lines } = req.body || {};
    if (!Array.isArray(lines)) {
        return res.status(400).json({ ok: false, error: "lines must be array" });
    }

    const source_db = (req.body?.source_db || "UNKNOWN_DB").toString().trim();

    const client = await pool.connect();
    try {
        await client.query("begin");

        const sql = `
      insert into rg7_hist.cxc_lines
      (uniq_key, fuente, sucursal, codigo_cliente, nombre_cliente,
       tipo_documento, numero_documento, fecha_emision, fecha_vencimiento,
       monto_total, saldo_pendiente, codigo_vendedor, raw, extracted_at)
      values
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14)
      on conflict (uniq_key) do update set
        saldo_pendiente = excluded.saldo_pendiente,
        extracted_at = excluded.extracted_at,
        raw = excluded.raw
      returning id
    `;

        let inserted = 0;

        for (const l of lines) {
            const tipo_doc = (l.tipo_documento || "UNKNOWN").toString().trim();
            const nro_doc = (l.numero_documento || "UNKNOWN").toString().trim();
            const sucursal = (l.sucursal || "UNKNOWN").toString().trim();

            const uniq_key = [
                source_db,
                sucursal,
                tipo_doc,
                nro_doc
            ].join("|");

            const r = await client.query(sql, [
                uniq_key,
                source_db,
                sucursal,
                l.codigo_cliente ?? null,
                l.nombre_cliente ?? null,
                tipo_doc,
                nro_doc,
                l.fecha_emision ?? null,
                l.fecha_vencimiento ?? null,
                l.monto_total ?? 0,
                l.saldo_pendiente ?? 0,
                l.codigo_vendedor ?? null,
                JSON.stringify(l),
                extracted_at ? new Date(extracted_at) : new Date(),
            ]);

            if (r.rowCount === 1) inserted++;
        }

        await client.query("commit");
        res.json({ ok: true, inserted });
    } catch (e) {
        try { await client.query("rollback"); } catch { }
        res.status(500).json({ ok: false, error: String(e?.message || e) });
    } finally {
        client.release();
    }
});

// --------------------
// API Tokens CRUD (via Supabase service_role)
// --------------------
let _sbAdmin;
async function getSbAdmin() {
  if (!_sbAdmin) {
    const { createClient } = await import('@supabase/supabase-js');
    const { default: ws } = await import('ws');
    _sbAdmin = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      { realtime: { transport: ws } }
    );
  }
  return _sbAdmin;
}

function genToken() {
  return "rg7_" + crypto.randomBytes(32).toString("hex");
}

function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

async function requireSupabaseSession(req, res, next) {
  const h = req.headers["authorization"] || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) return res.status(401).json({ ok: false, error: "missing token" });
  try {
    const sb = await getSbAdmin();
    const { data: { user }, error } = await sb.auth.getUser(token);
    if (error || !user) return res.status(401).json({ ok: false, error: "invalid session" });
    req.sessionUser = { id: user.id, email: user.email };
    next();
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

// GET /api/agent/tokens — list all tokens
app.get("/api/agent/tokens", requireSupabaseSession, async (req, res) => {
  try {
    const sb = await getSbAdmin();
    const { data, error } = await sb
      .from('api_tokens')
      .select('id, name, created_at, expires_at, last_used_at, last_ip, active, created_by')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ ok: true, tokens: data || [] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/agent/tokens — create new token
app.post("/api/agent/tokens", requireSupabaseSession, async (req, res) => {
  const { name, expires_in_days } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ ok: false, error: "name required" });
  try {
    const sb = await getSbAdmin();
    const raw = genToken();
    const hash = sha256(raw);
    const expiresAt = parseInt(expires_in_days) > 0
      ? new Date(Date.now() + parseInt(expires_in_days) * 86400000).toISOString()
      : null;
    const { error } = await sb
      .from('api_tokens')
      .insert({ name: name.trim(), token_hash: hash, expires_at: expiresAt, created_by: req.sessionUser.id });
    if (error) throw error;
    res.json({ ok: true, token: raw });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/agent/tokens/:id/regenerate
app.post("/api/agent/tokens/:id/regenerate", requireSupabaseSession, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ ok: false, error: "invalid id" });
  try {
    const sb = await getSbAdmin();
    const raw = genToken();
    const hash = sha256(raw);
    const { error } = await sb
      .from('api_tokens')
      .update({ token_hash: hash, last_used_at: null, last_ip: null })
      .eq('id', id);
    if (error) throw error;
    res.json({ ok: true, token: raw });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/agent/tokens/:id/deactivate
app.post("/api/agent/tokens/:id/deactivate", requireSupabaseSession, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ ok: false, error: "invalid id" });
  try {
    const sb = await getSbAdmin();
    const { error } = await sb.from('api_tokens').update({ active: false }).eq('id', id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/agent/tokens/:id/reactivate
app.post("/api/agent/tokens/:id/reactivate", requireSupabaseSession, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ ok: false, error: "invalid id" });
  try {
    const sb = await getSbAdmin();
    const { error } = await sb.from('api_tokens').update({ active: true }).eq('id', id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// --------------------
// Mercatech: validate API token
// --------------------
async function requireMercatechToken(req, res, next) {
  const h = req.headers["authorization"] || "";
  const raw = h.startsWith("Bearer ") ? h.slice(7) : h;
  if (!raw) return res.status(401).json({ ok: false, error: "missing token" });
  try {
    const sb = await getSbAdmin();
    const hash = sha256(raw);
    const { data, error } = await sb
      .from('api_tokens')
      .select('id, name')
      .eq('token_hash', hash)
      .eq('active', true)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(401).json({ ok: false, error: "invalid token" });
    const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '';
    await sb.from('api_tokens').update({ last_used_at: new Date().toISOString(), last_ip: ip }).eq('id', data.id);
    req.mercatechClient = data.name;
    next();
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

// POST /api/agent/mercatech/update — receive XML product update from Mercatech
app.post("/api/agent/mercatech/update", requireMercatechToken, async (req, res) => {
  let xml;
  if (req.is('xml') || req.is('text/xml')) {
    xml = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  } else {
    xml = req.body?.productos || '';
  }
  if (!xml || !xml.includes('<producto>')) {
    return res.status(400).json({ ok: false, error: "missing productos XML" });
  }
  const codeMatch = xml.match(/<codProducto>([^<]+)<\/codProducto>/);
  if (!codeMatch) return res.status(400).json({ ok: false, error: "missing codProducto in XML" });
  const codProducto = codeMatch[1].trim();
  const descMatch = xml.match(/<desProducto>([^<]*)<\/desProducto>/);
  const descripcion = descMatch ? descMatch[1].trim() : '';
  const priceMatch = xml.match(/<precioUSD>([^<]*)<\/precioUSD>/);
  const precioUSD = priceMatch ? parseFloat(priceMatch[1]) || 0 : 0;
  const qtyMatch = xml.match(/<cantidad>([^<]*)<\/cantidad>/);
  const cantidad = qtyMatch ? parseInt(qtyMatch[1]) || 0 : 0;
  const almacenes = [...xml.matchAll(/<almacen>\s*<code>([^<]+)<\/code>\s*<location>([^<]*)<\/location>\s*<qty>([^<]*)<\/qty>\s*<\/almacen>/g)];
  try {
    const sb = await getSbAdmin();
    const { data: existing } = await sb.from('products').select('codigo_producto').eq('codigo_producto', codProducto).maybeSingle();
    const upsertData = { codigo_producto: codProducto, descripcion, precio_referencia: precioUSD };
    if (almacenes.length > 0) {
      for (const a of almacenes) {
        const code = a[1].trim();
        const qty = parseInt(a[3]) || 0;
        if (code === '002' || code === 'FURIA' || code === '1') upsertData.stock_boleita = qty;
        if (code === '8' || code === 'odoo' || code === '2') upsertData.stock_sabana_grande = qty;
      }
    }
    if (existing) {
      await sb.from('products').update(upsertData).eq('codigo_producto', codProducto);
    } else {
      await sb.from('products').insert(upsertData);
    }
    res.json({ ok: true, producto: codProducto, actualizado: !!existing });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.listen(PORT, () => console.log("rg7-agent-api listening on", PORT));
