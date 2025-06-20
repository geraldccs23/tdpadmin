import React from 'react';
import { Copy, Check } from 'lucide-react';
import { DailyClosureData } from '../types';

interface MessageGeneratorProps {
  data: DailyClosureData;
  onCopy: () => void;
  isCopied: boolean;
}

export const MessageGenerator: React.FC<MessageGeneratorProps> = ({ data, onCopy, isCopied }) => {
  const calculateTotal = () => {
    return data.efectivo + data.zelle + data.pagoMovil + data.pdvBanesco + data.cashea;
  };

  const calculateDifference = () => {
    const calculated = calculateTotal();
    return data.totalDeclarado - calculated;
  };

  const formatExpenses = () => {
    if (data.gastos.length === 0) return 'Sin gastos registrados';
    
    return data.gastos
      .filter(gasto => gasto.monto > 0 && gasto.motivo && gasto.origen)
      .map(gasto => `Bs ${gasto.monto.toFixed(2)} para ${gasto.motivo} - pagado desde ${gasto.origen}`)
      .join('\n');
  };

  const generateMessage = () => {
    const difference = calculateDifference();
    const expenses = formatExpenses();
    
    let message = `📍 Cierre Diario – ${data.tienda || 'Sin datos'} ${data.fecha || 'Sin datos'}
Tasa BCV: ${data.tasaBcv || 'Sin datos'} Bs

Ventas Totales: ${calculateTotal().toFixed(2)} $

▫ Efectivo: ${data.efectivo.toFixed(2)} $
▫ Zelle: ${data.zelle.toFixed(2)} $ (Cuenta: ${data.cuentaZelle || 'Sin datos'})
▫ PM: ${data.pagoMovil.toFixed(2)} $ (Banco: ${data.bancoPm || 'Sin datos'})
▫ PDV Banesco: ${data.pdvBanesco.toFixed(2)} $ (Terminal: ${data.pdvBanescoId || 'Sin datos'})
▫ Cashea: ${data.cashea.toFixed(2)} $

✅ Total declarado: ${data.totalDeclarado.toFixed(2)} $

⭕ Observaciones:
${data.observaciones || 'Sin observaciones'}

⭕ Sobrantes:
${data.sobrantes || 'Sin sobrantes'}

✅ Efectivo caja chica: ${data.cajaChica.toFixed(2)} $
✅ Efectivo guardado: ${data.efectivoGuardado.toFixed(2)} $

🧾 Gastos registrados hoy:
${expenses}`;

    if (Math.abs(difference) > 0.01) {
      message += `\n\n⚠️ DIFERENCIA DETECTADA: ${difference > 0 ? '+' : ''}${difference.toFixed(2)} $ entre total declarado y calculado.`;
    }

    return message;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Mensaje Generado</h3>
        <button
          onClick={onCopy}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
            isCopied 
              ? 'bg-green-600 text-white' 
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span>{isCopied ? 'Copiado' : 'Copiar'}</span>
        </button>
      </div>
      
      <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm whitespace-pre-line max-h-96 overflow-y-auto">
        {generateMessage()}
      </div>

      {Math.abs(calculateDifference()) > 0.01 && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <span className="font-medium text-yellow-800">
              Diferencia detectada: {calculateDifference() > 0 ? '+' : ''}{calculateDifference().toFixed(2)} $ 
              entre total declarado ({data.totalDeclarado.toFixed(2)} $) y calculado ({calculateTotal().toFixed(2)} $)
            </span>
          </div>
        </div>
      )}
    </div>
  );
};