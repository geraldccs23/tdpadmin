import React, { useState, useEffect, useRef } from 'react';
import { dbService } from '../services/dbService';
import { supabase } from '../services/supabase';
import { Search, MessageSquare, Send, Plus, X, Loader2, Phone, User, Building2, CheckCircle2, Tag, Trash2, ChevronLeft, Smartphone } from 'lucide-react';
import { CRMInstances } from './CRMInstances';
function formatDate(date: Date, fmt: 'time' | 'date' | 'full'): string {
    if (fmt === 'time') return date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
    if (fmt === 'date') return date.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
    return date.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

interface Conversation {
    id: number;
    instance_id: number | null;
    remote_jid: string | null;
    customer_id: string | null;
    customer_name: string | null;
    customer_phone: string | null;
    last_message_at: string | null;
    last_message_preview: string | null;
    unread_count: number;
    status: string;
    assigned_to: number | null;
    created_at: string;
    wa_instances?: {
        seller_id: number;
        instance_name: string;
        phone_number: string;
        sellers?: { name: string };
    } | null;
}

interface Message {
    id: number;
    conversation_id: number;
    wa_message_id: string | null;
    from_me: boolean;
    message_type: string;
    content: string | null;
    media_url: string | null;
    mimetype: string | null;
    caption: string | null;
    metadata: any;
    timestamp: string;
    created_at: string;
}

interface QuickReply {
    id: number;
    category: string;
    title: string;
    content: string;
}

interface CustomerInfo {
    id: string;
    name: string;
    phone: string | null;
    total_incomes?: number;
    last_income_date?: string;
    total_purchases?: number;
    last_purchase_date?: string;
}

export const WAChat: React.FC = () => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [initialLoading, setInitialLoading] = useState(true);
    const [inputText, setInputText] = useState('');
    const [showQuickReplies, setShowQuickReplies] = useState(false);
    const [showNewMessageModal, setShowNewMessageModal] = useState(false);
    const [showQuickReplyManager, setShowQuickReplyManager] = useState(false);
    const [showInstances, setShowInstances] = useState(false);
    const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
    const [loadingMessages, setLoadingMessages] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const convLoadRef = useRef<number | null>(null);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [newQrCategory, setNewQrCategory] = useState('');
    const [newQrTitle, setNewQrTitle] = useState('');
    const [newQrContent, setNewQrContent] = useState('');

    const [newMsgCustomerName, setNewMsgCustomerName] = useState('');
    const [newMsgCustomerPhone, setNewMsgCustomerPhone] = useState('');
    const [newMsgText, setNewMsgText] = useState('');
    const [newMsgFromMe, setNewMsgFromMe] = useState(true);
    const [newMsgDate, setNewMsgDate] = useState(new Date().toISOString().slice(0, 16));
    const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([]);
    const [showCustomerSearch, setShowCustomerSearch] = useState(false);

    const qrCategories = ['precios', 'horarios', 'delivery', 'promociones', 'pagos', 'general'];

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (!selectedConv) return;
        const convId = selectedConv.id;
        convLoadRef.current = convId;
        loadMessages(convId);
        loadCustomerInfo(selectedConv.customer_id);
    }, [selectedConv]);

    useEffect(() => {
        const channel = supabase.channel('crm-realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wa_messages' }, payload => {
                const msg = payload.new as Message;
                setMessages(prev => {
                    if (prev.some(m => m.id === msg.id)) return prev;
                    const idx = prev.findIndex(m => new Date(m.timestamp) > new Date(msg.timestamp));
                    if (idx === -1) return [...prev, msg];
                    return [...prev.slice(0, idx), msg, ...prev.slice(idx)];
                });
                if (msg && !msg.from_me) {
                    setConversations(prev => prev.map(c =>
                        c.id === msg.conversation_id ? { ...c, last_message_at: msg.timestamp, last_message_preview: msg.content, unread_count: c.unread_count + 1 } : c
                    ));
                }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_conversations' }, () => {
                loadData();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [convData, qrData] = await Promise.all([
                dbService.getWAConversations(),
                dbService.getWAQuickReplies()
            ]);
            setConversations(convData);
            setQuickReplies(qrData);
            if (qrData.length === 0) {
                const seeds = [
                    { category: 'precios', title: 'Solicitar CI/RIF', content: 'Hola, para poder cotizarte necesito que me indiques tu cédula o RIF para buscar en el sistema.' },
                    { category: 'precios', title: 'Precio no disponible', content: 'Disculpa, ese producto no lo tenemos disponible actualmente. ¿Te interesa alguna alternativa similar?' },
                    { category: 'precios', title: 'Consultar precio', content: 'Déjame consultar el precio actualizado y te confirmo en breves.' },
                    { category: 'horarios', title: 'Horarios Boleita', content: 'Estamos en Boleita de Lun-Vie 8am-5pm y Sáb 8am-1pm.' },
                    { category: 'horarios', title: 'Horarios Sabana Grande', content: 'Estamos en Sabana Grande de Lun-Vie 8am-5pm y Sáb 8am-1pm.' },
                    { category: 'delivery', title: 'Costo delivery', content: 'El delivery tiene un costo de $2.00, depende de la zona. ¿Cuál es tu dirección?' },
                    { category: 'delivery', title: 'Tiempo delivery', content: 'Normalmente los entregamos el mismo día o al día siguiente, dependiendo de la zona.' },
                    { category: 'pagos', title: 'Métodos de pago', content: 'Aceptamos: Efectivo ($ o Bs), Punto de Venta, Pago Móvil, Transferencia y Zelle.' },
                    { category: 'general', title: 'Derivar a vendedor', content: 'Déjame pasarte con el vendedor para que te dé una atención más personalizada.' },
                    { category: 'general', title: 'Agradecimiento', content: 'Gracias por tu preferencia. Quedamos atentos a cualquier otra consulta.' },
                ];
                const { data: inserted } = await supabase.from('wa_quick_replies').insert(seeds).select();
                if (inserted) setQuickReplies(inserted);
            }
        } catch (err) {
            console.error('Error loading CRM data:', err);
        } finally {
            setLoading(false);
            setInitialLoading(false);
        }
    };

    const loadMessages = async (convId: number) => {
        try {
            setLoadingMessages(true);
            const data = await dbService.getWAMessages(convId);
            if (convLoadRef.current === convId) setMessages(data);
        } catch (err) {
            console.error('Error loading messages:', err);
        } finally {
            setLoadingMessages(false);
        }
    };

    const loadCustomerInfo = async (customerId: string | null) => {
        if (!customerId) { setCustomerInfo(null); return; }
        try {
            const { data: incomes } = await supabase
                .from('incomes')
                .select('id, total_amount, created_at')
                .eq('customer_id', customerId)
                .order('created_at', { ascending: false })
                .limit(5);

            const { data: customer } = await supabase
                .from('customers')
                .select('id, name, phone')
                .eq('id', customerId)
                .single();

            if (!customer) { setCustomerInfo(null); return; }
            setCustomerInfo({
                ...customer,
                total_incomes: incomes?.length || 0,
                last_income_date: incomes?.[0]?.created_at || undefined,
            });
        } catch (err) {
            console.error('Error loading customer info:', err);
        }
    };

    const filteredConversations = conversations.filter(c =>
        (c.customer_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.customer_phone || '').includes(search)
    );

    const handleSendMessage = async () => {
        if (!inputText.trim() || !selectedConv) return;
        const text = inputText.trim();
        try {
            // Try Evolution backend first
            const hasBackend = import.meta.env.VITE_CRM_API_URL;
            let backendOk = false;
            if (hasBackend && selectedConv.wa_instances?.instance_name && selectedConv.customer_phone) {
                backendOk = await dbService.sendViaBackend(
                    selectedConv.wa_instances.instance_name,
                    selectedConv.customer_phone,
                    text
                );
            }

            // Always save to local DB (backup)
            const msg = await dbService.createWAMessage({
                conversation_id: selectedConv.id,
                from_me: true,
                content: text,
                timestamp: new Date().toISOString()
            });
            await dbService.updateWAConversationLastMessage(selectedConv.id, text);

            setMessages(prev => [...prev, msg]);
            setInputText('');
            loadData();

            if (hasBackend && !backendOk) {
                console.warn('Backend unreachable, message saved locally only');
            }
        } catch (err) {
            console.error('Error sending message:', err);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleSelectConversation = (conv: Conversation) => {
        setSelectedConv(conv);
        setShowQuickReplies(false);
    };

    const insertQuickReply = (content: string) => {
        setInputText(prev => prev ? `${prev} ${content}` : content);
        setShowQuickReplies(false);
    };

    const handleAddQuickReply = async () => {
        if (!newQrCategory || !newQrTitle || !newQrContent) return;
        try {
            await dbService.createWAQuickReply({
                category: newQrCategory,
                title: newQrTitle,
                content: newQrContent
            });
            setNewQrCategory('');
            setNewQrTitle('');
            setNewQrContent('');
            const qrData = await dbService.getWAQuickReplies();
            setQuickReplies(qrData);
        } catch (err) {
            console.error('Error adding quick reply:', err);
        }
    };

    const handleDeleteQuickReply = async (id: number) => {
        try {
            await dbService.deleteWAQuickReply(id);
            setQuickReplies(prev => prev.filter(q => q.id !== id));
        } catch (err) {
            console.error('Error deleting quick reply:', err);
        }
    };

    const handleCustomerSearch = (query: string) => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        if (query.length < 2) { setCustomerSearchResults([]); setShowCustomerSearch(false); return; }
        searchTimerRef.current = setTimeout(async () => {
            try {
                const { data } = await supabase
                    .from('customers')
                    .select('id, name, phone')
                    .or(`name.ilike.%${query}%,id.ilike.%${query}%,phone.ilike.%${query}%`)
                    .limit(10);
                setCustomerSearchResults(data || []);
                setShowCustomerSearch((data?.length || 0) > 0);
            } catch { setCustomerSearchResults([]); setShowCustomerSearch(false); }
        }, 300);
    };

    const handleSelectCustomer = (c: any) => {
        setNewMsgCustomerName(c.name);
        setNewMsgCustomerPhone(c.phone || c.id);
        setShowCustomerSearch(false);
        setCustomerSearchResults([]);
    };

    const handleNewManualMessage = async () => {
        if (!newMsgCustomerPhone.trim()) return;
        try {
            let conv = conversations.find(c => c.customer_phone === newMsgCustomerPhone.trim());

            if (!conv) {
                const { data: newConv, error } = await supabase
                    .from('wa_conversations')
                    .insert([{
                        customer_name: newMsgCustomerName.trim() || null,
                        customer_phone: newMsgCustomerPhone.trim(),
                        remote_jid: `${newMsgCustomerPhone.trim()}@s.whatsapp.net`,
                        status: 'active'
                    }])
                    .select()
                    .single();
                if (error) throw error;
                conv = newConv;
            }

            if (newMsgText.trim()) {
                await dbService.createWAMessage({
                    conversation_id: conv.id,
                    from_me: newMsgFromMe,
                    content: newMsgText.trim(),
                    timestamp: new Date(newMsgDate).toISOString()
                });
                await dbService.updateWAConversationLastMessage(conv.id, newMsgText.trim());
            }

            setShowNewMessageModal(false);
            setNewMsgCustomerName('');
            setNewMsgCustomerPhone('');
            setNewMsgText('');
            setNewMsgFromMe(true);
            setNewMsgDate(new Date().toISOString().slice(0, 16));
            await loadData();
            setSelectedConv(conv);
        } catch (err) {
            console.error('Error creating manual message:', err);
        }
    };

    const groupedQuickReplies: Record<string, QuickReply[]> = quickReplies.reduce((acc, qr) => {
        if (!acc[qr.category]) acc[qr.category] = [];
        acc[qr.category].push(qr);
        return acc;
    }, {});

    if (initialLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-gray-500 gap-4">
                <Loader2 className="animate-spin text-purple-600" size={48} />
                <p className="font-bold uppercase tracking-widest text-xs">Cargando CRM WhatsApp...</p>
            </div>
        );
    }

    if (showInstances) {
        return <CRMInstances onClose={() => setShowInstances(false)} />;
    }

    return (
        <div className="flex h-[calc(100vh-8rem)] gap-4">
            {/* Left Panel - Conversations */}
            <div className={`${selectedConv ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 lg:w-96 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden shrink-0`}>
                <div className="p-4 border-b border-gray-100 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="font-black text-gray-800 uppercase text-sm tracking-tight flex items-center gap-2">
                            <MessageSquare size={18} className="text-purple-600" /> WhatsApp CRM
                        </h3>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setShowInstances(true)}
                                className="p-2 bg-gray-100 text-gray-500 hover:bg-purple-100 hover:text-purple-700 rounded-lg transition-all"
                                title="Gestionar instancias WhatsApp"
                            >
                                <Smartphone size={16} />
                            </button>
                            <button
                                onClick={() => setShowNewMessageModal(true)}
                                className="p-2 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg transition-all"
                                title="Nuevo mensaje manual"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar conversación..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                    {filteredConversations.length === 0 ? (
                        <div className="p-8 text-center">
                            <MessageSquare className="mx-auto text-gray-200 mb-3" size={40} />
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                {search ? 'Sin resultados' : 'No hay conversaciones'}
                            </p>
                            <p className="text-[10px] text-gray-300 mt-1">Registra un mensaje manual para empezar</p>
                        </div>
                    ) : (
                        filteredConversations.map(conv => (
                            <button
                                key={conv.id}
                                onClick={() => handleSelectConversation(conv)}
                                className={`w-full p-4 text-left hover:bg-purple-50/50 transition-colors ${selectedConv?.id === conv.id ? 'bg-purple-50 border-l-2 border-purple-500' : ''}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gray-800 text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                                        {(conv.customer_name || '?').charAt(0)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-gray-800 text-sm truncate">{conv.customer_name || conv.customer_phone || 'Desconocido'}</span>
                                            {conv.last_message_at && (
                                                <span className="text-[10px] text-gray-400 font-medium shrink-0 ml-2">
                                                    {formatDate(new Date(conv.last_message_at), 'time')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500 truncate block flex-1">
                                                {conv.last_message_preview || (conv.wa_instances?.sellers?.name ? `Asignado a: ${conv.wa_instances.sellers.name}` : 'Sin mensajes')}
                                            </span>
                                            {conv.unread_count > 0 && (
                                                <span className="bg-purple-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0">
                                                    {conv.unread_count}
                                                </span>
                                            )}
                                        </div>
                                        {conv.wa_instances?.sellers?.name && (
                                            <span className="text-[9px] text-purple-500 font-semibold">
                                                Vendedor: {conv.wa_instances.sellers.name}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>

                <div className="p-3 border-t border-gray-100 bg-gray-50/50">
                    <button
                        onClick={() => setShowQuickReplyManager(!showQuickReplyManager)}
                        className="w-full py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-purple-600 transition-all flex items-center justify-center gap-1"
                    >
                        <Tag size={12} /> Gestionar Respuestas Rápidas
                    </button>
                </div>
            </div>

            {/* Right Panel - Chat */}
            <div className={`${!selectedConv ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden`}>
                {!selectedConv ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
                        <MessageSquare size={48} className="text-gray-200 mb-4" />
                        <p className="font-black uppercase tracking-widest text-sm">Selecciona una conversación</p>
                        <p className="text-xs mt-1">o registra un mensaje manual desde el botón +</p>
                    </div>
                ) : (
                    <>
                        {/* Chat Header */}
                        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setSelectedConv(null)} className="md:hidden p-1 hover:bg-gray-200 rounded-lg">
                                    <ChevronLeft size={20} />
                                </button>
                                <div className="w-10 h-10 bg-gray-800 text-white rounded-full flex items-center justify-center font-bold text-sm">
                                    {(selectedConv.customer_name || '?').charAt(0)}
                                </div>
                                <div>
                                    <h4 className="font-black text-gray-800 text-sm">{selectedConv.customer_name || 'Desconocido'}</h4>
                                    <p className="text-[10px] text-gray-500 font-mono">{selectedConv.customer_phone || selectedConv.remote_jid}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedConv.customer_phone && (
                                    <a href={`https://wa.me/${selectedConv.customer_phone}`} target="_blank" rel="noopener noreferrer"
                                        className="p-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg transition-all" title="Abrir en WhatsApp">
                                        <Phone size={16} />
                                    </a>
                                )}
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                    selectedConv.status === 'active' ? 'bg-green-100 text-green-700' :
                                    selectedConv.status === 'closed' ? 'bg-gray-100 text-gray-500' : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                    {selectedConv.status}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-1 overflow-hidden">
                            {/* Messages */}
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f0f2f5]">
                                    {loadingMessages ? (
                                        <div className="flex items-center justify-center py-8">
                                            <Loader2 className="animate-spin text-purple-600" size={24} />
                                        </div>
                                    ) : messages.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                            <MessageSquare size={32} className="text-gray-200 mb-2" />
                                            <p className="text-xs font-bold uppercase tracking-widest">No hay mensajes</p>
                                            <p className="text-[10px] mt-1">Registra mensajes manualmente o conecta Evolution API</p>
                                        </div>
                                    ) : (
                                        messages.map((msg, i) => {
                                            const showDate = i === 0
                                                ? true
                                                : new Date(messages[i - 1].timestamp).toDateString() !== new Date(msg.timestamp).toDateString();
                                            return (
                                                <React.Fragment key={msg.id}>
                                                    {showDate && (
                                                        <div className="flex justify-center">
                                                            <span className="text-[10px] text-gray-400 bg-white px-3 py-1 rounded-full shadow-sm font-medium">
                                                                {formatDate(new Date(msg.timestamp), 'date')}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div className={`flex ${msg.from_me ? 'justify-end' : 'justify-start'}`}>
                                                        <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed shadow-sm ${
                                                            msg.from_me
                                                                ? 'bg-purple-600 text-white rounded-br-md'
                                                                : 'bg-white text-gray-800 rounded-bl-md'
                                                        }`}>
                                                            <p>{msg.content}</p>
                                                            <div className={`text-[9px] mt-1 flex items-center justify-end gap-1 ${
                                                                msg.from_me ? 'text-purple-200' : 'text-gray-400'
                                                            }`}>
                                                                {formatDate(new Date(msg.timestamp), 'time')}
                                                                {msg.from_me && <CheckCircle2 size={10} />}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </React.Fragment>
                                            );
                                        })
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Input */}
                                <div className="p-3 border-t border-gray-100 bg-white">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setShowQuickReplies(!showQuickReplies)}
                                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-purple-600 transition-all"
                                            title="Respuestas rápidas"
                                        >
                                            <Tag size={18} />
                                        </button>
                                        <div className="flex-1 relative">
                                            <input
                                                type="text"
                                                value={inputText}
                                                onChange={e => setInputText(e.target.value)}
                                                onKeyDown={handleKeyDown}
                                                placeholder="Escribe un mensaje para respaldo manual..."
                                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                            />
                                        </div>
                                        <button
                                            onClick={handleSendMessage}
                                            disabled={!inputText.trim()}
                                            className="p-2.5 bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all"
                                        >
                                            <Send size={18} />
                                        </button>
                                    </div>

                                    {showQuickReplies && (
                                        <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-200 max-h-48 overflow-y-auto animate-in slide-in-from-top-2 duration-200">
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Respuestas Rápidas</p>
                                            {quickReplies.length === 0 ? (
                                                <p className="text-xs text-gray-400">Crea respuestas rápidas desde el panel inferior</p>
                                            ) : (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {quickReplies.map(qr => (
                                                        <button
                                                            key={qr.id}
                                                            onClick={() => insertQuickReply(qr.content)}
                                                            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:border-purple-300 hover:text-purple-700 transition-all"
                                                            title={qr.content}
                                                        >
                                                            {qr.title}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Customer Info Sidebar */}
                            {customerInfo && (
                                <div className="hidden lg:block w-64 border-l border-gray-100 bg-gray-50/50 overflow-y-auto">
                                    <div className="p-4 border-b border-gray-100">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">Info del Cliente</p>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-xs">
                                                <User size={14} className="text-gray-400" />
                                                <span className="font-bold text-gray-800">{customerInfo.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs">
                                                <Building2 size={14} className="text-gray-400" />
                                                <span className="font-mono text-gray-600">{customerInfo.id}</span>
                                            </div>
                                            {customerInfo.phone && (
                                                <div className="flex items-center gap-2 text-xs">
                                                    <Phone size={14} className="text-gray-400" />
                                                    <span className="font-mono text-gray-600">{customerInfo.phone}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-gray-400">Compras</span>
                                            <span className="font-black text-gray-800">{customerInfo.total_incomes || 0}</span>
                                        </div>
                                        {customerInfo.last_income_date && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-gray-400">Última compra</span>
                                                <span className="text-[10px] font-mono text-gray-600">{formatDate(new Date(customerInfo.last_income_date), 'full')}</span>
                                            </div>
                                        )}
                                        <div className="pt-2 border-t border-gray-200">
                                            <button
                                                onClick={() => setSelectedConv(null)}
                                                className="w-full py-2 text-[10px] font-black text-purple-600 uppercase tracking-widest hover:bg-purple-50 rounded-lg transition-all"
                                            >
                                                Ver historial completo
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Quick Reply Manager Modal */}
            {showQuickReplyManager && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
                                <Tag size={18} className="text-purple-600" /> Respuestas Rápidas
                            </h3>
                            <button onClick={() => setShowQuickReplyManager(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
                            <div className="grid grid-cols-1 gap-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <select
                                        value={newQrCategory}
                                        onChange={e => setNewQrCategory(e.target.value)}
                                        className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                    >
                                        <option value="">Categoría</option>
                                        {qrCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <input
                                        type="text"
                                        placeholder="Título"
                                        value={newQrTitle}
                                        onChange={e => setNewQrTitle(e.target.value)}
                                        className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                    />
                                </div>
                                <textarea
                                    placeholder="Contenido de la respuesta..."
                                    value={newQrContent}
                                    onChange={e => setNewQrContent(e.target.value)}
                                    rows={3}
                                    className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 resize-none"
                                />
                                <button
                                    onClick={handleAddQuickReply}
                                    disabled={!newQrCategory || !newQrTitle || !newQrContent}
                                    className="py-2 bg-purple-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-purple-700 disabled:opacity-50 transition-all"
                                >
                                    Agregar Respuesta Rápida
                                </button>
                            </div>

                            <div className="space-y-3">
                                {Object.entries(groupedQuickReplies).map(([category, replies]) => (
                                    <div key={category}>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">{category}</p>
                                        <div className="space-y-1">
                                            {replies.map(qr => (
                                                <div key={qr.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-bold text-gray-800">{qr.title}</p>
                                                        <p className="text-[10px] text-gray-500 truncate">{qr.content}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleDeleteQuickReply(qr.id)}
                                                        className="p-1 hover:bg-red-100 text-gray-400 hover:text-red-600 rounded-lg transition-all shrink-0 ml-2"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                {quickReplies.length === 0 && (
                                    <p className="text-xs text-gray-400 text-center py-4">No hay respuestas rápidas creadas</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* New Manual Message Modal */}
            {showNewMessageModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
                                <Plus size={18} className="text-purple-600" /> Nuevo Mensaje Manual
                            </h3>
                            <button onClick={() => setShowNewMessageModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Registra una conversación de WhatsApp manualmente</p>
                            <div className="relative">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Buscar Cliente Existente</label>
                                <input
                                    type="text"
                                    onChange={e => handleCustomerSearch(e.target.value)}
                                    placeholder="Buscar por nombre, CI o teléfono..."
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                />
                                {showCustomerSearch && (
                                    <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                                        {customerSearchResults.map(c => (
                                            <button
                                                key={c.id}
                                                onClick={() => handleSelectCustomer(c)}
                                                className="w-full px-4 py-2.5 text-left hover:bg-purple-50 transition-colors border-b border-gray-50 last:border-0"
                                            >
                                                <span className="font-bold text-sm text-gray-800">{c.name}</span>
                                                <span className="text-xs text-gray-400 ml-2">{c.id}</span>
                                                {c.phone && <span className="text-xs text-gray-400 ml-2">📞 {c.phone}</span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nombre del Cliente</label>
                                <input
                                    type="text"
                                    value={newMsgCustomerName}
                                    onChange={e => setNewMsgCustomerName(e.target.value)}
                                    placeholder="Ej: Juan Pérez"
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Teléfono *</label>
                                <input
                                    type="text"
                                    value={newMsgCustomerPhone}
                                    onChange={e => setNewMsgCustomerPhone(e.target.value)}
                                    placeholder="584141234567"
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Mensaje</label>
                                <textarea
                                    value={newMsgText}
                                    onChange={e => setNewMsgText(e.target.value)}
                                    placeholder="Copia aquí el mensaje de WhatsApp..."
                                    rows={3}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 resize-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Fecha/Hora</label>
                                    <input
                                        type="datetime-local"
                                        value={newMsgDate}
                                        onChange={e => setNewMsgDate(e.target.value)}
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Dirección</label>
                                    <select
                                        value={newMsgFromMe ? 'sent' : 'received'}
                                        onChange={e => setNewMsgFromMe(e.target.value === 'sent')}
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                    >
                                        <option value="received">📩 Recibido del cliente</option>
                                        <option value="sent">📤 Enviado por vendedor</option>
                                    </select>
                                </div>
                            </div>
                            <button
                                onClick={handleNewManualMessage}
                                disabled={!newMsgCustomerPhone.trim()}
                                className="w-full py-3 bg-purple-600 text-white rounded-xl font-black uppercase text-sm tracking-widest hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                            >
                                <Plus size={16} /> Registrar Mensaje
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
