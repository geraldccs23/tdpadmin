// RG7 CRM — Evolution API Bridge
// Recibe webhooks de Evolution API y los guarda en Supabase
// Expone API para que el frontend envíe mensajes

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const PORT = process.env.PORT || 3001;
const EVO_URL = process.env.EVOLUTION_API_URL?.replace(/\/+$/, '');
const EVO_KEY = process.env.EVOLUTION_API_KEY;
const CRM_KEY = process.env.CRM_API_KEY;

// --------------- Supabase Admin ---------------
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

// --------------- Express ---------------
const app = express();
app.use(express.json({ limit: '5mb' }));

// Optional auth for frontend API calls
function requireCrmAuth(req, res, next) {
    if (!CRM_KEY) return next();
    const h = req.headers['authorization'] || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    if (token !== CRM_KEY) return res.status(401).json({ ok: false, error: 'unauthorized' });
    next();
}

// ======================= HELPER: Extract text from Evolution message =======================
function extractMessageText(msg) {
    if (!msg) return null;
    if (msg.conversation) return msg.conversation;
    if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
    if (msg.imageMessage?.caption) return msg.imageMessage.caption;
    if (msg.videoMessage?.caption) return msg.videoMessage.caption;
    return null;
}

function getMessageType(msg) {
    if (!msg) return 'text';
    if (msg.conversation || msg.extendedTextMessage) return 'text';
    if (msg.imageMessage) return 'image';
    if (msg.audioMessage) return 'audio';
    if (msg.videoMessage) return 'video';
    if (msg.documentMessage) return 'document';
    if (msg.locationMessage) return 'location';
    if (msg.contactMessage) return 'contact';
    if (msg.stickerMessage) return 'sticker';
    return 'text';
}

function getMediaUrl(msg) {
    if (!msg) return null;
    if (msg.imageMessage?.url) return msg.imageMessage.url;
    if (msg.audioMessage?.url) return msg.audioMessage.url;
    if (msg.videoMessage?.url) return msg.videoMessage.url;
    if (msg.documentMessage?.url) return msg.documentMessage.url;
    return null;
}

function getMimetype(msg) {
    if (!msg) return null;
    if (msg.imageMessage?.mimetype) return msg.imageMessage.mimetype;
    if (msg.audioMessage?.mimetype) return msg.audioMessage.mimetype;
    if (msg.videoMessage?.mimetype) return msg.videoMessage.mimetype;
    if (msg.documentMessage?.mimetype) return msg.documentMessage.mimetype;
    return null;
}

function cleanJid(jid) {
    if (!jid) return null;
    return jid.replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, '');
}

// ======================= WEBHOOK: Evolution → Supabase =======================
app.post('/webhook', async (req, res) => {
    try {
        const { event, instance, data } = req.body;

        if (!event || !instance) {
            return res.status(400).json({ ok: false, error: 'Missing event or instance' });
        }

        console.log(`[WEBHOOK] event=${event} instance=${instance}`);

        // ---- Connection update ----
        if (event === 'CONNECTION_UPDATE') {
            const state = data?.state || 'disconnected';
            await supabase.from('wa_instances').update({ connection_status: state }).eq('instance_name', instance);
            return res.json({ ok: true });
        }

        // ---- QR Code ----
        if (event === 'QRCODE_UPDATED') {
            const qr = data?.qrcode || null;
            if (qr) {
                await supabase.from('wa_instances').update({ qr_code: qr, connection_status: 'connecting' }).eq('instance_name', instance);
            }
            return res.json({ ok: true });
        }

        // ---- Incoming messages ----
        if (event === 'MESSAGES_UPSERT' && Array.isArray(data)) {
            for (const msgData of data) {
                const key = msgData.key;
                if (!key || key.remoteJid?.includes('@g.us')) continue; // skip groups

                const remoteJid = key.remoteJid;
                const fromMe = key.fromMe || false;
                const waMessageId = key.id;
                const phoneNumber = cleanJid(remoteJid);
                const text = extractMessageText(msgData.message);
                const msgType = getMessageType(msgData.message);
                const mediaUrl = getMediaUrl(msgData.message);
                const mimetype = getMimetype(msgData.message);
                const timestamp = msgData.messageTimestamp
                    ? new Date(parseInt(msgData.messageTimestamp) * 1000).toISOString()
                    : new Date().toISOString();
                const pushName = msgData.pushName || null;

                if (!phoneNumber) continue;

                // 1. Find instance
                const { data: instData } = await supabase
                    .from('wa_instances')
                    .select('id')
                    .eq('instance_name', instance)
                    .maybeSingle();

                // 2. Find or create customer by phone
                let customerId = null;
                const { data: existingCust } = await supabase
                    .from('customers')
                    .select('id, name')
                    .or(`phone.eq.${phoneNumber},phone.eq.${phoneNumber.replace(/^58/, '0')}`)
                    .maybeSingle();

                if (existingCust) {
                    customerId = existingCust.id;
                } else if (pushName && !fromMe) {
                    // Auto-create customer for incoming messages
                    const { data: newCust } = await supabase
                        .from('customers')
                        .insert([{ id: phoneNumber, name: pushName, phone: phoneNumber }])
                        .select()
                        .single();
                    if (newCust) customerId = newCust.id;
                }

                // 3. Find or create conversation
                let convId;
                const { data: existingConv } = await supabase
                    .from('wa_conversations')
                    .select('id')
                    .eq('remote_jid', remoteJid)
                    .maybeSingle();

                if (existingConv) {
                    convId = existingConv.id;
                } else {
                    const { data: newConv } = await supabase
                        .from('wa_conversations')
                        .insert([{
                            instance_id: instData?.id || null,
                            remote_jid: remoteJid,
                            customer_id: customerId,
                            customer_name: pushName || phoneNumber,
                            customer_phone: phoneNumber,
                            status: 'active',
                            last_message_at: timestamp,
                            last_message_preview: text || '[Media]',
                            unread_count: fromMe ? 0 : 1
                        }])
                        .select()
                        .single();
                    if (newConv) convId = newConv.id;
                }

                if (!convId) continue;

                // 4. Insert message
                await supabase.from('wa_messages').insert([{
                    conversation_id: convId,
                    wa_message_id: waMessageId,
                    from_me: fromMe,
                    message_type: msgType,
                    content: text,
                    media_url: mediaUrl,
                    mimetype: mimetype,
                    timestamp,
                }]);

                // 5. Update conversation metadata
                const convUpdates = {
                    last_message_at: timestamp,
                    last_message_preview: text || '[Media]',
                };
                if (!fromMe) {
                    const { data: curConv } = await supabase
                        .from('wa_conversations')
                        .select('unread_count')
                        .eq('id', convId)
                        .maybeSingle();
                    convUpdates.unread_count = (curConv?.unread_count || 0) + 1;
                }
                await supabase.from('wa_conversations').update(convUpdates).eq('id', convId);
            }
            return res.json({ ok: true });
        }

        res.json({ ok: true, ignored: event });
    } catch (err) {
        console.error('[WEBHOOK ERROR]', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ======================= API: Send message via Evolution =======================
app.post('/api/send', requireCrmAuth, async (req, res) => {
    try {
        const { instance, number, text, delay = 1 } = req.body;
        if (!instance || !number || !text) {
            return res.status(400).json({ ok: false, error: 'Missing instance, number, or text' });
        }

        // Call Evolution API
        const evoRes = await fetch(`${EVO_URL}/message/sendText/${instance}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
            body: JSON.stringify({ number, text, delay, linkPreview: true })
        });

        if (!evoRes.ok) {
            const errText = await evoRes.text();
            return res.status(502).json({ ok: false, error: `Evolution API error: ${errText}` });
        }

        const evoData = await evoRes.json();

        // Save sent message to DB
        const remoteJid = `${number}@s.whatsapp.net`;
        const { data: conv } = await supabase
            .from('wa_conversations')
            .select('id')
            .eq('remote_jid', remoteJid)
            .maybeSingle();

        if (conv) {
            await supabase.from('wa_messages').insert([{
                conversation_id: conv.id,
                wa_message_id: evoData?.key?.id || null,
                from_me: true,
                message_type: 'text',
                content: text,
                timestamp: new Date().toISOString()
            }]);

            await supabase
                .from('wa_conversations')
                .update({ last_message_at: new Date().toISOString(), last_message_preview: text })
                .eq('id', conv.id);
        }

        res.json({ ok: true, data: evoData });
    } catch (err) {
        console.error('[SEND ERROR]', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ======================= API: Get QR for instance =======================
app.get('/api/instances/:name/qrcode', requireCrmAuth, async (req, res) => {
    try {
        const { name } = req.params;

        const evoRes = await fetch(`${EVO_URL}/instance/connect/${name}`, {
            method: 'GET',
            headers: { apikey: EVO_KEY }
        });

        if (!evoRes.ok) {
            const errText = await evoRes.text();
            return res.status(502).json({ ok: false, error: `Evolution API error: ${errText}` });
        }

        const data = await evoRes.json();
        res.json({ ok: true, data });
    } catch (err) {
        console.error('[QR ERROR]', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ======================= API: List instances from Evolution =======================
app.get('/api/instances', requireCrmAuth, async (req, res) => {
    try {
        const evoRes = await fetch(`${EVO_URL}/instance/fetchInstances`, {
            method: 'GET',
            headers: { apikey: EVO_KEY }
        });

        if (!evoRes.ok) {
            return res.status(502).json({ ok: false, error: 'Failed to fetch instances from Evolution' });
        }

        const data = await evoRes.json();
        res.json({ ok: true, data });
    } catch (err) {
        console.error('[INSTANCES ERROR]', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ======================= API: Create instance in Evolution =======================
app.post('/api/instances/create', requireCrmAuth, async (req, res) => {
    try {
        const { instanceName, sellerId } = req.body;
        if (!instanceName) return res.status(400).json({ ok: false, error: 'Missing instanceName' });

        // Create in Evolution
        const evoRes = await fetch(`${EVO_URL}/instance/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
            body: JSON.stringify({
                instanceName,
                integration: 'WHATSAPP-BAILEYS',
                qrcode: true,
                rejectCall: true,
                groupsIgnore: true,
                alwaysOnline: true,
                readMessages: false,
                readStatus: false,
                syncFullHistory: false,
                webhook: {
                    url: `${req.protocol}://${req.get('host')}/webhook`,
                    byEvents: false,
                    events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED']
                }
            })
        });

        if (!evoRes.ok) {
            const errText = await evoRes.text();
            return res.status(502).json({ ok: false, error: `Evolution API error: ${errText}` });
        }

        const evoData = await evoRes.json();

        // Save to local DB
        const { data: inst } = await supabase.from('wa_instances').insert([{
            seller_id: sellerId || null,
            instance_name: instanceName,
            phone_number: '',
            apikey: evoData?.hash?.apikey || '',
            connection_status: 'connecting',
            qr_code: null
        }]).select().single();

        res.json({ ok: true, data: { evolution: evoData, local: inst } });
    } catch (err) {
        console.error('[CREATE INSTANCE ERROR]', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ======================= Health =======================
app.get('/ping', (req, res) => {
    res.json({ ok: true, service: 'rg7-crm-evolution', time: new Date().toISOString() });
});

// ======================= Start =======================
app.listen(PORT, () => {
    console.log(`[CRM Backend] Running on port ${PORT}`);
    console.log(`[CRM Backend] Evolution API: ${EVO_URL}`);
    console.log(`[CRM Backend] Webhook URL: http://<host>:${PORT}/webhook`);
});
