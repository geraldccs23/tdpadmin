import React, { useState, useEffect } from 'react';
import { TrendingUp, Plus, List, Save, X, Building2, CreditCard, Banknote, Landmark, Wallet, ShieldCheck, Loader2, Search, ArrowRightCircle, Trash2, Edit2, Users, ShoppingCart, SearchIcon } from 'lucide-react';
import { supabase } from '../services/supabase';
import { dbService } from '../services/dbService';
import { BankAccount, BranchType, PaymentCondition, Income as IncomeType, Seller, Courier } from '../types';

export function Income() {
    const [activeTab, setActiveTab] = useState<'new' | 'history' | 'customers'>('new');
    const [step, setStep] = useState(1);
    const [userRole, setUserRole] = useState<string | null>(null);

    // Data from DB
    const [bankAccounts, setBankAccounts] = useState<(BankAccount & { banks: { name: string } })[]>([]);
    const [recentIncomes, setRecentIncomes] = useState<IncomeType[]>([]);
    const [historyStartDate, setHistoryStartDate] = useState('');
    const [historyEndDate, setHistoryEndDate] = useState('');
    const [historyPage, setHistoryPage] = useState(1);
    const [historyPageSize] = useState(20);
    const [historyTotal, setHistoryTotal] = useState(0);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [loadingAccounts, setLoadingAccounts] = useState(false);
    const [loadingOriginalSale, setLoadingOriginalSale] = useState(false);
    const [duplicateInfo, setDuplicateInfo] = useState<any>(null);

    // Sound alarm for duplicates
    function playAlarm() {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 440;
            osc.type = 'square';
            gain.gain.value = 0.3;
            osc.start();
            setTimeout(() => { gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3); }, 100);
            setTimeout(() => osc.stop(), 500);
        } catch (e) { /* audio not supported */ }
    }

    // Check duplicate on blur
    const checkDuplicate = async () => {
        if (!docNumber.trim()) return;
        try {
            const { data: existing } = await supabase
                .from('incomes')
                .select('id, created_by_email, customer_name, total_amount, created_at, branch')
                .eq('branch', branch)
                .eq('document_type', docType)
                .eq('document_number', docNumber.trim())
                .eq('type', incomeType)
                .limit(1);
            if (existing && existing.length > 0) {
                playAlarm();
                setDuplicateInfo({
                    document_number: docNumber.trim(),
                    document_type: docType,
                    type: incomeType,
                    created_by_email: existing[0].created_by_email,
                    customer_name: existing[0].customer_name,
                    total_amount: existing[0].total_amount,
                    created_at: existing[0].created_at,
                    branch: existing[0].branch
                });
            }
        } catch (e) { /* silent */ }
    };

    // Form State
    const [branch, setBranch] = useState<BranchType>('Boleita');
    const [docType, setDocType] = useState('Factura');
    const [docNumber, setDocNumber] = useState('');
    const [paymentCondition, setPaymentCondition] = useState<PaymentCondition>('Contado');
    const [totalAmount, setTotalAmount] = useState<number | ''>('');
    const [totalAmountBs, setTotalAmountBs] = useState<number | ''>('');
    const [incomeType, setIncomeType] = useState<'Venta' | 'Devolucion'>('Venta');

    // POS Cart State
    const [cart, setCart] = useState<any[]>([]);
    const [globalDiscount, setGlobalDiscount] = useState<number | ''>('');
    const [productSearch, setProductSearch] = useState('');
    const [productResults, setProductResults] = useState<any[]>([]);
    const [isSearchingProduct, setIsSearchingProduct] = useState(false);

    // Customer State
    const [customerId, setCustomerId] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');

    // Payments State
    interface PaymentDetail {
        id: string;
        type: string;
        amount: number;
        exchange_rate: number;
        amount_bs?: number;
        bankAccountId?: number;
        bankAccountRef?: string;
    }
    const [payments, setPayments] = useState<PaymentDetail[]>([]);

    // Exchange Rate State
    const [exchangeRate, setExchangeRate] = useState<number>(1);
    const [amountBs, setAmountBs] = useState<number | ''>('');
    const [isSaturdayRateModalOpen, setIsSaturdayRateModalOpen] = useState(false);
    const [saturdayManualRate, setSaturdayManualRate] = useState<number | ''>('');
    const [savingSaturdayRate, setSavingSaturdayRate] = useState(false);

    // Seller & Delivery
    const [sellers, setSellers] = useState<Seller[]>([]);
    const [couriers, setCouriers] = useState<Courier[]>([]);
    const [selectedSeller, setSelectedSeller] = useState<number | ''>('');
    const [deliveryMethod, setDeliveryMethod] = useState<string>('Retira en Tienda');
    const [selectedCourier, setSelectedCourier] = useState<number | ''>('');
    const [selectedCashRegister, setSelectedCashRegister] = useState<string>('');
    const [shippingAgency, setShippingAgency] = useState('');
    const [destinationState, setDestinationState] = useState('');
    const [destinationCity, setDestinationCity] = useState('');

    const VENEZUELA_STATES = [
        'Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 
        'Carabobo', 'Cojedes', 'Delta Amacuro', 'Distrito Capital', 'Falcón', 
        'Guárico', 'Lara', 'Mérida', 'Miranda', 'Monagas', 'Nueva Esparta', 
        'Portuguesa', 'Sucre', 'Táchira', 'Trujillo', 'La Guaira', 'Yaracuy', 'Zulia'
    ];
    const [deliveryMunicipio, setDeliveryMunicipio] = useState<string>('');
    const [deliveryZona, setDeliveryZona] = useState<string>('');
    const [deliveryObservations, setDeliveryObservations] = useState('');
    const [deliveryLocationUrl, setDeliveryLocationUrl] = useState('');
    const [deliverySecondPhone, setDeliverySecondPhone] = useState('');

    const agencyOptions = ['ZOOM', 'MRW', 'TEALCA', 'DOMESA', 'LIBERTY EXPRESS', 'OTRO'];
    const venezuelanStates = [
        'Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 'Carabobo', 'Cojedes', 'Delta Amacuro', 
        'Falcón', 'Guárico', 'Lara', 'Mérida', 'Miranda', 'Monagas', 'Nueva Esparta', 'Portuguesa', 'Sucre', 
        'Táchira', 'Trujillo', 'Vargas', 'Yaracuy', 'Zulia', 'Distrito Capital'
    ];

    const [deliveryZones, setDeliveryZones] = useState<Record<string, string[]>>({});

    // Modal states
    const [isCourierModalOpen, setIsCourierModalOpen] = useState(false);
    const [newCourierName, setNewCourierName] = useState('');
    const [newCourierPhone, setNewCourierPhone] = useState('');
    const [savingCourier, setSavingCourier] = useState(false);

    const [customerList, setCustomerList] = useState<any[]>([]);
    const [customerSearch, setCustomerSearch] = useState('');
    const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
    const [customerAutocompleteResults, setCustomerAutocompleteResults] = useState<any[]>([]);
    const [customerDebts, setCustomerDebts] = useState<{ pendingCxc: number, pendingCashea: number } | null>(null);

    const [numInstallments, setNumInstallments] = useState<number>(3);
    const [saving, setSaving] = useState(false);

    // Edit state
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingIncomeId, setEditingIncomeId] = useState<number | null>(null);

    const paymentTypes = ['Efectivo $', 'Efectivo Bs', 'Punto de Venta', 'Pago Móvil', 'Transferencia', 'Zelle'];
    const requiresBank = ['Punto de Venta', 'Pago Móvil', 'Transferencia'];
    const cashRegistersByBranch: Record<BranchType, string[]> = {
        'Boleita': ['Fiscal', 'Tecnologia', 'Servientrega'],
        'Sabana Grande': ['Principal']
    };

    const [newPayType, setNewPayType] = useState('Efectivo $');
    const [newPayBank, setNewPayBank] = useState<number | ''>('');
    const [newPayAmount, setNewPayAmount] = useState<number | ''>('');

    useEffect(() => {
        const fetchAll = async () => {
            fetchUserRole();
            setLoadingAccounts(true);
            const [accounts, rate, sellersData, couriersData, zones] = await Promise.all([
                supabase.from('bank_accounts').select('*, banks(name)'),
                dbService.getLatestExchangeRate(),
                dbService.getSellers(),
                dbService.getCouriers(),
                supabase.from('delivery_zones').select('municipio, zona').order('municipio', { ascending: true }).order('zona', { ascending: true })
            ]);
            if (accounts.data) setBankAccounts(accounts.data as any);

            if (rate === -1) {
                setIsSaturdayRateModalOpen(true);
            } else {
                setExchangeRate(rate);
            }

            setSellers(sellersData);
            setCouriers(couriersData);

            // Group zones by municipio (case-insensitive dedup)
            if (zones.data) {
                const grouped: Record<string, { display: string; zonas: Set<string> }> = {};
                for (const z of zones.data) {
                    const key = z.municipio.toLowerCase().trim();
                    if (!grouped[key]) {
                        grouped[key] = { display: z.municipio, zonas: new Set([z.zona]) };
                    } else {
                        if (grouped[key].display === grouped[key].display.toUpperCase() && z.municipio !== z.municipio.toUpperCase()) {
                            grouped[key].display = z.municipio;
                        }
                        grouped[key].zonas.add(z.zona);
                    }
                }
                const result: Record<string, string[]> = {};
                for (const g of Object.values(grouped)) {
                    result[g.display] = Array.from(g.zonas).sort();
                }
                setDeliveryZones(result);
            }

            setLoadingAccounts(false);

        };
        fetchAll();
    }, []);

    useEffect(() => {
        setSelectedCashRegister('');
    }, [branch]);


    async function fetchUserRole() {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            const { data } = await supabase.from('user_roles').select('role, branch').eq('user_id', session.user.id).single();
            if (data) {
                setUserRole(data.role);
                // No forzar la sucursal, dejar que el usuario elija si desea, pero mantener el default si tiene uno
                if (data.branch) {
                    setBranch(data.branch as BranchType);
                }
            }
        }
    }

    const fetchRecentIncomes = async () => {
        try {
            setLoadingHistory(true);

            const from = (historyPage - 1) * historyPageSize;
            const to = from + historyPageSize - 1;

            let query = supabase
                .from('incomes')
                .select('*, income_payments(amount, payment_type)', { count: 'exact' });

            if (historyStartDate) {
                query = query.gte('created_at', `${historyStartDate}T00:00:00`);
            }

            if (historyEndDate) {
                query = query.lte('created_at', `${historyEndDate}T23:59:59`);
            }

            const { data, error, count } = await query
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;

            setRecentIncomes((data as any[]) || []);
            setHistoryTotal(count || 0);
        } catch (error) {
            console.error('Error fetching incomes history:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    useEffect(() => {
        if (!customerId && !customerName) {
            setCustomerAutocompleteResults([]);
            return;
        }

        const searchTerm = customerId || customerName;
        if (searchTerm.length < 3) return;

        const t = setTimeout(async () => {
            setIsSearchingCustomer(true);
            try {
                // If the user typed an exact cedula, try to fetch directly
                if (customerId && customerId.length >= 7) {
                    const exactMatch = await dbService.getCustomerById(customerId);
                    if (exactMatch) {
                        setCustomerName(exactMatch.name);
                        setCustomerPhone(exactMatch.phone || '');
                        setCustomerAutocompleteResults([]);
                        setIsSearchingCustomer(false);
                        const debts = await dbService.getCustomerDebts(customerId);
                        setCustomerDebts(debts);
                        return;
                    }
                }

                // Otherwise run a loose autocomplete
                const results = await dbService.searchCustomers(searchTerm);
                setCustomerAutocompleteResults(results);
            } catch (error) {
                console.error(error);
            } finally {
                setIsSearchingCustomer(false);
            }
        }, 250);

        return () => clearTimeout(t);
    }, [customerId, customerName]);

    // Product Search Effect
    useEffect(() => {
        if (!productSearch) {
            setProductResults([]);
            return;
        }
        const t = setTimeout(async () => {
            if (productSearch.length >= 3) {
                setIsSearchingProduct(true);
                try {
                    const results = await dbService.searchPOSProducts(productSearch);
                    setProductResults(results);
                } catch (e) {
                    console.error(e);
                } finally {
                    setIsSearchingProduct(false);
                }
            }
        }, 300);
        return () => clearTimeout(t);
    }, [productSearch]);

    useEffect(() => {
        if (activeTab === 'history') {
            fetchRecentIncomes();
        }
    }, [activeTab, historyStartDate, historyEndDate, historyPage]);
    const handleSelectCustomer = async (c: any) => {
        setCustomerId(c.id);
        setCustomerName(c.name);
        setCustomerPhone(c.phone || '');
        if (c.seller_id) {
            setSelectedSeller(Number(c.seller_id));
        } else {
            const topSeller = await dbService.getTopSellerForCustomer(c.id);
            if (topSeller) setSelectedSeller(topSeller);
        }
        setCustomerAutocompleteResults([]);
        try {
            const debts = await dbService.getCustomerDebts(c.id);
            setCustomerDebts(debts);
        } catch (e) { }
    };

    const handleSaveSaturdayRate = async () => {
        if (!saturdayManualRate || Number(saturdayManualRate) <= 0) return;
        setSavingSaturdayRate(true);
        try {
            await dbService.saveDailyRate(Number(saturdayManualRate));
            setExchangeRate(Number(saturdayManualRate));
            setIsSaturdayRateModalOpen(false);
        } catch (e: any) {
            alert('Error al guardar la tasa: ' + e.message);
        } finally {
            setSavingSaturdayRate(false);
        }
    };

    const handleSaveCourier = async () => {
        if (!newCourierName || savingCourier) return;
        setSavingCourier(true);
        try {
            const { data, error } = await supabase.from('couriers').insert([{
                name: newCourierName, phone: newCourierPhone
            }]).select().single();
            if (error) throw error;
            setCouriers([...couriers, data as any]);
            setSelectedCourier(data.id);
            setNewCourierName(''); setNewCourierPhone('');
            setIsCourierModalOpen(false);
        } catch (e: any) { alert('Error: ' + e.message); }
        finally { setSavingCourier(false); }
    };

    // Calculate cart total
    const cartTotal = cart.reduce((sum, item) => sum + item.total_linea_usd, 0);
    const finalTotal = Math.max(0, cartTotal - (Number(globalDiscount) || 0));

    // Sync totalAmount with finalTotal
    useEffect(() => {
        if (finalTotal > 0) {
            setTotalAmount(Number(finalTotal.toFixed(2)));
            if (exchangeRate) setTotalAmountBs(Number((finalTotal * exchangeRate).toFixed(2)));
        } else {
            setTotalAmount('');
            setTotalAmountBs('');
        }
    }, [finalTotal, exchangeRate]);

    const addToCart = (product: any, price: number, qty: number) => {
        const total = price * qty;
        const precioOriginal = Number(product.precio_referencia || 0);
        const descuento = Math.max(0, precioOriginal - price);
        setCart([...cart, {
            id: Math.random().toString(),
            codigo_producto: product.codigo_producto,
            cantidad: qty,
            precio_unitario_usd: price,
            precio_original_usd: precioOriginal,
            descuento_usd: descuento,
            total_linea_usd: total,
            descripcion: product.descripcion
        }]);
        setProductSearch('');
        setProductResults([]);
    };

    const removeFromCart = (id: string) => {
        setCart(cart.filter(item => item.id !== id));
    };

    const handleSaveIncome = async () => {
        if (!isFormValid || saving) return;
        setSaving(true);
        try {
            // Check for duplicates
            const { data: existing, error: checkError } = await supabase
                .from('incomes')
                .select('id, created_by_email, customer_name, total_amount, created_at, branch, document_type')
                .eq('branch', branch)
                .eq('document_type', docType)
                .eq('document_number', docNumber.trim())
                .eq('type', incomeType)
                .limit(1);

            if (checkError) throw checkError;

            if (existing && existing.length > 0) {
                playAlarm();
                setDuplicateInfo({
                    document_number: docNumber.trim(),
                    document_type: docType,
                    type: incomeType,
                    created_by_email: existing[0].created_by_email,
                    customer_name: existing[0].customer_name,
                    total_amount: existing[0].total_amount,
                    created_at: existing[0].created_at,
                    branch: existing[0].branch
                });
                setStep(1); 
                setDocNumber(''); 
                setTotalAmount(''); 
                setTotalAmountBs(''); 
                setPayments([]); 
                setCart([]); 
                setCustomerId(''); 
                setCustomerName(''); 
                setCustomerPhone(''); 
                setIncomeType('Venta'); 
                setDeliveryMunicipio(''); 
                setDeliveryZona(''); 
                setGlobalDiscount('');
                setSaving(false);
                return;
            }

            // Validate stock for sales (returns always allowed)
            if (incomeType === 'Venta' && cart.length > 0) {
                const codes = cart.map((c: any) => c.codigo_producto);
                const stockMap = await dbService.getProductsStockByCodes(codes, branch);
                const insufficient: { code: string; stock: number; requested: number }[] = [];
                for (const item of cart) {
                    const stock = stockMap[item.codigo_producto] ?? 0;
                    if (stock < Number(item.cantidad)) {
                        insufficient.push({ code: item.codigo_producto, stock, requested: Number(item.cantidad) });
                    }
                }
                if (insufficient.length > 0) {
                    const msg = insufficient.map(i =>
                        `${i.code} — Stock actual: ${i.stock}, Solicitado: ${i.requested}`
                    ).join('\n');
                    alert(`⚠️ Stock insuficiente. No se puede procesar la venta.\n\n${msg}`);
                    setSaving(false);
                    return;
                }
            }

            if (customerId && customerName) {
                await dbService.upsertCustomer({ id: customerId, name: customerName, phone: customerPhone });
            }
            const { data: { session } } = await supabase.auth.getSession();
            const { data: income, error: iError } = await supabase.from('incomes').insert([{
                branch, type: incomeType, document_type: docType, document_number: docNumber, payment_condition: paymentCondition,
                customer_id: customerId || null, customer_name: customerName || null, customer_phone: customerPhone || null,
                total_amount: incomeType === 'Devolucion' ? -Math.abs(Number(totalAmount)) : Number(totalAmount),
                discount_usd: Number(globalDiscount) || 0,
                seller_id: selectedSeller || null, delivery_method: deliveryMethod,
                courier_id: deliveryMethod === 'Servientrega' ? selectedCourier : null,
                shipping_agency: deliveryMethod === 'Envío Nacional' ? shippingAgency : null,
                cash_register: selectedCashRegister,
                created_by_email: session?.user?.email,
                created_by_id: session?.user?.id
            }]).select().single();
            if (iError) throw iError;

            // Handle returns: if this is a refund/return, delete the delivery associated with the original sale
            if (incomeType === 'Devolucion') {
                const { data: originalSales } = await supabase
                    .from('incomes')
                    .select('id')
                    .eq('branch', branch)
                    .eq('document_type', docType)
                    .eq('document_number', docNumber.trim())
                    .eq('type', 'Venta')
                    .limit(1);

                if (originalSales && originalSales.length > 0) {
                    const originalSaleId = originalSales[0].id;
                    await supabase
                        .from('deliveries')
                        .delete()
                        .eq('income_id', originalSaleId);
                }
            }

            // Save Cart Lines
            if (cart.length > 0) {
                const linesToInsert = cart.map(c => ({
                    income_id: income.id,
                    codigo_producto: c.codigo_producto,
                    descripcion: c.descripcion,
                    cantidad: incomeType === 'Devolucion' ? -Math.abs(c.cantidad) : c.cantidad,
                    precio_unitario_usd: c.precio_unitario_usd,
                    precio_original_usd: c.precio_original_usd,
                    descuento_usd: c.descuento_usd,
                    total_linea_usd: incomeType === 'Devolucion' ? -Math.abs(c.total_linea_usd) : c.total_linea_usd
                }));
                const { error: linesError } = await supabase.from('income_lines').insert(linesToInsert);
                if (linesError) throw linesError;
                
                // Update local inventory
                for (const line of cart) {
                    const stockColumn = branch === 'Boleita' ? 'stock_boleita' : 'stock_sabana_grande';
                    const { data: p } = await supabase.from('products').select(stockColumn).eq('codigo_producto', line.codigo_producto).single();
                    if (p) {
                        const qtyDiff = incomeType === 'Devolucion' ? Number(line.cantidad) : -Number(line.cantidad);
                        const newStock = Math.max(0, Number(p[stockColumn]) + qtyDiff);
                        await supabase.from('products').update({ [stockColumn]: newStock }).eq('codigo_producto', line.codigo_producto);
                    }
                }
            }

            let paymentsToInsert = payments.map(p => {
                const isPunto = p.type.toLowerCase().includes('punto');
                return {
                    income_id: income.id, payment_type: paymentCondition === 'Inicial de Cashea' ? `INICIAL: ${p.type}` : p.type,
                    amount: incomeType === 'Devolucion' ? -Math.abs(p.amount) : p.amount,
                    exchange_rate: p.exchange_rate,
                    amount_bs: incomeType === 'Devolucion' ? -Math.abs(p.amount_bs || (p.amount * p.exchange_rate)) : (p.amount_bs || (p.amount * p.exchange_rate)),
                    bank_account_id: p.bankAccountId,
                    status: isPunto ? 'deferred' : 'available'
                };
            });

            if (paymentCondition === 'Inicial de Cashea' && remainingAmount > 0) {
                const casheaAmount = incomeType === 'Devolucion' ? -Math.abs(remainingAmount) : remainingAmount;
                paymentsToInsert.push({
                    income_id: income.id, payment_type: 'Cashea', amount: casheaAmount,
                    exchange_rate: exchangeRate, amount_bs: casheaAmount * exchangeRate, bank_account_id: null
                });
                await supabase.from('cashea_installments').insert([{
                    income_id: income.id, installment_number: 1, amount_usd: casheaAmount,
                    status: 'pending', due_date: null, created_at: new Date().toISOString()
                }]);
            }

            if (paymentsToInsert.length > 0) {
                const { error: pError } = await supabase.from('income_payments').insert(paymentsToInsert);
                if (pError) throw pError;
            }

            if (deliveryMethod === 'Servientrega') {
                // Fetch rate from delivery_zones
                let deliveryFee = 2.00;
                try {
                    const { data: zoneData } = await supabase
                        .from('delivery_zones')
                        .select('rate')
                        .eq('zona', deliveryZona)
                        .maybeSingle();
                    if (zoneData && zoneData.rate !== undefined && zoneData.rate !== null) {
                        deliveryFee = Number(zoneData.rate);
                    }
                } catch (err) {
                    console.error("Error fetching delivery zone rate:", err);
                }

                await dbService.createDelivery({
                    income_id: income.id,
                    courier_id: selectedCourier ? Number(selectedCourier) : undefined,
                    municipio: deliveryMunicipio,
                    zona: deliveryZona,
                    observations: deliveryObservations || null,
                    location_url: deliveryLocationUrl || null,
                    second_phone: deliverySecondPhone || null,
                    delivery_status: 'EN_PREPARACION',
                    payment_status: 'PENDIENTE',
                    delivery_fee: deliveryFee
                });
            }

            if (deliveryMethod === 'Envío Nacional') {
                await dbService.createNationalShipping({
                    income_id: income.id,
                    agency: shippingAgency,
                    destination_state: destinationState,
                    destination_city: destinationCity,
                    status: 'PREPARANDO'
                });
            }

            alert('Ingreso registrado con éxito');
            setStep(1); setDocNumber(''); setTotalAmount(''); setTotalAmountBs(''); setPayments([]); setCart([]); setCustomerId(''); setCustomerName(''); setCustomerPhone(''); setIncomeType('Venta'); setDeliveryMunicipio(''); setDeliveryZona(''); setGlobalDiscount('');
            fetchRecentIncomes(); setActiveTab('history');
        } catch (e: any) {
            alert('Error: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleLoadOriginalSale = async () => {
        if (!docNumber.trim()) {
            alert('Por favor ingresa el Nº de Documento de la venta original.');
            return;
        }
        setLoadingOriginalSale(true);
        try {
            // Buscar la venta original por tipo y numero
            const { data: originalIncomes, error: searchError } = await supabase
                .from('incomes')
                .select('*')
                .eq('document_type', docType)
                .eq('document_number', docNumber.trim())
                .eq('type', 'Venta')
                .order('created_at', { ascending: false })
                .limit(1);

            if (searchError) throw searchError;

            if (!originalIncomes || originalIncomes.length === 0) {
                alert('No se encontró ninguna venta con este tipo y número de documento.');
                return;
            }

            const originalSale = originalIncomes[0];

            // Buscar las líneas correspondientes
            const { data: lines, error: linesError } = await supabase
                .from('income_lines')
                .select('*')
                .eq('income_id', originalSale.id);

            if (linesError) throw linesError;

            if (!lines || lines.length === 0) {
                alert('La venta fue encontrada pero no contiene productos registrados.');
                return;
            }

            // Mapear al carrito (las cantidades se muestran positivas en la interfaz)
            const mappedCart = lines.map(line => ({
                id: Math.random().toString(36).substr(2, 9),
                codigo_producto: line.codigo_producto,
                cantidad: Math.abs(line.cantidad),
                precio_unitario_usd: Number(line.precio_unitario_usd),
                precio_original_usd: Number(line.precio_original_usd || line.precio_unitario_usd),
                descuento_usd: Number(line.descuento_usd || 0),
                total_linea_usd: Math.abs(Number(line.total_linea_usd)),
                descripcion: line.descripcion || ''
            }));

            setCart(mappedCart);
            setCustomerId(originalSale.customer_id || '');
            setCustomerName(originalSale.customer_name || '');
            setCustomerPhone(originalSale.customer_phone || '');
            setSelectedSeller(originalSale.seller_id || '');
            if (originalSale.branch) setBranch(originalSale.branch);

            alert('¡Venta original cargada con éxito! Se cargaron los productos, cliente y vendedor.');
        } catch (e: any) {
            alert('Error al cargar la venta: ' + e.message);
        } finally {
            setLoadingOriginalSale(false);
        }
    };

    const handleOpenEdit = (income: any) => {
        setEditingIncomeId(income.id);
        setBranch(income.branch);
        setDocType(income.document_type || 'Factura');
        setDocNumber(income.document_number || '');
        setTotalAmount(income.total_amount || 0);
        setPaymentCondition(income.payment_condition || 'Contado');
        setCustomerId(income.customer_id || '');
        setCustomerName(income.customer_name || '');
        setCustomerPhone(income.customer_phone || '');
        setSelectedSeller(income.seller_id || '');
        setDeliveryMethod(income.delivery_method || 'Retira en Tienda');
        setSelectedCourier(income.courier_id || '');
        setShippingAgency(income.shipping_agency || '');
        setSelectedCashRegister(income.cash_register || '');
        setIsEditModalOpen(true);
    };

    const handleUpdateIncome = async () => {
        if (!editingIncomeId) return;
        setSaving(true);
        try {
            const { error } = await supabase.from('incomes').update({
                branch, document_type: docType, document_number: docNumber, payment_condition: paymentCondition,
                customer_id: customerId || null, customer_name: customerName || null, customer_phone: customerPhone || null,
                total_amount: Number(totalAmount), seller_id: selectedSeller || null, delivery_method: deliveryMethod,
                courier_id: deliveryMethod === 'Servientrega' ? selectedCourier : null,
                shipping_agency: deliveryMethod === 'Envío Nacional' ? shippingAgency : null,
                cash_register: selectedCashRegister
            }).eq('id', editingIncomeId);
            if (error) throw error;
            setIsEditModalOpen(false); fetchRecentIncomes();
            alert('¡Actualizado!');
        } catch (e: any) { alert('Error: ' + e.message); }
        finally { setSaving(false); }
    };

    const handleDeleteIncome = async (id: number) => {
        if (!confirm('¿Seguro? Revertirá saldos.')) return;
        try {
            // Delete associated delivery explicitly
            await supabase.from('deliveries').delete().eq('income_id', id);
            const { error } = await supabase.from('incomes').delete().eq('id', id);
            if (!error) fetchRecentIncomes();
        } catch (e) { console.error(e); }
    };

    const sumPayments = payments.reduce((acc, p) => acc + p.amount, 0);
    const remainingAmount = (Number(totalAmount) || 0) - sumPayments;
    const isCustomerMandatory = paymentCondition === 'Credito' || paymentCondition === 'Inicial de Cashea' || incomeType === 'Devolucion';

    const isFormValid = totalAmount !== '' && Number(totalAmount) > 0 && docNumber.trim() !== '' && selectedSeller !== '' && selectedCashRegister !== '' &&
        cart.length > 0 &&
        (deliveryMethod !== 'Servientrega' || (selectedCourier && deliveryMunicipio && deliveryZona)) &&
        (deliveryMethod !== 'Envío Nacional' || (shippingAgency && destinationState && destinationCity)) &&
        (!isCustomerMandatory || (customerId && customerName)) &&
        ((paymentCondition === 'Contado' && remainingAmount === 0) ||
            (paymentCondition === 'Credito' && payments.length === 0) ||
            (paymentCondition === 'Inicial de Cashea' && remainingAmount > 0));

    const totalHistoryPages = Math.max(1, Math.ceil(historyTotal / historyPageSize));

    useEffect(() => {
        setNewPayBank('');
    }, [newPayType]);

    const addPayment = () => {
        if (!newPayAmount || Number(newPayAmount) <= 0) return;
        if (Number(newPayAmount) > remainingAmount + 0.001) return alert('El monto supera el restante');
        const account = bankAccounts.find(ba => ba.id === Number(newPayBank));
        setPayments([...payments, {
            id: Math.random().toString(36).substr(2, 9), type: newPayType, amount: Number(newPayAmount),
            exchange_rate: exchangeRate, amount_bs: Number(amountBs) || undefined,
            bankAccountId: newPayBank ? Number(newPayBank) : undefined,
            bankAccountRef: account ? `${account.banks?.name} - ${account.reference || 'S/R'}` : undefined
        }]);
        setNewPayAmount(''); setNewPayBank(''); setAmountBs('');
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-2">
                        <TrendingUp className="text-[#D40000]" size={28} /> Módulo de Ingresos
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 font-medium text-left">Control de ventas, créditos y cobranzas por sucursal.</p>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button onClick={() => setActiveTab('new')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'new' ? 'bg-white text-[#D40000] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Plus size={16} className="inline mr-1" /> Nuevo Registro</button>
                    {userRole !== 'vendedor' && (
                        <>
                            <button onClick={() => setActiveTab('history')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'history' ? 'bg-white text-[#D40000] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><List size={16} className="inline mr-1" /> Ver Historial</button>
                            <button onClick={() => setActiveTab('customers')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'customers' ? 'bg-white text-[#D40000] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Users size={16} className="inline mr-1" /> Clientes</button>
                        </>
                    )}
                </div>
            </header>

            {activeTab === 'new' ? (
                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden text-left">
                    <div className="flex border-b border-gray-100">
                        <div className={`flex-1 p-4 text-center border-r border-gray-100 ${step === 1 ? 'bg-red-50' : ''}`}><span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-black text-sm mb-1 ${step === 1 ? 'bg-[#D40000] text-white' : 'bg-gray-100 text-gray-400'}`}>1</span><p className={`text-[10px] font-black uppercase tracking-widest ${step === 1 ? 'text-[#D40000]' : 'text-gray-400'}`}>Origen</p></div>
                        <div className={`flex-1 p-4 text-center border-r border-gray-100 ${step === 2 ? 'bg-red-50' : ''}`}><span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-black text-sm mb-1 ${step === 2 ? 'bg-[#D40000] text-white' : 'bg-gray-100 text-gray-400'}`}>2</span><p className={`text-[10px] font-black uppercase tracking-widest ${step === 2 ? 'text-[#D40000]' : 'text-gray-400'}`}>Cliente</p></div>
                        <div className={`flex-1 p-4 text-center ${step === 3 ? 'bg-red-50' : ''}`}><span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-black text-sm mb-1 ${step === 3 ? 'bg-[#D40000] text-white' : 'bg-gray-100 text-gray-400'}`}>3</span><p className={`text-[10px] font-black uppercase tracking-widest ${step === 3 ? 'text-[#D40000]' : 'text-gray-400'}`}>Pago</p></div>
                    </div>

                    <div className="p-6 md:p-10 min-h-[400px]">
                        {step === 1 && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div>
                                    <h3 className="text-xl font-black text-gray-800 mb-2">Paso 1: Datos del Documento</h3>
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                        <p className="text-sm text-gray-500 font-medium">Define dónde se origina esta venta y el monto total.</p>
                                        <div className="flex bg-gray-100 p-1 rounded-xl shadow-sm border border-gray-200">
                                            <button
                                                onClick={() => setIncomeType('Venta')}
                                                className={`px-6 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${incomeType === 'Venta' ? 'bg-[#D40000] text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                                            >
                                                VENTA
                                            </button>
                                            <button
                                                onClick={() => setIncomeType('Devolucion')}
                                                className={`px-6 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${incomeType === 'Devolucion' ? 'bg-orange-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                                            >
                                                DEVOLUCIÓN
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Sucursal</label>
                                        <select
                                            value={branch}
                                            onChange={e => setBranch(e.target.value as any)}
                                            className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-bold transition-all outline-none text-gray-700"
                                        >
                                            <option value="Boleita">Boleita</option>
                                            <option value="Sabana Grande">Sabana Grande</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2"><label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Caja</label><select value={selectedCashRegister} onChange={e => setSelectedCashRegister(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-bold transition-all outline-none text-gray-700"><option value="">-- Seleccione una caja --</option>{cashRegistersByBranch[branch].map(cr => <option key={cr} value={cr}>{cr}</option>)}</select></div>
                                    <div className="space-y-2"><label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Tipo de Documento</label><select value={docType} onChange={e => setDocType(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-bold transition-all outline-none text-gray-700"><option value="Factura">Factura Fiscal</option><option value="Recibo">Recibo Manual</option><option value="Nota de Entrega">Nota de Entrega</option></select></div>
                                    <div className="space-y-2"><label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Nº de Documento</label><input type="text" value={docNumber} onChange={e => setDocNumber(e.target.value)} onBlur={checkDuplicate} placeholder="0001" className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-bold transition-all outline-none text-gray-700" /></div>
                                    
                                    {incomeType === 'Devolucion' && (
                                        <div className="md:col-span-2 flex justify-end">
                                            <button
                                                type="button"
                                                onClick={handleLoadOriginalSale}
                                                disabled={loadingOriginalSale}
                                                className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest px-6 py-3 rounded-xl transition-all shadow-md flex items-center gap-2"
                                            >
                                                {loadingOriginalSale ? (
                                                    <Loader2 className="animate-spin" size={16} />
                                                ) : (
                                                    <Search size={16} />
                                                )}
                                                Cargar Venta Original
                                            </button>
                                        </div>
                                    )}
                                </div>
                                
                                {/* POS Cart Section */}
                                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 space-y-4">
                                    <div className="flex items-center gap-2">
                                        <ShoppingCart className="text-[#D40000]" size={20} />
                                        <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest">Productos a Facturar</h4>
                                    </div>
                                    
                                    <div className="relative">
                                        <div className="flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden focus-within:border-[#D40000] focus-within:ring-2 focus-within:ring-[#D40000]/20 transition-all">
                                            <SearchIcon size={18} className="text-gray-400 ml-4" />
                                            <input 
                                                type="text" 
                                                value={productSearch}
                                                onChange={e => setProductSearch(e.target.value)}
                                                placeholder="Buscar por código de producto..." 
                                                className="w-full px-4 py-3 outline-none font-bold text-gray-700" 
                                            />
                                            {isSearchingProduct && <Loader2 size={16} className="animate-spin text-[#D40000] mr-4" />}
                                        </div>
                                        
                                        {/* Autocomplete */}
                                        {productResults.length > 0 && (
                                            <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden max-h-60 overflow-y-auto">
                                                {productResults.map(p => (
                                                    <div key={p.codigo_producto} className="flex flex-col md:flex-row md:items-center justify-between p-4 border-b border-gray-50 hover:bg-red-50/50 transition-colors gap-2">
                                                        <div>
                                                            <p className="font-black text-gray-800 uppercase">{p.codigo_producto}</p>
                                                            <p className="text-xs text-gray-600 font-medium truncate max-w-[200px] md:max-w-md">{p.descripcion || 'Sin descripción'}</p>
                                                            <p className="text-[10px] text-[#D40000] font-bold uppercase mt-0.5">Stock Boleita: {p.stock_boleita} | S.G: {p.stock_sabana_grande}</p>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1">CANT</span>
                                                                <input type="number" id={`qty-${p.codigo_producto}`} defaultValue="1" min="1" className="w-16 px-2 py-1.5 text-xs font-black text-center border border-gray-200 rounded-lg outline-none focus:border-[#D40000] bg-gray-50 text-gray-700" />
                                                            </div>
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1">PRECIO $</span>
                                                                <input type="number" id={`price-${p.codigo_producto}`} defaultValue={p.precio_referencia || 0} min="0" step="0.01" className="w-20 px-2 py-1.5 text-xs font-black text-center border border-gray-200 rounded-lg outline-none focus:border-[#D40000] bg-gray-50 text-green-600 font-bold" />
                                                            </div>
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-[9px] font-black text-transparent select-none mb-1">.</span>
                                                                <button 
                                                                    onClick={() => {
                                                                        const qty = Number((document.getElementById(`qty-${p.codigo_producto}`) as HTMLInputElement).value) || 1;
                                                                        const price = Number((document.getElementById(`price-${p.codigo_producto}`) as HTMLInputElement).value) || 0;
                                                                        if (price <= 0) return alert('Por favor ingresa el precio de venta');
                                                                        
                                                                        const productToAdd = { ...p, descripcion: p.descripcion || `Ref ${p.codigo_producto}` };
                                                                        addToCart(productToAdd, price, qty);
                                                                    }}
                                                                    className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-[#D40000] transition-colors"
                                                                >
                                                                    Agregar
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Cart Table */}
                                    {cart.length > 0 ? (
                                        <div className="overflow-hidden border border-gray-200 rounded-xl bg-white shadow-sm">
                                            <table className="w-full text-left">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Código</th>
                                                        <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Cant</th>
                                                        <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">P. Base</th>
                                                        <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Desc.</th>
                                                        <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">P. Final</th>
                                                        <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Total</th>
                                                        <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {cart.map((item, idx) => (
                                                        <tr key={item.id} className="hover:bg-gray-50/50">
                                                            <td className="px-4 py-3">
                                                                <p className="font-bold text-sm text-gray-800">{item.codigo_producto}</p>
                                                                <p className="text-[10px] text-gray-500 truncate max-w-[150px]">{item.descripcion}</p>
                                                            </td>
                                                            <td className="px-4 py-3 font-bold text-sm text-center">{item.cantidad}</td>
                                                            <td className="px-4 py-3 font-bold text-sm text-right text-gray-400">${item.precio_original_usd?.toFixed(2)}</td>
                                                            <td className="px-4 py-3 font-bold text-sm text-right text-red-500">
                                                                {item.descuento_usd > 0 ? `-$${item.descuento_usd.toFixed(2)}` : '-'}
                                                            </td>
                                                            <td className="px-4 py-3 font-bold text-sm text-right text-green-600">${item.precio_unitario_usd.toFixed(2)}</td>
                                                            <td className="px-4 py-3 font-black text-sm text-right text-gray-900">${item.total_linea_usd.toFixed(2)}</td>
                                                            <td className="px-4 py-3 text-center">
                                                                <button onClick={() => removeFromCart(item.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="text-center py-6 bg-white rounded-xl border border-gray-100 border-dashed">
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">El carrito está vacío</p>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-2"><label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Descuento Global $</label><input type="number" value={globalDiscount} onChange={e => { const val = e.target.value; setGlobalDiscount(val === '' ? '' : Number(val)); }} placeholder="0" min="0" className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-2xl font-black text-lg transition-all outline-none text-red-500" /></div>
                                    <div className="space-y-2"><label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Monto Total $</label><input type="number" readOnly value={totalAmount !== '' ? Number(totalAmount).toFixed(2) : ''} placeholder="0.00" className={`w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-2xl font-black text-2xl transition-all outline-none opacity-80 ${incomeType === 'Devolucion' ? 'text-orange-600' : 'text-[#D40000]'}`} /></div>
                                    <div className="space-y-2"><label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Monto en Bolívares (VEF)</label><input type="number" readOnly value={totalAmountBs !== '' ? Number(totalAmountBs).toFixed(2) : ''} placeholder="0.00" className="w-full px-4 py-3 bg-gray-100 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-2xl font-black text-xl text-gray-500 transition-all outline-none opacity-80" /></div>
                                    <div className="md:col-span-3 flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 self-start">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tasa Referencial:</span>
                                        <span className="text-sm font-black text-[#D40000]">1 USD = {Number(exchangeRate).toFixed(2)} Bs</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Condición de Pago</label>
                                        <select
                                            value={paymentCondition}
                                            onChange={e => setPaymentCondition(e.target.value as any)}
                                            className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-bold transition-all outline-none text-gray-700"
                                        >
                                            <option value="Contado">Contado</option>
                                            <option value="Inicial de Cashea">Inicial de Cashea</option>
                                            <option value="Credito">Crédito</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2"><label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Entrega</label><select value={deliveryMethod} onChange={e => { setDeliveryMethod(e.target.value); setSelectedCourier(''); setShippingAgency(''); }} className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-bold transition-all outline-none text-gray-700"><option value="Retira en Tienda">Retira en Tienda</option><option value="Servientrega">Delivery (Servientrega)</option><option value="Envío Nacional">Envío Nacional</option></select></div>
                                    {deliveryMethod === 'Servientrega' && (
                                        <div className="md:col-span-2 space-y-4 p-4 bg-red-50 border-2 border-red-100 rounded-2xl animate-in fade-in slide-in-from-left-2 duration-300">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="space-y-2">
                                                    <label className="block text-xs font-black text-[#D40000] uppercase tracking-widest">Municipio</label>
                                                    <select
                                                        value={deliveryMunicipio}
                                                        onChange={e => { setDeliveryMunicipio(e.target.value); setDeliveryZona(''); }}
                                                        className="w-full px-4 py-3 bg-white border-2 border-transparent focus:border-[#D40000] rounded-xl font-bold transition-all outline-none text-gray-700"
                                                    >
                                                        <option value="">-- Municipio --</option>
                                                        {Object.keys(deliveryZones).map(m => <option key={m} value={m}>{m}</option>)}
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="block text-xs font-black text-[#D40000] uppercase tracking-widest">Zona</label>
                                                    <select
                                                        value={deliveryZona}
                                                        onChange={e => setDeliveryZona(e.target.value)}
                                                        className="w-full px-4 py-3 bg-white border-2 border-transparent focus:border-[#D40000] rounded-xl font-bold transition-all outline-none text-gray-700"
                                                        disabled={!deliveryMunicipio}
                                                    >
                                                        <option value="">-- Zona / Urb --</option>
                                                        {deliveryMunicipio && deliveryZones[deliveryMunicipio]?.map(z => <option key={z} value={z}>{z}</option>)}
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="block text-xs font-black text-[#D40000] uppercase tracking-widest flex justify-between">
                                                        Motorizado Asignado
                                                        <button type="button" onClick={() => setIsCourierModalOpen(true)} className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-500 hover:bg-gray-200">+ Nuevo</button>
                                                    </label>
                                                    <select
                                                        value={selectedCourier}
                                                        onChange={e => setSelectedCourier(Number(e.target.value))}
                                                        className="w-full px-4 py-3 bg-white border-2 border-transparent focus:border-[#D40000] rounded-xl font-bold transition-all outline-none text-gray-700"
                                                        required
                                                    >
                                                        <option value="">-- Seleccione motorizado --</option>
                                                        {couriers.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="space-y-2">
                                                    <label className="block text-xs font-black text-[#D40000] uppercase tracking-widest">Ubicación (Link)</label>
                                                    <input
                                                        type="text"
                                                        value={deliveryLocationUrl}
                                                        onChange={e => setDeliveryLocationUrl(e.target.value)}
                                                        placeholder="https://maps.app.goo.gl/..."
                                                        className="w-full px-4 py-3 bg-white border-2 border-transparent focus:border-[#D40000] rounded-xl font-bold transition-all outline-none text-gray-700 text-sm"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="block text-xs font-black text-[#D40000] uppercase tracking-widest">Teléfono 2 (WhatsApp)</label>
                                                    <input
                                                        type="text"
                                                        value={deliverySecondPhone}
                                                        onChange={e => setDeliverySecondPhone(e.target.value)}
                                                        placeholder="0412-0000000"
                                                        className="w-full px-4 py-3 bg-white border-2 border-transparent focus:border-[#D40000] rounded-xl font-bold transition-all outline-none text-gray-700"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="block text-xs font-black text-[#D40000] uppercase tracking-widest">Observaciones / Labor a Realizar</label>
                                                <textarea
                                                    value={deliveryObservations}
                                                    onChange={e => setDeliveryObservations(e.target.value)}
                                                    placeholder="Detalle de la labor a realizar, instrucciones especiales..."
                                                    rows={3}
                                                    className="w-full px-4 py-3 bg-white border-2 border-transparent focus:border-[#D40000] rounded-xl font-bold transition-all outline-none text-gray-700 resize-none"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    {deliveryMethod === 'Envío Nacional' && (
                                        <div className="md:col-span-2 space-y-4 p-4 bg-orange-50 border-2 border-orange-100 rounded-2xl animate-in fade-in slide-in-from-left-2 duration-300">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="space-y-2">
                                                    <label className="block text-xs font-black text-orange-600 uppercase tracking-widest">Agencia</label>
                                                    <select
                                                        value={shippingAgency}
                                                        onChange={e => setShippingAgency(e.target.value)}
                                                        className="w-full px-4 py-3 bg-white border-2 border-transparent focus:border-[#D40000] rounded-xl font-bold transition-all outline-none text-gray-700"
                                                        required
                                                    >
                                                        <option value="">-- Agencia --</option>
                                                        {agencyOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="block text-xs font-black text-orange-600 uppercase tracking-widest">Estado</label>
                                                    <select
                                                        value={destinationState}
                                                        onChange={e => setDestinationState(e.target.value)}
                                                        className="w-full px-4 py-3 bg-white border-2 border-transparent focus:border-[#D40000] rounded-xl font-bold transition-all outline-none text-gray-700"
                                                        required
                                                    >
                                                        <option value="">-- Estado --</option>
                                                        {VENEZUELA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="block text-xs font-black text-orange-600 uppercase tracking-widest">Ciudad Destino</label>
                                                    <input 
                                                        type="text"
                                                        value={destinationCity}
                                                        onChange={e => setDestinationCity(e.target.value)}
                                                        placeholder="Ej: Valencia"
                                                        className="w-full px-4 py-3 bg-white border-2 border-transparent focus:border-[#D40000] rounded-xl font-bold transition-all outline-none text-gray-700 shadow-sm"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex pt-6"><button onClick={() => setStep(2)} disabled={cart.length === 0 || !docNumber || !selectedCashRegister || (deliveryMethod === 'Servientrega' && (!selectedCourier || !deliveryMunicipio || !deliveryZona)) || (deliveryMethod === 'Envío Nacional' && !shippingAgency)} className="ml-auto flex items-center gap-2 px-8 py-4 bg-gray-900 text-white rounded-2xl font-black shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all disabled:opacity-30 disabled:translate-y-0">Siguiente Paso <ArrowRightCircle size={20} /></button></div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div><h3 className="text-xl font-black text-gray-800 mb-2">Paso 2: Información del Cliente</h3><p className="text-sm text-gray-500 font-medium">Asocia la venta a un cliente para control de CxC y Cashea.</p></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2 relative space-y-4 bg-red-50/50 p-6 rounded-3xl border border-red-100">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">
                                                    Cédula / RIF (Nuevo o Existente) {isSearchingCustomer && <Loader2 size={12} className="inline animate-spin text-[#D40000] ml-2" />}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={customerId}
                                                    onChange={e => {
                                                        setCustomerId(e.target.value.toUpperCase());
                                                        setCustomerAutocompleteResults([]);
                                                        setCustomerDebts(null);
                                                    }}
                                                    placeholder="EJ: V-12345678"
                                                    className="w-full px-4 py-3 bg-white border-2 border-transparent focus:border-[#D40000] rounded-xl font-black text-gray-800 transition-all outline-none uppercase shadow-sm"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Nombre del Cliente</label>
                                                <input
                                                    type="text"
                                                    value={customerName}
                                                    onChange={e => {
                                                        setCustomerName(e.target.value);
                                                        setCustomerAutocompleteResults([]);
                                                        setCustomerDebts(null);
                                                    }}
                                                    placeholder="Juan Pérez"
                                                    className="w-full px-4 py-3 bg-white border-2 border-transparent focus:border-[#D40000] rounded-xl font-bold transition-all outline-none shadow-sm"
                                                />
                                            </div>
                                        </div>

                                        {/* Inline Autocomplete Menu */}
                                        {customerAutocompleteResults.length > 0 && (
                                            <div className="absolute top-20 left-0 w-full z-50 px-6">
                                                <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden max-h-64 overflow-y-auto w-full">
                                                    <div className="p-3 bg-gray-50 border-b text-xs font-black text-gray-400 uppercase tracking-widest flex items-center justify-between">
                                                        <span>Clientes Encontrados ({customerAutocompleteResults.length})</span>
                                                        <button onClick={() => setCustomerAutocompleteResults([])}><X size={14} /></button>
                                                    </div>
                                                    {customerAutocompleteResults.map(c => (
                                                        <button
                                                            key={c.id}
                                                            onClick={() => handleSelectCustomer(c)}
                                                            className="w-full p-4 text-left hover:bg-red-50 flex items-center justify-between transition-colors border-b last:border-0 group"
                                                        >
                                                            <div>
                                                                <p className="text-sm font-black text-gray-800 uppercase group-hover:text-[#D40000]">{c.name}</p>
                                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{c.id} • {c.phone || 'Sin WhatsApp'}</p>
                                                            </div>
                                                            <ArrowRightCircle size={18} className="text-gray-200 group-hover:text-[#D40000]" />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {customerId.length >= 7 && customerName.length > 2 && customerAutocompleteResults.length === 0 && !isSearchingCustomer && !customerDebts && (
                                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 bg-emerald-50 text-emerald-800 rounded-2xl border-2 border-emerald-100">
                                                <div className="flex items-center gap-3">
                                                    <span className="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center font-black shadow-sm">+</span>
                                                    <div className="text-xs">
                                                        <b className="uppercase tracking-widest text-[#D40000]">Cliente Nuevo Detectado</b>
                                                        <p className="opacity-80 font-medium">Registra este cliente antes de continuar.</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            await dbService.upsertCustomer({ id: customerId, name: customerName, phone: customerPhone, seller_id: selectedSeller || null });
                                                            alert(`¡El cliente ${customerName} ha sido registrado exitosamente!`);
                                                            const debts = await dbService.getCustomerDebts(customerId);
                                                            setCustomerDebts(debts);
                                                            if (!selectedSeller) {
                                                                const topSeller = await dbService.getTopSellerForCustomer(customerId);
                                                                if (topSeller) setSelectedSeller(topSeller);
                                                            }
                                                        } catch (e: any) {
                                                            alert('Error registrando cliente: ' + e.message);
                                                        }
                                                    }}
                                                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase cursor-pointer shadow-lg hover:-translate-y-0.5 transition-all w-full md:w-auto"
                                                >
                                                    Guardar Cliente Ahora
                                                </button>
                                            </div>
                                        )}

                                        {customerDebts && (customerDebts.pendingCxc > 0 || customerDebts.pendingCashea > 0) && (
                                            <div className="flex bg-orange-50 p-4 rounded-2xl border-2 border-orange-100 mt-2 gap-4 items-center animate-in slide-in-from-bottom-2">
                                                <div className="w-12 h-12 bg-orange-200 text-orange-700 rounded-xl flex items-center justify-center">
                                                    <Wallet size={24} />
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-orange-800 text-sm uppercase tracking-widest">Advertencia: Deudas Pendientes</h4>
                                                    <div className="flex gap-4 mt-1 text-xs font-bold text-orange-600">
                                                        {customerDebts.pendingCxc > 0 && <span>Créditos CxC: <b>${customerDebts.pendingCxc.toFixed(2)}</b></span>}
                                                        {customerDebts.pendingCashea > 0 && <span>Cashea: <b>${customerDebts.pendingCashea.toFixed(2)}</b></span>}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-2 pt-2">
                                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Teléfono (WhatsApp)</label>
                                            <input type="text" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="0412-1234567" className="w-full px-4 py-3 bg-white border-2 border-transparent focus:border-[#D40000] rounded-xl font-bold transition-all outline-none shadow-sm" />
                                        </div>
                                        <div className="space-y-2"><label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Vendedor</label><select value={selectedSeller} onChange={e => setSelectedSeller(Number(e.target.value))} className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-bold transition-all outline-none text-gray-700"><option value="">-- Escoger vendedor --</option>{sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                                    </div>
                                    {paymentCondition === 'Inicial de Cashea' && (<div className="space-y-2"><label className="block text-xs font-black text-red-600 uppercase tracking-widest">Número de Cuotas</label><input type="number" value={numInstallments} onChange={e => setNumInstallments(Number(e.target.value))} className="w-full px-4 py-3 bg-red-50 border-2 border-red-200 focus:border-[#D40000] focus:bg-white rounded-xl font-black text-center text-xl transition-all outline-none" /></div>)}
                                </div>
                                <div className="flex flex-col md:flex-row gap-4 pt-6"><button onClick={() => setStep(1)} className="px-8 py-4 border-2 border-gray-100 text-gray-500 rounded-2xl font-black hover:bg-gray-50 transition-all">Regresar</button><button onClick={() => setStep(3)} disabled={isCustomerMandatory && (!customerId || !customerName || !selectedSeller)} className="ml-auto flex items-center gap-2 px-8 py-4 bg-gray-900 text-white rounded-2xl font-black shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all disabled:opacity-30 disabled:translate-y-0">Siguiente Paso <ArrowRightCircle size={20} /></button></div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-6"><div className="space-y-1"><h3 className="text-xl font-black text-gray-800">Paso 3: Distribución del Pago</h3><p className="text-sm text-gray-500 font-medium">Registra los montos parciales hasta completar los <b>${Number(totalAmount).toFixed(2)}</b>.</p></div><div className="px-6 py-4 bg-gray-900 rounded-2xl text-center"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Restante por cobrar</p><p className={`text-2xl font-black ${remainingAmount === 0 ? 'text-green-400' : 'text-red-400'}`}>${remainingAmount.toFixed(2)}</p></div></div>
                                {paymentCondition === 'Credito' ? (
                                    <div className="p-10 bg-orange-50 border-2 border-dashed border-orange-200 rounded-3xl text-center space-y-4">
                                        <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-sm text-orange-500 mb-2"><CreditCard size={32} /></div><h4 className="text-xl font-black text-orange-800 uppercase italic">Venta a Crédito Pendiente</h4><p className="text-orange-600 font-medium max-w-sm mx-auto">Esta transacción se guardará como un saldo pendiente por cobrar para <b>{customerName}</b>.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {remainingAmount > 0 && (
                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-6 bg-gray-50 border-2 border-gray-100 rounded-3xl items-end">
                                                <div className="md:col-span-3 space-y-2"><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Medio de Pago</label><select value={newPayType} onChange={e => setNewPayType(e.target.value)} className="w-full px-4 py-2 bg-white border-2 border-transparent focus:border-[#D40000] rounded-xl font-bold text-sm transition-all outline-none">{paymentTypes.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                                                {requiresBank.includes(newPayType) && (
                                                    <div className="md:col-span-3 space-y-2">
                                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Banco / Cuenta</label>
                                                        <select value={newPayBank} onChange={e => setNewPayBank(Number(e.target.value))} className="w-full px-4 py-2 bg-white border-2 border-transparent focus:border-[#D40000] rounded-xl font-bold text-sm transition-all outline-none">
                                                            <option value="">-- Escoger --</option>
                                                            {bankAccounts
                                                                .filter(ba => (ba.payment_types || []).includes(newPayType) && ba.sucursal === branch)
                                                                .map(ba => (
                                                                    <option key={ba.id} value={ba.id}>{ba.banks?.name} - {ba.reference}</option>
                                                                ))
                                                            }
                                                        </select>
                                                    </div>
                                                )}
                                                <div className="md:col-span-2 space-y-2">
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Monto $</label>
                                                    <input
                                                        type="number" step="0.01"
                                                        value={newPayAmount}
                                                        onChange={e => {
                                                            const v = e.target.value;
                                                            setNewPayAmount(v === '' ? '' : Number(v));
                                                            if (v !== '' && exchangeRate) {
                                                                setAmountBs(Number((Number(v) * exchangeRate).toFixed(2)));
                                                            } else {
                                                                setAmountBs('');
                                                            }
                                                        }}
                                                        placeholder="0.00"
                                                        className="w-full px-4 py-2 bg-white border-2 border-transparent focus:border-[#D40000] rounded-xl font-black text-center text-sm transition-all outline-none"
                                                    />
                                                </div>
                                                <div className="md:col-span-2 space-y-2">
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Monto Bs</label>
                                                    <input
                                                        type="number" step="0.01"
                                                        value={amountBs}
                                                        onChange={e => {
                                                            const v = e.target.value;
                                                            setAmountBs(v === '' ? '' : Number(v));
                                                            if (v !== '' && exchangeRate) {
                                                                setNewPayAmount(Number((Number(v) / exchangeRate).toFixed(2)));
                                                            } else {
                                                                setNewPayAmount('');
                                                            }
                                                        }}
                                                        placeholder="0.00"
                                                        className="w-full px-4 py-2 bg-white border-2 border-transparent focus:border-[#D40000] rounded-xl font-black text-center text-sm transition-all outline-none"
                                                    />
                                                </div>
                                                <div className="md:col-span-2 pb-0.5">
                                                    <button onClick={addPayment} className="w-full py-2 bg-gray-900 text-white rounded-xl font-black text-xs uppercase shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all h-[42px]">Agregar Pago</button>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 self-start mb-6">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tasa Sugerida (DolarAPI):</span>
                                            <span className="text-sm font-black text-[#D40000]">1 USD = {Number(exchangeRate).toFixed(2)} Bs</span>
                                        </div>
                                        <div className="space-y-3">
                                            {payments.map(p => (
                                                <div key={p.id} className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-2xl shadow-sm ring-1 ring-black/5">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-500">{(p.type.includes('Efectivo') || p.type.includes('Zelle')) ? <Banknote size={20} /> : <Landmark size={20} />}</div>
                                                        <div><p className="text-sm font-black text-gray-800">{p.type}</p><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{p.bankAccountRef || 'Efectivo en Caja'}</p></div>
                                                    </div>
                                                    <div className="flex items-center gap-4"><p className="text-xl font-black text-gray-900">${p.amount.toFixed(2)}</p><button onClick={() => setPayments(payments.filter(x => x.id !== p.id))} className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><X size={16} /></button></div>
                                                </div>
                                            ))}
                                            {paymentCondition === 'Inicial de Cashea' && remainingAmount > 0 && (
                                                <div className="flex justify-between items-center p-6 border-4 border-dashed border-purple-100 bg-purple-50/50 rounded-3xl">
                                                    <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center"><ShieldCheck size={28} /></div><div><p className="text-lg font-black text-purple-900">Financiamiento CASHEA</p><p className="text-xs text-purple-600 font-bold uppercase tracking-widest">Saldo total pendiente</p></div></div>
                                                    <p className="text-3xl font-black text-purple-700">${remainingAmount.toFixed(2)}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <div className="flex flex-col md:flex-row gap-4 pt-4"><button onClick={() => setStep(2)} className="px-8 py-4 border-2 border-gray-100 text-gray-500 rounded-2xl font-black hover:bg-gray-50 transition-all">Regresar</button><button onClick={handleSaveIncome} disabled={!isFormValid || saving} className="ml-auto flex items-center gap-3 px-12 py-4 bg-[#D40000] text-white rounded-2xl font-black text-xl shadow-xl shadow-red-200 hover:shadow-2xl hover:-translate-y-1 transition-all disabled:opacity-30 disabled:translate-y-0">{saving ? <><Loader2 className="animate-spin" /> Procesando...</> : <><Save size={24} /> Finalizar Operación</>}</button></div>
                            </div>
                        )}
                    </div>
                </div>
            ) : activeTab === 'history' ? (
                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden text-left">
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50 space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter">
                                Historial de Ingresos
                            </h3>

                            <div className="text-sm font-bold text-gray-500">
                                Movimientos encontrados: <span className="text-[#D40000] font-black">{historyTotal}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                    Desde
                                </label>
                                <input
                                    type="date"
                                    value={historyStartDate}
                                    onChange={(e) => {
                                        setHistoryPage(1);
                                        setHistoryStartDate(e.target.value);
                                    }}
                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-red-100 focus:border-[#D40000]"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                    Hasta
                                </label>
                                <input
                                    type="date"
                                    value={historyEndDate}
                                    onChange={(e) => {
                                        setHistoryPage(1);
                                        setHistoryEndDate(e.target.value);
                                    }}
                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-red-100 focus:border-[#D40000]"
                                />
                            </div>

                            <div className="flex items-end">
                                <button
                                    onClick={() => {
                                        setHistoryPage(1);
                                        setHistoryStartDate('');
                                        setHistoryEndDate('');
                                    }}
                                    className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-black text-sm uppercase transition-all"
                                >
                                    Limpiar Filtros
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        {loadingHistory ? (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-4">
                                <Loader2 className="animate-spin text-[#D40000]" size={40} />
                                <p className="font-bold uppercase tracking-widest text-xs">
                                    Cargando historial...
                                </p>
                            </div>
                        ) : recentIncomes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-4">
                                <List size={40} className="text-gray-300" />
                                <p className="font-bold uppercase tracking-widest text-xs">
                                    No hay movimientos en el rango seleccionado
                                </p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white border-b border-gray-100">
                                        <th className="py-5 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha / Hora</th>
                                        <th className="py-5 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Documento</th>
                                        <th className="py-5 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Cliente</th>
                                        <th className="py-5 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Sucursal</th>
                                        <th className="py-5 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipo</th>
                                        <th className="py-5 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Condición</th>
                                        <th className="py-5 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Venta Total</th>
                                        <th className="py-5 px-6 text-[10px] font-black text-red-600 uppercase tracking-widest text-right">Ingreso Real</th>
                                        <th className="py-5 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {recentIncomes.map(inc => {
                                        const realInflow = (inc.income_payments || [])
                                            .filter((p: any) => p.payment_type !== 'Cashea' && p.payment_type !== 'Credito')
                                            .reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0);

                                        const isReturn = inc.type === 'Devolucion';

                                        return (
                                            <tr key={inc.id} className={`hover:bg-gray-50/80 transition-all group ${isReturn ? 'border-l-4 border-l-orange-500' : ''}`}>
                                                <td className="py-5 px-6">
                                                    <div className="text-sm font-black text-gray-700">{new Date(inc.created_at).toLocaleDateString()}</div>
                                                    <div className={`text-[10px] font-bold ${isReturn ? 'text-orange-600' : 'text-gray-400'}`}>
                                                        {isReturn ? 'DEVOLUCIÓN' : new Date(inc.created_at).toLocaleTimeString()}
                                                    </div>
                                                </td>
                                                <td className="py-5 px-6">
                                                    <div className="text-sm font-black text-gray-800">{inc.document_type}</div>
                                                    <div className="text-xs text-gray-500 font-mono">#{inc.document_number}</div>
                                                </td>
                                                <td className="py-5 px-6">
                                                    <div className="text-sm font-black text-gray-700 uppercase">{inc.customer_name || 'Sin nombre'}</div>
                                                    <div className="text-[10px] text-gray-400 font-mono tracking-tighter">{inc.customer_id}</div>
                                                </td>
                                                <td className="py-5 px-6 text-sm text-gray-600 font-medium">{inc.branch}</td>
                                                <td className="py-5 px-6">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight ${isReturn ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {inc.type || 'Venta'}
                                                    </span>
                                                </td>
                                                <td className="py-5 px-6">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight ${inc.payment_condition === 'Contado' ? 'bg-green-100 text-green-700' : inc.payment_condition === 'Inicial de Cashea' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                                                        {inc.payment_condition}
                                                    </span>
                                                </td>
                                                <td className="py-5 px-6 text-right">
                                                    <div className="text-lg font-black text-gray-400 opacity-60">${Number(inc.total_amount).toFixed(2)}</div>
                                                </td>
                                                <td className="py-5 px-6 text-right">
                                                    <div className="text-xl font-black text-[#D40000]">${realInflow.toFixed(2)}</div>
                                                </td>
                                                <td className="py-5 px-6 text-center">
                                                    {(userRole === 'director' || userRole === 'supervisor') && (
                                                        <div className="flex justify-center gap-2">
                                                            <button onClick={() => handleOpenEdit(inc)} className="p-2 bg-blue-50 text-blue-500 rounded-lg hover:bg-blue-100 border border-blue-100 transition-colors">
                                                                <Edit2 size={14} />
                                                            </button>
                                                            <button onClick={() => handleDeleteIncome(inc.id)} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 border border-red-100 transition-colors">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="text-sm font-bold text-gray-500">
                            Página <span className="text-[#D40000] font-black">{historyPage}</span> de <span className="text-gray-800 font-black">{totalHistoryPages}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setHistoryPage(prev => Math.max(1, prev - 1))}
                                disabled={historyPage === 1 || loadingHistory}
                                className="px-4 py-2 bg-white border border-gray-200 rounded-xl font-black text-sm text-gray-700 hover:bg-gray-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Anterior
                            </button>

                            <button
                                onClick={() => setHistoryPage(prev => Math.min(totalHistoryPages, prev + 1))}
                                disabled={historyPage >= totalHistoryPages || loadingHistory}
                                className="px-4 py-2 bg-white border border-gray-200 rounded-xl font-black text-sm text-gray-700 hover:bg-gray-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 text-left">
                    <div className="flex items-center gap-4 mb-8 border-b border-gray-100 pb-6">
                        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-[#D40000]"><Users size={32} /></div>
                        <div><h3 className="text-2xl font-black text-gray-800">Directorio de Clientes</h3><p className="text-gray-500 font-medium">Información detallada y saldos pendientes.</p></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {customerList.length === 0 ? (
                            <div className="col-span-full py-12 text-center text-gray-400">Busca un cliente en el formulario para cargar este directorio.</div>
                        ) : (
                            customerList.map(c => {
                                const total = c.incomes?.reduce((acc: number, inc: any) => acc + (Number(inc.total_amount) || 0), 0) || 0;
                                let pending = 0;
                                c.incomes?.forEach((inc: any) => {
                                    inc.cashea_installments?.forEach((i: any) => {
                                        if (i.status === 'pending') {
                                            pending += (Number(i.amount_usd) || 0);
                                        }
                                    });
                                });
                                return (
                                    <div key={c.id} className="p-6 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
                                        <div className="absolute top-0 right-0 w-24 h-24 bg-gray-50 rounded-bl-full -mr-12 -mt-12 group-hover:bg-red-50 transition-colors"></div>
                                        <div className="relative z-10">
                                            <div className="text-[10px] font-black text-gray-400 uppercase mb-1">{c.id}</div>
                                            <div className="text-xl font-black text-gray-800 uppercase mb-4">{c.name}</div>
                                            <div className="space-y-4">
                                                <div className="text-sm text-gray-600 font-medium flex items-center gap-2">📞 {c.phone || 'S/T'}</div>
                                                <div className="grid grid-cols-2 gap-3 pt-4 border-t">
                                                    <div><p className="text-[9px] font-bold text-gray-400 uppercase">Compras</p><p className="text-lg font-black">${total.toFixed(2)}</p></div>
                                                    <div><p className="text-[9px] font-bold text-purple-400 uppercase">Cashea</p><p className={`text-lg font-black ${pending > 0 ? 'text-purple-600' : 'text-gray-300'}`}>${pending.toFixed(2)}</p></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-left">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50"><h3 className="font-black text-lg text-gray-800">Modificar Ingreso</h3><button onClick={() => setIsEditModalOpen(false)}><X size={24} /></button></div>
                        <div className="p-6 space-y-4 grid grid-cols-2 gap-4">
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Sucursal</label><select value={branch} onChange={e => setBranch(e.target.value as any)} className="w-full px-3 py-2 border rounded-lg text-sm">{Object.keys(cashRegistersByBranch).map(b => <option key={b} value={b}>{b}</option>)}</select></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Caja</label><select value={selectedCashRegister} onChange={e => setSelectedCashRegister(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">{cashRegistersByBranch[branch].map(cr => <option key={cr} value={cr}>{cr}</option>)}</select></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Tipo Documento</label><select value={docType} onChange={e => setDocType(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="Factura">Factura Fiscal</option><option value="Recibo">Recibo Manual</option><option value="Nota de Entrega">Nota de Entrega</option></select></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Doc Nº</label><input value={docNumber} onChange={e => setDocNumber(e.target.value)} className="w-full px-3 py-2 border rounded-lg font-medium" /></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Vendedor</label><select value={selectedSeller} onChange={e => setSelectedSeller(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="">-- Escoger --</option>{sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Condición</label><select value={paymentCondition} onChange={e => setPaymentCondition(e.target.value as any)} className="w-full px-3 py-2 border rounded-lg font-bold"><option value="Contado">Contado</option><option value="Credito">Crédito</option><option value="Inicial de Cashea">Cashea</option></select></div>
                            <div className="col-span-2"><label className="text-xs font-bold text-gray-500 uppercase">Monto Total $</label><input type="number" step="0.01" value={totalAmount !== '' ? Number(totalAmount).toFixed(2) : ''} onChange={e => setTotalAmount(e.target.value === '' ? '' : Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg font-black text-2xl text-red-600 text-center" /></div>
                            {deliveryMethod === 'Envío Nacional' && (
                                <div className="col-span-2"><label className="text-xs font-bold text-gray-500 uppercase">Agencia de Envío</label><select value={shippingAgency} onChange={e => setShippingAgency(e.target.value)} className="w-full px-3 py-2 border rounded-lg font-bold text-red-600">{agencyOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
                            )}
                        </div>
                        <div className="p-6 bg-gray-50 border-t flex gap-3"><button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-3 bg-white border rounded-xl font-bold">Cancelar</button>
                            <button onClick={handleUpdateIncome} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black shadow-lg hover:bg-blue-700 transition-all">Guardar Cambios</button></div>
                    </div>
                </div>
            )}

            {/* Modal Directry removed as requested */}

            {duplicateInfo && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border-2 border-[#D40000]">
                        <div className="p-8 bg-[#D40000] text-center">
                            <div className="mx-auto w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-4 shadow-inner">
                                <X className="text-white" size={44} strokeWidth={3} />
                            </div>
                            <h2 className="text-white text-3xl font-black uppercase tracking-widest mb-1">¡DOCUMENTO</h2>
                            <h2 className="text-white text-3xl font-black uppercase tracking-widest">DUPLICADO!</h2>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="bg-red-50 rounded-2xl p-5 space-y-3 border border-red-100">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Documento</span>
                                    <span className="text-lg font-black text-gray-900">{duplicateInfo.document_number}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Tipo</span>
                                    <span className="font-bold text-gray-700">{duplicateInfo.document_type} · {duplicateInfo.type === 'Venta' ? 'Venta' : 'Devolución'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Sucursal</span>
                                    <span className="font-bold text-gray-700">{duplicateInfo.branch}</span>
                                </div>
                                <div className="border-t border-red-200 my-2"></div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Registrado por</span>
                                    <span className="font-bold text-[#D40000]">{duplicateInfo.created_by_email || 'Desconocido'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Cliente</span>
                                    <span className="font-bold text-gray-700">{duplicateInfo.customer_name || '—'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Monto</span>
                                    <span className="font-bold text-gray-700">${Number(duplicateInfo.total_amount).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Creado</span>
                                    <span className="font-bold text-gray-700">{new Date(duplicateInfo.created_at).toLocaleString('es-ES')}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setDuplicateInfo(null)}
                                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-sm shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all"
                            >
                                ENTENDIDO
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isCourierModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 bg-gray-50 border-b flex items-center justify-between">
                            <h3 className="font-black text-gray-800 uppercase tracking-widest text-sm">Nuevo Motorizado</h3>
                            <button onClick={() => setIsCourierModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Nombre Completo</label>
                                <input
                                    type="text"
                                    value={newCourierName}
                                    onChange={e => setNewCourierName(e.target.value)}
                                    placeholder="Ej: Pedro Perez"
                                    className="w-full px-4 py-2 bg-gray-50 border rounded-xl font-bold outline-none focus:ring-2 focus:ring-red-100"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Teléfono</label>
                                <input
                                    type="text"
                                    value={newCourierPhone}
                                    onChange={e => setNewCourierPhone(e.target.value)}
                                    placeholder="0412..."
                                    className="w-full px-4 py-2 bg-gray-50 border rounded-xl font-bold outline-none focus:ring-2 focus:ring-red-100"
                                />
                            </div>
                            <button
                                onClick={handleSaveCourier}
                                disabled={!newCourierName || savingCourier}
                                className="w-full py-3 bg-[#D40000] text-white rounded-xl font-black text-sm shadow-xl shadow-red-100 hover:shadow-2xl hover:-translate-y-0.5 transition-all disabled:opacity-50"
                            >
                                {savingCourier ? 'Guardando...' : 'Registrar Motorizado'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isSaturdayRateModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-6 bg-red-50 border-b border-red-100 text-center">
                            <div className="mx-auto w-16 h-16 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm">
                                <Banknote className="text-[#D40000]" size={32} />
                            </div>
                            <h3 className="font-black text-[#D40000] text-lg uppercase tracking-widest">Tasa del Día</h3>
                            <p className="text-xs text-red-600 font-bold mt-1">{new Date().getDay() === 6 ? 'Obligatorio establecer tasa para operar hoy Sábado.' : 'Hoy es lunes feriado bancario — ingresa la tasa manualmente.'}</p>
                        </div>
                        <div className="p-8 space-y-6 flex flex-col items-center">
                            <div className="w-full relative">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest text-center mb-2">Tasa de Cambio (VES por 1 USD)</label>
                                <input
                                    type="number" step="0.01" autoFocus
                                    value={saturdayManualRate}
                                    onChange={e => setSaturdayManualRate(e.target.value)}
                                    placeholder="Ej: 36.50"
                                    className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-[#D40000] rounded-2xl font-black text-center text-3xl transition-all outline-none text-gray-800"
                                />
                            </div>
                            <button
                                onClick={handleSaveSaturdayRate}
                                disabled={!saturdayManualRate || savingSaturdayRate || Number(saturdayManualRate) <= 0}
                                className="w-full py-4 bg-[#D40000] text-white rounded-xl font-black shadow-xl shadow-red-200 hover:shadow-2xl hover:-translate-y-1 transition-all disabled:opacity-50 disabled:translate-y-0"
                            >
                                {savingSaturdayRate ? 'Guardando...' : 'Establecer Tasa'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
