import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  FaKey, FaUser, FaBuilding, FaCheck, FaTimes, FaClock, FaShieldAlt,
  FaLock, FaSync, FaToggleOn, FaToggleOff, FaPlus, FaEye, FaEyeSlash, FaInfoCircle
} from 'react-icons/fa';
import api from '@/services/api';
import { useNotification } from '@/hooks/useNotification';
import AdminLayout from '@/components/admin/AdminLayout';

interface MasterUser {
  id: number;
  tenant_id: number;
  nome: string;
  email: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  ultimo_login: string | null;
  total_logins: number;
  tenant_nome: string;
  tenant_slug: string;
  tenant_email: string;
  plano: string;
  tenant_status: string;
}

export default function MasterUsers() {
  const router = useRouter();
  const notification = useNotification();
  const [masterUsers, setMasterUsers] = useState<MasterUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<MasterUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadMasterUsers();
  }, []);

  const loadMasterUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/master-users');
      setMasterUsers(response.data.data || []);
      console.log('✅ Usuários master carregados:', response.data.data?.length);
    } catch (error: any) {
      console.error('❌ Erro ao carregar usuários master:', error);
      notification.error('Erro ao carregar usuários master', error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMissing = async () => {
    if (!confirm('Deseja criar usuários master para todos os tenants que ainda não possuem?')) {
      return;
    }

    try {
      setProcessing(true);
      const response = await api.post('/admin/master-users/create-missing');
      notification.success('Sucesso', response.data.message || 'Usuários master criados com sucesso!');
      await loadMasterUsers();
    } catch (error: any) {
      console.error('❌ Erro ao criar usuários master:', error);
      notification.error('Erro ao criar usuários master', error.response?.data?.message || error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleToggleActive = async (user: MasterUser) => {
    const action = user.ativo ? 'desativar' : 'ativar';
    if (!confirm(`Deseja ${action} o usuário master ${user.email}?`)) {
      return;
    }

    try {
      const response = await api.put(`/admin/master-users/${user.id}/toggle-active`);
      notification.success('Sucesso', response.data.message);
      await loadMasterUsers();
    } catch (error: any) {
      console.error('❌ Erro ao alterar status:', error);
      notification.error('Erro ao alterar status', error.response?.data?.message || error.message);
    }
  };

  const handleOpenChangePassword = (user: MasterUser) => {
    setSelectedUser(user);
    setNewPassword('');
    setShowPassword(false);
    setShowChangePasswordModal(true);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || newPassword.length < 6) {
      notification.error('Senha inválida', 'A senha deve ter no mínimo 6 caracteres');
      return;
    }

    if (!selectedUser) return;

    try {
      setProcessing(true);
      const response = await api.put(`/admin/master-users/${selectedUser.id}/change-password`, {
        newPassword
      });
      notification.success('Sucesso', response.data.message);
      setShowChangePasswordModal(false);
      setSelectedUser(null);
      setNewPassword('');
    } catch (error: any) {
      console.error('❌ Erro ao alterar senha:', error);
      notification.error('Erro ao alterar senha', error.response?.data?.message || error.message);
    } finally {
      setProcessing(false);
    }
  };

  const filteredUsers = masterUsers.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.tenant_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.tenant_id.toString().includes(searchTerm)
  );

  const getStatusBadge = (user: MasterUser) => {
    if (!user.ativo) {
      return <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/40">Desativado</span>;
    }
    if (user.ultimo_login) {
      return <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-300 border border-green-500/40">Ativo</span>;
    }
    return <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">Nunca usado</span>;
  };

  return (
    <>
      <notification.NotificationContainer />
      <AdminLayout>
        <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600/30 via-pink-500/20 to-purple-600/30 backdrop-blur-xl border-2 border-purple-500/40 rounded-3xl p-8 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-purple-500 to-pink-600 p-4 rounded-2xl shadow-lg">
                  <FaShieldAlt className="text-4xl text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-black text-white mb-1">Usuários Master</h1>
                  <p className="text-white/80 text-lg">Gerenciamento de acesso master aos tenants</p>
                </div>
              </div>
              <button
                onClick={handleCreateMissing}
                disabled={processing}
                className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaPlus />
                Criar Faltantes
              </button>
            </div>
          </div>

          {/* Informação sobre Credenciais */}
          <div className="bg-gradient-to-r from-blue-600/20 via-indigo-600/20 to-purple-600/20 border-2 border-blue-500/40 rounded-2xl p-6 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="bg-blue-500/20 p-3 rounded-xl">
                <FaInfoCircle className="text-3xl text-blue-300" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-black text-white mb-3 flex items-center gap-2">
                  🔐 Como são criados os Usuários Master
                </h3>
                <div className="space-y-2 text-white/90">
                  <p className="text-base">
                    <strong>Criação Automática:</strong> Todo tenant criado recebe automaticamente um usuário master.
                  </p>
                  <div className="bg-dark-800/50 rounded-lg p-4 border border-blue-500/30 space-y-2">
                    <p className="font-bold text-blue-300">📧 Formato do Login:</p>
                    <code className="block bg-dark-900 px-3 py-2 rounded text-green-400 font-mono">
                      {'{'}ID_DO_TENANT{'}'}@NETTSISTEMAS.COM.BR
                    </code>
                    <p className="text-sm text-white/70">
                      Exemplo: Tenant 4 → <span className="text-yellow-300 font-mono">4@NETTSISTEMAS.COM.BR</span>
                    </p>
                  </div>
                  <div className="bg-dark-800/50 rounded-lg p-4 border border-purple-500/30 space-y-2">
                    <p className="font-bold text-purple-300">🔑 Senha Padrão:</p>
                    <code className="block bg-dark-900 px-3 py-2 rounded text-pink-400 font-mono">
                      master123@nettsistemas
                    </code>
                    <p className="text-sm text-white/70">
                      ℹ️ A mesma senha é usada para todos os usuários master criados automaticamente
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-3 text-yellow-300">
                    <FaKey className="text-lg" />
                    <p className="text-sm">
                      <strong>Dica:</strong> Você pode alterar a senha individualmente clicando em "Alterar Senha"
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-2 border-blue-500/40 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <FaUser className="text-2xl text-blue-400" />
                <h3 className="text-sm font-bold text-white/70">Total de Usuários</h3>
              </div>
              <p className="text-3xl font-black text-white">{masterUsers.length}</p>
            </div>

            <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-2 border-green-500/40 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <FaCheck className="text-2xl text-green-400" />
                <h3 className="text-sm font-bold text-white/70">Ativos</h3>
              </div>
              <p className="text-3xl font-black text-white">
                {masterUsers.filter(u => u.ativo).length}
              </p>
            </div>

            <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border-2 border-yellow-500/40 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <FaClock className="text-2xl text-yellow-400" />
                <h3 className="text-sm font-bold text-white/70">Nunca Acessados</h3>
              </div>
              <p className="text-3xl font-black text-white">
                {masterUsers.filter(u => !u.ultimo_login).length}
              </p>
            </div>

            <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 border-2 border-red-500/40 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <FaTimes className="text-2xl text-red-400" />
                <h3 className="text-sm font-bold text-white/70">Inativos</h3>
              </div>
              <p className="text-3xl font-black text-white">
                {masterUsers.filter(u => !u.ativo).length}
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="bg-white/5 backdrop-blur-xl border-2 border-white/20 rounded-2xl p-6">
            <input
              type="text"
              placeholder="🔍 Buscar por email, tenant ou ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-dark-800 border-2 border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:border-purple-500 focus:outline-none"
            />
          </div>

          {/* Lista de Usuários */}
          <div className="bg-white/5 backdrop-blur-xl border-2 border-white/20 rounded-2xl p-6">
            {loading ? (
              <div className="text-center py-12">
                <FaSync className="animate-spin text-4xl text-purple-500 mx-auto mb-4" />
                <p className="text-white/70">Carregando usuários master...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12">
                <FaUser className="text-6xl text-white/20 mx-auto mb-4" />
                <p className="text-white/70 text-lg">Nenhum usuário master encontrado</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-6 hover:border-purple-500/50 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-3">
                        {/* Email e Status */}
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                            user.ativo ? 'bg-gradient-to-br from-purple-500 to-pink-600' : 'bg-gray-500'
                          }`}>
                            <FaKey className="text-white text-xl" />
                          </div>
                          <div>
                            <h3 className="text-xl font-black text-white">{user.email}</h3>
                            <p className="text-sm text-gray-400">{user.nome}</p>
                          </div>
                          {getStatusBadge(user)}
                        </div>

                        {/* Info do Tenant */}
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <FaBuilding className="text-blue-400" />
                            <span className="text-white/80">
                              <span className="font-bold">ID {user.tenant_id}:</span> {user.tenant_nome}
                            </span>
                          </div>
                          <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-300 text-xs font-bold">
                            {user.plano}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            user.tenant_status === 'active' 
                              ? 'bg-green-500/20 text-green-300'
                              : 'bg-red-500/20 text-red-300'
                          }`}>
                            {user.tenant_status}
                          </span>
                        </div>

                        {/* Estatísticas */}
                        <div className="flex items-center gap-6 text-sm text-white/60">
                          <div className="flex items-center gap-2">
                            <FaClock className="text-purple-400" />
                            Criado: {new Date(user.created_at).toLocaleDateString('pt-BR')}
                          </div>
                          {user.ultimo_login && (
                            <div className="flex items-center gap-2">
                              <FaCheck className="text-green-400" />
                              Último login: {new Date(user.ultimo_login).toLocaleDateString('pt-BR')}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <FaUser className="text-blue-400" />
                            {user.total_logins || 0} login(s)
                          </div>
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleOpenChangePassword(user)}
                          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold transition-all"
                        >
                          <FaLock />
                          Alterar Senha
                        </button>
                        <button
                          onClick={() => handleToggleActive(user)}
                          className={`flex items-center gap-2 ${
                            user.ativo 
                              ? 'bg-red-600 hover:bg-red-500' 
                              : 'bg-green-600 hover:bg-green-500'
                          } text-white px-4 py-2 rounded-lg font-bold transition-all`}
                        >
                          {user.ativo ? <FaToggleOff /> : <FaToggleOn />}
                          {user.ativo ? 'Desativar' : 'Ativar'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Alterar Senha */}
        {showChangePasswordModal && selectedUser && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-dark-800 to-dark-900 border-2 border-purple-500/40 rounded-3xl p-8 max-w-md w-full shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-gradient-to-br from-purple-500 to-pink-600 p-3 rounded-xl">
                  <FaLock className="text-2xl text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white">Alterar Senha</h3>
                  <p className="text-sm text-white/60">{selectedUser.email}</p>
                </div>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-white/80 mb-2">
                    Nova Senha (mínimo 6 caracteres)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-dark-700 border-2 border-white/20 rounded-xl px-4 py-3 pr-12 text-white focus:border-purple-500 focus:outline-none"
                      placeholder="Digite a nova senha"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                    >
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={processing}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50"
                  >
                    {processing ? 'Alterando...' : 'Confirmar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowChangePasswordModal(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
      </AdminLayout>
    </>
  );
}

