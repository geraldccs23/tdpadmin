import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, 
  X, 
  Send, 
  ArrowLeft, 
  HelpCircle, 
  Bot, 
  User, 
  Loader2, 
  MessageSquare,
  Sparkles,
  AlertCircle,
  Clock,
  CheckCircle2,
  Paperclip,
  ImageIcon
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { dbService } from '../services/dbService';
import { SupportTicket } from '../types';

interface SupportMessage {
  id: number;
  ticket_id: string;
  sender_id: string;
  sender_email: string;
  message: string;
  image_url?: string;
  created_at: string;
}

const parseMessage = (msg: { message: string, image_url?: string | null }) => {
  let text = msg.message;
  let imageUrl = msg.image_url;

  if (msg.message && msg.message.startsWith('{') && msg.message.endsWith('}')) {
    try {
      const parsed = JSON.parse(msg.message);
      if (parsed && typeof parsed === 'object') {
        text = parsed.text || '';
        imageUrl = parsed.image_url || imageUrl;
      }
    } catch (e) {
      // Not JSON
    }
  }
  return { text, imageUrl };
};

export const SupportBubble: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'menu' | 'faq' | 'tickets' | 'create_ticket' | 'chat'>('menu');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatImage, setChatImage] = useState<File | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const ticketsRef = useRef<SupportTicket[]>([]);
  const selectedTicketRef = useRef<SupportTicket | null>(null);
  const viewRef = useRef(view);
  const isOpenRef = useRef(isOpen);

  useEffect(() => { ticketsRef.current = tickets; }, [tickets]);
  useEffect(() => { selectedTicketRef.current = selectedTicket; }, [selectedTicket]);
  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  
  // New Ticket State
  const [newTicket, setNewTicket] = useState({
    title: '',
    description: '',
    priority: 'medium' as SupportTicket['priority'],
    category: 'support' as SupportTicket['category'],
    branch: 'Boleita'
  });
  const [ticketImage, setTicketImage] = useState<File | null>(null);
  const [isSavingTicket, setIsSavingTicket] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const ticketFileInputRef = useRef<HTMLInputElement>(null);

  // FAQs
  const faqs = [
    {
      q: '¿Cómo registro una devolución de venta?',
      a: 'Para registrar una devolución, ve al módulo de "Ingresos" (Ventas) y selecciona "Nueva Devolución". Introduce el número de factura/documento original para cargar sus datos, selecciona los productos a devolver y confirma el registro.'
    },
    {
      q: '¿Cómo realizo el cuadre de caja diario?',
      a: 'Ve al módulo de "Cuadre de Caja", selecciona tu sucursal y la caja correspondiente. Ingresa el monto real en efectivo (Bs. y $) y otras formas de pago. El sistema calculará automáticamente la diferencia contra el saldo virtual.'
    },
    {
      q: '¿Cómo ajustar el stock en inventario?',
      a: 'Si requieres realizar traslados o ajustes de inventario físico, ve a "Gestión de Almacén" o a "Inventario ERP". Recuerda que cada movimiento (entrada/salida) requiere registrar el concepto o motivo.'
    },
    {
      q: '¿Cómo se manejan los abonos a CxC?',
      a: 'En la sección "Cuentas por Cobrar (CxC)", busca al cliente con deuda activa y haz clic en "Abonar a Deuda". Especifica el monto en USD (se convertirá a Bs. si es por pago móvil/transferencia) y la cuenta de banco destino.'
    }
  ];

  useEffect(() => {
    fetchSession();
  }, []);

  const fetchSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setCurrentUserId(session.user.id);
      setCurrentUserEmail(session.user.email || null);
      
      let role = null;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();
      if (data) {
        role = data.role;
        setUserRole(role);
      }
      
      fetchMyTickets(session.user.id, role);
    }
  };

  const fetchMyTickets = async (userId?: string, roleOverride?: string | null) => {
    const uid = userId || currentUserId;
    if (!uid) return;
    const role = roleOverride !== undefined ? roleOverride : userRole;

    try {
      setLoadingTickets(true);
      const isAdmin = role === 'soporte' || role === 'director' || role === 'supervisor' || role === 'administrador';
      
      let query = supabase
        .from('v_support_tickets')
        .select('*')
        .in('status', ['open', 'in_progress'])
        .order('created_at', { ascending: false });

      if (!isAdmin) {
        query = query.eq('user_id', uid);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTickets(data || []);

      if (data && data.length > 0) {
        const ticketIds = data.map((t: any) => t.id);
        const { data: msgs, error: msgsError } = await supabase
          .from('support_messages')
          .select('id, ticket_id, sender_id')
          .in('ticket_id', ticketIds);

        if (!msgsError && msgs) {
          const stored = localStorage.getItem('rg7_support_last_read');
          const lastReadMap = stored ? JSON.parse(stored) : {};
          const counts: Record<string, number> = {};

          data.forEach((ticket: any) => {
            const ticketMsgs = msgs.filter(m => m.ticket_id === ticket.id);
            const lastReadId = lastReadMap[ticket.id] || 0;
            const unread = ticketMsgs.filter(m => m.sender_id !== uid && m.id > lastReadId).length;
            counts[ticket.id] = unread;
          });

          setUnreadCounts(counts);
        }
      }
    } catch (e) {
      console.error('Error fetching user tickets:', e);
    } finally {
      setLoadingTickets(false);
    }
  };

  const updateLastRead = (ticketId: string, messageId: number) => {
    try {
      const stored = localStorage.getItem('rg7_support_last_read');
      const map = stored ? JSON.parse(stored) : {};
      map[ticketId] = Math.max(map[ticketId] || 0, messageId);
      localStorage.setItem('rg7_support_last_read', JSON.stringify(map));
      
      setUnreadCounts(prev => ({
        ...prev,
        [ticketId]: 0
      }));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMessages = async (ticketId: string) => {
    const { data, error } = await supabase
      .from('support_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    
    if (!error && data) {
      setMessages(data);
      if (data.length > 0) {
        const lastMsgId = data[data.length - 1].id;
        updateLastRead(ticketId, lastMsgId);
      }
    }
  };

  // Real-time global subscription for tickets and messages
  useEffect(() => {
    if (!currentUserId) return;

    const msgChannel = supabase
      .channel('support-messages-global')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'support_messages'
      }, (payload) => {
        const newMsg = payload.new as SupportMessage;
        const hasTicket = ticketsRef.current.some(t => t.id === newMsg.ticket_id);
        
        if (!hasTicket) {
          fetchMyTickets();
          return;
        }

        if (selectedTicketRef.current?.id === newMsg.ticket_id && viewRef.current === 'chat' && isOpenRef.current) {
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          updateLastRead(newMsg.ticket_id, newMsg.id);
        } else {
          if (newMsg.sender_id !== currentUserId) {
            setUnreadCounts(prev => {
              const currentCount = prev[newMsg.ticket_id] || 0;
              return {
                ...prev,
                [newMsg.ticket_id]: currentCount + 1
              };
            });
          }
        }
      })
      .subscribe();

    const ticketChannel = supabase
      .channel('support-tickets-global')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'support_tickets'
      }, () => {
        fetchMyTickets();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(ticketChannel);
    };
  }, [currentUserId]);

  useEffect(() => {
    if (view === 'chat') {
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages, view]);

  const handleOpenChat = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    fetchMessages(ticket.id);
    setView('chat');
  };

  const uploadImage = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('ImagenesSoporte')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('ImagenesSoporte')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !chatImage) || !selectedTicket || !currentUserId) return;

    setSendingMessage(true);
    try {
      let imageUrl = '';
      if (chatImage) {
        imageUrl = await uploadImage(chatImage);
      }

      const { error } = await supabase.from('support_messages').insert([{
        ticket_id: selectedTicket.id,
        sender_id: currentUserId,
        sender_email: currentUserEmail || 'usuario@rg7.com',
        message: JSON.stringify({
          text: newMessage.trim(),
          image_url: imageUrl || null
        })
      }]);

      if (error) throw error;
      setNewMessage('');
      setChatImage(null);
      // Fetch immediately to show message faster
      fetchMessages(selectedTicket.id);
    } catch (error: any) {
      alert(`Error al enviar mensaje: ${error.message}`);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicket.title || !newTicket.description || !currentUserId) return;

    setIsSavingTicket(true);
    try {
      let imageUrl = '';
      if (ticketImage) {
        imageUrl = await uploadImage(ticketImage);
      }

      const created = await dbService.createSupportTicket({
        ...newTicket,
        image_url: imageUrl || undefined
      });

      setNewTicket({
        title: '',
        description: '',
        priority: 'medium',
        category: 'support',
        branch: 'Boleita'
      });
      setTicketImage(null);
      
      // Auto-open chat for the newly created ticket
      handleOpenChat(created);
    } catch (error: any) {
      alert(`Error al crear ticket: ${error.message}`);
    } finally {
      setIsSavingTicket(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <Clock size={14} className="text-blue-500" />;
      case 'in_progress': return <Loader2 size={14} className="text-amber-500 animate-spin" />;
      case 'resolved': return <CheckCircle2 size={14} className="text-green-500" />;
      default: return <AlertCircle size={14} className="text-gray-500" />;
    }
  };

  if (!currentUserId) return null; // Only show for logged in users

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end font-sans">
      
      {/* Support Panel */}
      {isOpen && (
        <div className="w-[380px] h-[550px] bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col mb-4 overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-red-950 p-4 text-white flex items-center justify-between shadow-md shrink-0">
            <div className="flex items-center gap-3">
              {view !== 'menu' && (
                <button 
                  onClick={() => {
                    if (view === 'chat') {
                      setView('tickets');
                      fetchMyTickets();
                    } else {
                      setView('menu');
                    }
                  }} 
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white"
                >
                  <ArrowLeft size={18} />
                </button>
              )}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-red-600 to-red-400 flex items-center justify-center shadow-lg shadow-red-500/20">
                  <Bot size={18} className="text-white" />
                </div>
                <div>
                  <h4 className="font-black text-sm uppercase tracking-tight">RG7 Soporte Bot</h4>
                  <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> En Línea
                  </p>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)} 
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-300 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto bg-gray-50 flex flex-col">
            
            {/* VIEW: MENU */}
            {view === 'menu' && (
              <div className="p-5 space-y-5 flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-start gap-3">
                    <div className="p-2 bg-red-50 text-[#D40000] rounded-xl">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <h5 className="font-bold text-gray-800 text-sm">¡Hola!</h5>
                      <p className="text-xs text-gray-500 leading-relaxed mt-1">
                        Soy tu asistente virtual de RG7. Estoy aquí para guiarte en dudas del sistema o ayudarte a contactar a un soporte humano.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] uppercase font-black tracking-widest text-gray-400 pl-1">¿Qué deseas hacer?</p>
                    
                    <button
                      onClick={() => setView('faq')}
                      className="w-full p-4 bg-white hover:bg-gray-50 border border-gray-150 rounded-2xl flex items-center justify-between text-left transition-all hover:scale-[1.01] hover:border-red-100 group shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                          <HelpCircle size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-gray-850 text-xs">Preguntas Frecuentes (FAQ)</p>
                          <p className="text-[10px] text-gray-400">Guía rápida de soluciones comunes</p>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setView('tickets');
                        fetchMyTickets();
                      }}
                      className="w-full p-4 bg-white hover:bg-gray-50 border border-gray-150 rounded-2xl flex items-center justify-between text-left transition-all hover:scale-[1.01] hover:border-red-100 group shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-50 text-green-600 rounded-xl">
                          <MessageSquare size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-gray-850 text-xs">Soporte Humano (Chat)</p>
                          <p className="text-[10px] text-gray-400">Habla directamente con soporte</p>
                        </div>
                      </div>
                      {(Object.values(unreadCounts) as number[]).reduce((sum, c) => sum + c, 0) > 0 && (
                        <span className="bg-red-600 text-white text-[9px] font-black px-2.5 py-1 rounded-full animate-pulse shadow-sm">
                          {(Object.values(unreadCounts) as number[]).reduce((sum, c) => sum + c, 0)} nuevo{(Object.values(unreadCounts) as number[]).reduce((sum, c) => sum + c, 0) > 1 ? 's' : ''}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">Sistema de Soporte Administrativo RG7</p>
                </div>
              </div>
            )}

            {/* VIEW: FAQ */}
            {view === 'faq' && (
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <HelpCircle size={16} className="text-blue-500" />
                  <span className="text-xs font-black uppercase text-gray-500 tracking-wider">Preguntas Comunes</span>
                </div>
                
                {faqs.map((faq, i) => (
                  <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-2">
                    <p className="font-black text-gray-800 text-xs flex items-start gap-1.5">
                      <span className="text-[#D40000]">Q:</span> {faq.q}
                    </p>
                    <p className="text-xs text-gray-600 leading-relaxed pl-4 border-l-2 border-gray-100">
                      {faq.a}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* VIEW: TICKETS LIST */}
            {view === 'tickets' && (() => {
              const isAdmin = userRole === 'soporte' || userRole === 'director' || userRole === 'supervisor' || userRole === 'administrador';
              return (
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black uppercase text-gray-500 tracking-wider flex items-center gap-1">
                        <MessageSquare size={16} className="text-green-500" /> {isAdmin ? 'Chats Pendientes' : 'Mis Chats Abiertos'}
                      </span>
                      <button
                        onClick={() => setView('create_ticket')}
                        className="text-[10px] bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded-lg font-black uppercase tracking-wider transition-all active:scale-95"
                      >
                        Nuevo Ticket
                      </button>
                    </div>

                    {loadingTickets ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <Loader2 className="animate-spin text-red-600" size={24} />
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cargando tus chats...</p>
                      </div>
                    ) : tickets.length === 0 ? (
                      <div className="bg-white p-6 rounded-2xl text-center border-2 border-dashed border-gray-200">
                        <p className="text-gray-400 font-bold text-xs uppercase">{isAdmin ? 'No hay chats pendientes' : 'No tienes tickets de soporte'}</p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {isAdmin ? 'Todos los requerimientos de soporte han sido resueltos.' : 'Crea uno nuevo para iniciar un chat con soporte.'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                        {tickets.map(ticket => (
                          <div
                            key={ticket.id}
                            onClick={() => handleOpenChat(ticket)}
                            className="bg-white p-3.5 rounded-2xl border border-gray-150 shadow-sm hover:border-red-100 cursor-pointer transition-all hover:scale-[1.01] flex items-center justify-between"
                          >
                            <div className="flex flex-col gap-1 min-w-0 flex-1 pr-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[8px] font-mono text-gray-400">#{ticket.id.substring(0, 8)}</span>
                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border 
                                  ${ticket.status === 'resolved' ? 'bg-green-50 text-green-700 border-green-150' : 'bg-blue-50 text-blue-700 border-blue-150'}`}>
                                  {ticket.status === 'in_progress' ? 'Progreso' : ticket.status}
                                </span>
                                {unreadCounts[ticket.id] > 0 && (
                                  <span className="bg-red-650 text-white text-[8px] font-black px-1.5 py-0.2 rounded">
                                    {unreadCounts[ticket.id]} nuevo{unreadCounts[ticket.id] > 1 ? 's' : ''}
                                  </span>
                                )}
                                {isAdmin && ticket.creator_email && (
                                  <span className="text-[8px] font-bold text-gray-400 truncate">
                                    • {ticket.creator_email.split('@')[0]}
                                  </span>
                                )}
                              </div>
                              <p className="font-bold text-gray-800 text-xs truncate">{ticket.title}</p>
                            </div>
                            <div className="flex items-center">
                              {unreadCounts[ticket.id] > 0 ? (
                                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
                              ) : (
                                getStatusIcon(ticket.status)
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* VIEW: CREATE TICKET FORM */}
            {view === 'create_ticket' && (
              <form onSubmit={handleCreateTicket} className="p-5 space-y-4">
                <p className="text-xs font-black uppercase text-gray-500 tracking-wider mb-2">Describir Problema</p>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Título Corto</label>
                  <input
                    required
                    type="text"
                    value={newTicket.title}
                    onChange={e => setNewTicket({...newTicket, title: e.target.value})}
                    placeholder="Ej: No funciona impresión de recibo"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#D40000]/15 focus:border-[#D40000] outline-none text-xs font-medium bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Sucursal</label>
                    <select
                      value={newTicket.branch}
                      onChange={e => setNewTicket({...newTicket, branch: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#D40000]/15 focus:border-[#D40000] outline-none text-xs font-medium bg-white"
                    >
                      <option value="Boleita">Boleita</option>
                      <option value="Sabana Grande">Sabana Grande</option>
                      <option value="Otro">Otro / Global</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Prioridad</label>
                    <select
                      value={newTicket.priority}
                      onChange={e => setNewTicket({...newTicket, priority: e.target.value as any})}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#D40000]/15 focus:border-[#D40000] outline-none text-xs font-medium bg-white"
                    >
                      <option value="low">Baja</option>
                      <option value="medium">Media</option>
                      <option value="high">Alta</option>
                      <option value="urgent">Urgente</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Detalles</label>
                  <textarea
                    required
                    rows={3}
                    value={newTicket.description}
                    onChange={e => setNewTicket({...newTicket, description: e.target.value})}
                    placeholder="Escribe detalles del problema..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#D40000]/15 focus:border-[#D40000] outline-none text-xs font-medium bg-white resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Adjuntar Captura (Opcional)</label>
                  <div 
                    onClick={() => ticketFileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <input 
                      type="file" 
                      ref={ticketFileInputRef} 
                      className="hidden" 
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setTicketImage(e.target.files[0]);
                        }
                      }}
                    />
                    {ticketImage ? (
                      <div className="text-center">
                        <ImageIcon size={18} className="mx-auto text-blue-500" />
                        <p className="text-[10px] font-bold text-gray-700 max-w-[150px] truncate">{ticketImage.name}</p>
                      </div>
                    ) : (
                      <div className="text-center text-gray-400 flex items-center gap-1">
                        <Paperclip size={14} />
                        <span className="text-[10px] font-bold">Subir imagen</span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSavingTicket}
                  className="w-full py-3 bg-[#D40000] hover:bg-[#B30000] text-white rounded-xl font-black uppercase text-xs tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                >
                  {isSavingTicket ? <Loader2 size={16} className="animate-spin" /> : 'Crear & Chatear'}
                </button>
              </form>
            )}

            {/* VIEW: CHAT */}
            {view === 'chat' && selectedTicket && (
              <div className="flex-1 flex flex-col bg-white overflow-hidden h-[calc(550px-60px)]">
                
                {/* Info Bar */}
                <div className="bg-gray-150 px-4 py-2 border-b border-gray-100 flex items-center justify-between shrink-0">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-[10px] font-black uppercase text-gray-800 truncate">{selectedTicket.title}</p>
                    <p className="text-[8px] text-gray-400 uppercase font-medium truncate">{selectedTicket.description}</p>
                  </div>
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border shrink-0 
                    ${selectedTicket.status === 'resolved' ? 'bg-green-50 text-green-700 border-green-150' : 'bg-blue-50 text-blue-700 border-blue-150'}`}>
                    {selectedTicket.status}
                  </span>
                </div>

                {/* Messages List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center opacity-30">
                      <MessageSquare size={36} className="mb-1 text-gray-500" />
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">Inicia la conversación...</p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const { text, imageUrl } = parseMessage(msg);
                      return (
                        <div key={msg.id} className={`flex flex-col ${msg.sender_id === currentUserId ? 'items-end' : 'items-start'}`}>
                          <div className={`max-w-[85%] p-3 rounded-2xl shadow-sm border text-xs leading-relaxed ${
                            msg.sender_id === currentUserId 
                              ? 'bg-gray-950 text-white border-gray-900 rounded-tr-none' 
                              : 'bg-white text-gray-800 border-gray-250 rounded-tl-none'
                          }`}>
                            {imageUrl && (
                              <a href={imageUrl} target="_blank" rel="noopener noreferrer">
                                <img src={imageUrl} alt="Adjunto" className="max-w-full rounded-lg mb-1 border border-gray-200 hover:opacity-90 cursor-pointer object-cover" style={{ maxHeight: '120px' }} />
                              </a>
                            )}
                            {text && <p className="font-medium">{text}</p>}
                            <div className={`mt-1 flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest ${
                              msg.sender_id === currentUserId ? 'text-gray-400' : 'text-gray-400'
                            }`}>
                              <span>{msg.sender_email?.split('@')[0]}</span>
                              <span>•</span>
                              <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input Form */}
                <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-100 bg-white flex items-center gap-2 shrink-0 relative">
                  {chatImage && (
                    <div className="absolute bottom-16 left-3 bg-white p-2 rounded-xl border border-gray-200 shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-2 z-10">
                      <ImageIcon size={14} className="text-blue-500" />
                      <span className="text-[10px] font-bold text-gray-700 max-w-[120px] truncate">{chatImage.name}</span>
                      <button type="button" onClick={() => setChatImage(null)} className="p-0.5 hover:bg-gray-150 rounded-md text-red-500">
                        <X size={10} />
                      </button>
                    </div>
                  )}
                  <input 
                    type="file" 
                    ref={chatFileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setChatImage(e.target.files[0]);
                      }
                    }}
                  />
                  <button 
                    type="button" 
                    onClick={() => chatFileInputRef.current?.click()}
                    className="p-2.5 bg-gray-50 border border-gray-250 text-gray-400 rounded-xl hover:text-gray-600 hover:bg-gray-100 transition-all shadow-sm shrink-0"
                  >
                    <Paperclip size={16} />
                  </button>
                  <input 
                    type="text"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Escribe un mensaje..."
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-250 rounded-xl focus:ring-2 focus:ring-red-500/10 focus:border-[#D40000] outline-none transition-all font-medium text-xs bg-white"
                  />
                  <button 
                    type="submit"
                    disabled={sendingMessage || (!newMessage.trim() && !chatImage)}
                    className="p-2.5 bg-[#D40000] text-white rounded-xl shadow-lg shadow-red-500/20 hover:bg-[#B30000] transition-all disabled:opacity-50 shrink-0"
                  >
                    {sendingMessage ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </form>
              </div>
            )}

          </div>

        </div>
      )}

      {/* Floating Toggle Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setView('menu'); // Always reset to menu when opened
        }}
        className="w-14 h-14 bg-gradient-to-tr from-gray-900 to-red-950 text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-105 transition-all focus:outline-none active:scale-95 group relative border border-red-900/30 font-bold"
      >
        <span className="absolute -inset-1 rounded-full bg-red-600/20 animate-ping group-hover:animate-none"></span>
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
        
         {!isOpen && (Object.values(unreadCounts) as number[]).reduce((sum, c) => sum + c, 0) > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-xl animate-bounce">
            {(Object.values(unreadCounts) as number[]).reduce((sum, c) => sum + c, 0)}
          </span>
        )}
      </button>

    </div>
  );
};
