import { auth } from './auth';

const API_URL = import.meta.env.VITE_API_URL || window.location.origin;

async function request(path: string, opts?: RequestInit) {
  const token = localStorage.getItem('restaurantdp_auth_token');
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts?.headers },
  });
  return res.json();
}

export const supportApi = {
  async getTickets() {
    const json = await request('/api/support/tickets');
    if (!json.ok) throw new Error(json.error || 'Error loading tickets');
    return json.tickets;
  },

  async createTicket(data: { title: string; description: string; priority?: string; category?: string; branch?: string; image_url?: string }) {
    const json = await request('/api/support/tickets', { method: 'POST', body: JSON.stringify(data) });
    if (!json.ok) throw new Error(json.error || 'Error creating ticket');
    return json.ticket;
  },

  async getMessages(ticketId: string) {
    const json = await request(`/api/support/tickets/${ticketId}/messages`);
    if (!json.ok) throw new Error(json.error || 'Error loading messages');
    return json.messages;
  },

  async sendMessage(ticketId: string, data: { message: string; image_url?: string }) {
    const json = await request(`/api/support/tickets/${ticketId}/messages`, { method: 'POST', body: JSON.stringify(data) });
    if (!json.ok) throw new Error(json.error || 'Error sending message');
    return json.message;
  },

  async updateTicket(ticketId: string, data: { status?: string; priority?: string }) {
    const json = await request(`/api/support/tickets/${ticketId}`, { method: 'PATCH', body: JSON.stringify(data) });
    if (!json.ok) throw new Error(json.error || 'Error updating ticket');
    return json.ticket;
  },

  async uploadImage(base64: string, fileName: string) {
    const json = await request('/api/support/upload', { method: 'POST', body: JSON.stringify({ file_data: base64, file_name: fileName }) });
    if (!json.ok) throw new Error(json.error || 'Error uploading file');
    return json.url;
  },
};
