// tdpadmin — Backend Server
// - Agent API: /api/agent/* (auth: AGENT_TOKEN)
// - Admin API: /api/agent/tokens (auth: ADMIN_API_TOKEN)
// - Data Proxy: /api/data/* (auth: ADMIN_API_TOKEN)
// - TDP Admin Auth: /api/tdp/auth/* (tdpadmin.users schema)

require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, Content-Type, Accept, Authorization",
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (_req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
const PORT = process.env.PORT || 3003;
const AGENT_TOKEN = process.env.AGENT_TOKEN || "";
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || "";
const PUBLIC_API_TOKEN = process.env.PUBLIC_API_TOKEN || "tdp_public_default";
const JWT_SECRET = process.env.JWT_SECRET || "change_me";

// --------------------
// JWT auth
// --------------------
function generateToken(user, permissions) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      permissions: permissions || {},
    },
    JWT_SECRET,
    { expiresIn: "24h" },
  );
}

function requireJwt(req, res, next) {
  const h = req.headers["authorization"] || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token)
    return res.status(401).json({ ok: false, error: "missing token" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res
      .status(401)
      .json({ ok: false, error: "invalid or expired token" });
  }
}

// POST /api/auth/login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ ok: false, error: "email and password required" });
    }
    const { rows } = await pool.query(
      "SELECT id, email, name, role, password_hash, is_active FROM public.users WHERE email = $1 LIMIT 1",
      [email.trim().toLowerCase()],
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
    // Fetch role permissions
    let permissions = {};
    try {
      const { rows: roleRows } = await pool.query(
        "SELECT permissions FROM public.roles WHERE name = $1 AND is_active = true LIMIT 1",
        [user.role],
      );
      if (roleRows.length > 0) permissions = roleRows[0].permissions || {};
    } catch {}
    const token = generateToken(user, permissions);
    res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions,
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// GET /api/auth/session
app.get("/api/auth/session", requireJwt, async (req, res) => {
  // Fetch latest permissions from DB in case role was updated
  let permissions = req.user.permissions || {};
  try {
    const { rows } = await pool.query(
      "SELECT permissions FROM public.roles WHERE name = $1 AND is_active = true LIMIT 1",
      [req.user.role],
    );
    if (rows.length > 0) permissions = rows[0].permissions || {};
  } catch {}
  res.json({
    ok: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      permissions,
    },
  });
});

// POST /api/auth/logout
app.post("/api/auth/logout", requireJwt, async (_req, res) => {
  res.json({ ok: true });
});

// --------------------
// TDP Admin Auth (tdpadmin.users)
// --------------------

function generateTDPToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.full_name,
      tdp: true,
    },
    JWT_SECRET,
    { expiresIn: "24h" },
  );
}

function requireTDPAuth(req, res, next) {
  const h = req.headers["authorization"] || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token)
    return res.status(401).json({ ok: false, error: "missing token" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.tdp)
      return res.status(401).json({ ok: false, error: "invalid token" });
    req.tdpUser = decoded;
    next();
  } catch (e) {
    return res
      .status(401)
      .json({ ok: false, error: "invalid or expired token" });
  }
}

// POST /api/tdp/auth/register
app.post("/api/tdp/auth/register", async (req, res) => {
  try {
    const { email, password, full_name, role } = req.body || {};
    if (!email || !password)
      return res
        .status(400)
        .json({ ok: false, error: "email and password required" });
    const hash = bcrypt.hashSync(password, 10);
    const { rows } = await tdpPool.query(
      `INSERT INTO tdpadmin.users (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, role, status, created_at`,
      [email.trim().toLowerCase(), hash, full_name || "", role || "staff"],
    );
    const user = rows[0];
    const token = generateTDPToken(user);
    res.json({ ok: true, token, user });
  } catch (e) {
    const msg =
      e?.constraint === "tdpadmin_users_email_key"
        ? "email already exists"
        : String(e?.message || e);
    res.status(400).json({ ok: false, error: msg });
  }
});

// POST /api/tdp/auth/login
app.post("/api/tdp/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res
        .status(400)
        .json({ ok: false, error: "email and password required" });
    const { rows } = await tdpPool.query(
      "SELECT id, email, password_hash, full_name, role, status FROM tdpadmin.users WHERE email = $1 LIMIT 1",
      [email.trim().toLowerCase()],
    );
    if (rows.length === 0)
      return res.status(401).json({ ok: false, error: "invalid credentials" });
    const user = rows[0];
    if (user.status !== "active")
      return res
        .status(401)
        .json({ ok: false, error: "account is not active" });
    if (!bcrypt.compareSync(password, user.password_hash))
      return res.status(401).json({ ok: false, error: "invalid credentials" });
    await tdpPool.query(
      "UPDATE tdpadmin.users SET last_login_at = NOW() WHERE id = $1",
      [user.id],
    );
    const token = generateTDPToken(user);
    res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// GET /api/tdp/auth/me
app.get("/api/tdp/auth/me", requireTDPAuth, async (req, res) => {
  try {
    const { rows } = await tdpPool.query(
      "SELECT id, email, full_name, role, status, last_login_at, created_at FROM tdpadmin.users WHERE id = $1",
      [req.tdpUser.id],
    );
    if (rows.length === 0)
      return res.status(404).json({ ok: false, error: "user not found" });
    res.json({ ok: true, user: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/tdp/auth/logout
app.post("/api/tdp/auth/logout", requireTDPAuth, async (_req, res) => {
  res.json({ ok: true });
});

// --------------------
// TDP Admin Exchange Rates
// --------------------

// GET /api/tdp/exchange-rates/latest
app.get("/api/tdp/exchange-rates/latest", requireTDPAuth, async (req, res) => {
  try {
    const { rows } = await tdpPool.query(
      "SELECT * FROM tdpadmin.exchange_rates ORDER BY rate_date DESC, created_at DESC LIMIT 1",
    );
    res.json({ ok: true, rate: rows[0] || null });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// GET /api/tdp/exchange-rates
app.get("/api/tdp/exchange-rates", requireTDPAuth, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const { rows } = await tdpPool.query(
      "SELECT * FROM tdpadmin.exchange_rates ORDER BY rate_date DESC LIMIT $1",
      [limit],
    );
    res.json({ ok: true, rates: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/tdp/exchange-rates
app.post("/api/tdp/exchange-rates", requireTDPAuth, async (req, res) => {
  try {
    const { rate_date, currency, rate, source, notes } = req.body || {};
    if (!rate_date)
      return res.status(400).json({ ok: false, error: "rate_date required" });
    const rateNum = Number(rate);
    if (!rateNum || rateNum <= 0)
      return res
        .status(400)
        .json({ ok: false, error: "rate must be a positive number" });
    const { rows } = await tdpPool.query(
      `INSERT INTO tdpadmin.exchange_rates (rate_date, currency, rate, source, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (rate_date, currency) DO UPDATE SET rate = EXCLUDED.rate, source = EXCLUDED.source, notes = EXCLUDED.notes, created_by = EXCLUDED.created_by
       RETURNING *`,
      [
        rate_date,
        (currency || "USD").toUpperCase(),
        rateNum,
        source || "manual",
        notes || "",
        req.tdpUser.id,
      ],
    );
    res.json({ ok: true, rate: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// --------------------
// TDP Admin Support
// --------------------

function isInternalRole(role) {
  return [
    "superadmin",
    "admin",
    "director",
    "project_manager",
    "developer",
    "support",
  ].includes(role);
}

// GET /api/tdp/support/tickets
app.get("/api/tdp/support/tickets", requireTDPAuth, async (req, res) => {
  try {
    const isInternal = isInternalRole(req.tdpUser.role);
    let sql = `SELECT t.*, c.name AS client_name, 
      u_assigned.email AS assigned_email, u_creator.email AS created_by_email
      FROM tdpadmin.support_tickets t
      LEFT JOIN tdpadmin.clients c ON c.id = t.client_id
      LEFT JOIN tdpadmin.users u_assigned ON u_assigned.id = t.assigned_to
      LEFT JOIN tdpadmin.users u_creator ON u_creator.id = t.created_by
      WHERE 1=1`;
    const params = [];

    if (!isInternal) {
      params.push(req.tdpUser.client_id);
      sql += ` AND t.client_id = $${params.length}`;
    }

    for (const key of ["status", "priority", "client_id", "assigned_to"]) {
      if (req.query[key]) {
        params.push(req.query[key]);
        sql += ` AND t.${key} = $${params.length}`;
      }
    }

    if (req.query.search) {
      params.push(`%${req.query.search}%`);
      sql += ` AND (t.title ILIKE $${params.length} OR t.ticket_number ILIKE $${params.length})`;
    }

    sql += " ORDER BY t.created_at DESC LIMIT 100";
    const { rows } = await tdpPool.query(sql, params);
    res.json({ ok: true, tickets: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/tdp/support/tickets
app.post("/api/tdp/support/tickets", requireTDPAuth, async (req, res) => {
  try {
    const { client_id, project_id, title, description, priority, category } =
      req.body || {};
    if (!title)
      return res.status(400).json({ ok: false, error: "title required" });

    let targetClientId = client_id;
    if (req.tdpUser.role === "client") {
      targetClientId = req.tdpUser.client_id;
    }
    if (!targetClientId)
      return res.status(400).json({ ok: false, error: "client_id required" });

    const { rows } = await tdpPool.query(
      `INSERT INTO tdpadmin.support_tickets (client_id, project_id, title, description, priority, category, source, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,'portal',$7) RETURNING *`,
      [
        targetClientId,
        project_id || null,
        title,
        description || "",
        priority || "normal",
        category || "general",
        req.tdpUser.id,
      ],
    );
    res.json({ ok: true, ticket: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// GET /api/tdp/support/tickets/:id
app.get("/api/tdp/support/tickets/:id", requireTDPAuth, async (req, res) => {
  try {
    const { rows } = await tdpPool.query(
      `SELECT t.*, c.name AS client_name, c.email AS client_email,
        u_assigned.email AS assigned_email, u_creator.email AS created_by_email
       FROM tdpadmin.support_tickets t
       LEFT JOIN tdpadmin.clients c ON c.id = t.client_id
       LEFT JOIN tdpadmin.users u_assigned ON u_assigned.id = t.assigned_to
       LEFT JOIN tdpadmin.users u_creator ON u_creator.id = t.created_by
       WHERE t.id = $1`,
      [req.params.id],
    );
    if (rows.length === 0)
      return res.status(404).json({ ok: false, error: "ticket not found" });
    const ticket = rows[0];

    // Client can only see own tickets
    if (
      req.tdpUser.role === "client" &&
      ticket.client_id !== req.tdpUser.client_id
    ) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    // Messages: client cannot see is_internal
    let msgSql =
      "SELECT * FROM tdpadmin.support_ticket_messages WHERE ticket_id = $1";
    if (req.tdpUser.role === "client") msgSql += " AND is_internal = false";
    msgSql += " ORDER BY created_at ASC";
    const { rows: messages } = await tdpPool.query(msgSql, [req.params.id]);

    res.json({ ok: true, ticket: { ...ticket, messages } });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// PATCH /api/tdp/support/tickets/:id
app.patch("/api/tdp/support/tickets/:id", requireTDPAuth, async (req, res) => {
  try {
    const isInternal = isInternalRole(req.tdpUser.role);
    const allowedFields = isInternal
      ? [
          "status",
          "priority",
          "assigned_to",
          "category",
          "project_id",
          "title",
          "description",
        ]
      : ["title", "description"];

    const sets = [];
    const params = [];
    let idx = 0;
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        idx++;
        sets.push(`${key} = $${idx}`);
        params.push(req.body[key]);
      }
    }
    if (req.body.status === "closed" || req.body.status === "resolved") {
      idx++;
      sets.push(`closed_at = $${idx}`);
      params.push(new Date().toISOString());
    }
    if (sets.length === 0)
      return res.status(400).json({ ok: false, error: "no valid fields" });

    idx++;
    params.push(req.params.id);
    const { rows } = await tdpPool.query(
      `UPDATE tdpadmin.support_tickets SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      params,
    );
    if (rows.length === 0)
      return res.status(404).json({ ok: false, error: "not found" });
    res.json({ ok: true, ticket: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/tdp/support/tickets/:id/messages
app.post(
  "/api/tdp/support/tickets/:id/messages",
  requireTDPAuth,
  async (req, res) => {
    try {
      const { message, is_internal } = req.body || {};
      if (!message)
        return res.status(400).json({ ok: false, error: "message required" });

      // Verify ticket access
      const { rows: ticketRows } = await tdpPool.query(
        "SELECT id, client_id, status FROM tdpadmin.support_tickets WHERE id = $1",
        [req.params.id],
      );
      if (ticketRows.length === 0)
        return res.status(404).json({ ok: false, error: "ticket not found" });
      const ticket = ticketRows[0];
      if (
        req.tdpUser.role === "client" &&
        ticket.client_id !== req.tdpUser.client_id
      ) {
        return res.status(403).json({ ok: false, error: "forbidden" });
      }

      const canInternal = isInternalRole(req.tdpUser.role);
      const internalFlag = canInternal ? is_internal === true : false;
      const authorType = req.tdpUser.role === "client" ? "client" : "internal";

      const { rows } = await tdpPool.query(
        `INSERT INTO tdpadmin.support_ticket_messages (ticket_id, author_id, author_type, message, is_internal)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [req.params.id, req.tdpUser.id, authorType, message, internalFlag],
      );

      // Auto-update status based on who replied
      if (req.tdpUser.role === "client" && ticket.status === "waiting_client") {
        await tdpPool.query(
          "UPDATE tdpadmin.support_tickets SET status = 'open' WHERE id = $1",
          [req.params.id],
        );
      } else if (authorType === "internal" && ticket.status === "open") {
        await tdpPool.query(
          "UPDATE tdpadmin.support_tickets SET status = 'in_progress' WHERE id = $1",
          [req.params.id],
        );
      }

      res.json({ ok: true, message: rows[0] });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  },
);

// POST /api/tdp/clients/:clientId/users — create client user
app.post(
  "/api/tdp/clients/:clientId/users",
  requireTDPAuth,
  async (req, res) => {
    if (!isInternalRole(req.tdpUser.role))
      return res.status(403).json({ ok: false, error: "forbidden" });
    try {
      const { email, password, full_name } = req.body || {};
      if (!email || !password)
        return res
          .status(400)
          .json({ ok: false, error: "email and password required" });
      const hash = bcrypt.hashSync(password, 10);
      const { rows } = await tdpPool.query(
        `INSERT INTO tdpadmin.users (email, password_hash, full_name, role, client_id)
       VALUES ($1,$2,$3,'client',$4) RETURNING id, email, full_name, role, client_id, created_at`,
        [
          email.trim().toLowerCase(),
          hash,
          full_name || email,
          req.params.clientId,
        ],
      );
      res.json({ ok: true, user: rows[0] });
    } catch (e) {
      const msg =
        e?.constraint === "tdpadmin_users_email_key"
          ? "email already exists"
          : String(e?.message || e);
      res.status(400).json({ ok: false, error: msg });
    }
  },
);

// GET /api/tdp/clients — list clients for internal users
app.get("/api/tdp/clients", requireTDPAuth, async (req, res) => {
  if (!isInternalRole(req.tdpUser.role))
    return res.status(403).json({ ok: false, error: "forbidden" });
  try {
    const { rows } = await tdpPool.query(
      "SELECT id, name, email, phone, status FROM tdpadmin.clients ORDER BY name ASC",
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// --------------------
// TDP CRM
// --------------------

function requireCRMAccess(req, res, next) {
  if (
    ![
      "superadmin",
      "admin",
      "director",
      "project_manager",
      "sales",
      "support",
      "staff",
    ].includes(req.tdpUser.role)
  ) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }
  next();
}

// GET /api/tdp/crm/clients
app.get(
  "/api/tdp/crm/clients",
  requireTDPAuth,
  requireCRMAccess,
  async (req, res) => {
    try {
      let sql = `SELECT c.*, u.email AS assigned_email
      FROM tdpadmin.clients c
      LEFT JOIN tdpadmin.users u ON u.id = c.assigned_to
      WHERE 1=1`;
      const params = [];
      for (const key of ["kind", "status", "assigned_to", "source"]) {
        if (req.query[key]) {
          params.push(req.query[key]);
          sql += ` AND c.${key} = $${params.length}`;
        }
      }
      if (req.query.search) {
        params.push(`%${req.query.search}%`);
        sql += ` AND (c.name ILIKE $${params.length} OR c.email ILIKE $${params.length} OR c.phone ILIKE $${params.length} OR c.company_name ILIKE $${params.length})`;
      }
      sql += " ORDER BY c.updated_at DESC LIMIT 200";
      const { rows } = await tdpPool.query(sql, params);
      res.json({ ok: true, clients: rows });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  },
);

// GET /api/tdp/crm/clients/:id
app.get("/api/tdp/crm/clients/:id", requireTDPAuth, async (req, res) => {
  if (req.tdpUser.role === "client")
    return res.status(403).json({ ok: false, error: "forbidden" });
  try {
    const { rows } = await tdpPool.query(
      "SELECT * FROM tdpadmin.clients WHERE id = $1",
      [req.params.id],
    );
    if (rows.length === 0)
      return res.status(404).json({ ok: false, error: "not found" });
    res.json({ ok: true, client: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/tdp/crm/clients
app.post(
  "/api/tdp/crm/clients",
  requireTDPAuth,
  requireCRMAccess,
  async (req, res) => {
    try {
      const {
        name,
        email,
        phone,
        kind,
        status,
        source,
        interest,
        estimated_budget,
        assigned_to,
        company_name,
        contact_name,
        whatsapp,
        city,
        notes,
      } = req.body || {};
      if (!name)
        return res.status(400).json({ ok: false, error: "name required" });
      const { rows } = await tdpPool.query(
        `INSERT INTO tdpadmin.clients (name, email, phone, kind, status, source, interest, estimated_budget, assigned_to, company_name, contact_name, whatsapp, city, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [
          name,
          email || "",
          phone || "",
          kind || "prospect",
          status || "lead",
          source || "otro",
          interest || "",
          estimated_budget || null,
          assigned_to || req.tdpUser.id,
          company_name || "",
          contact_name || "",
          whatsapp || "",
          city || "",
          notes || "",
          req.tdpUser.id,
        ],
      );
      res.json({ ok: true, client: rows[0] });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  },
);

// PATCH /api/tdp/crm/clients/:id
app.patch(
  "/api/tdp/crm/clients/:id",
  requireTDPAuth,
  requireCRMAccess,
  async (req, res) => {
    try {
      const sets = [];
      const params = [];
      let idx = 0;
      const allowed = [
        "name",
        "email",
        "phone",
        "whatsapp",
        "instagram",
        "kind",
        "status",
        "source",
        "interest",
        "estimated_budget",
        "assigned_to",
        "company_name",
        "contact_name",
        "position",
        "country",
        "city",
        "address",
        "website",
        "next_follow_up",
        "lost_reason",
        "tags",
        "notes",
      ];
      for (const key of allowed) {
        if (req.body[key] !== undefined) {
          idx++;
          sets.push(`${key} = $${idx}`);
          params.push(req.body[key]);
        }
      }
      if (sets.length === 0)
        return res.status(400).json({ ok: false, error: "no fields" });
      idx++;
      params.push(req.params.id);
      const { rows } = await tdpPool.query(
        `UPDATE tdpadmin.clients SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
        params,
      );
      if (rows.length === 0)
        return res.status(404).json({ ok: false, error: "not found" });
      res.json({ ok: true, client: rows[0] });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  },
);

// DELETE /api/tdp/crm/clients/:id — soft delete
app.delete(
  "/api/tdp/crm/clients/:id",
  requireTDPAuth,
  requireCRMAccess,
  async (req, res) => {
    try {
      const { rowCount } = await tdpPool.query(
        "UPDATE tdpadmin.clients SET status = 'inactive' WHERE id = $1 AND status != 'inactive'",
        [req.params.id],
      );
      if (rowCount === 0)
        return res.status(404).json({ ok: false, error: "not found" });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  },
);

// --------------------
// TDP Quotes
// --------------------

// GET /api/tdp/quotes
app.get("/api/tdp/quotes", requireTDPAuth, async (req, res) => {
  try {
    let sql = `SELECT q.*, c.name AS client_name
      FROM tdpadmin.quotes q
      LEFT JOIN tdpadmin.clients c ON c.id = q.client_id
      WHERE 1=1`;
    const params = [];
    for (const key of ["status", "client_id"]) {
      if (req.query[key]) {
        params.push(req.query[key]);
        sql += ` AND q.${key} = $${params.length}`;
      }
    }
    if (req.query.search) {
      params.push(`%${req.query.search}%`);
      sql += ` AND (q.quote_number ILIKE $${params.length} OR q.title ILIKE $${params.length})`;
    }
    if (req.tdpUser.role === "client") {
      params.push(req.tdpUser.client_id);
      sql += ` AND q.client_id = $${params.length}`;
    }
    sql += " ORDER BY q.created_at DESC LIMIT 100";
    const { rows } = await tdpPool.query(sql, params);
    res.json({ ok: true, quotes: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// GET /api/tdp/quotes/:id
app.get("/api/tdp/quotes/:id", requireTDPAuth, async (req, res) => {
  try {
    const { rows } = await tdpPool.query(
      `SELECT q.*, c.name AS client_name, c.email AS client_email, c.phone AS client_phone
       FROM tdpadmin.quotes q
       LEFT JOIN tdpadmin.clients c ON c.id = q.client_id
       WHERE q.id = $1`,
      [req.params.id],
    );
    if (rows.length === 0)
      return res.status(404).json({ ok: false, error: "not found" });
    const { rows: items } = await tdpPool.query(
      "SELECT * FROM tdpadmin.quote_items WHERE quote_id = $1 ORDER BY display_order ASC, created_at ASC",
      [req.params.id],
    );
    res.json({ ok: true, quote: { ...rows[0], items } });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

function calcQuoteTotals(items) {
  const subtotal = (items || []).reduce(
    (s, it) => s + Number(it.quantity || 1) * Number(it.unit_price || 0),
    0,
  );
  return { subtotal };
}

// POST /api/tdp/quotes
app.post("/api/tdp/quotes", requireTDPAuth, async (req, res) => {
  try {
    const {
      client_id,
      project_id,
      title,
      currency,
      exchange_rate,
      discount,
      notes,
      terms,
      valid_until,
      items,
    } = req.body || {};
    if (!client_id)
      return res.status(400).json({ ok: false, error: "client_id required" });

    const { subtotal } = calcQuoteTotals(items);
    const disc = Number(discount || 0);
    const total = subtotal - disc;

    const client = await tdpPool.connect();
    try {
      await client.query("BEGIN");
      // Generate number manually since default may already be consumed
      const {
        rows: [seq],
      } = await client.query(
        "SELECT nextval('tdpadmin.seq_quote_number_v2') AS num",
      );
      const num = String(seq.num).padStart(5, "0");
      const yymm = new Date().toISOString().slice(0, 7).replace("-", "");
      const quoteNumber = `PRE-${yymm}-${num}`;

      const { rows: quoteRows } = await client.query(
        `INSERT INTO tdpadmin.quotes (quote_number, client_id, project_id, title, currency, exchange_rate, subtotal, discount, total, notes, terms, valid_until, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [
          quoteNumber,
          client_id,
          project_id || null,
          title || "",
          currency || "USD",
          exchange_rate || null,
          subtotal,
          disc,
          total,
          notes || "",
          terms || "",
          valid_until || null,
          req.tdpUser.id,
        ],
      );

      if (Array.isArray(items)) {
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          const totalLine =
            (Number(it.quantity) || 1) * (Number(it.unit_price) || 0);
          await client.query(
            `INSERT INTO tdpadmin.quote_items (quote_id, item_type, description, quantity, unit_price, total_price, display_order)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [
              quoteRows[0].id,
              it.item_type || "service",
              it.description || "",
              Number(it.quantity) || 1,
              Number(it.unit_price) || 0,
              totalLine,
              i,
            ],
          );
        }
      }

      await client.query("COMMIT");
      const { rows: full } = await tdpPool.query(
        "SELECT * FROM tdpadmin.quotes WHERE id = $1",
        [quoteRows[0].id],
      );
      res.json({ ok: true, quote: full[0] });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// PATCH /api/tdp/quotes/:id
app.patch("/api/tdp/quotes/:id", requireTDPAuth, async (req, res) => {
  try {
    const { items, ...fields } = req.body;
    const client = await tdpPool.connect();
    try {
      await client.query("BEGIN");
      // Update header fields
      const fieldKeys = Object.keys(fields).filter((k) =>
        [
          "title",
          "client_id",
          "project_id",
          "currency",
          "exchange_rate",
          "discount",
          "notes",
          "terms",
          "valid_until",
          "status",
        ].includes(k),
      );
      if (fieldKeys.length > 0) {
        const sets = [];
        const params = [];
        let idx = 0;
        for (const key of fieldKeys) {
          idx++;
          sets.push(`${key} = $${idx}`);
          params.push(fields[key]);
        }
        params.push(req.params.id);
        await client.query(
          `UPDATE tdpadmin.quotes SET ${sets.join(", ")} WHERE id = $${idx + 1}`,
          params,
        );
      }
      // Replace items
      if (Array.isArray(items)) {
        await client.query(
          "DELETE FROM tdpadmin.quote_items WHERE quote_id = $1",
          [req.params.id],
        );
        let subtotal = 0;
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          const totalLine =
            (Number(it.quantity) || 1) * (Number(it.unit_price) || 0);
          subtotal += totalLine;
          await client.query(
            `INSERT INTO tdpadmin.quote_items (quote_id, item_type, description, quantity, unit_price, total_price, display_order)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [
              req.params.id,
              it.item_type || "service",
              it.description || "",
              Number(it.quantity) || 1,
              Number(it.unit_price) || 0,
              totalLine,
              i,
            ],
          );
        }
        const disc = Number(fields.discount || req.body.discount || 0);
        await client.query(
          "UPDATE tdpadmin.quotes SET subtotal = $1, total = $2 WHERE id = $3",
          [subtotal, subtotal - disc, req.params.id],
        );
      }
      // Handle status changes
      if (fields.status === "approved") {
        await client.query(
          "UPDATE tdpadmin.quotes SET approved_at = NOW() WHERE id = $1",
          [req.params.id],
        );
      }
      await client.query("COMMIT");
      const { rows } = await tdpPool.query(
        "SELECT * FROM tdpadmin.quotes WHERE id = $1",
        [req.params.id],
      );
      res.json({ ok: true, quote: rows[0] });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/tdp/quotes/:id/send
app.post("/api/tdp/quotes/:id/send", requireTDPAuth, async (req, res) => {
  try {
    const { rows } = await tdpPool.query(
      "UPDATE tdpadmin.quotes SET status = 'sent' WHERE id = $1 AND status = 'draft' RETURNING *",
      [req.params.id],
    );
    if (rows.length === 0)
      return res
        .status(400)
        .json({ ok: false, error: "quote not found or not in draft" });
    res.json({ ok: true, quote: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/tdp/quotes/:id/approve
app.post("/api/tdp/quotes/:id/approve", requireTDPAuth, async (req, res) => {
  try {
    const { rows } = await tdpPool.query(
      "UPDATE tdpadmin.quotes SET status = 'approved', approved_at = NOW() WHERE id = $1 AND status = 'sent' RETURNING *",
      [req.params.id],
    );
    if (rows.length === 0)
      return res
        .status(400)
        .json({ ok: false, error: "quote not found or not sent" });
    res.json({ ok: true, quote: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/tdp/quotes/:id/reject
app.post("/api/tdp/quotes/:id/reject", requireTDPAuth, async (req, res) => {
  try {
    const { rows } = await tdpPool.query(
      "UPDATE tdpadmin.quotes SET status = 'rejected' WHERE id = $1 AND status IN ('draft','sent') RETURNING *",
      [req.params.id],
    );
    if (rows.length === 0)
      return res.status(400).json({ ok: false, error: "quote not found" });
    res.json({ ok: true, quote: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// =============================================================================
// Proyectos
// =============================================================================

// GET /api/tdp/projects
app.get("/api/tdp/projects", requireTDPAuth, async (req, res) => {
  try {
    let sql = `SELECT p.*,
      (SELECT COUNT(*) FROM tdpadmin.project_tasks WHERE project_id = p.id AND status = 'done') AS tasks_done,
      (SELECT COUNT(*) FROM tdpadmin.project_tasks WHERE project_id = p.id) AS tasks_total,
      (SELECT json_agg(json_build_object('id', pm.user_id, 'name', u.full_name, 'email', u.email, 'role', pm.role))
       FROM tdpadmin.project_members pm
       LEFT JOIN tdpadmin.users u ON u.id = pm.user_id
       WHERE pm.project_id = p.id) AS members
      FROM tdpadmin.projects p
      WHERE 1=1`;
    const params = [];
    for (const key of ["status", "priority", "project_type"]) {
      if (req.query[key]) {
        params.push(req.query[key]);
        sql += ` AND p.${key} = $${params.length}`;
      }
    }
    if (req.query.search) {
      params.push(`%${req.query.search}%`);
      sql += ` AND (p.name ILIKE $${params.length} OR p.client_name ILIKE $${params.length} OR p.description ILIKE $${params.length})`;
    }
    if (req.tdpUser.role === "client") {
      params.push(req.tdpUser.client_id);
      sql += ` AND p.client_id = $${params.length}`;
    }
    sql += " ORDER BY p.created_at DESC LIMIT 100";
    const { rows } = await tdpPool.query(sql, params);
    res.json({ ok: true, projects: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// GET /api/tdp/projects/:id
app.get("/api/tdp/projects/:id", requireTDPAuth, async (req, res) => {
  try {
    const { rows } = await tdpPool.query(
      `SELECT p.*, c.name AS client_name, c.email AS client_email, c.phone AS client_phone,
        (SELECT json_agg(json_build_object('id', pm.user_id, 'name', u.full_name, 'email', u.email, 'role', pm.role) ORDER BY pm.created_at)
         FROM tdpadmin.project_members pm
         LEFT JOIN tdpadmin.users u ON u.id = pm.user_id
         WHERE pm.project_id = p.id) AS members
       FROM tdpadmin.projects p
       LEFT JOIN tdpadmin.clients c ON c.id = p.client_id
       WHERE p.id = $1`,
      [req.params.id],
    );
    if (rows.length === 0)
      return res.status(404).json({ ok: false, error: "not found" });

    const { rows: milestones } = await tdpPool.query(
      "SELECT * FROM tdpadmin.project_milestones WHERE project_id = $1 ORDER BY sort_order ASC, due_date ASC NULLS LAST",
      [req.params.id],
    );
    const { rows: tasks } = await tdpPool.query(
      `SELECT t.*, u.full_name AS assignee_name
       FROM tdpadmin.project_tasks t
       LEFT JOIN tdpadmin.users u ON u.id = t.assignee_id
       WHERE t.project_id = $1 ORDER BY t.sort_order ASC, t.created_at DESC`,
      [req.params.id],
    );
    const { rows: activity } = await tdpPool.query(
      `SELECT a.*, u.full_name AS user_name
       FROM tdpadmin.project_activity a
       LEFT JOIN tdpadmin.users u ON u.id = a.user_id
       WHERE a.project_id = $1 ORDER BY a.created_at DESC LIMIT 50`,
      [req.params.id],
    );
    const { rows: expenses } = await tdpPool.query(
      "SELECT * FROM tdpadmin.project_expenses WHERE project_id = $1 ORDER BY created_at DESC",
      [req.params.id],
    );

    res.json({ ok: true, project: { ...rows[0], milestones, tasks, activity, expenses: expenses || [] } });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

function logProjectActivity(projectId, userId, action, description) {
  tdpPool.query(
    "INSERT INTO tdpadmin.project_activity (project_id, user_id, action, description) VALUES ($1,$2,$3,$4)",
    [projectId, userId, action, description],
  ).catch(() => {});
}

// POST /api/tdp/projects
app.post("/api/tdp/projects", requireTDPAuth, async (req, res) => {
  try {
    const {
      client_id, name, description, project_type, priority,
      start_date, end_date, budget, quote_id, client_name, owner_id,
    } = req.body || {};
    if (!name || !name.trim())
      return res.status(400).json({ ok: false, error: "name required" });

    const projectType = project_type || "otro";
    const { rows } = await tdpPool.query(
      `INSERT INTO tdpadmin.projects (client_id, name, description, project_type, priority, start_date, end_date, budget, quote_id, client_name, owner_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        client_id || null, name.trim(), description || "",
        projectType, priority || "medium",
        start_date || null, end_date || null,
        budget ? Number(budget) : null,
        quote_id || null, client_name || "",
        owner_id || req.tdpUser.id, req.tdpUser.id,
      ],
    );
    logProjectActivity(rows[0].id, req.tdpUser.id, "created", `Proyecto "${name.trim()}" creado`);
    res.json({ ok: true, project: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// PATCH /api/tdp/projects/:id
app.patch("/api/tdp/projects/:id", requireTDPAuth, async (req, res) => {
  try {
    const allowed = ["name","description","status","priority","project_type","start_date","end_date","budget","actual_cost","progress","client_id","client_name","quote_id","owner_id"];
    const fields = {};
    let changed = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields[key] = req.body[key];
        changed.push(key);
      }
    }
    if (Object.keys(fields).length === 0)
      return res.status(400).json({ ok: false, error: "no fields to update" });

    const sets = [];
    const params = [];
    let idx = 0;
    for (const [key, val] of Object.entries(fields)) {
      idx++;
      sets.push(`${key} = $${idx}`);
      params.push(val);
    }
    params.push(req.params.id);
    const { rows } = await tdpPool.query(
      `UPDATE tdpadmin.projects SET ${sets.join(", ")} WHERE id = $${idx + 1} RETURNING *`,
      params,
    );
    if (rows.length === 0)
      return res.status(404).json({ ok: false, error: "not found" });

    logProjectActivity(rows[0].id, req.tdpUser.id, "updated", `Campos actualizados: ${changed.join(", ")}`);
    res.json({ ok: true, project: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/tdp/projects/:id/members
app.post("/api/tdp/projects/:id/members", requireTDPAuth, async (req, res) => {
  try {
    const { user_id, role } = req.body || {};
    if (!user_id) return res.status(400).json({ ok: false, error: "user_id required" });
    const { rows } = await tdpPool.query(
      `INSERT INTO tdpadmin.project_members (project_id, user_id, role) VALUES ($1,$2,$3)
       ON CONFLICT (project_id, user_id) DO UPDATE SET role = $3 RETURNING *`,
      [req.params.id, user_id, role || "developer"],
    );
    const { rows: users } = await tdpPool.query("SELECT full_name AS name FROM tdpadmin.users WHERE id = $1", [user_id]);
    const userName = users[0]?.name || "Usuario";
    logProjectActivity(req.params.id, req.tdpUser.id, "member_added", `${userName} añadido como ${role || "developer"}`);
    res.json({ ok: true, member: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// DELETE /api/tdp/projects/:id/members/:userId
app.delete("/api/tdp/projects/:id/members/:userId", requireTDPAuth, async (req, res) => {
  try {
    const { rows: users } = await tdpPool.query("SELECT full_name AS name FROM tdpadmin.users WHERE id = $1", [req.params.userId]);
    const userName = users[0]?.name || "Usuario";
    await tdpPool.query(
      "DELETE FROM tdpadmin.project_members WHERE project_id = $1 AND user_id = $2",
      [req.params.id, req.params.userId],
    );
    logProjectActivity(req.params.id, req.tdpUser.id, "member_removed", `${userName} removido del equipo`);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/tdp/projects/:id/milestones
app.post("/api/tdp/projects/:id/milestones", requireTDPAuth, async (req, res) => {
  try {
    const { name, description, due_date, sort_order } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ ok: false, error: "name required" });
    const { rows } = await tdpPool.query(
      `INSERT INTO tdpadmin.project_milestones (project_id, name, description, due_date, sort_order)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, name.trim(), description || "", due_date || null, sort_order || 0],
    );
    logProjectActivity(req.params.id, req.tdpUser.id, "milestone_added", `Hito "${name.trim()}" añadido`);
    res.json({ ok: true, milestone: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// PATCH /api/tdp/projects/:id/milestones/:msId
app.patch("/api/tdp/projects/:id/milestones/:msId", requireTDPAuth, async (req, res) => {
  try {
    const allowed = ["name","description","due_date","status","sort_order"];
    const sets = [];
    const params = [];
    let idx = 0;
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        idx++;
        sets.push(`${key} = $${idx}`);
        params.push(req.body[key]);
      }
    }
    if (sets.length === 0) return res.status(400).json({ ok: false, error: "no fields" });
    params.push(req.params.msId);
    const { rows } = await tdpPool.query(
      `UPDATE tdpadmin.project_milestones SET ${sets.join(", ")} WHERE id = $${idx + 1} RETURNING *`,
      params,
    );
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "milestone not found" });
    logProjectActivity(req.params.id, req.tdpUser.id, "milestone_updated", `Hito "${rows[0].name}" actualizado`);
    res.json({ ok: true, milestone: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// DELETE /api/tdp/projects/:id/milestones/:msId
app.delete("/api/tdp/projects/:id/milestones/:msId", requireTDPAuth, async (req, res) => {
  try {
    await tdpPool.query("DELETE FROM tdpadmin.project_milestones WHERE id = $1", [req.params.msId]);
    logProjectActivity(req.params.id, req.tdpUser.id, "milestone_removed", "Hito eliminado");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/tdp/projects/:id/tasks
app.post("/api/tdp/projects/:id/tasks", requireTDPAuth, async (req, res) => {
  try {
    const { title, description, priority, assignee_id, due_date, estimated_hours, milestone_id, sort_order } = req.body || {};
    if (!title || !title.trim()) return res.status(400).json({ ok: false, error: "title required" });
    const { rows } = await tdpPool.query(
      `INSERT INTO tdpadmin.project_tasks (project_id, milestone_id, title, description, priority, assignee_id, due_date, estimated_hours, sort_order, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        req.params.id, milestone_id || null, title.trim(), description || "",
        priority || "medium", assignee_id || null, due_date || null,
        estimated_hours ? Number(estimated_hours) : null,
        sort_order || 0, req.tdpUser.id,
      ],
    );
    logProjectActivity(req.params.id, req.tdpUser.id, "task_added", `Tarea "${title.trim()}" añadida`);
    res.json({ ok: true, task: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// PATCH /api/tdp/projects/:id/tasks/:taskId
app.patch("/api/tdp/projects/:id/tasks/:taskId", requireTDPAuth, async (req, res) => {
  try {
    const allowed = ["title","description","status","priority","assignee_id","due_date","estimated_hours","actual_hours","sort_order","milestone_id"];
    const sets = [];
    const params = [];
    let idx = 0;
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        idx++;
        sets.push(`${key} = $${idx}`);
        params.push(req.body[key]);
      }
    }
    if (sets.length === 0) return res.status(400).json({ ok: false, error: "no fields" });

    // If status changed to done, log it
    if (req.body.status === "done") {
      logProjectActivity(req.params.id, req.tdpUser.id, "task_completed", `Tarea completada: "${req.body.title || req.params.taskId}"`);
    }

    params.push(req.params.taskId);
    const { rows } = await tdpPool.query(
      `UPDATE tdpadmin.project_tasks SET ${sets.join(", ")} WHERE id = $${idx + 1} RETURNING *`,
      params,
    );
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "task not found" });
    res.json({ ok: true, task: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// DELETE /api/tdp/projects/:id/tasks/:taskId
app.delete("/api/tdp/projects/:id/tasks/:taskId", requireTDPAuth, async (req, res) => {
  try {
    await tdpPool.query("DELETE FROM tdpadmin.project_tasks WHERE id = $1", [req.params.taskId]);
    logProjectActivity(req.params.id, req.tdpUser.id, "task_removed", "Tarea eliminada");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/tdp/projects/:id/expenses
app.post("/api/tdp/projects/:id/expenses", requireTDPAuth, async (req, res) => {
  try {
    const { concept, amount, date } = req.body || {};
    if (!concept || !concept.trim()) return res.status(400).json({ ok: false, error: "concept required" });
    if (!amount) return res.status(400).json({ ok: false, error: "amount required" });
    const { rows } = await tdpPool.query(
      `INSERT INTO tdpadmin.project_expenses (project_id, concept, amount, date, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, concept.trim(), Number(amount), date || null, req.tdpUser.id],
    );
    // Update actual_cost
    await tdpPool.query(
      "UPDATE tdpadmin.projects SET actual_cost = (SELECT COALESCE(SUM(amount),0) FROM tdpadmin.project_expenses WHERE project_id = $1) WHERE id = $1",
      [req.params.id],
    );
    logProjectActivity(req.params.id, req.tdpUser.id, "expense_added", `Gasto registrado: ${concept.trim()} - $${Number(amount).toFixed(2)}`);
    res.json({ ok: true, expense: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// PATCH /api/tdp/projects/:id/expenses/:expId
app.patch("/api/tdp/projects/:id/expenses/:expId", requireTDPAuth, async (req, res) => {
  try {
    const allowed = ["concept","amount","date"];
    const sets = [];
    const params = [];
    let idx = 0;
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        idx++;
        sets.push(`${key} = $${idx}`);
        params.push(req.body[key]);
      }
    }
    if (sets.length === 0) return res.status(400).json({ ok: false, error: "no fields" });
    params.push(req.params.expId);
    const { rows } = await tdpPool.query(
      `UPDATE tdpadmin.project_expenses SET ${sets.join(", ")} WHERE id = $${idx + 1} RETURNING *`,
      params,
    );
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "expense not found" });
    await tdpPool.query(
      "UPDATE tdpadmin.projects SET actual_cost = (SELECT COALESCE(SUM(amount),0) FROM tdpadmin.project_expenses WHERE project_id = $1) WHERE id = $1",
      [req.params.id],
    );
    res.json({ ok: true, expense: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// DELETE /api/tdp/projects/:id/expenses/:expId
app.delete("/api/tdp/projects/:id/expenses/:expId", requireTDPAuth, async (req, res) => {
  try {
    await tdpPool.query("DELETE FROM tdpadmin.project_expenses WHERE id = $1", [req.params.expId]);
    await tdpPool.query(
      "UPDATE tdpadmin.projects SET actual_cost = (SELECT COALESCE(SUM(amount),0) FROM tdpadmin.project_expenses WHERE project_id = $1) WHERE id = $1",
      [req.params.id],
    );
    logProjectActivity(req.params.id, req.tdpUser.id, "expense_removed", "Gasto eliminado");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// GET /api/tdp/users/team (for member assignment)
app.get("/api/tdp/users/team", requireTDPAuth, async (req, res) => {
  try {
    const { rows } = await tdpPool.query(
      "SELECT id, full_name AS name, email, role FROM tdpadmin.users WHERE role IN ('superadmin','admin','director','project_manager','developer','designer','content') ORDER BY full_name",
    );
    res.json({ ok: true, users: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
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

// Permission check helper (for future use)
function requirePermission(module, action) {
  return (req, res, next) => {
    if (req.user?.role === "admin") return next();
    const perms = req.user?.permissions || {};
    if (perms[module]?.[action]) return next();
    return res.status(403).json({ ok: false, error: "forbidden" });
  };
}

// --------------------
// Users CRUD
// --------------------

// GET /api/users — list all users (no password_hash)
app.get("/api/users", requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, email, name, role, is_active, created_at, updated_at FROM public.users ORDER BY email ASC",
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
      return res
        .status(400)
        .json({ ok: false, error: "email and password required" });
    }
    const userRole = role || "waiter";
    const hash = bcrypt.hashSync(password, 10);
    const { rows } = await pool.query(
      "INSERT INTO public.users (email, name, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role, is_active, created_at, updated_at",
      [
        email.trim().toLowerCase(),
        name || email.trim().toLowerCase(),
        userRole,
        hash,
      ],
    );
    res.json({ ok: true, user: rows[0] });
  } catch (e) {
    const msg =
      e?.constraint === "users_email_key"
        ? "email already exists"
        : String(e?.message || e);
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

    if (name !== undefined) {
      idx++;
      sets.push(`name = $${idx}`);
      params.push(name);
    }
    if (role !== undefined) {
      idx++;
      sets.push(`role = $${idx}`);
      params.push(role);
    }
    if (is_active !== undefined) {
      idx++;
      sets.push(`is_active = $${idx}`);
      params.push(is_active);
    }
    if (password !== undefined) {
      idx++;
      sets.push(`password_hash = $${idx}`);
      params.push(bcrypt.hashSync(password, 10));
    }

    if (sets.length === 0)
      return res.status(400).json({ ok: false, error: "no fields to update" });

    idx++;
    params.push(id);
    const { rows } = await pool.query(
      `UPDATE public.users SET ${sets.join(", ")} WHERE id = $${idx} RETURNING id, email, name, role, is_active, created_at, updated_at`,
      params,
    );
    if (rows.length === 0)
      return res.status(404).json({ ok: false, error: "user not found" });
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
      [req.params.id],
    );
    if (rowCount === 0)
      return res
        .status(404)
        .json({ ok: false, error: "user not found or already inactive" });
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
      "SELECT id, name, label, description, permissions, is_active, created_at, updated_at FROM public.roles ORDER BY label ASC",
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
    if (!name || !label)
      return res
        .status(400)
        .json({ ok: false, error: "name and label required" });
    const { rows } = await pool.query(
      "INSERT INTO public.roles (name, label, description) VALUES ($1, $2, $3) RETURNING id, name, label, description, is_active, created_at, updated_at",
      [name.trim().toLowerCase(), label.trim(), description || null],
    );
    res.json({ ok: true, role: rows[0] });
  } catch (e) {
    const msg =
      e?.constraint === "roles_name_key"
        ? "role name already exists"
        : String(e?.message || e);
    res.status(400).json({ ok: false, error: msg });
  }
});

// PATCH /api/roles/:id
app.patch("/api/roles/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { label, description, is_active, permissions } = req.body || {};
    const sets = [];
    const params = [];
    let idx = 0;
    if (label !== undefined) {
      idx++;
      sets.push(`label = $${idx}`);
      params.push(label);
    }
    if (description !== undefined) {
      idx++;
      sets.push(`description = $${idx}`);
      params.push(description);
    }
    if (is_active !== undefined) {
      idx++;
      sets.push(`is_active = $${idx}`);
      params.push(is_active);
    }
    if (permissions !== undefined) {
      idx++;
      sets.push(`permissions = $${idx}`);
      params.push(JSON.stringify(permissions));
    }
    if (sets.length === 0)
      return res.status(400).json({ ok: false, error: "no fields to update" });
    idx++;
    params.push(id);
    const { rows } = await pool.query(
      `UPDATE public.roles SET ${sets.join(", ")} WHERE id = $${idx} RETURNING id, name, label, description, permissions, is_active, created_at, updated_at`,
      params,
    );
    if (rows.length === 0)
      return res.status(404).json({ ok: false, error: "role not found" });
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
      [req.params.id],
    );
    if (rowCount === 0)
      return res
        .status(404)
        .json({ ok: false, error: "role not found or already inactive" });
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
// PG Pool (tdp_main — restaurant data)
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
// TDP Pool (tdpadmin — TDP Admin data)
// --------------------
const tdpPool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 })
  : pool;

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
        (l.tipo_documento || "UNKNOWN").toString().trim() || "UNKNOWN";
      const numero_documento =
        (l.numero_documento || l.doc_num || "UNKNOWN").toString().trim() ||
        "UNKNOWN";
      const sucursal =
        (l.sucursal || l.nombre_sucursal || "UNKNOWN").toString().trim() ||
        "UNKNOWN";
      const codigo_producto =
        (l.codigo_producto || l.co_art || "UNKNOWN").toString().trim() ||
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
    } catch {}
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
        (l.tipo_documento || "UNKNOWN").toString().trim() || "UNKNOWN";
      const numero_documento =
        (l.numero_documento || "UNKNOWN").toString().trim() || "UNKNOWN";

      const sucursal = (
        l.sucursal ||
        l.codigo_sucursal ||
        l.co_alma ||
        "UNKNOWN"
      )
        .toString()
        .trim();

      const codigo_producto =
        (l.codigo_producto || l.co_art || "UNKNOWN").toString().trim() ||
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
    } catch {}
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
    return res
      .status(400)
      .json({ ok: false, error: "warehouses must be array" });
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
      [branch.trim(), capturedAt],
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
        const fs = require("fs");
        const path = require("path");
        fs.writeFileSync(
          path.join(__dirname, "snapshot_debug.json"),
          JSON.stringify(
            {
              keys: Object.keys(rows[0]),
              sample: rows[0],
            },
            null,
            2,
          ),
        );
      } catch (e) {}
    }

    for (const r of rows) {
      const codigo_producto =
        (r.co_art || r.codigo_producto || "").toString().trim() || null;

      const codigo_almacen =
        (r.co_alma || r.codigo_almacen || "").toString().trim() || null;

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
      const precio_usd_num = Number(
        r.precio_usd ||
          r.precioUsd ||
          r.prec_vta1 ||
          r.monto_vta1 ||
          r.monto ||
          0,
      );
      const precio_usd = Number.isFinite(precio_usd_num) ? precio_usd_num : 0;

      const precio_bs_num = Number(
        r.precio_bs || r.precioBs || r.montoadi1 || r.prec_vta1_bs || 0,
      );
      const precio_bs = Number.isFinite(precio_bs_num) ? precio_bs_num : 0;

      const tasa_ref_num = Number(
        r.tasa_ref || r.tasaRef || r.montoadi5 || r.tasa || 0,
      );
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
    try {
      await client.query("rollback");
    } catch {}
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

      const uniq_key = [source_db, sucursal, tipo_doc, nro_doc].join("|");

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
    try {
      await client.query("rollback");
    } catch {}
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
      [hash],
    );
    if (rows.length === 0)
      return res.status(401).json({ ok: false, error: "invalid token" });
    const ip =
      req.headers["x-forwarded-for"] || req.connection?.remoteAddress || "";
    await pool.query(
      "UPDATE public.api_tokens SET last_used_at = NOW(), last_ip = $2 WHERE id = $1",
      [rows[0].id, ip || ""],
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
      "SELECT id, name, created_at, expires_at, last_used_at, last_ip, active, created_by FROM public.api_tokens ORDER BY created_at DESC",
    );
    res.json({ ok: true, tokens: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/agent/tokens — create new token
app.post("/api/agent/tokens", requireAdminToken, async (req, res) => {
  const { name, expires_in_days } = req.body;
  if (!name || !name.trim())
    return res.status(400).json({ ok: false, error: "name required" });
  try {
    const raw = genToken();
    const hash = sha256(raw);
    const expiresAt =
      parseInt(expires_in_days) > 0
        ? new Date(
            Date.now() + parseInt(expires_in_days) * 86400000,
          ).toISOString()
        : null;
    await pool.query(
      "INSERT INTO public.api_tokens (name, token_hash, expires_at) VALUES ($1, $2, $3)",
      [name.trim(), hash, expiresAt],
    );
    res.json({ ok: true, token: raw });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/agent/tokens/:id/regenerate
app.post(
  "/api/agent/tokens/:id/regenerate",
  requireAdminToken,
  async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id))
      return res.status(400).json({ ok: false, error: "invalid id" });
    try {
      const raw = genToken();
      const hash = sha256(raw);
      const { rowCount } = await pool.query(
        "UPDATE public.api_tokens SET token_hash = $2, last_used_at = NULL, last_ip = NULL WHERE id = $1",
        [id, hash],
      );
      if (rowCount === 0)
        return res.status(404).json({ ok: false, error: "token not found" });
      res.json({ ok: true, token: raw });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  },
);

// POST /api/agent/tokens/:id/deactivate
app.post(
  "/api/agent/tokens/:id/deactivate",
  requireAdminToken,
  async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id))
      return res.status(400).json({ ok: false, error: "invalid id" });
    try {
      const { rowCount } = await pool.query(
        "UPDATE public.api_tokens SET active = false WHERE id = $1",
        [id],
      );
      if (rowCount === 0)
        return res.status(404).json({ ok: false, error: "token not found" });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  },
);

// POST /api/agent/tokens/:id/reactivate
app.post(
  "/api/agent/tokens/:id/reactivate",
  requireAdminToken,
  async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id))
      return res.status(400).json({ ok: false, error: "invalid id" });
    try {
      const { rowCount } = await pool.query(
        "UPDATE public.api_tokens SET active = true WHERE id = $1",
        [id],
      );
      if (rowCount === 0)
        return res.status(404).json({ ok: false, error: "token not found" });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  },
);

// --------------------
// Mercatech: receive XML product update
// --------------------
app.post(
  "/api/agent/mercatech/update",
  requireMercatechToken,
  async (req, res) => {
    let xml;
    if (req.is("xml") || req.is("text/xml")) {
      xml = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    } else {
      xml = req.body?.productos || "";
    }
    if (!xml || !xml.includes("<producto>")) {
      return res
        .status(400)
        .json({ ok: false, error: "missing productos XML" });
    }
    const codeMatch = xml.match(/<codProducto>([^<]+)<\/codProducto>/);
    if (!codeMatch)
      return res
        .status(400)
        .json({ ok: false, error: "missing codProducto in XML" });
    const codProducto = codeMatch[1].trim();
    const descMatch = xml.match(/<desProducto>([^<]*)<\/desProducto>/);
    const descripcion = descMatch ? descMatch[1].trim() : "";
    const priceMatch = xml.match(/<precioUSD>([^<]*)<\/precioUSD>/);
    const precioUSD = priceMatch ? parseFloat(priceMatch[1]) || 0 : 0;
    const qtyMatch = xml.match(/<cantidad>([^<]*)<\/cantidad>/);
    const cantidad = qtyMatch ? parseInt(qtyMatch[1]) || 0 : 0;
    const almacenes = [
      ...xml.matchAll(
        /<almacen>\s*<code>([^<]+)<\/code>\s*<location>([^<]*)<\/location>\s*<qty>([^<]*)<\/qty>\s*<\/almacen>/g,
      ),
    ];
    try {
      const { rows: existing } = await pool.query(
        "SELECT codigo_producto FROM public.products WHERE codigo_producto = $1 LIMIT 1",
        [codProducto],
      );
      const upsertData = {
        codigo_producto: codProducto,
        descripcion,
        precio_referencia: precioUSD,
      };
      if (almacenes.length > 0) {
        for (const a of almacenes) {
          const code = a[1].trim();
          const qty = parseInt(a[3]) || 0;
          if (code === "002" || code === "FURIA" || code === "1")
            upsertData.stock_boleita = qty;
          if (code === "8" || code === "odoo" || code === "2")
            upsertData.stock_sabana_grande = qty;
        }
      }
      if (existing.length > 0) {
        await pool.query(
          "UPDATE public.products SET descripcion = $2, precio_referencia = $3, stock_boleita = $4, stock_sabana_grande = $5 WHERE codigo_producto = $1",
          [
            codProducto,
            upsertData.descripcion,
            upsertData.precio_referencia,
            upsertData.stock_boleita || 0,
            upsertData.stock_sabana_grande || 0,
          ],
        );
      } else {
        await pool.query(
          "INSERT INTO public.products (codigo_producto, descripcion, precio_referencia, stock_boleita, stock_sabana_grande) VALUES ($1, $2, $3, $4, $5)",
          [
            codProducto,
            upsertData.descripcion,
            upsertData.precio_referencia,
            upsertData.stock_boleita || 0,
            upsertData.stock_sabana_grande || 0,
          ],
        );
      }
      res.json({
        ok: true,
        producto: codProducto,
        actualizado: existing.length > 0,
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  },
);

// =============================================================================
// Restaurant: Ingredients CRUD
// =============================================================================

// GET /api/restaurant/ingredients
app.get("/api/restaurant/ingredients", requireJwt, async (req, res) => {
  try {
    const search = req.query.search || "";
    const filter = req.query.filter || "all";
    let sql = "SELECT * FROM public.restaurant_ingredients WHERE 1=1";
    const params = [];
    if (search) {
      sql +=
        " AND (name ILIKE $" +
        (params.length + 1) +
        " OR code ILIKE $" +
        (params.length + 1) +
        ")";
      params.push(`%${search}%`);
    }
    if (filter === "active") {
      sql += " AND is_active = true";
    } else if (filter === "inactive") {
      sql += " AND is_active = false";
    } else if (filter === "low_stock") {
      sql += " AND is_active = true AND stock <= min_stock";
    }
    sql += " ORDER BY name ASC";
    const { rows } = await pool.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/restaurant/ingredients
app.post("/api/restaurant/ingredients", requireJwt, async (req, res) => {
  try {
    const { code, name, category, unit, cost, stock, min_stock } =
      req.body || {};
    if (!name)
      return res.status(400).json({ ok: false, error: "name required" });
    const { rows } = await pool.query(
      `INSERT INTO public.restaurant_ingredients (code, name, category, unit, cost, stock, min_stock)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        code || "",
        name,
        category || "",
        unit || "unidad",
        cost || 0,
        stock || 0,
        min_stock || 0,
      ],
    );
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// PATCH /api/restaurant/ingredients/:id
app.patch("/api/restaurant/ingredients/:id", requireJwt, async (req, res) => {
  try {
    const sets = [];
    const params = [];
    let idx = 0;
    for (const key of [
      "code",
      "name",
      "category",
      "unit",
      "cost",
      "stock",
      "min_stock",
      "is_active",
    ]) {
      if (req.body[key] !== undefined) {
        idx++;
        sets.push(`${key} = $${idx}`);
        params.push(req.body[key]);
      }
    }
    if (sets.length === 0)
      return res.status(400).json({ ok: false, error: "no fields" });
    idx++;
    params.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE public.restaurant_ingredients SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      params,
    );
    if (rows.length === 0)
      return res.status(404).json({ ok: false, error: "not found" });
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// DELETE /api/restaurant/ingredients/:id
app.delete("/api/restaurant/ingredients/:id", requireJwt, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      "UPDATE public.restaurant_ingredients SET is_active = false WHERE id = $1 AND is_active = true",
      [req.params.id],
    );
    if (rowCount === 0)
      return res
        .status(404)
        .json({ ok: false, error: "not found or already inactive" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// =============================================================================
// Restaurant: Recipes CRUD
// =============================================================================

// GET /api/restaurant/recipes
app.get("/api/restaurant/recipes", requireJwt, async (req, res) => {
  try {
    const search = req.query.search || "";
    const filter = req.query.filter || "all";
    let sql = `SELECT r.*,
      COALESCE((SELECT SUM(COALESCE(ri.quantity, 0) * COALESCE(ri.cost_snapshot, i.cost, 0))
       FROM public.restaurant_recipe_items ri
       LEFT JOIN public.restaurant_ingredients i ON i.id = ri.ingredient_id
       WHERE ri.recipe_id = r.id), 0) AS calculated_cost,
      (SELECT COUNT(*) FROM public.restaurant_recipe_items WHERE recipe_id = r.id) AS ingredient_count
      FROM public.restaurant_recipes r WHERE 1=1`;
    const params = [];
    if (search) {
      sql +=
        " AND (r.name ILIKE $" +
        (params.length + 1) +
        " OR r.code ILIKE $" +
        (params.length + 1) +
        " OR r.category ILIKE $" +
        (params.length + 1) +
        ")";
      params.push(`%${search}%`);
    }
    if (filter === "active") {
      sql += " AND r.is_active = true";
    } else if (filter === "inactive") {
      sql += " AND r.is_active = false";
    }
    sql += " ORDER BY r.name ASC";
    const { rows } = await pool.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// GET /api/restaurant/recipes/:id
app.get("/api/restaurant/recipes/:id", requireJwt, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.* FROM public.restaurant_recipes r WHERE r.id = $1`,
      [req.params.id],
    );
    if (rows.length === 0)
      return res.status(404).json({ ok: false, error: "not found" });
    const { rows: items } = await pool.query(
      `SELECT ri.*, i.name AS ingredient_name, i.code AS ingredient_code, i.unit AS ingredient_unit, i.cost AS ingredient_cost
       FROM public.restaurant_recipe_items ri
       LEFT JOIN public.restaurant_ingredients i ON i.id = ri.ingredient_id
       WHERE ri.recipe_id = $1 ORDER BY ri.created_at ASC`,
      [req.params.id],
    );
    res.json({ ok: true, data: { ...rows[0], items } });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/restaurant/recipes
app.post("/api/restaurant/recipes", requireJwt, async (req, res) => {
  try {
    const {
      code,
      name,
      category,
      description,
      preparation_time_minutes,
      portions,
      instructions,
      items,
    } = req.body || {};
    if (!name)
      return res.status(400).json({ ok: false, error: "name required" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        `INSERT INTO public.restaurant_recipes (code, name, category, description, preparation_time_minutes, portions, instructions)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          code || "",
          name,
          category || "",
          description || "",
          preparation_time_minutes || null,
          portions || 1,
          instructions || "",
        ],
      );
      const recipe = rows[0];
      if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          const { rows: ing } = await client.query(
            "SELECT cost FROM public.restaurant_ingredients WHERE id = $1",
            [item.ingredient_id],
          );
          const cost_snapshot = ing.length > 0 ? ing[0].cost : 0;
          await client.query(
            `INSERT INTO public.restaurant_recipe_items (recipe_id, ingredient_id, quantity, unit, cost_snapshot) VALUES ($1, $2, $3, $4, $5)`,
            [
              recipe.id,
              item.ingredient_id,
              item.quantity,
              item.unit || "unidad",
              cost_snapshot,
            ],
          );
        }
      }
      await client.query("COMMIT");
      res.json({ ok: true, data: recipe });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// PATCH /api/restaurant/recipes/:id
app.patch("/api/restaurant/recipes/:id", requireJwt, async (req, res) => {
  try {
    const body = req.body;
    const { items, ...fields } = body;
    const fieldKeys = Object.keys(fields);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (fieldKeys.length > 0) {
        const sets = [];
        const params = [];
        let idx = 0;
        for (const key of fieldKeys) {
          if (body[key] !== undefined) {
            idx++;
            sets.push(`${key} = $${idx}`);
            params.push(body[key]);
          }
        }
        idx++;
        params.push(req.params.id);
        await client.query(
          `UPDATE public.restaurant_recipes SET ${sets.join(", ")} WHERE id = $${idx}`,
          params,
        );
      }
      if (Array.isArray(items)) {
        await client.query(
          "DELETE FROM public.restaurant_recipe_items WHERE recipe_id = $1",
          [req.params.id],
        );
        for (const item of items) {
          const { rows: ing } = await client.query(
            "SELECT cost FROM public.restaurant_ingredients WHERE id = $1",
            [item.ingredient_id],
          );
          const cost_snapshot = ing.length > 0 ? ing[0].cost : 0;
          await client.query(
            `INSERT INTO public.restaurant_recipe_items (recipe_id, ingredient_id, quantity, unit, cost_snapshot) VALUES ($1, $2, $3, $4, $5)`,
            [
              req.params.id,
              item.ingredient_id,
              item.quantity,
              item.unit || "unidad",
              cost_snapshot,
            ],
          );
        }
      }
      await client.query("COMMIT");
      const { rows } = await client.query(
        "SELECT * FROM public.restaurant_recipes WHERE id = $1",
        [req.params.id],
      );
      if (rows.length === 0)
        return res.status(404).json({ ok: false, error: "not found" });
      res.json({ ok: true, data: rows[0] });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// DELETE /api/restaurant/recipes/:id — soft delete
app.delete("/api/restaurant/recipes/:id", requireJwt, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      "UPDATE public.restaurant_recipes SET is_active = false WHERE id = $1 AND is_active = true",
      [req.params.id],
    );
    if (rowCount === 0)
      return res.status(404).json({ ok: false, error: "not found" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/restaurant/recipes/:id/items — add ingredient to recipe
app.post("/api/restaurant/recipes/:id/items", requireJwt, async (req, res) => {
  try {
    const { ingredient_id, quantity, unit } = req.body || {};
    if (!ingredient_id || !quantity)
      return res
        .status(400)
        .json({ ok: false, error: "ingredient_id and quantity required" });
    // Snapshot the ingredient cost at time of adding
    const { rows: ing } = await pool.query(
      "SELECT cost FROM public.restaurant_ingredients WHERE id = $1",
      [ingredient_id],
    );
    const cost_snapshot = ing.length > 0 ? ing[0].cost : 0;
    const { rows } = await pool.query(
      `INSERT INTO public.restaurant_recipe_items (recipe_id, ingredient_id, quantity, unit, cost_snapshot)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.id, ingredient_id, quantity, unit || "unidad", cost_snapshot],
    );
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// PATCH /api/restaurant/recipe-items/:itemId
app.patch(
  "/api/restaurant/recipe-items/:itemId",
  requireJwt,
  async (req, res) => {
    try {
      const sets = [];
      const params = [];
      let idx = 0;
      for (const key of ["quantity", "unit", "cost_snapshot"]) {
        if (req.body[key] !== undefined) {
          idx++;
          sets.push(`${key} = $${idx}`);
          params.push(req.body[key]);
        }
      }
      if (sets.length === 0)
        return res.status(400).json({ ok: false, error: "no fields" });
      idx++;
      params.push(req.params.itemId);
      const { rows } = await pool.query(
        `UPDATE public.restaurant_recipe_items SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
        params,
      );
      if (rows.length === 0)
        return res.status(404).json({ ok: false, error: "not found" });
      res.json({ ok: true, data: rows[0] });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  },
);

// DELETE /api/restaurant/recipe-items/:itemId
app.delete(
  "/api/restaurant/recipe-items/:itemId",
  requireJwt,
  async (req, res) => {
    try {
      const { rowCount } = await pool.query(
        "DELETE FROM public.restaurant_recipe_items WHERE id = $1",
        [req.params.itemId],
      );
      if (rowCount === 0)
        return res.status(404).json({ ok: false, error: "not found" });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  },
);

// =============================================================================
// Restaurant: Inventory Products CRUD
// =============================================================================

app.get("/api/restaurant/inventory-products", requireJwt, async (req, res) => {
  try {
    const search = req.query.search || "";
    const filter = req.query.filter || "all";
    let sql = "SELECT * FROM public.restaurant_inventory_products WHERE 1=1";
    const params = [];
    if (search) {
      sql +=
        " AND (name ILIKE $" +
        (params.length + 1) +
        " OR code ILIKE $" +
        (params.length + 1) +
        " OR barcode ILIKE $" +
        (params.length + 1) +
        ")";
      params.push(`%${search}%`);
    }
    if (filter === "active") {
      sql += " AND is_active = true";
    } else if (filter === "inactive") {
      sql += " AND is_active = false";
    } else if (filter === "low_stock") {
      sql += " AND is_active = true AND current_stock <= minimum_stock";
    }
    sql += " ORDER BY name ASC";
    const { rows } = await pool.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.post("/api/restaurant/inventory-products", requireJwt, async (req, res) => {
  try {
    const {
      code,
      barcode,
      name,
      category,
      unit,
      cost,
      sale_price,
      current_stock,
      minimum_stock,
      warehouse_id,
      supplier_id,
    } = req.body || {};
    if (!name)
      return res.status(400).json({ ok: false, error: "name required" });
    const { rows } = await pool.query(
      `INSERT INTO public.restaurant_inventory_products (code, barcode, name, category, unit, cost, sale_price, current_stock, minimum_stock, warehouse_id, supplier_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        code || null,
        barcode || "",
        name,
        category || "",
        unit || "unidad",
        cost || 0,
        sale_price || 0,
        current_stock || 0,
        minimum_stock || 0,
        warehouse_id || null,
        supplier_id || null,
      ],
    );
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    const msg =
      e?.constraint === "restaurant_inventory_products_code_key"
        ? "code already exists"
        : String(e?.message || e);
    res.status(400).json({ ok: false, error: msg });
  }
});

app.patch(
  "/api/restaurant/inventory-products/:id",
  requireJwt,
  async (req, res) => {
    try {
      const sets = [];
      const params = [];
      let idx = 0;
      for (const key of [
        "code",
        "barcode",
        "name",
        "category",
        "unit",
        "cost",
        "sale_price",
        "current_stock",
        "minimum_stock",
        "warehouse_id",
        "supplier_id",
        "is_active",
      ]) {
        if (req.body[key] !== undefined) {
          idx++;
          sets.push(`${key} = $${idx}`);
          params.push(req.body[key]);
        }
      }
      if (sets.length === 0)
        return res.status(400).json({ ok: false, error: "no fields" });
      idx++;
      params.push(req.params.id);
      const { rows } = await pool.query(
        `UPDATE public.restaurant_inventory_products SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
        params,
      );
      if (rows.length === 0)
        return res.status(404).json({ ok: false, error: "not found" });
      res.json({ ok: true, data: rows[0] });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  },
);

app.delete(
  "/api/restaurant/inventory-products/:id",
  requireJwt,
  async (req, res) => {
    try {
      const { rowCount } = await pool.query(
        "UPDATE public.restaurant_inventory_products SET is_active = false WHERE id = $1 AND is_active = true",
        [req.params.id],
      );
      if (rowCount === 0)
        return res.status(404).json({ ok: false, error: "not found" });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  },
);

// =============================================================================
// Restaurant: Menu CRUD
// =============================================================================

// ————— Categories —————

app.get("/api/restaurant/menu/categories", requireJwt, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM public.restaurant_categories ORDER BY display_order ASC, name ASC",
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.post("/api/restaurant/menu/categories", requireJwt, async (req, res) => {
  try {
    const { name, description, display_order } = req.body || {};
    if (!name)
      return res.status(400).json({ ok: false, error: "name required" });
    const { rows } = await pool.query(
      "INSERT INTO public.restaurant_categories (name, description, display_order) VALUES ($1, $2, $3) RETURNING *",
      [name, description || "", display_order || 0],
    );
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.patch(
  "/api/restaurant/menu/categories/:id",
  requireJwt,
  async (req, res) => {
    try {
      const sets = [];
      const params = [];
      let idx = 0;
      for (const key of ["name", "description", "display_order", "is_active"]) {
        if (req.body[key] !== undefined) {
          idx++;
          sets.push(`${key} = $${idx}`);
          params.push(req.body[key]);
        }
      }
      if (sets.length === 0)
        return res.status(400).json({ ok: false, error: "no fields" });
      idx++;
      params.push(req.params.id);
      const { rows } = await pool.query(
        `UPDATE public.restaurant_categories SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
        params,
      );
      if (rows.length === 0)
        return res.status(404).json({ ok: false, error: "not found" });
      res.json({ ok: true, data: rows[0] });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  },
);

app.delete(
  "/api/restaurant/menu/categories/:id",
  requireJwt,
  async (req, res) => {
    try {
      const { rowCount } = await pool.query(
        "UPDATE public.restaurant_categories SET is_active = false WHERE id = $1 AND is_active = true",
        [req.params.id],
      );
      if (rowCount === 0)
        return res.status(404).json({ ok: false, error: "not found" });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  },
);

// ————— Menu Items —————

app.get("/api/restaurant/menu/items", requireJwt, async (req, res) => {
  try {
    const search = req.query.search || "";
    const cat = req.query.category || "";
    let sql = `SELECT mi.*, c.name AS category_name, r.name AS recipe_name,
      ip.name AS inv_product_name, ip.cost AS inv_product_cost, ip.sale_price AS inv_sale_price,
      CASE
        WHEN mi.item_type = 'inventory_product' THEN ip.cost
        ELSE COALESCE(mi.cost, (SELECT SUM(COALESCE(ri.quantity,0) * COALESCE(ri.cost_snapshot, i.cost, 0))
          FROM public.restaurant_recipe_items ri LEFT JOIN public.restaurant_ingredients i ON i.id = ri.ingredient_id
          WHERE ri.recipe_id = mi.recipe_id), 0)
      END AS calculated_cost
      FROM public.restaurant_menu_items mi
      LEFT JOIN public.restaurant_categories c ON c.id = mi.category_id
      LEFT JOIN public.restaurant_recipes r ON r.id = mi.recipe_id
      LEFT JOIN public.restaurant_inventory_products ip ON ip.id = mi.inventory_product_id
      WHERE 1=1`;
    const params = [];
    if (search) {
      sql += ` AND (mi.name ILIKE $${params.length + 1} OR mi.code ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }
    if (cat) {
      sql += ` AND mi.category_id = $${params.length + 1}`;
      params.push(cat);
    }
    sql += " ORDER BY mi.display_order ASC, mi.name ASC";
    const { rows } = await pool.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.post("/api/restaurant/menu/items", requireJwt, async (req, res) => {
  try {
    const {
      category_id,
      item_type,
      recipe_id,
      inventory_product_id,
      code,
      name,
      description,
      price,
      cost,
      image_url,
      display_order,
    } = req.body || {};
    if (!name || !category_id)
      return res
        .status(400)
        .json({ ok: false, error: "name and category required" });
    const { rows } = await pool.query(
      `INSERT INTO public.restaurant_menu_items (category_id, item_type, recipe_id, inventory_product_id, code, name, description, price, cost, image_url, display_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        category_id,
        item_type || "recipe",
        recipe_id || null,
        inventory_product_id || null,
        code || "",
        name,
        description || "",
        price || 0,
        cost || null,
        image_url || "",
        display_order || 0,
      ],
    );
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.patch("/api/restaurant/menu/items/:id", requireJwt, async (req, res) => {
  try {
    const sets = [];
    const params = [];
    let idx = 0;
    for (const key of [
      "category_id",
      "item_type",
      "recipe_id",
      "inventory_product_id",
      "code",
      "name",
      "description",
      "price",
      "cost",
      "margin_percent",
      "image_url",
      "is_available",
      "is_active",
      "display_order",
    ]) {
      if (req.body[key] !== undefined) {
        idx++;
        sets.push(`${key} = $${idx}`);
        params.push(req.body[key]);
      }
    }
    if (sets.length === 0)
      return res.status(400).json({ ok: false, error: "no fields" });
    idx++;
    params.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE public.restaurant_menu_items SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      params,
    );
    if (rows.length === 0)
      return res.status(404).json({ ok: false, error: "not found" });
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.delete("/api/restaurant/menu/items/:id", requireJwt, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      "UPDATE public.restaurant_menu_items SET is_active = false WHERE id = $1 AND is_active = true",
      [req.params.id],
    );
    if (rowCount === 0)
      return res.status(404).json({ ok: false, error: "not found" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// =============================================================================
// Inventory: Movements CRUD
// =============================================================================

const ENTRY_TYPES = [
  "compra",
  "ajuste_positivo",
  "transferencia_entrada",
  "devolucion",
];
const EXIT_TYPES = [
  "venta",
  "ajuste_negativo",
  "transferencia_salida",
  "merma",
  "vencimiento",
];

function normalizeQuantity(movementType, qty) {
  const abs = Math.abs(Number(qty) || 0);
  if (ENTRY_TYPES.includes(movementType)) return abs;
  return -abs;
}

// Reusable inventory movement creator
async function createInventoryMovement(
  client,
  {
    item_type,
    item_id,
    movement_type,
    quantity,
    unit_cost,
    warehouse_id,
    reference_type,
    reference_id,
    notes,
    created_by,
    allow_negative,
  },
) {
  if (!["ingredient", "inventory_product"].includes(item_type))
    throw new Error("invalid item_type");
  if (![...ENTRY_TYPES, ...EXIT_TYPES].includes(movement_type))
    throw new Error("invalid movement_type");

  let table, stockCol, costCol;
  if (item_type === "ingredient") {
    table = "public.restaurant_ingredients";
    stockCol = "stock";
    costCol = "cost";
  } else {
    table = "public.restaurant_inventory_products";
    stockCol = "current_stock";
    costCol = "cost";
  }

  const { rows: itemRows } = await client.query(
    `SELECT ${stockCol} AS current_stock, ${costCol} AS cost FROM ${table} WHERE id = $1`,
    [item_id],
  );
  if (itemRows.length === 0) throw new Error("item not found");
  const item = itemRows[0];

  const signedQty = normalizeQuantity(movement_type, quantity);
  const absQty = Math.abs(signedQty);
  const newStock = Number(item.current_stock) + signedQty;
  if (newStock < 0 && !allow_negative)
    throw new Error(
      `stock insuficiente: tiene ${Number(item.current_stock).toFixed(2)}, necesita ${absQty.toFixed(2)}`,
    );

  const finalCost =
    unit_cost !== undefined && unit_cost !== null && unit_cost !== ""
      ? Number(unit_cost)
      : Number(item.cost) || 0;
  const totalCost = absQty * finalCost;

  const { rows: movRows } = await client.query(
    `INSERT INTO public.inventory_movements (item_type, item_id, movement_type, quantity, unit_cost, total_cost, reference_type, reference_id, warehouse_id, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      item_type,
      item_id,
      movement_type,
      signedQty,
      finalCost,
      totalCost,
      reference_type || null,
      reference_id || null,
      warehouse_id || null,
      notes || null,
      created_by,
    ],
  );

  await client.query(
    `UPDATE ${table} SET ${stockCol} = ${stockCol} + $1 WHERE id = $2`,
    [signedQty, item_id],
  );
  return movRows[0];
}

// GET /api/inventory/movements
app.get("/api/inventory/movements", requireJwt, async (req, res) => {
  try {
    let sql = `SELECT m.*,
      COALESCE(i.name, ip.name) AS item_name
      FROM public.inventory_movements m
      LEFT JOIN public.restaurant_ingredients i ON m.item_type = 'ingredient' AND m.item_id = i.id
      LEFT JOIN public.restaurant_inventory_products ip ON m.item_type = 'inventory_product' AND m.item_id = ip.id
      WHERE 1=1`;
    const params = [];
    for (const key of [
      "item_type",
      "item_id",
      "movement_type",
      "warehouse_id",
    ]) {
      if (req.query[key]) {
        params.push(req.query[key]);
        sql += ` AND m.${key} = $${params.length}`;
      }
    }
    if (req.query.from) {
      params.push(req.query.from);
      sql += ` AND m.created_at >= $${params.length}`;
    }
    if (req.query.to) {
      params.push(req.query.to);
      sql += ` AND m.created_at <= $${params.length}`;
    }
    sql += " ORDER BY m.created_at DESC LIMIT 500";
    const { rows } = await pool.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/inventory/movements
app.post("/api/inventory/movements", requireJwt, async (req, res) => {
  const {
    item_type,
    item_id,
    movement_type,
    quantity,
    unit_cost,
    warehouse_id,
    reference_type,
    reference_id,
    notes,
    allow_negative,
  } = req.body || {};
  if (!item_type || !item_id || !movement_type) {
    return res
      .status(400)
      .json({ ok: false, error: "item_type, item_id, movement_type required" });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const movement = await createInventoryMovement(client, {
      item_type,
      item_id,
      movement_type,
      quantity,
      unit_cost,
      warehouse_id,
      reference_type,
      reference_id,
      notes,
      allow_negative,
      created_by: req.user.id,
    });
    await client.query("COMMIT");
    res.json({ ok: true, data: movement });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  } finally {
    client.release();
  }
});

// GET /api/inventory/movements/:id
app.get("/api/inventory/movements/:id", requireJwt, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.*,
        COALESCE(i.name, ip.name) AS item_name
       FROM public.inventory_movements m
       LEFT JOIN public.restaurant_ingredients i ON m.item_type = 'ingredient' AND m.item_id = i.id
       LEFT JOIN public.restaurant_inventory_products ip ON m.item_type = 'inventory_product' AND m.item_id = ip.id
       WHERE m.id = $1`,
      [req.params.id],
    );
    if (rows.length === 0)
      return res.status(404).json({ ok: false, error: "not found" });
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// =============================================================================
// Purchases: Suppliers CRUD
// =============================================================================

app.get("/api/purchases/suppliers", requireJwt, async (req, res) => {
  try {
    const search = req.query.search || "";
    const filter = req.query.filter || "all";
    let sql = "SELECT * FROM public.purchase_suppliers WHERE 1=1";
    const params = [];
    if (search) {
      sql +=
        " AND (name ILIKE $" +
        (params.length + 1) +
        " OR code ILIKE $" +
        (params.length + 1) +
        " OR rif ILIKE $" +
        (params.length + 1) +
        ")";
      params.push(`%${search}%`);
    }
    if (filter === "active") sql += " AND is_active = true";
    else if (filter === "inactive") sql += " AND is_active = false";
    sql += " ORDER BY name ASC";
    const { rows } = await pool.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.post("/api/purchases/suppliers", requireJwt, async (req, res) => {
  try {
    const {
      code,
      name,
      contact_person,
      phone,
      email,
      rif,
      address,
      payment_terms,
      lead_time_days,
      notes,
    } = req.body || {};
    if (!name)
      return res.status(400).json({ ok: false, error: "name required" });
    const { rows } = await pool.query(
      `INSERT INTO public.purchase_suppliers (code, name, contact_person, phone, email, rif, address, payment_terms, lead_time_days, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        code || null,
        name,
        contact_person || "",
        phone || "",
        email || "",
        rif || null,
        address || "",
        payment_terms || "",
        lead_time_days || null,
        notes || "",
      ],
    );
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    const msg =
      e?.constraint === "purchase_suppliers_code_key"
        ? "code already exists"
        : String(e?.message || e);
    res.status(400).json({ ok: false, error: msg });
  }
});

app.patch("/api/purchases/suppliers/:id", requireJwt, async (req, res) => {
  try {
    const sets = [];
    const params = [];
    let idx = 0;
    for (const key of [
      "code",
      "name",
      "contact_person",
      "phone",
      "email",
      "rif",
      "address",
      "payment_terms",
      "lead_time_days",
      "notes",
      "is_active",
    ]) {
      if (req.body[key] !== undefined) {
        idx++;
        sets.push(`${key} = $${idx}`);
        params.push(req.body[key]);
      }
    }
    if (sets.length === 0)
      return res.status(400).json({ ok: false, error: "no fields" });
    idx++;
    params.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE public.purchase_suppliers SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      params,
    );
    if (rows.length === 0)
      return res.status(404).json({ ok: false, error: "not found" });
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.delete("/api/purchases/suppliers/:id", requireJwt, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      "UPDATE public.purchase_suppliers SET is_active = false WHERE id = $1 AND is_active = true",
      [req.params.id],
    );
    if (rowCount === 0)
      return res.status(404).json({ ok: false, error: "not found" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// =============================================================================
// Purchases: Orders CRUD
// =============================================================================

// GET /api/purchases/orders
app.get("/api/purchases/orders", requireJwt, async (req, res) => {
  try {
    const search = req.query.search || "";
    const status = req.query.status || "";
    const approval = req.query.approval_status || "";
    let sql = `SELECT po.*, ps.name AS supplier_name, cw.name AS warehouse_name,
      (SELECT COUNT(*) FROM public.purchase_order_lines WHERE order_id = po.id) AS line_count
      FROM public.purchase_orders po
      LEFT JOIN public.purchase_suppliers ps ON ps.id = po.supplier_id
      LEFT JOIN public.company_warehouses cw ON cw.id = po.warehouse_id
      WHERE 1=1`;
    const params = [];
    if (search) {
      sql += ` AND (po.order_number ILIKE $${params.length + 1} OR ps.name ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }
    if (status) {
      sql += ` AND po.status = $${params.length + 1}`;
      params.push(status);
    }
    if (approval) {
      sql += ` AND po.approval_status = $${params.length + 1}`;
      params.push(approval);
    }
    sql += " ORDER BY po.created_at DESC LIMIT 100";
    const { rows } = await pool.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// GET /api/purchases/orders/:id
app.get("/api/purchases/orders/:id", requireJwt, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT po.*, ps.name AS supplier_name, ps.rif AS supplier_rif, ps.phone AS supplier_phone,
        cw.name AS warehouse_name,
        u_creator.email AS created_by_email
       FROM public.purchase_orders po
       LEFT JOIN public.purchase_suppliers ps ON ps.id = po.supplier_id
       LEFT JOIN public.company_warehouses cw ON cw.id = po.warehouse_id
       LEFT JOIN public.users u_creator ON u_creator.id = po.created_by
       WHERE po.id = $1`,
      [req.params.id],
    );
    if (rows.length === 0)
      return res.status(404).json({ ok: false, error: "not found" });
    const { rows: lines } = await pool.query(
      `SELECT pol.*, COALESCE(i.name, ip.name) AS item_name
       FROM public.purchase_order_lines pol
       LEFT JOIN public.restaurant_ingredients i ON pol.item_type = 'ingredient' AND pol.item_id = i.id
       LEFT JOIN public.restaurant_inventory_products ip ON pol.item_type = 'inventory_product' AND pol.item_id = ip.id
       WHERE pol.order_id = $1 ORDER BY pol.created_at ASC`,
      [req.params.id],
    );
    res.json({ ok: true, data: { ...rows[0], lines } });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/purchases/orders
app.post("/api/purchases/orders", requireJwt, async (req, res) => {
  try {
    const { supplier_id, warehouse_id, expected_date, notes, items } =
      req.body || {};
    if (!supplier_id)
      return res.status(400).json({ ok: false, error: "supplier required" });
    if (!Array.isArray(items) || items.length === 0)
      return res
        .status(400)
        .json({ ok: false, error: "at least one item required" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let subtotal = 0;
      const lineValues = [];
      for (const item of items) {
        const qty = Number(item.quantity_ordered) || 0;
        const cost = Number(item.unit_cost) || 0;
        const total = qty * cost;
        subtotal += total;
        lineValues.push({
          ...item,
          quantity_ordered: qty,
          unit_cost: cost,
          total_line: total,
        });
      }

      const { rows: orderRows } = await client.query(
        `INSERT INTO public.purchase_orders (supplier_id, warehouse_id, expected_date, notes, subtotal, total, created_by)
         VALUES ($1,$2,$3,$4,$5,$5,$6) RETURNING *`,
        [
          supplier_id,
          warehouse_id || null,
          expected_date || null,
          notes || "",
          subtotal,
          req.user.id,
        ],
      );
      const order = orderRows[0];

      for (const line of lineValues) {
        await client.query(
          `INSERT INTO public.purchase_order_lines (order_id, item_type, item_id, item_name, quantity_ordered, unit_cost, total_line)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            order.id,
            line.item_type,
            line.item_id,
            line.item_name || "",
            line.quantity_ordered,
            line.unit_cost,
            line.total_line,
          ],
        );
      }

      await client.query("COMMIT");
      const fullOrder = await pool.query(
        `SELECT po.*, ps.name AS supplier_name FROM public.purchase_orders po
         LEFT JOIN public.purchase_suppliers ps ON ps.id = po.supplier_id WHERE po.id = $1`,
        [order.id],
      );
      res.json({ ok: true, data: fullOrder.rows[0] });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// PATCH /api/purchases/orders/:id
app.patch("/api/purchases/orders/:id", requireJwt, async (req, res) => {
  try {
    const { supplier_id, warehouse_id, expected_date, notes, items } =
      req.body || {};
    if (items) {
      // Full replace: recalculate totals from items
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        let subtotal = 0;
        await client.query(
          "DELETE FROM public.purchase_order_lines WHERE order_id = $1",
          [req.params.id],
        );
        for (const item of items) {
          const qty = Number(item.quantity_ordered) || 0;
          const cost = Number(item.unit_cost) || 0;
          const total = qty * cost;
          subtotal += total;
          await client.query(
            `INSERT INTO public.purchase_order_lines (order_id, item_type, item_id, item_name, quantity_ordered, unit_cost, total_line)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [
              req.params.id,
              item.item_type,
              item.item_id,
              item.item_name || "",
              qty,
              cost,
              total,
            ],
          );
        }
        await client.query(
          `UPDATE public.purchase_orders SET subtotal = $1, total = $1 WHERE id = $2`,
          [subtotal, req.params.id],
        );
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    }
    // Update fields
    const sets = [];
    const params = [];
    let idx = 0;
    for (const key of [
      "supplier_id",
      "warehouse_id",
      "expected_date",
      "notes",
    ]) {
      if (req.body[key] !== undefined) {
        idx++;
        sets.push(`${key} = $${idx}`);
        params.push(req.body[key]);
      }
    }
    if (sets.length > 0) {
      idx++;
      params.push(req.params.id);
      await pool.query(
        `UPDATE public.purchase_orders SET ${sets.join(", ")} WHERE id = $${idx}`,
        params,
      );
    }
    const { rows } = await pool.query(
      "SELECT * FROM public.purchase_orders WHERE id = $1",
      [req.params.id],
    );
    if (rows.length === 0)
      return res.status(404).json({ ok: false, error: "not found" });
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// DELETE /api/purchases/orders/:id — cancel
app.delete("/api/purchases/orders/:id", requireJwt, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT status FROM public.purchase_orders WHERE id = $1",
      [req.params.id],
    );
    if (rows.length === 0)
      return res.status(404).json({ ok: false, error: "not found" });
    if (rows[0].status === "received")
      return res
        .status(400)
        .json({ ok: false, error: "cannot cancel received order" });
    await pool.query(
      "UPDATE public.purchase_orders SET status = 'cancelled' WHERE id = $1",
      [req.params.id],
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/purchases/orders/:id/approve
app.post("/api/purchases/orders/:id/approve", requireJwt, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE public.purchase_orders SET approval_status = 'approved', approved_by = $1, approved_at = NOW()
       WHERE id = $2 AND approval_status = 'pending' RETURNING *`,
      [req.user.id, req.params.id],
    );
    if (rows.length === 0)
      return res
        .status(400)
        .json({ ok: false, error: "order not found or already processed" });
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/purchases/orders/:id/reject
app.post("/api/purchases/orders/:id/reject", requireJwt, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE public.purchase_orders SET approval_status = 'rejected' WHERE id = $1 AND approval_status = 'pending' RETURNING *`,
      [req.params.id],
    );
    if (rows.length === 0)
      return res
        .status(400)
        .json({ ok: false, error: "order not found or already processed" });
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/purchases/orders/:id/send
app.post("/api/purchases/orders/:id/send", requireJwt, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE public.purchase_orders SET status = 'sent' WHERE id = $1 AND approval_status = 'approved' AND status = 'draft' RETURNING *`,
      [req.params.id],
    );
    if (rows.length === 0)
      return res.status(400).json({
        ok: false,
        error: "order must be approved first or already sent",
      });
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// =============================================================================
// Purchases: Receptions CRUD
// =============================================================================

// GET /api/purchases/orders/:id/receivable-lines — líneas pendientes de recibir
app.get(
  "/api/purchases/orders/:id/receivable-lines",
  requireJwt,
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT pol.*, COALESCE(i.name, ip.name) AS item_name,
        (pol.quantity_ordered - pol.quantity_received) AS pending_qty
       FROM public.purchase_order_lines pol
       LEFT JOIN public.restaurant_ingredients i ON pol.item_type = 'ingredient' AND pol.item_id = i.id
       LEFT JOIN public.restaurant_inventory_products ip ON pol.item_type = 'inventory_product' AND pol.item_id = ip.id
       WHERE pol.order_id = $1 AND pol.quantity_received < pol.quantity_ordered
       ORDER BY pol.created_at ASC`,
        [req.params.id],
      );
      res.json({ ok: true, data: rows });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  },
);

// GET /api/purchases/receptions
app.get("/api/purchases/receptions", requireJwt, async (req, res) => {
  try {
    const sql = `SELECT r.*, ps.name AS supplier_name, cw.name AS warehouse_name,
      po.order_number AS po_number, u.email AS received_by_email
      FROM public.purchase_receptions r
      LEFT JOIN public.purchase_suppliers ps ON ps.id = r.supplier_id
      LEFT JOIN public.company_warehouses cw ON cw.id = r.warehouse_id
      LEFT JOIN public.purchase_orders po ON po.id = r.order_id
      LEFT JOIN public.users u ON u.id = r.received_by
      ORDER BY r.created_at DESC LIMIT 100`;
    const { rows } = await pool.query(sql);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// GET /api/purchases/receptions/:id
app.get("/api/purchases/receptions/:id", requireJwt, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, ps.name AS supplier_name, cw.name AS warehouse_name, po.order_number AS po_number
       FROM public.purchase_receptions r
       LEFT JOIN public.purchase_suppliers ps ON ps.id = r.supplier_id
       LEFT JOIN public.company_warehouses cw ON cw.id = r.warehouse_id
       LEFT JOIN public.purchase_orders po ON po.id = r.order_id
       WHERE r.id = $1`,
      [req.params.id],
    );
    if (rows.length === 0)
      return res.status(404).json({ ok: false, error: "not found" });
    const { rows: lines } = await pool.query(
      `SELECT rl.* FROM public.purchase_reception_lines rl WHERE rl.reception_id = $1 ORDER BY rl.created_at ASC`,
      [req.params.id],
    );
    res.json({ ok: true, data: { ...rows[0], lines } });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/purchases/receptions
app.post("/api/purchases/receptions", requireJwt, async (req, res) => {
  const { order_id, document_number, warehouse_id, notes, lines } =
    req.body || {};
  if (!order_id)
    return res.status(400).json({ ok: false, error: "order_id required" });
  if (!Array.isArray(lines) || lines.length === 0)
    return res
      .status(400)
      .json({ ok: false, error: "at least one line required" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Validate order exists and is receivable
    const { rows: orderRows } = await client.query(
      "SELECT id, supplier_id, status FROM public.purchase_orders WHERE id = $1 FOR UPDATE",
      [order_id],
    );
    if (orderRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, error: "order not found" });
    }
    const order = orderRows[0];
    if (!["sent", "partial"].includes(order.status)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        error: `order status ${order.status} cannot receive`,
      });
    }

    // Validate each line
    for (const line of lines) {
      const { rows: pol } = await client.query(
        "SELECT id, quantity_ordered, quantity_received, item_type, item_id, unit_cost FROM public.purchase_order_lines WHERE id = $1 AND order_id = $2",
        [line.order_line_id, order_id],
      );
      if (pol.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          ok: false,
          error: `line ${line.order_line_id} not found in order`,
        });
      }
      const pl = pol[0];
      const pending =
        Number(pl.quantity_ordered) - Number(pl.quantity_received);
      if (Number(line.quantity_received) > pending) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          ok: false,
          error: `cannot receive more than pending (${pending}) for line ${pl.id}`,
        });
      }
    }

    // Create reception
    const { rows: recRows } = await client.query(
      `INSERT INTO public.purchase_receptions (order_id, supplier_id, warehouse_id, document_number, notes, received_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        order_id,
        order.supplier_id,
        warehouse_id || null,
        document_number || "",
        notes || "",
        req.user.id,
      ],
    );
    const reception = recRows[0];

    // Process each line
    for (const line of lines) {
      const { rows: pol } = await client.query(
        "SELECT item_type, item_id, unit_cost FROM public.purchase_order_lines WHERE id = $1",
        [line.order_line_id],
      );
      const pl = pol[0];
      const qty = Number(line.quantity_received);
      const cost = Number(pl.unit_cost);
      const total = qty * cost;

      // Create inventory movement
      const movement = await createInventoryMovement(client, {
        item_type: pl.item_type,
        item_id: pl.item_id,
        movement_type: "compra",
        quantity: qty,
        unit_cost: cost,
        warehouse_id: warehouse_id || null,
        reference_type: "purchase_reception",
        reference_id: reception.id,
        notes: `Recepción ${reception.reception_number}`,
        created_by: req.user.id,
      });

      // Insert reception line
      await client.query(
        `INSERT INTO public.purchase_reception_lines (reception_id, order_line_id, item_type, item_id, item_name, quantity_received, unit_cost, total_line, movement_id)
         VALUES ($1,$2,$3,$4,'',$5,$6,$7,$8)`,
        [
          reception.id,
          line.order_line_id,
          pl.item_type,
          pl.item_id,
          qty,
          cost,
          total,
          movement.id,
        ],
      );

      // Update PO line received qty
      await client.query(
        "UPDATE public.purchase_order_lines SET quantity_received = quantity_received + $1 WHERE id = $2",
        [qty, line.order_line_id],
      );
    }

    // Recalculate order status
    const { rows: remaining } = await client.query(
      "SELECT COUNT(*) AS pending FROM public.purchase_order_lines WHERE order_id = $1 AND quantity_received < quantity_ordered",
      [order_id],
    );
    const newStatus = Number(remaining[0].pending) > 0 ? "partial" : "received";
    await client.query(
      "UPDATE public.purchase_orders SET status = $1 WHERE id = $2",
      [newStatus, order_id],
    );

    await client.query("COMMIT");
    res.json({ ok: true, data: reception });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  } finally {
    client.release();
  }
});

// =============================================================================
// Support Module
// =============================================================================
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const fs = require("fs");
const path = require("path");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function requireSupportAuth(req, res, next) {
  requireJwt(req, res, () => {
    req.canManage =
      req.user?.role === "admin" ||
      req.user?.role === "manager" ||
      req.user?.role === "soporte";
    next();
  });
}

// GET /api/support/tickets
app.get("/api/support/tickets", requireSupportAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const canManage = req.canManage;
    let sql, params;
    if (canManage) {
      sql = "SELECT * FROM public.v_support_tickets ORDER BY created_at DESC";
      params = [];
    } else {
      sql =
        "SELECT * FROM public.v_support_tickets WHERE user_id = $1 ORDER BY created_at DESC";
      params = [userId];
    }
    const { rows } = await pool.query(sql, params);
    res.json({ ok: true, tickets: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/support/tickets
app.post("/api/support/tickets", requireSupportAuth, async (req, res) => {
  try {
    const { title, description, priority, category, branch, image_url } =
      req.body || {};
    if (!title || !description)
      return res
        .status(400)
        .json({ ok: false, error: "title and description required" });
    const { rows } = await pool.query(
      `INSERT INTO public.support_tickets (title, description, priority, category, branch, user_id, user_email, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        title,
        description,
        priority || "medium",
        category || "support",
        branch || null,
        req.user.id,
        req.user.email,
        image_url || null,
      ],
    );
    res.json({ ok: true, ticket: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// GET /api/support/tickets/:id/messages
app.get(
  "/api/support/tickets/:id/messages",
  requireSupportAuth,
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM public.support_messages WHERE ticket_id = $1 ORDER BY created_at ASC",
        [req.params.id],
      );
      res.json({ ok: true, messages: rows });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  },
);

// POST /api/support/tickets/:id/messages
app.post(
  "/api/support/tickets/:id/messages",
  requireSupportAuth,
  async (req, res) => {
    try {
      const { message, image_url } = req.body || {};
      if (!message)
        return res.status(400).json({ ok: false, error: "message required" });
      const { rows } = await pool.query(
        `INSERT INTO public.support_messages (ticket_id, sender_id, sender_email, message, image_url)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [
          req.params.id,
          req.user.id,
          req.user.email,
          message,
          image_url || null,
        ],
      );
      res.json({ ok: true, message: rows[0] });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  },
);

// PATCH /api/support/tickets/:id
app.patch("/api/support/tickets/:id", requireSupportAuth, async (req, res) => {
  try {
    const { status, priority, assigned_to } = req.body || {};
    const sets = [];
    const params = [];
    let idx = 0;
    if (status !== undefined) {
      idx++;
      sets.push(`status = $${idx}`);
      params.push(status);
    }
    if (priority !== undefined) {
      idx++;
      sets.push(`priority = $${idx}`);
      params.push(priority);
    }
    if (assigned_to !== undefined) {
      idx++;
      sets.push(`assigned_to = $${idx}`);
      params.push(assigned_to);
    }
    if (sets.length === 0)
      return res.status(400).json({ ok: false, error: "no fields to update" });
    idx++;
    params.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE public.support_tickets SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      params,
    );
    if (rows.length === 0)
      return res.status(404).json({ ok: false, error: "ticket not found" });
    res.json({ ok: true, ticket: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/support/upload — file upload (stores locally, returns URL)
app.post("/api/support/upload", requireSupportAuth, async (req, res) => {
  try {
    const { file_data, file_name } = req.body || {};
    if (!file_data)
      return res
        .status(400)
        .json({ ok: false, error: "file_data required (base64)" });
    const ext = (file_name || "file.png").split(".").pop();
    const storedName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const buffer = Buffer.from(file_data, "base64");
    fs.writeFileSync(path.join(UPLOAD_DIR, storedName), buffer);
    res.json({ ok: true, url: `/uploads/${storedName}` });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Serve uploaded files
app.use("/uploads", express.static(UPLOAD_DIR));

// =============================================================================
// Settings / Fiscal CRUD
// =============================================================================
const SETTINGS_TABLES = {
  company: "company_settings",
  "fiscal-entities": "fiscal_entities",
  branches: "company_branches",
  warehouses: "company_warehouses",
  "tax-rates": "tax_rates",
  "document-sequences": "document_sequences",
  "fiscal-providers": "fiscal_printers_or_providers",
  "municipal-tax": "municipal_tax_settings",
  "legal-permits": "legal_permits",
  "national-taxes": "national_tax_settings",
  "parafiscal-obligations": "parafiscal_obligations",
  "compliance-calendar": "compliance_calendar",
};

// GET /api/settings/:entity — list (or first row for company/singleton tables)
app.get("/api/settings/:entity", requireJwt, async (req, res) => {
  const table = SETTINGS_TABLES[req.params.entity];
  if (!table)
    return res.status(404).json({ ok: false, error: "unknown entity" });
  try {
    const { rows } = await pool.query(
      `SELECT * FROM public.${sanitizeIdent(table)} ORDER BY created_at DESC`,
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/settings/:entity — create
app.post("/api/settings/:entity", requireJwt, async (req, res) => {
  const table = SETTINGS_TABLES[req.params.entity];
  if (!table)
    return res.status(404).json({ ok: false, error: "unknown entity" });
  try {
    const body = { ...req.body };
    // Handle is_default for fiscal_entities
    if (table === "fiscal_entities" && body.is_default) {
      await pool.query(
        "UPDATE public.fiscal_entities SET is_default = false WHERE is_default = true",
      );
    }
    const cols = Object.keys(body);
    const safeCols = cols.map((c) => sanitizeIdent(c)).filter(Boolean);
    const params = safeCols.map(
      (c) => body[cols.find((k) => sanitizeIdent(k) === c) || c],
    );
    const placeholders = safeCols.map((_, i) => `$${i + 1}`);
    const { rows } = await pool.query(
      `INSERT INTO public.${sanitizeIdent(table)} (${safeCols.join(",")}) VALUES (${placeholders.join(",")}) RETURNING *`,
      params,
    );
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// PATCH /api/settings/:entity/:id — update
app.patch("/api/settings/:entity/:id", requireJwt, async (req, res) => {
  const table = SETTINGS_TABLES[req.params.entity];
  if (!table)
    return res.status(404).json({ ok: false, error: "unknown entity" });
  try {
    const body = { ...req.body };
    // Handle is_default for fiscal_entities
    if (table === "fiscal_entities" && body.is_default) {
      await pool.query(
        "UPDATE public.fiscal_entities SET is_default = false WHERE is_default = true",
      );
    }
    const cols = Object.keys(body);
    const params = [];
    const sets = cols.map((c, i) => {
      params.push(body[c]);
      return `${sanitizeIdent(c)} = $${i + 1}`;
    });
    params.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE public.${sanitizeIdent(table)} SET ${sets.join(",")} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (rows.length === 0)
      return res.status(404).json({ ok: false, error: "not found" });
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// DELETE /api/settings/:entity/:id
app.delete("/api/settings/:entity/:id", requireJwt, async (req, res) => {
  const table = SETTINGS_TABLES[req.params.entity];
  if (!table)
    return res.status(404).json({ ok: false, error: "unknown entity" });
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM public.${sanitizeIdent(table)} WHERE id = $1`,
      [req.params.id],
    );
    if (rowCount === 0)
      return res.status(404).json({ ok: false, error: "not found" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// =============================================================================
// Generic Data Proxy (replaces Supabase .from() calls)
// =============================================================================

const DATA_TABLES_ALLOWED = [
  "accounts_payable",
  "attendance_logs",
  "bank_accounts",
  "bank_initial_balances",
  "bank_transfers",
  "banks",
  "brands",
  "cashea_installments",
  "couriers",
  "customers",
  "daily_rates",
  "deliveries",
  "delivery_zones",
  "expense_recipients",
  "expenses",
  "fordmac_config",
  "income_lines",
  "income_payments",
  "incomes",
  "inventory_movements",
  "payable_payments",
  "physical_inventory",
  "physical_inventory_lines",
  "products",
  "purchase_lines",
  "purchase_order_lines",
  "purchase_orders",
  "sellers",
  "stock_snapshot_lines",
  "stock_snapshots",
  "suppliers",
  "support_messages",
  "support_tickets",
  "sync_logs",
  "transfer_drafts",
  "transferencias_internas_v4",
  "user_roles",
  "v_envios_nacionales",
  "v_latest_stock_by_branch",
  "v_sales_filters",
  "v_sales_lines",
  "v_support_tickets",
  "v_transferencias_final_v4",
  "vw_inventory_dashboard_stats",
  "vw_inventory_top_discrepancias",
  "wa_conversations",
  "wa_instances",
  "wa_messages",
  "wa_quick_replies",
];

function sanitizeIdent(s) {
  if (typeof s !== "string") return "";
  return s.replace(/[^a-z0-9_]/gi, "");
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
    let selectCols = "*";
    if (req.query.select) {
      const cols = req.query.select
        .split(",")
        .map((c) => sanitizeIdent(c.trim()))
        .filter(Boolean);
      if (cols.length > 0) selectCols = cols.join(", ");
    }

    let sql = `SELECT ${selectCols} FROM public.${safeTable}`;
    const params = [];
    const conditions = [];
    const orderClauses = [];
    let limitVal = null;
    let offsetVal = null;
    let countExact = req.query.count === "exact";

    for (const [key, value] of Object.entries(req.query)) {
      if (
        [
          "select",
          "order",
          "limit",
          "offset",
          "single",
          "count",
          "range_start",
          "range_end",
          "id_col",
        ].includes(key)
      )
        continue;

      if (key.startsWith("eq_")) {
        const col = sanitizeIdent(key.slice(3));
        if (col) {
          conditions.push(`${col} = $${params.length + 1}`);
          params.push(value);
        }
      } else if (key.startsWith("neq_")) {
        const col = sanitizeIdent(key.slice(4));
        if (col) {
          conditions.push(`${col} != $${params.length + 1}`);
          params.push(value);
        }
      } else if (key.startsWith("in_")) {
        const col = sanitizeIdent(key.slice(3));
        if (col && value) {
          const vals = value
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean);
          if (vals.length > 0) {
            const placeholders = vals.map((v) => {
              params.push(v);
              return `$${params.length}`;
            });
            conditions.push(`${col} IN (${placeholders.join(",")})`);
          }
        }
      } else if (key.startsWith("gt_")) {
        const col = sanitizeIdent(key.slice(3));
        if (col) {
          conditions.push(`${col} > $${params.length + 1}`);
          params.push(value);
        }
      } else if (key.startsWith("gte_")) {
        const col = sanitizeIdent(key.slice(4));
        if (col) {
          conditions.push(`${col} >= $${params.length + 1}`);
          params.push(value);
        }
      } else if (key.startsWith("lt_")) {
        const col = sanitizeIdent(key.slice(3));
        if (col) {
          conditions.push(`${col} < $${params.length + 1}`);
          params.push(value);
        }
      } else if (key.startsWith("lte_")) {
        const col = sanitizeIdent(key.slice(4));
        if (col) {
          conditions.push(`${col} <= $${params.length + 1}`);
          params.push(value);
        }
      } else if (key.startsWith("ilike_")) {
        const col = sanitizeIdent(key.slice(6));
        if (col) {
          conditions.push(`${col} ILIKE $${params.length + 1}`);
          params.push(value);
        }
      } else if (key.startsWith("is_")) {
        const col = sanitizeIdent(key.slice(3));
        if (col) {
          conditions.push(`${col} IS ${value === "null" ? "NULL" : value}`);
        }
      }
    }

    if (req.query.order) {
      const parts = Array.isArray(req.query.order)
        ? req.query.order
        : [req.query.order];
      for (const o of parts) {
        const [col, dir] = o.split(".");
        const sc = sanitizeIdent(col);
        if (sc) orderClauses.push(`${sc} ${dir === "desc" ? "DESC" : "ASC"}`);
      }
    }

    if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");
    if (orderClauses.length > 0) sql += " ORDER BY " + orderClauses.join(", ");

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
      const countSql = `SELECT COUNT(*) FROM public.${safeTable}${conditions.length > 0 ? " WHERE " + conditions.join(" AND ") : ""}`;
      const countResult = await pool.query(countSql, params);
      count = parseInt(countResult.rows[0].count);
    }

    const { rows } = await pool.query(sql, params);

    if (req.query.single === "true") {
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

    if (rows.length === 0)
      return res.status(400).json({ ok: false, error: "empty body" });

    const cols = Object.keys(rows[0]);
    const safeCols = cols.map((c) => sanitizeIdent(c)).filter(Boolean);

    const allParams = [];
    const valuePlaceholders = rows.map((row) => {
      return (
        "(" +
        safeCols
          .map((c, i) => {
            allParams.push(row[cols[i]]);
            return `$${allParams.length}`;
          })
          .join(",") +
        ")"
      );
    });

    let sql = `INSERT INTO public.${safeTable} (${safeCols.join(",")}) VALUES ${valuePlaceholders.join(",")}`;
    if (req.query.select === "true" || req.query.returning) {
      sql += " RETURNING *";
    }

    const { rows: inserted } = await pool.query(sql, allParams);
    res.json({ ok: true, data: isArray ? inserted : inserted[0] || rows[0] });
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
    const idCol = sanitizeIdent(req.query.id_col || "id");
    if (!idCol)
      return res.status(400).json({ ok: false, error: "invalid id_col" });

    const body = req.body;
    const cols = Object.keys(body);
    if (cols.length === 0)
      return res.status(400).json({ ok: false, error: "empty body" });

    const params = [];
    const setClauses = cols.map((c) => {
      const sc = sanitizeIdent(c);
      params.push(body[c]);
      return `${sc} = $${params.length}`;
    });
    params.push(id);

    const sql = `UPDATE public.${safeTable} SET ${setClauses.join(",")} WHERE ${idCol} = $${params.length} RETURNING *`;
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
    const idCol = sanitizeIdent(req.query.id_col || "id");
    if (!idCol)
      return res.status(400).json({ ok: false, error: "invalid id_col" });

    const { rowCount } = await pool.query(
      `DELETE FROM public.${safeTable} WHERE ${idCol} = $1`,
      [id],
    );
    res.json({ ok: true, deleted: rowCount });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// =============================================================================
// TDP Users Management
// =============================================================================

function requireUserAdmin(req, res, next) {
  if (!["superadmin", "admin"].includes(req.tdpUser.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }
  next();
}

// GET /api/tdp/users
app.get(
  "/api/tdp/users",
  requireTDPAuth,
  requireUserAdmin,
  async (req, res) => {
    try {
      const { rows } = await tdpPool.query(
        "SELECT id, email, full_name, role, status, client_id, last_login_at, created_at FROM tdpadmin.users ORDER BY full_name ASC",
      );
      res.json({ ok: true, users: rows });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  },
);

// POST /api/tdp/users
app.post(
  "/api/tdp/users",
  requireTDPAuth,
  requireUserAdmin,
  async (req, res) => {
    try {
      const { email, password, full_name, role } = req.body || {};
      if (!email || !password)
        return res
          .status(400)
          .json({ ok: false, error: "email and password required" });
      const validRoles = [
        "superadmin",
        "admin",
        "director",
        "project_manager",
        "developer",
        "sales",
        "support",
        "finance",
        "staff",
        "client",
      ];
      const userRole = validRoles.includes(role) ? role : "staff";
      const hash = bcrypt.hashSync(password, 10);
      const { rows } = await tdpPool.query(
        `INSERT INTO tdpadmin.users (email, password_hash, full_name, role) VALUES ($1,$2,$3,$4)
       RETURNING id, email, full_name, role, status, created_at`,
        [email.trim().toLowerCase(), hash, full_name || email, userRole],
      );
      res.json({ ok: true, user: rows[0] });
    } catch (e) {
      const msg =
        e?.constraint === "tdpadmin_users_email_key"
          ? "email already exists"
          : String(e?.message || e);
      res.status(400).json({ ok: false, error: msg });
    }
  },
);

// PATCH /api/tdp/users/:id
app.patch(
  "/api/tdp/users/:id",
  requireTDPAuth,
  requireUserAdmin,
  async (req, res) => {
    try {
      const sets = [];
      const params = [];
      let idx = 0;
      for (const key of ["full_name", "role", "status"]) {
        if (req.body[key] !== undefined) {
          idx++;
          sets.push(`${key} = $${idx}`);
          params.push(req.body[key]);
        }
      }
      if (req.body.password) {
        idx++;
        sets.push(`password_hash = $${idx}`);
        params.push(bcrypt.hashSync(req.body.password, 10));
      }
      if (sets.length === 0)
        return res.status(400).json({ ok: false, error: "no fields" });
      idx++;
      params.push(req.params.id);
      const { rows } = await tdpPool.query(
        `UPDATE tdpadmin.users SET ${sets.join(", ")} WHERE id = $${idx} RETURNING id, email, full_name, role, status, created_at`,
        params,
      );
      if (rows.length === 0)
        return res.status(404).json({ ok: false, error: "not found" });
      res.json({ ok: true, user: rows[0] });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  },
);

// DELETE /api/tdp/users/:id — soft delete
app.delete(
  "/api/tdp/users/:id",
  requireTDPAuth,
  requireUserAdmin,
  async (req, res) => {
    try {
      const { rowCount } = await tdpPool.query(
        "UPDATE tdpadmin.users SET status = 'inactive' WHERE id = $1 AND status = 'active'",
        [req.params.id],
      );
      if (rowCount === 0)
        return res
          .status(404)
          .json({ ok: false, error: "not found or already inactive" });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  },
);

// =============================================================================
// Public: Quote sharing (no auth required)
// =============================================================================

// GET /api/p/quotes/:id — public view
app.get("/api/p/quotes/:id", async (req, res) => {
  try {
    const { rows } = await tdpPool.query(
      `SELECT q.*, c.name AS client_name, c.email AS client_email, c.phone AS client_phone
       FROM tdpadmin.quotes q
       LEFT JOIN tdpadmin.clients c ON c.id = q.client_id
       WHERE q.id = $1`,
      [req.params.id],
    );
    if (rows.length === 0)
      return res.status(404).json({ ok: false, error: "not found" });
    const { rows: items } = await tdpPool.query(
      "SELECT * FROM tdpadmin.quote_items WHERE quote_id = $1 ORDER BY display_order ASC, created_at ASC",
      [req.params.id],
    );
    res.json({ ok: true, quote: { ...rows[0], items } });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// GET /api/p/view/:id — public quote page (HTML)
app.get("/api/p/view/:id", async (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Presupuesto — Taller de Pixeles</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
*{font-family:'Inter',sans-serif;margin:0;padding:0;box-sizing:border-box}
body{background:#f3f4f6;padding:24px}
@media print{body{padding:0;background:#fff}.no-print{display:none!important}}
.quote-card{max-width:900px;margin:0 auto;background:#fff;border-radius:24px;box-shadow:0 4px 6px -1px rgba(0,0,0,.07),0 10px 40px -2px rgba(0,0,0,.08);overflow:hidden}
.header-bar{background:linear-gradient(135deg,#0a1628,#0d1f3c);padding:32px 40px;color:#fff}
.header-bar .logo-area{display:flex;align-items:center;gap:16px}
.header-bar .logo-area img{width:48px;height:48px;border-radius:12px;background:rgba(255,255,255,.1);padding:8px}
.header-bar h1{font-size:20px;font-weight:700}
.header-bar h1 span{color:#009FE3}
.header-bar .company-info{font-size:12px;color:rgba(255,255,255,.6);line-height:1.6;margin-top:4px}
.header-bar .badge{display:inline-block;padding:6px 16px;border-radius:20px;font-size:12px;font-weight:600;background:rgba(255,255,255,.1);color:#fff}
.section{padding:32px 40px}
.section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;margin-bottom:12px;border-bottom:2px solid #f3f4f6;padding-bottom:8px}
table{width:100%;border-collapse:collapse}
thead th{padding:10px 12px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;border-bottom:2px solid #e5e7eb}
thead th:first-child{text-align:left}
tbody td{padding:14px 12px;font-size:14px;border-bottom:1px solid #f3f4f6;text-align:right}
tbody td:first-child{text-align:left;color:#111827;font-weight:500}
tbody td:not(:first-child){font-family:'Courier New',monospace;color:#374151}
tfoot td{padding:12px;font-size:15px;text-align:right;font-family:'Courier New',monospace;font-weight:700}
tfoot tr:last-child td{border-top:2px solid #111827;font-size:18px;color:#111827}
.btn{padding:12px 28px;border-radius:14px;font-size:14px;font-weight:600;border:none;cursor:pointer;transition:all .2s;text-decoration:none;display:inline-flex;align-items:center;gap:8px}
.btn:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.15)}
.btn-primary{background:#009FE3;color:#fff}
.btn-primary:hover{background:#0088c4}
.btn-success{background:#059669;color:#fff}
.btn-success:hover{background:#047857}
.btn-danger{background:#dc2626;color:#fff}
.btn-danger:hover{background:#b91c1c}
.btn-warning{background:#d97706;color:#fff}
.btn-warning:hover{background:#b45309}
.btn-outline{background:transparent;border:1px solid #d1d5db;color:#374151}
.btn-outline:hover{background:#f9fafb}
.footer{background:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;line-height:1.6;text-align:center}
.footer strong{color:#374151}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.info-grid .label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;margin-bottom:4px}
.info-grid .value{font-size:14px;color:#111827}
@media(max-width:640px){.header-bar,.section,.footer{padding:20px}.info-grid{grid-template-columns:1fr}.btn{width:100%;justify-content:center}}
</style>
</head>
<body>
<div id="app" class="quote-card">
  <div class="text-center py-20 text-gray-400">Cargando...</div>
</div>
<script>
const API = window.location.origin;
const currUSD = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const currVES = new Intl.NumberFormat('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2});

fetch(API + '/api/p/quotes/' + location.pathname.split('/').pop())
  .then(r => r.json())
  .then(j => {
    if (!j.ok) throw new Error(j.error);
    const q = j.quote;
    const items = q.items || [];
    const er = q.exchange_rate;
    const hasVES = er && er > 0;
    const st = q.status;
    const isSent = st === 'sent';
    const statusBadge = {draft:'Borrador',sent:'Enviado',approved:'Aprobado',rejected:'Rechazado',expired:'Vencido',cancelled:'Cancelado'}[st]||st;
    const statusColor = {draft:'rgba(107,114,128,.15)',sent:'rgba(0,159,227,.15)',approved:'rgba(5,150,105,.15)',rejected:'rgba(220,38,38,.15)'}[st]||'rgba(107,114,128,.15)';
    const statusTextColor = {draft:'#6b7280',sent:'#009FE3',approved:'#059669',rejected:'#dc2626'}[st]||'#6b7280';

    document.getElementById('app').innerHTML = \`
      <div class="header-bar">
        <div style="text-align:center">
          <div style="margin-bottom:8px">
            <img src="https://admin.tallerdepixeles.com/ISOTIPOTDP.png" alt="TDP" style="max-width:160px;height:auto;display:block;margin:0 auto;filter:brightness(0)invert(1)">
          </div>
          <div class="company-info" style="font-size:13px;color:rgba(255,255,255,.6);line-height:1.7">
            Taller de Pixeles, C.A. · RIF J-50000272-6<br>
            Av. San Carlos, Qta. San Onofre, La Floresta, Altamira<br>
            Tel: 0414-7131270 / 0414-2530115
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:20px;flex-wrap:wrap;gap:12px">
          <div style="font-size:28px;font-weight:800;color:#fff">\${q.quote_number}</div>
          <span style="display:inline-block;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;background:\${statusColor};color:\${statusTextColor}">\${statusBadge}</span>
        </div>
      </div>

      <div class="section">
        <div class="info-grid">
          <div>
            <div class="label">Cliente</div>
            <div class="value">\${q.client_name || '—'}</div>
            \${q.client_email ? '<div style="font-size:13px;color:#6b7280;margin-top:2px">' + q.client_email + '</div>' : ''}
          </div>
          <div>
            <div class="label">Presupuesto</div>
            <div class="value">\${q.title || '—'}</div>
            \${q.valid_until ? '<div style="font-size:13px;color:#6b7280;margin-top:2px">Valido hasta: ' + q.valid_until.split('T')[0] + '</div>' : ''}
          </div>
        </div>
      </div>

      <div class="section" style="padding-top:0">
        <div class="section-title">Detalle de la propuesta</div>
        <table>
          <thead><tr>
            <th style="width:45%">Descripcion</th>
            <th style="width:10%">Cant.</th>
            <th style="width:15%">Precio USD</th>
            <th style="width:15%">Total USD</th>
            \${hasVES ? '<th style="width:15%">Total Bs.</th>' : ''}
          </tr></thead>
          <tbody>
            \${items.map(it => {
              const tusd = Number(it.total_price);
              return \`<tr>
                <td>\${it.description}</td>
                <td>\${Number(it.quantity).toFixed(2)}</td>
                <td>\${currUSD.format(Number(it.unit_price))}</td>
                <td>\${currUSD.format(tusd)}</td>
                \${hasVES ? '<td style="color:#6b7280">Bs. ' + currVES.format(tusd * er) + '</td>' : ''}
              </tr>\`;
            }).join('')}
          </tbody>
          \${Number(q.discount) > 0 ? '<tfoot><tr><td colspan="' + (hasVES ? 4 : 3) + '" style="text-align:right;color:#6b7280;font-weight:400;font-size:14px">Descuento</td><td style="color:#dc2626">-' + currUSD.format(Number(q.discount)) + '</td></tr></tfoot>' : ''}
          <tfoot><tr><td colspan="\${hasVES ? 4 : 3}" style="font-size:18px">Total</td><td style="font-size:18px">\${currUSD.format(Number(q.total))}</td>
            \${hasVES ? '<td style="font-size:15px;color:#6b7280">Bs. ' + currVES.format(Number(q.total) * er) + '</td>' : ''}
          </tr></tfoot>
        </table>
        \${hasVES ? '<div style="font-size:12px;color:#9ca3af;margin-top:8px;text-align:right">Tasa de cambio: 1 USD = Bs. ' + Number(er).toFixed(2) + '</div>' : ''}
      </div>

      \${q.notes ? '<div class="section" style="padding-top:0"><div class="section-title">Notas</div><div style="font-size:14px;color:#374151;line-height:1.6;white-space:pre-line">' + q.notes.replace(/\\n/g,'<br>') + '</div></div>' : ''}

      <div class="section" style="padding-top:0">
        <div class="section-title">Datos de pago</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div style="background:#f9fafb;border-radius:12px;padding:16px;font-size:13px;line-height:1.6">
            <strong style="color:#111827;display:block;margin-bottom:6px">Banplus — Cuenta Corriente</strong>
            <span style="color:#6b7280">Transferencias</span><br>
            <span style="font-family:'Courier New',monospace;font-weight:600;color:#111827">0174 0131 93 1314977321</span><br>
            <span style="color:#6b7280">J-500002726</span><br>
            <span style="color:#6b7280">Taller de Pixeles, C.A.</span>
          </div>
          <div style="background:#f9fafb;border-radius:12px;padding:16px;font-size:13px;line-height:1.6">
            <strong style="color:#111827;display:block;margin-bottom:6px">Banplus — Pago Movil</strong>
            <span style="color:#6b7280">0422 7493537</span><br>
            <span style="color:#6b7280">J-500002726</span><br>
            <span style="color:#6b7280">Taller de Pixeles, C.A.</span>
          </div>
        </div>
      </div>

      \${isSent ? '<div class="section" style="padding-top:0;padding-bottom:0"><div class="section-title">Acciones</div></div><div class="section" style="padding-top:12px"><div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center">' +
        '<button class="btn btn-success" onclick="doAction(\\'approve\\')">✅ Aprobar presupuesto</button>' +
        '<button class="btn btn-danger" onclick="promptReject()">❌ Rechazar</button>' +
        '<button class="btn btn-warning" onclick="promptChanges()">✏️ Solicitar cambio</button>' +
      '</div><div id="actionMsg" style="text-align:center;font-size:14px;margin-top:12px;color:#059669;font-weight:600"></div></div>' : ''}

      <div class="footer">
        <strong>Taller de Pixeles, C.A.</strong> · RIF J-50000272-6<br>
        Av. San Carlos, Qta. San Onofre, La Floresta, Altamira<br>
        Tel: 0414-7131270 / 0414-2530115<br><br>
        <span style="font-size:11px">© \${new Date().getFullYear()} Taller de Pixeles C.A. — Todos los derechos reservados</span>
        <span class="no-print" style="display:block;margin-top:12px"><button class="btn btn-outline" onclick="window.print()" style="font-size:12px;padding:8px 20px">🖨️ Imprimir / PDF</button></span>
      </div>
    \`;
  })
  .catch(e => { document.getElementById('app').innerHTML = '<div class="quote-card"><div style="padding:60px;text-align:center;color:#dc2626;font-size:16px">Error: ' + e.message + '</div></div>'; });

function doAction(action) {
  fetch(API + '/api/p/quotes/' + location.pathname.split('/').pop() + '/' + action, { method:'POST' })
    .then(r => r.json()).then(j => { if(j.ok) location.reload(); else alert(j.error); });
}

function promptReject() {
  const reason = prompt('Motivo del rechazo (opcional):');
  fetch(API + '/api/p/quotes/' + location.pathname.split('/').pop() + '/reject', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ reason })
  }).then(r => r.json()).then(j => { if(j.ok) location.reload(); else alert(j.error); });
}

function promptChanges() {
  const msg = prompt('Describe que cambios necesitas:');
  if (!msg) return;
  fetch(API + '/api/p/quotes/' + location.pathname.split('/').pop() + '/request-changes', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ message: msg })
  }).then(r => r.json()).then(j => { if(j.ok) location.reload(); else alert(j.error); });
}
</script>
</body>
</html>`);
});

// POST /api/p/quotes/:id/approve — public approve
app.post("/api/p/quotes/:id/approve", async (req, res) => {
  try {
    const { rows } = await tdpPool.query(
      "UPDATE tdpadmin.quotes SET status = 'approved', approved_at = NOW() WHERE id = $1 AND status = 'sent' RETURNING *",
      [req.params.id],
    );
    if (rows.length === 0)
      return res
        .status(400)
        .json({ ok: false, error: "quote not found or not in sent status" });
    res.json({ ok: true, quote: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/p/quotes/:id/reject — public reject
app.post("/api/p/quotes/:id/reject", async (req, res) => {
  try {
    const { reason } = req.body || {};
    const { rows } = await tdpPool.query(
      "UPDATE tdpadmin.quotes SET status = 'rejected', notes = CASE WHEN $2::text IS NOT NULL THEN COALESCE(notes, '') || E'\\nMotivo de rechazo: ' || $2 ELSE notes END WHERE id = $1 AND status = 'sent' RETURNING *",
      [req.params.id, reason || null],
    );
    if (rows.length === 0)
      return res
        .status(400)
        .json({ ok: false, error: "quote not found or not in sent status" });
    res.json({ ok: true, quote: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/p/quotes/:id/request-changes — public request changes
app.post("/api/p/quotes/:id/request-changes", async (req, res) => {
  try {
    const { message } = req.body || {};
    const { rows } = await tdpPool.query(
      "UPDATE tdpadmin.quotes SET status = 'draft', notes = COALESCE(notes, '') || E'\\nSolicitud de cambio: ' || $2 WHERE id = $1 AND status = 'sent' RETURNING *",
      [req.params.id, message || ""],
    );
    if (rows.length === 0)
      return res
        .status(400)
        .json({ ok: false, error: "quote not found or not in sent status" });
    res.json({ ok: true, quote: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// =============================================================================
// Public: Landing page & lead capture
// =============================================================================

// POST /api/p/lead — capture prospect from landing page
app.post("/api/p/lead", async (req, res) => {
  try {
    const { name, email, phone, company, service, message } = req.body || {};
    if (!name || !email)
      return res
        .status(400)
        .json({ ok: false, error: "name and email required" });
    const interest = service || "no especificado";
    const { rows } = await tdpPool.query(
      `INSERT INTO tdpadmin.clients (name, email, phone, company_name, interest, source, status, kind, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,'web','lead','prospect',$6,(SELECT id FROM tdpadmin.users WHERE role='superadmin' LIMIT 1))
       RETURNING id`,
      [name, email, phone || "", company || "", interest, message || ""],
    );
    res.json({ ok: true, client_id: rows[0].id });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});


// =============================================================================
// TDP Connect Leads
// =============================================================================

// GET /api/tdp/connect/leads
app.get("/api/tdp/connect/leads", requireTDPAuth, async (req, res) => {
  try {
    const { rows } = await tdpPool.query(
      "SELECT id, name, email, phone, company_name, interest, notes, source, status, estimated_budget, created_at FROM tdpadmin.clients WHERE interest ILIKE '%TDP Connect%' OR source = 'web' ORDER BY created_at DESC"
    );
    res.json({ ok: true, leads: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// PATCH /api/tdp/connect/leads/:id
app.patch("/api/tdp/connect/leads/:id", requireTDPAuth, async (req, res) => {
  try {
    const { status, notes } = req.body || {};
    const sets = []; const params = []; let idx = 0;
    if (status !== undefined) { idx++; sets.push(`status = $${idx}`); params.push(status); }
    if (notes !== undefined) { idx++; sets.push(`notes = $${idx}`); params.push(notes); }
    if (sets.length === 0) return res.status(400).json({ ok: false, error: "no fields" });
    idx++; params.push(req.params.id);
    const { rows } = await tdpPool.query(
      `UPDATE tdpadmin.clients SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, name, email, phone, company_name, interest, notes, source, status, created_at`, params
    );
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "not found" });
    res.json({ ok: true, lead: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// =============================================================================
// TDP Admin Partners
// =============================================================================

// GET /api/tdp/partners/dashboard — partner's own dashboard
app.get("/api/tdp/partners/dashboard", requireTDPAuth, async (req, res) => {
  try {
    const uid = req.tdpUser.id;
    const clientLeads = await tdpPool.query(
      "SELECT COUNT(*) AS total FROM tdpadmin.clients WHERE created_by = $1", [uid]
    );
    const commissions = await tdpPool.query(
      "SELECT COUNT(*) FILTER (WHERE status = 'pending') AS pending, COALESCE(SUM(commission_amount) FILTER (WHERE status IN ('approved','paid')), 0) AS earned FROM tdpadmin.commissions WHERE partner_id = $1", [uid]
    );
    const ranking = await tdpPool.query(
      "SELECT partner_id, SUM(commission_amount) AS total FROM tdpadmin.commissions WHERE status IN ('approved','paid') GROUP BY partner_id ORDER BY total DESC"
    );
    const rank = ranking.rows.findIndex(r => r.partner_id === uid) + 1;
    res.json({ ok: true, dashboard: {
      total_leads: Number(clientLeads.rows[0].total),
      pending_commissions: Number(commissions.rows[0].pending),
      total_earned: Number(commissions.rows[0].earned),
      ranking: rank > 0 ? rank : ranking.rows.length + 1,
    }});
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// GET /api/tdp/partners/commission — partner's commission list
app.get("/api/tdp/partners/commission", requireTDPAuth, async (req, res) => {
  try {
    const { rows } = await tdpPool.query(
      "SELECT * FROM tdpadmin.commissions WHERE partner_id = $1 ORDER BY created_at DESC",
      [req.tdpUser.id]
    );
    res.json({ ok: true, commissions: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// GET /api/tdp/partners/profile — partner's own profile
app.get("/api/tdp/partners/profile", requireTDPAuth, async (req, res) => {
  try {
    const { rows } = await tdpPool.query(
      "SELECT id, email, full_name, role, referral_code, bank_name, bank_account_type, bank_account_number, bank_document_id, bank_phone, commission_rate, created_at FROM tdpadmin.users WHERE id = $1",
      [req.tdpUser.id]
    );
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "not found" });
    res.json({ ok: true, profile: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// PATCH /api/tdp/partners/profile — update own profile
app.patch("/api/tdp/partners/profile", requireTDPAuth, async (req, res) => {
  try {
    const allowed = ['full_name', 'bank_name', 'bank_account_type', 'bank_account_number', 'bank_document_id', 'bank_phone'];
    const sets = []; const params = []; let idx = 0;
    for (const key of allowed) {
      if (req.body[key] !== undefined) { idx++; sets.push(`${key} = $${idx}`); params.push(req.body[key]); }
    }
    if (sets.length === 0) return res.status(400).json({ ok: false, error: "no fields" });
    idx++; params.push(req.tdpUser.id);
    const { rows } = await tdpPool.query(
      `UPDATE tdpadmin.users SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, email, full_name, role, referral_code, bank_name, bank_account_type, bank_account_number, bank_document_id, bank_phone, commission_rate`,
      params
    );
    res.json({ ok: true, profile: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Admin: GET /api/tdp/partners — list all partners
app.get("/api/tdp/partners", requireTDPAuth, async (req, res) => {
  if (!['superadmin', 'admin'].includes(req.tdpUser.role)) return res.status(403).json({ ok: false, error: "forbidden" });
  try {
    const { rows } = await tdpPool.query(
      `SELECT u.id, u.email, u.full_name, u.role, u.referral_code, u.commission_rate, u.created_at,
        (SELECT COUNT(*) FROM tdpadmin.clients WHERE created_by = u.id) AS total_leads,
        (SELECT COALESCE(SUM(commission_amount),0) FROM tdpadmin.commissions WHERE partner_id = u.id AND status IN ('approved','paid')) AS total_earned
       FROM tdpadmin.users u WHERE u.role = 'sales' ORDER BY u.full_name ASC`
    );
    res.json({ ok: true, partners: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Admin: GET /api/tdp/partners/commissions — all commissions
app.get("/api/tdp/partners/commissions", requireTDPAuth, async (req, res) => {
  if (!['superadmin', 'admin'].includes(req.tdpUser.role)) return res.status(403).json({ ok: false, error: "forbidden" });
  try {
    const { rows } = await tdpPool.query(
      `SELECT c.*, u.full_name AS partner_name FROM tdpadmin.commissions c
       LEFT JOIN tdpadmin.users u ON u.id = c.partner_id ORDER BY c.created_at DESC`
    );
    res.json({ ok: true, commissions: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Admin: POST /api/tdp/partners/commissions — create commission
app.post("/api/tdp/partners/commissions", requireTDPAuth, async (req, res) => {
  if (!['superadmin', 'admin'].includes(req.tdpUser.role)) return res.status(403).json({ ok: false, error: "forbidden" });
  try {
    const { partner_id, client_id, project_name, client_name, project_value, commission_rate } = req.body || {};
    if (!partner_id || !project_value) return res.status(400).json({ ok: false, error: "partner_id and project_value required" });
    const rate = Number(commission_rate || 10);
    const amount = Number(project_value) * rate / 100;
    const { rows } = await tdpPool.query(
      `INSERT INTO tdpadmin.commissions (partner_id, client_id, project_name, client_name, project_value, commission_rate, commission_amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [partner_id, client_id || null, project_name || '', client_name || '', Number(project_value), rate, amount]
    );
    res.json({ ok: true, commission: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Admin: PATCH /api/tdp/partners/:id — update partner (commission_rate)
app.patch("/api/tdp/partners/:id", requireTDPAuth, async (req, res) => {
  if (!['superadmin', 'admin'].includes(req.tdpUser.role)) return res.status(403).json({ ok: false, error: "forbidden" });
  try {
    const { commission_rate } = req.body || {};
    if (commission_rate === undefined) return res.status(400).json({ ok: false, error: "commission_rate required" });
    const rate = Math.min(Math.max(Number(commission_rate), 0), 100);
    const { rows } = await tdpPool.query(
      "UPDATE tdpadmin.users SET commission_rate = $1 WHERE id = $2 AND role = 'sales' RETURNING id, email, full_name, role, commission_rate",
      [rate, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "partner not found" });
    res.json({ ok: true, partner: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Admin: PATCH /api/tdp/partners/commissions/:id — update commission status
app.patch("/api/tdp/partners/commissions/:id", requireTDPAuth, async (req, res) => {
  if (!['superadmin', 'admin'].includes(req.tdpUser.role)) return res.status(403).json({ ok: false, error: "forbidden" });
  try {
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ ok: false, error: "status required" });
    const extra = status === 'paid' ? ", paid_at = NOW()" : "";
    const { rows } = await tdpPool.query(
      `UPDATE tdpadmin.commissions SET status = $1${extra} WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "not found" });
    res.json({ ok: true, commission: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// =============================================================================
// TDP Dashboard — summary of all modules
// =============================================================================

app.get("/api/tdp/dashboard/summary", requireTDPAuth, async (req, res) => {
  try {
    const [support, projects, crm, quotes, connect, commissions, recent] = await Promise.all([
      tdpPool.query("SELECT * FROM tdpadmin.vw_support_stats"),
      tdpPool.query("SELECT * FROM tdpadmin.vw_project_stats"),
      tdpPool.query("SELECT * FROM tdpadmin.vw_crm_stats"),
      tdpPool.query("SELECT * FROM tdpadmin.vw_quote_stats"),
      tdpPool.query("SELECT * FROM tdpadmin.vw_connect_stats"),
      tdpPool.query("SELECT * FROM tdpadmin.vw_commission_stats"),
      tdpPool.query("SELECT * FROM tdpadmin.vw_recent_activity"),
    ]);
    res.json({
      ok: true,
      dashboard: {
        support: support.rows[0] || {},
        projects: projects.rows[0] || {},
        crm: crm.rows[0] || {},
        quotes: quotes.rows[0] || {},
        connect: connect.rows[0] || {},
        commissions: commissions.rows[0] || {},
        recent_activity: recent.rows || [],
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// =============================================================================
// Public endpoints (token-based auth for external systems like RG7)
// =============================================================================

function requirePublicToken(req, res, next) {
  const token = req.headers["x-api-token"];
  if (!token || token !== PUBLIC_API_TOKEN) {
    return res.status(401).json({ ok: false, error: "token inválido" });
  }
  next();
}

// Create ticket from external client
app.post("/api/public/tickets", requirePublicToken, async (req, res) => {
  try {
    const { title, description, priority, category, client_email, client_name, branch } = req.body;
    if (!title || !description || !client_email || !client_name) {
      return res.status(400).json({ ok: false, error: "faltan campos requeridos" });
    }

    // Map external categories/priorities to internal values
    const priorityMap = { low: 'low', medium: 'normal', high: 'high', urgent: 'urgent' };
    const categoryMap = {
      bug: 'system', feature_request: 'general', support: 'general', other: 'other',
      web: 'web', hosting: 'hosting', email: 'email', domain: 'domain', system: 'system', billing: 'billing', general: 'general'
    };
    const mappedPriority = priorityMap[priority] || 'normal';
    const mappedCategory = categoryMap[category] || 'general';

    const { rows } = await tdpPool.query(
      `INSERT INTO tdpadmin.support_tickets
        (title, description, status, priority, category, client_email, client_name, branch, created_at, updated_at)
       VALUES ($1,$2,'open',$3,$4,$5,$6,$7,NOW(),NOW())
       RETURNING *`,
      [title, description, mappedPriority, mappedCategory, client_email, client_name, branch]
    );
    res.json({ ok: true, ticket: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// List tickets by client email
app.get("/api/public/tickets", requirePublicToken, async (req, res) => {
  try {
    const { client_email } = req.query;
    if (!client_email) {
      return res.status(400).json({ ok: false, error: "client_email requerido" });
    }
    const { rows } = await tdpPool.query(
      `SELECT t.*, COALESCE(u.full_name,'') as assigned_name
       FROM tdpadmin.support_tickets t
       LEFT JOIN tdpadmin.users u ON u.id = t.assigned_to
       WHERE t.client_email = $1
       ORDER BY t.created_at DESC`,
      [client_email]
    );
    res.json({ ok: true, tickets: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Get single ticket
app.get("/api/public/tickets/:id", requirePublicToken, async (req, res) => {
  try {
    const { rows } = await tdpPool.query(
      `SELECT t.*, COALESCE(u.full_name,'') as assigned_name
       FROM tdpadmin.support_tickets t
       LEFT JOIN tdpadmin.users u ON u.id = t.assigned_to
       WHERE t.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "ticket no encontrado" });
    res.json({ ok: true, ticket: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Get messages for a ticket
app.get("/api/public/tickets/:id/messages", requirePublicToken, async (req, res) => {
  try {
    const { rows } = await tdpPool.query(
      `SELECT m.*, COALESCE(u.full_name,'') as sender_name
       FROM tdpadmin.support_messages m
       LEFT JOIN tdpadmin.users u ON u.id = m.sender_id
       WHERE m.ticket_id = $1
       ORDER BY m.created_at ASC`,
      [req.params.id]
    );
    res.json({ ok: true, messages: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Add message to ticket
app.post("/api/public/tickets/:id/messages", requirePublicToken, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ ok: false, error: "message requerido" });
    }
    const { rows: ticketRows } = await tdpPool.query(
      "SELECT id, client_name, client_email FROM tdpadmin.support_tickets WHERE id = $1",
      [req.params.id]
    );
    if (ticketRows.length === 0) return res.status(404).json({ ok: false, error: "ticket no encontrado" });

    const msg = JSON.stringify({ text: message, author: ticketRows[0].client_name });
    const { rows } = await tdpPool.query(
      `INSERT INTO tdpadmin.support_messages (ticket_id, sender_id, sender_email, message, created_at)
       VALUES ($1, NULL, $2, $3, NOW())
       RETURNING *`,
      [req.params.id, ticketRows[0].client_email, msg]
    );

    // Reopen ticket if closed
    await tdpPool.query(
      "UPDATE tdpadmin.support_tickets SET status = 'in_progress', updated_at = NOW() WHERE id = $1 AND status = 'closed'",
      [req.params.id]
    );

    res.json({ ok: true, message: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Update ticket (status only)
app.patch("/api/public/tickets/:id", requirePublicToken, async (req, res) => {
  try {
    const { status, priority } = req.body;
    const sets = [];
    const params = [];
    let idx = 0;
    if (status) {
      const allowed = ['open','in_progress','resolved','closed','cancelled'];
      if (!allowed.includes(status)) return res.status(400).json({ ok: false, error: "status inválido" });
      idx++; sets.push(`status = $${idx}`); params.push(status);
    }
    if (priority) {
      const allowed = ['low','normal','high','urgent'];
      if (!allowed.includes(priority)) return res.status(400).json({ ok: false, error: "priority inválido" });
      idx++; sets.push(`priority = $${idx}`); params.push(priority);
    }
    if (sets.length === 0) return res.status(400).json({ ok: false, error: "nada que actualizar" });
    sets.push(`updated_at = NOW()`);
    idx++; params.push(req.params.id);
    const { rows } = await tdpPool.query(
      `UPDATE tdpadmin.support_tickets SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      params
    );
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "ticket no encontrado" });
    res.json({ ok: true, ticket: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Upload image (base64 → local file)
const PUBLIC_UPLOAD_DIR = process.env.PUBLIC_UPLOAD_DIR || "./public_uploads";
if (!fs.existsSync(PUBLIC_UPLOAD_DIR)) fs.mkdirSync(PUBLIC_UPLOAD_DIR, { recursive: true });

app.post("/api/public/upload", requirePublicToken, async (req, res) => {
  try {
    const { file_data, file_name } = req.body || {};
    if (!file_data) return res.status(400).json({ ok: false, error: "file_data requerido (base64)" });
    const ext = (file_name || "file.png").split(".").pop();
    const storedName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const buffer = Buffer.from(file_data, "base64");
    fs.writeFileSync(path.join(PUBLIC_UPLOAD_DIR, storedName), buffer);
    res.json({ ok: true, url: `/public_uploads/${storedName}` });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// =============================================================================
// Start server
// =============================================================================

// Serve static files (landing page, etc.)
app.use(express.static("public"));
app.use("/public_uploads", express.static(PUBLIC_UPLOAD_DIR));

// Root serves landing
app.get("/", (req, res) => {
  res.sendFile("index.html", { root: "public" });
});

// Demo login (no auth required)
app.get("/api/demo/login", async (req, res) => {
  try {
    const { rows } = await tdpPool.query(
      "SELECT id, email, password_hash, full_name, role FROM tdpadmin.users WHERE email = 'demo@tallerdepixeles.com' LIMIT 1"
    );
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "demo user not found" });
    const token = generateTDPToken(rows[0]);
    res.json({ ok: true, token, redirect: "https://admin.tallerdepixeles.com" });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Legacy redirect
app.get("/api/p/landing", (req, res) => {
  res.redirect(301, "/");
});

app.listen(PORT, () => console.log("restaurantdp-server listening on", PORT));
