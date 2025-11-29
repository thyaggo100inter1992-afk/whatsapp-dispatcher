import { useState, useEffect } from 'react';
import { FaCog } from 'react-icons/fa';
import AdminLayout from '@/components/admin/AdminLayout';
import api from '@/services/api';

export default function AdminCredentials() {
  return (
    <AdminLayout
      title="Gerenciamento de Credenciais"
      subtitle="Gerencie credenciais UAZAP e Nova Vida"
      icon={<FaCog className="text-3xl text-white" />}
      currentPage="credentials"
    >
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl border-2 border-purple-500/30">
        <h2 className="text-2xl font-bold text-white mb-4">🚧 Página em Manutenção</h2>
        <p className="text-gray-300">
          Esta página está sendo reconfigurada. Por favor, aguarde.
        </p>
      </div>
    </AdminLayout>
  );
}

