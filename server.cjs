// restaurantdp — Backend Server
// - Agent API: /api/agent/* (auth: AGENT_TOKEN)
// - Admin API: /api/agent/tokens (auth: ADMIN_API_TOKEN)
// - Data Proxy: /api/data/* (auth: ADMIN_API_TOKEN)
//   Replaces Supabase .from() calls for the frontend

require('dotenv').config();
const express = require("express");
const { Pool } = require("pg");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

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
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || "";
const JWT_SECRET = process.env.JWT_SECRET || "change_me";

// --------------------
// JWT auth
// --------------------
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

function requireJwt(req, res, next) {
  const h = req.headers["authorization"] || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) return res.status(401).json({ ok: false, error: "missing token" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: "invalid or expired token" });
  }
}

// POST /api/auth/login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "email and password required" });
    }
    const { rows } = await pool.query(
      "SELECT id, email, name, role, password_hash, is_active FROM public.users WHERE email = $1 LIMIT 1",
      [email.trim().toLowerCase()]
    );
    if (rows.length === 0) {
      return res.status(401).json({ ok: false, error: "invalid credentials" });
    }
    const user = rows[0];
    if (!user.is_active) {
      return res.status(401).json({ ok: false, error: "account disabled" });
    }
    if (!user.password_hash) {
      return res.status(401).json({ ok: false, error: "no password set" });
    }
    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ ok: false, error: "invalid credentials" });
    }
    const token = generateToken(user);
    res.json({
      ok: true,
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// GET /api/auth/session
app.get("/api/auth/session", requireJwt, async (req, res) => {
  res.json({
    ok: true,
    user: { id: req.user.id, email: req.user.email, name: req.user.name, role: req.user.role },
  });
});

// POST /api/auth/logout
app.post("/api/auth/logout", requireJwt, async (_req, res) => {
  res.json({ ok: true });
});

// --------------------
// Admin-only middleware (JWT + role=admin)
// --------------------
function requireAdmin(req, res, next) {
  requireJwt(req, res, () => {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }
    next();
  });
}

// --------------------
// Users CRUD
// --------------------

// GET /api/users — list all users (no password_hash)
app.get("/api/users", requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, email, name, role, is_active, created_at, updated_at FROM public.users ORDER BY email ASC"
    );
    res.json({ ok: true, users: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/users — create user
app.post("/api/users", requireAdmin, async (req, res) => {
  try {
    const { email, name, role, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "email and password required" });
    }
    const validRoles = ["admin", "manager", "cashier", "kitchen", "waiter"];
    const userRole = validRoles.includes(role) ? role : "waiter";
    const hash = bcrypt.hashSync(password, 10);
    const { rows } = await pool.query(
      "INSERT INTO public.users (email, name, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role, is_active, created_at, updated_at",
      [email.trim().toLowerCase(), name || email.trim().toLowerCase(), userRole, hash]
    );
    res.json({ ok: true, user: rows[0] });
  } catch (e) {
    const msg = e?.constraint === "users_email_key" ? "email already exists" : String(e?.message || e);
    res.status(400).json({ ok: false, error: msg });
  }
});

// PATCH /api/users/:id — update user (role, active, name)
app.patch("/api/users/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, is_active, password } = req.body || {};
    const sets = [];
    const params = [];
    let idx = 0;

    if (name !== undefined) { idx++; sets.push(`name = $${idx}`); params.push(name); }
    if (role !== undefined) { idx++; sets.push(`role = $${idx}`); params.push(role); }
    if (is_active !== undefined) { idx++; sets.push(`is_active = $${idx}`); params.push(is_active); }
    if (password !== undefined) { idx++; sets.push(`password_hash = $${idx}`); params.push(bcrypt.hashSync(password, 10)); }

    if (sets.length === 0) return res.status(400).json({ ok: false, error: "no fields to update" });

    idx++; params.push(id);
    const { rows } = await pool.query(
      `UPDATE public.users SET ${sets.join(", ")} WHERE id = $${idx} RETURNING id, email, name, role, is_active, created_at, updated_at`,
      params
    );
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "user not found" });
    res.json({ ok: true, user: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// DELETE /api/users/:id — deactivate user (soft delete)
app.delete("/api/users/:id", requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      "UPDATE public.users SET is_active = false WHERE id = $1 AND is_active = true",
      [req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ ok: false, error: "user not found or already inactive" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// --------------------
// Roles CRUD
// --------------------

// GET /api/roles
app.get("/api/roles", requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, label, description, is_active, created_at, updated_at FROM public.roles ORDER BY label ASC"
    );
    res.json({ ok: true, roles: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/roles
app.post("/api/roles", requireAdmin, async (req, res) => {
  try {
    const { name, label, description } = req.body || {};
    if (!name || !label) return res.status(400).json({ ok: false, error: "name and label required" });
    const { rows } = await pool.query(
      "INSERT INTO public.roles (name, label, description) VALUES ($1, $2, $3) RETURNING id, name, label, description, is_active, created_at, updated_at",
      [name.trim().toLowerCase(), label.trim(), description || null]
    );
    res.json({ ok: true, role: rows[0] });
  } catch (e) {
    const msg = e?.constraint === "roles_name_key" ? "role name already exists" : String(e?.message || e);
    res.status(400).json({ ok: false, error: msg });
  }
});

// PATCH /api/roles/:id
app.patch("/api/roles/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { label, description, is_active } = req.body || {};
    const sets = [];
    const params = [];
    let idx = 0;
    if (label !== undefined) { idx++; sets.push(`label = $${idx}`); params.push(label); }
    if (description !== undefined) { idx++; sets.push(`description = $${idx}`); params.push(description); }
    if (is_active !== undefined) { idx++; sets.push(`is_active = $${idx}`); params.push(is_active); }
    if (sets.length === 0) return res.status(400).json({ ok: false, error: "no fields to update" });
    idx++; params.push(id);
    const { rows } = await pool.query(
      `UPDATE public.roles SET ${sets.join(", ")} WHERE id = $${idx} RETURNING id, name, label, description, is_active, created_at, updated_at`,
      params
    );
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "role not found" });
    res.json({ ok: true, role: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// DELETE /api/roles/:id — soft delete
app.delete("/api/roles/:id", requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      "UPDATE public.roles SET is_active = false WHERE id = $1 AND is_active = true",
      [req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ ok: false, error: "role not found or already inactive" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// --------------------
// Auth middleware for agent
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
// Helpers
// --------------------
function genToken() {
  return "tdp_" + crypto.randomBytes(32).toString("hex");
}

function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

// --------------------
// Admin token auth middleware (replaces Supabase session)
// --------------------
function requireAdminToken(req, res, next) {
  const h = req.headers["authorization"] || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!ADMIN_API_TOKEN || token !== ADMIN_API_TOKEN) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  next();
}

// --------------------
// Mercatech: validate API token via PG
// --------------------
async function requireMercatechToken(req, res, next) {
  const h = req.headers["authorization"] || "";
  const raw = h.startsWith("Bearer ") ? h.slice(7) : h;
  if (!raw) return res.status(401).json({ ok: false, error: "missing token" });
  try {
    const hash = sha256(raw);
    const { rows } = await pool.query(
      "SELECT id, name FROM public.api_tokens WHERE token_hash = $1 AND active = true LIMIT 1",
      [hash]
    );
    if (rows.length === 0) return res.status(401).json({ ok: false, error: "invalid token" });
    const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '';
    await pool.query(
      "UPDATE public.api_tokens SET last_used_at = NOW(), last_ip = $2 WHERE id = $1",
      [rows[0].id, ip || '']
    );
    req.mercatechClient = rows[0].name;
    next();
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

// --------------------
// API Tokens CRUD (via PostgreSQL direct)
// --------------------

// GET /api/agent/tokens — list all tokens
app.get("/api/agent/tokens", requireAdminToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, created_at, expires_at, last_used_at, last_ip, active, created_by FROM public.api_tokens ORDER BY created_at DESC"
    );
    res.json({ ok: true, tokens: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/agent/tokens — create new token
app.post("/api/agent/tokens", requireAdminToken, async (req, res) => {
  const { name, expires_in_days } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ ok: false, error: "name required" });
  try {
    const raw = genToken();
    const hash = sha256(raw);
    const expiresAt = parseInt(expires_in_days) > 0
      ? new Date(Date.now() + parseInt(expires_in_days) * 86400000).toISOString()
      : null;
    await pool.query(
      "INSERT INTO public.api_tokens (name, token_hash, expires_at) VALUES ($1, $2, $3)",
      [name.trim(), hash, expiresAt]
    );
    res.json({ ok: true, token: raw });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/agent/tokens/:id/regenerate
app.post("/api/agent/tokens/:id/regenerate", requireAdminToken, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ ok: false, error: "invalid id" });
  try {
    const raw = genToken();
    const hash = sha256(raw);
    const { rowCount } = await pool.query(
      "UPDATE public.api_tokens SET token_hash = $2, last_used_at = NULL, last_ip = NULL WHERE id = $1",
      [id, hash]
    );
    if (rowCount === 0) return res.status(404).json({ ok: false, error: "token not found" });
    res.json({ ok: true, token: raw });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/agent/tokens/:id/deactivate
app.post("/api/agent/tokens/:id/deactivate", requireAdminToken, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ ok: false, error: "invalid id" });
  try {
    const { rowCount } = await pool.query(
      "UPDATE public.api_tokens SET active = false WHERE id = $1",
      [id]
    );
    if (rowCount === 0) return res.status(404).json({ ok: false, error: "token not found" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/agent/tokens/:id/reactivate
app.post("/api/agent/tokens/:id/reactivate", requireAdminToken, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ ok: false, error: "invalid id" });
  try {
    const { rowCount } = await pool.query(
      "UPDATE public.api_tokens SET active = true WHERE id = $1",
      [id]
    );
    if (rowCount === 0) return res.status(404).json({ ok: false, error: "token not found" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// --------------------
// Mercatech: receive XML product update
// --------------------
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
    const { rows: existing } = await pool.query(
      "SELECT codigo_producto FROM public.products WHERE codigo_producto = $1 LIMIT 1",
      [codProducto]
    );
    const upsertData = { codigo_producto: codProducto, descripcion, precio_referencia: precioUSD };
    if (almacenes.length > 0) {
      for (const a of almacenes) {
        const code = a[1].trim();
        const qty = parseInt(a[3]) || 0;
        if (code === '002' || code === 'FURIA' || code === '1') upsertData.stock_boleita = qty;
        if (code === '8' || code === 'odoo' || code === '2') upsertData.stock_sabana_grande = qty;
      }
    }
    if (existing.length > 0) {
      await pool.query(
        "UPDATE public.products SET descripcion = $2, precio_referencia = $3, stock_boleita = $4, stock_sabana_grande = $5 WHERE codigo_producto = $1",
        [codProducto, upsertData.descripcion, upsertData.precio_referencia, upsertData.stock_boleita || 0, upsertData.stock_sabana_grande || 0]
      );
    } else {
      await pool.query(
        "INSERT INTO public.products (codigo_producto, descripcion, precio_referencia, stock_boleita, stock_sabana_grande) VALUES ($1, $2, $3, $4, $5)",
        [codProducto, upsertData.descripcion, upsertData.precio_referencia, upsertData.stock_boleita || 0, upsertData.stock_sabana_grande || 0]
      );
    }
    res.json({ ok: true, producto: codProducto, actualizado: existing.length > 0 });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// =============================================================================
// Generic Data Proxy (replaces Supabase .from() calls)
// =============================================================================

const DATA_TABLES_ALLOWED = [
  'accounts_payable', 'attendance_logs', 'bank_accounts', 'bank_initial_balances',
  'bank_transfers', 'banks', 'brands', 'cashea_installments', 'couriers', 'customers',
  'daily_rates', 'deliveries', 'delivery_zones', 'expense_recipients', 'expenses',
  'fordmac_config', 'income_lines', 'income_payments', 'incomes', 'inventory_movements',
  'payable_payments', 'physical_inventory', 'physical_inventory_lines', 'products',
  'purchase_lines', 'purchase_order_lines', 'purchase_orders', 'sellers',
  'stock_snapshot_lines', 'stock_snapshots', 'suppliers', 'support_messages',
  'support_tickets', 'sync_logs', 'transfer_drafts', 'transferencias_internas_v4',
  'user_roles', 'v_envios_nacionales', 'v_latest_stock_by_branch',
  'v_sales_filters', 'v_sales_lines', 'v_support_tickets', 'v_transferencias_final_v4',
  'vw_inventory_dashboard_stats', 'vw_inventory_top_discrepancias',
  'wa_conversations', 'wa_instances', 'wa_messages', 'wa_quick_replies',
];

function sanitizeIdent(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/[^a-z0-9_]/gi, '');
}

function requireDataAuth(req, res, next) {
  const h = req.headers["authorization"] || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!ADMIN_API_TOKEN || token !== ADMIN_API_TOKEN) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  next();
}

// GET /api/data/:table — list rows with filters
app.get("/api/data/:table", requireDataAuth, async (req, res) => {
  const { table } = req.params;
  if (!DATA_TABLES_ALLOWED.includes(table)) {
    return res.status(403).json({ ok: false, error: "table not allowed" });
  }

  try {
    const safeTable = sanitizeIdent(table);
    let selectCols = '*';
    if (req.query.select) {
      const cols = req.query.select.split(',').map(c => sanitizeIdent(c.trim())).filter(Boolean);
      if (cols.length > 0) selectCols = cols.join(', ');
    }

    let sql = `SELECT ${selectCols} FROM public.${safeTable}`;
    const params = [];
    const conditions = [];
    const orderClauses = [];
    let limitVal = null;
    let offsetVal = null;
    let countExact = req.query.count === 'exact';

    for (const [key, value] of Object.entries(req.query)) {
      if (['select', 'order', 'limit', 'offset', 'single', 'count', 'range_start', 'range_end', 'id_col'].includes(key)) continue;

      if (key.startsWith('eq_')) {
        const col = sanitizeIdent(key.slice(3));
        if (col) { conditions.push(`${col} = $${params.length + 1}`); params.push(value); }
      } else if (key.startsWith('neq_')) {
        const col = sanitizeIdent(key.slice(4));
        if (col) { conditions.push(`${col} != $${params.length + 1}`); params.push(value); }
      } else if (key.startsWith('in_')) {
        const col = sanitizeIdent(key.slice(3));
        if (col && value) {
          const vals = value.split(',').map(v => v.trim()).filter(Boolean);
          if (vals.length > 0) {
            const placeholders = vals.map(v => { params.push(v); return `$${params.length}`; });
            conditions.push(`${col} IN (${placeholders.join(',')})`);
          }
        }
      } else if (key.startsWith('gt_')) {
        const col = sanitizeIdent(key.slice(3));
        if (col) { conditions.push(`${col} > $${params.length + 1}`); params.push(value); }
      } else if (key.startsWith('gte_')) {
        const col = sanitizeIdent(key.slice(4));
        if (col) { conditions.push(`${col} >= $${params.length + 1}`); params.push(value); }
      } else if (key.startsWith('lt_')) {
        const col = sanitizeIdent(key.slice(3));
        if (col) { conditions.push(`${col} < $${params.length + 1}`); params.push(value); }
      } else if (key.startsWith('lte_')) {
        const col = sanitizeIdent(key.slice(4));
        if (col) { conditions.push(`${col} <= $${params.length + 1}`); params.push(value); }
      } else if (key.startsWith('ilike_')) {
        const col = sanitizeIdent(key.slice(6));
        if (col) { conditions.push(`${col} ILIKE $${params.length + 1}`); params.push(value); }
      } else if (key.startsWith('is_')) {
        const col = sanitizeIdent(key.slice(3));
        if (col) { conditions.push(`${col} IS ${value === 'null' ? 'NULL' : value}`); }
      }
    }

    if (req.query.order) {
      const parts = Array.isArray(req.query.order) ? req.query.order : [req.query.order];
      for (const o of parts) {
        const [col, dir] = o.split('.');
        const sc = sanitizeIdent(col);
        if (sc) orderClauses.push(`${sc} ${dir === 'desc' ? 'DESC' : 'ASC'}`);
      }
    }

    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    if (orderClauses.length > 0) sql += ' ORDER BY ' + orderClauses.join(', ');

    if (req.query.limit) limitVal = parseInt(req.query.limit);
    if (req.query.range_start && req.query.range_end) {
      const start = parseInt(req.query.range_start);
      const end = parseInt(req.query.range_end);
      limitVal = end - start + 1;
      offsetVal = start;
    }
    if (req.query.offset) offsetVal = parseInt(req.query.offset);
    if (limitVal) sql += ` LIMIT ${limitVal}`;
    if (offsetVal) sql += ` OFFSET ${offsetVal}`;

    let count = null;
    if (countExact) {
      const countSql = `SELECT COUNT(*) FROM public.${safeTable}${conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : ''}`;
      const countResult = await pool.query(countSql, params);
      count = parseInt(countResult.rows[0].count);
    }

    const { rows } = await pool.query(sql, params);

    if (req.query.single === 'true') {
      return res.json({ ok: true, data: rows[0] || null });
    }

    const result = { ok: true, data: rows };
    if (count !== null) result.count = count;
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/data/:table — insert row(s)
app.post("/api/data/:table", requireDataAuth, async (req, res) => {
  const { table } = req.params;
  if (!DATA_TABLES_ALLOWED.includes(table)) {
    return res.status(403).json({ ok: false, error: "table not allowed" });
  }

  try {
    const safeTable = sanitizeIdent(table);
    const body = req.body;
    const isArray = Array.isArray(body);
    const rows = isArray ? body : [body];

    if (rows.length === 0) return res.status(400).json({ ok: false, error: "empty body" });

    const cols = Object.keys(rows[0]);
    const safeCols = cols.map(c => sanitizeIdent(c)).filter(Boolean);

    const allParams = [];
    const valuePlaceholders = rows.map(row => {
      return '(' + safeCols.map((c, i) => {
        allParams.push(row[cols[i]]);
        return `$${allParams.length}`;
      }).join(',') + ')';
    });

    let sql = `INSERT INTO public.${safeTable} (${safeCols.join(',')}) VALUES ${valuePlaceholders.join(',')}`;
    if (req.query.select === 'true' || req.query.returning) {
      sql += ' RETURNING *';
    }

    const { rows: inserted } = await pool.query(sql, allParams);
    res.json({ ok: true, data: isArray ? inserted : (inserted[0] || rows[0]) });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// PATCH /api/data/:table/:id — update row by id
app.patch("/api/data/:table/:id", requireDataAuth, async (req, res) => {
  const { table, id } = req.params;
  if (!DATA_TABLES_ALLOWED.includes(table)) {
    return res.status(403).json({ ok: false, error: "table not allowed" });
  }

  try {
    const safeTable = sanitizeIdent(table);
    const idCol = sanitizeIdent(req.query.id_col || 'id');
    if (!idCol) return res.status(400).json({ ok: false, error: "invalid id_col" });

    const body = req.body;
    const cols = Object.keys(body);
    if (cols.length === 0) return res.status(400).json({ ok: false, error: "empty body" });

    const params = [];
    const setClauses = cols.map(c => {
      const sc = sanitizeIdent(c);
      params.push(body[c]);
      return `${sc} = $${params.length}`;
    });
    params.push(id);

    const sql = `UPDATE public.${safeTable} SET ${setClauses.join(',')} WHERE ${idCol} = $${params.length} RETURNING *`;
    const { rows: updated } = await pool.query(sql, params);
    res.json({ ok: true, data: updated[0] || null });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// DELETE /api/data/:table/:id — delete row by id
app.delete("/api/data/:table/:id", requireDataAuth, async (req, res) => {
  const { table, id } = req.params;
  if (!DATA_TABLES_ALLOWED.includes(table)) {
    return res.status(403).json({ ok: false, error: "table not allowed" });
  }

  try {
    const safeTable = sanitizeIdent(table);
    const idCol = sanitizeIdent(req.query.id_col || 'id');
    if (!idCol) return res.status(400).json({ ok: false, error: "invalid id_col" });

    const { rowCount } = await pool.query(
      `DELETE FROM public.${safeTable} WHERE ${idCol} = $1`,
      [id]
    );
    res.json({ ok: true, deleted: rowCount });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// =============================================================================
// Start server
// =============================================================================
app.listen(PORT, () => console.log("restaurantdp-server listening on", PORT));
