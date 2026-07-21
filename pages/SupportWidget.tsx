// SupportWidget — Componente portable para integrar soporte TDP
// en cualquier implementación cliente (React 18+).
//
// Uso:
//   <SupportWidget
//     apiToken="token-publico-de-tdp"
//     clientEmail="usuario@cliente.com"
//     clientName="Nombre del Usuario"
//     implementationSlug="restaurant-rg7"
//   />

import React, { useState, useEffect, useCallback, useRef } from 'react';

const API = 'https://api.admin.tallerdepixeles.com/api/public';

interface Ticket { id: string; ticket_number: string; title: string; status: string; priority: string; created_at: string; }
interface Message { id: string; message: string; author_type: string; sender_name: string; created_at: string; }

export function SupportWidget({ apiToken, clientEmail, clientName, implementationSlug }: { apiToken: string; clientEmail: string; clientName: string; implementationSlug?: string }) {
  const [open, setOpen] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [view, setView] = useState<'list' | 'new' | 'chat'>('list');
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<any>(null);

  const headers = { 'Content-Type': 'application/json', 'x-api-token': apiToken };

  const apiFetch = useCallback(async (path: string, data?: any) => {
    const res = await fetch(`${API}${path}`, {
      method: data ? 'POST' : 'GET',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
    return res.json();
  }, [apiToken]);

  const loadTickets = useCallback(async () => {
    const json = await apiFetch(`/tickets?client_email=${encodeURIComponent(clientEmail)}`);
    if (json.ok) setTickets(json.tickets || []);
  }, [apiFetch, clientEmail]);

  const loadMessages = useCallback(async (ticket: Ticket) => {
    setLoading(true);
    const json = await apiFetch(`/tickets/${ticket.id}/messages?client_email=${encodeURIComponent(clientEmail)}`);
    if (json.ok) { setMessages(json.messages || []); setSelected(ticket); setView('chat'); }
    setLoading(false);
  }, [apiFetch, clientEmail]);

  useEffect(() => {
    if (open) { loadTickets(); }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [open, loadTickets]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (open && selected && view === 'chat') {
      pollRef.current = setInterval(() => loadMessages(selected), 10000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [open, selected, view, loadMessages]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !clientEmail) return;
    await apiFetch('/tickets', {
      client_email: clientEmail, client_name: clientName,
      title, description, priority: 'normal', category: 'support',
      source_implementation: implementationSlug || '',
    });
    setTitle(''); setDescription(''); setView('list');
    loadTickets();
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsg.trim() || !selected) return;
    await apiFetch(`/tickets/${selected.id}/messages`, {
      client_email: clientEmail, message: newMsg,
    });
    setNewMsg('');
    loadMessages(selected);
  };

  const handleClose = () => {
    setOpen(false);
    setSelected(null);
    setView('list');
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const STATUS_LABELS: Record<string, string> = {
    open: 'Abierto', in_progress: 'En revisión', waiting_client: 'Esperando tu respuesta',
    waiting_internal: 'Esperando respuesta', resolved: 'Resuelto', closed: 'Cerrado', cancelled: 'Cancelado',
  };

  const styles: Record<string, React.CSSProperties> = {
    fab: {
      position: 'fixed', bottom: 24, right: 24, zIndex: 99999,
      width: 56, height: 56, borderRadius: 28,
      background: '#009FE3', color: '#fff', border: 'none',
      cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    panel: {
      position: 'fixed', bottom: 24, right: 24, zIndex: 99999,
      width: 380, maxHeight: 600, background: '#fff', borderRadius: 16,
      boxShadow: '0 8px 32px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
    },
    header: {
      background: '#009FE3', color: '#fff', padding: '14px 16px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    },
    btnClose: { background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18, padding: '0 4px' },
    body: { flex: 1, overflow: 'auto', padding: 12 },
    card: { padding: 12, border: '1px solid #e5e7eb', borderRadius: 10, cursor: 'pointer' },
    input: { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' as const },
    textarea: { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, resize: 'vertical' as const, outline: 'none', boxSizing: 'border-box' as const },
    btnPrimary: { padding: '8px 16px', background: '#009FE3', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
    btnSecondary: { padding: '8px 16px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13 },
    bubbleClient: { padding: '8px 12px', borderRadius: 12, background: '#009FE3', color: '#fff', alignSelf: 'flex-end' as const, maxWidth: '85%', fontSize: 13 },
    bubbleAgent: { padding: '8px 12px', borderRadius: 12, background: '#f3f4f6', color: '#1f2937', alignSelf: 'flex-start' as const, maxWidth: '85%', fontSize: 13 },
  };

  if (!open) {
    return <button onClick={() => setOpen(true)} style={styles.fab} title="Soporte">?</button>;
  }

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Soporte TDP</span>
        <button onClick={handleClose} style={styles.btnClose}>✕</button>
      </div>

      <div style={styles.body}>
        {view === 'list' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => setView('new')} style={styles.btnPrimary}>
              + Nuevo Ticket
            </button>
            {tickets.map(t => (
              <div key={t.id} onClick={() => loadMessages(t)} style={styles.card}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t.ticket_number}</div>
                <div style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>{t.title}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                  {STATUS_LABELS[t.status] || t.status}
                </div>
              </div>
            ))}
            {tickets.length === 0 && (
              <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: 24 }}>
                Sin tickets. Crea uno nuevo.
              </p>
            )}
          </div>
        )}

        {view === 'new' && (
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título del problema" required style={styles.input} />
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe el problema en detalle..." rows={4} style={styles.textarea} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setView('list')} style={styles.btnSecondary}>Cancelar</button>
              <button type="submit" style={styles.btnPrimary}>Enviar</button>
            </div>
          </form>
        )}

        {view === 'chat' && selected && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
            <button onClick={() => { setSelected(null); setView('list'); }}
              style={{ background: 'none', border: 'none', color: '#009FE3', cursor: 'pointer', fontSize: 13, textAlign: 'left', padding: 0 }}>
              ← Volver
            </button>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{selected.ticket_number}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{selected.title}</div>

            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 200, marginBottom: 8 }}>
              {loading && messages.length === 0 && <p style={{ textAlign: 'center', color: '#9ca3af' }}>Cargando...</p>}
              {messages.map(m => (
                <div key={m.id} style={m.author_type === 'client' ? styles.bubbleClient : styles.bubbleAgent}>
                  <div>{m.message}</div>
                  <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSend} style={{ display: 'flex', gap: 8 }}>
              <input value={newMsg} onChange={e => setNewMsg(e.target.value)}
                placeholder="Escribe un mensaje..." style={{ flex: 1, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, outline: 'none' }} />
              <button type="submit" style={styles.btnPrimary}>→</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
