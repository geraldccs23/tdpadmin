// supportSync.cjs — Stub para sincronización futura con Admin TDP central
// Cuando TDP_ADMIN_API_URL esté configurado, enviará tickets/mensajes al admin central.
// Por ahora no hace nada.

const TDP_ADMIN_API_URL = process.env.TDP_ADMIN_API_URL || '';
const TDP_ADMIN_API_TOKEN = process.env.TDP_ADMIN_API_TOKEN || '';
const TDP_TENANT_ID = process.env.TDP_TENANT_ID || 'restaurantdp';

async function syncTicketToAdmin(ticketId, pool) {
  if (!TDP_ADMIN_API_URL) return { synced: false, reason: 'TDP_ADMIN_API_URL not configured' };
  try {
    // TODO: Implement when admin.tallerdepixeles.com is ready
    // const { rows } = await pool.query('SELECT * FROM public.v_support_tickets WHERE id = $1', [ticketId]);
    // if (rows.length === 0) return { synced: false, reason: 'ticket not found' };
    // const res = await fetch(`${TDP_ADMIN_API_URL}/api/support/tickets`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TDP_ADMIN_API_TOKEN}` },
    //   body: JSON.stringify({ ...rows[0], tenant_id: TDP_TENANT_ID }),
    // });
    // const json = await res.json();
    // if (json.ok) {
    //   await pool.query('UPDATE public.support_tickets SET sync_status = $2, external_ticket_id = $3 WHERE id = $1', [ticketId, 'synced', json.ticket?.id]);
    //   return { synced: true };
    // }
    return { synced: false, reason: 'not implemented yet' };
  } catch (e) {
    await pool.query('UPDATE public.support_tickets SET sync_status = $2 WHERE id = $1', [ticketId, 'failed']).catch(() => {});
    return { synced: false, reason: String(e?.message || e) };
  }
}

async function syncMessageToAdmin(messageId, pool) {
  if (!TDP_ADMIN_API_URL) return { synced: false, reason: 'TDP_ADMIN_API_URL not configured' };
  // TODO: Implement when admin.tallerdepixeles.com is ready
  return { synced: false, reason: 'not implemented yet' };
}

module.exports = { syncTicketToAdmin, syncMessageToAdmin };
