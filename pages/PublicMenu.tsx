import React from 'react';
import { Globe } from 'lucide-react';

export function PublicMenu() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Menú Digital Público</h2>
          <p className="text-sm text-gray-500 mt-1">Vista previa del menú público</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
        <Globe className="mx-auto text-gray-300 mb-4" size={56} />
        <p className="text-gray-500 font-medium text-lg">Menú Público</p>
        <p className="text-gray-400 text-sm mt-1">Módulo en construcción</p>
      </div>
    </div>
  );
}
