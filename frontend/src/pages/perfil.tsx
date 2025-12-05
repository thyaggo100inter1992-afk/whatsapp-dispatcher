import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FaUser, FaEnvelope, FaLock, FaCamera, FaSave, FaArrowLeft, FaHome, FaSignOutAlt, FaUserCircle, FaTrash, FaCheckCircle, FaExclamationTriangle, FaPhone, FaIdCard, FaBuilding } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import SystemLogo from '../components/SystemLogo';
import { buildFileUrl, getApiBaseUrl } from '@/utils/urlHelpers';

export default function ProfilePage() {
  const router = useRouter();
  const { user, signOut, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Dados do perfil
  const [profileData, setProfileData] = useState({
    nome: '',
    email: '',
    telefone: '',
    documento: ''
  });

  // Dados do Tenant
  const [tenantData, setTenantData] = useState({
    nome: '',
    email: '',
    telefone: '',
    documento: ''
  });

  // Alteração de senha
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Avatar
  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const API_URL = `${getApiBaseUrl()}/api`;

  // Redirecionar admins para a página de gestão
  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'super_admin')) {
      router.push('/gestao');
      return;
    }
  }, [user, router]);

  // Carregar dados do perfil
  useEffect(() => {
    if (user && user.role === 'user') {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const response = await axios.get(`${API_URL}/users/profile`);
      
      if (response.data.success) {
        const { user: userData, tenant: tenantInfo } = response.data.data;
        
        setProfileData({
          nome: userData.nome || '',
          email: userData.email || '',
          telefone: userData.telefone || '',
          documento: userData.documento || ''
        });

        if (tenantInfo) {
          setTenantData({
            nome: tenantInfo.nome || '',
            email: tenantInfo.email || '',
            telefone: tenantInfo.telefone || '',
            documento: tenantInfo.documento || ''
          });
        }

        if (userData.avatar) {
          setAvatar(userData.avatar);
          setAvatarPreview(
            buildFileUrl(
              userData.avatar.startsWith('/uploads')
                ? userData.avatar
                : `/uploads/avatars/${userData.avatar}`
            )
          );
        }
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    }
  };

  // Atualizar perfil (apenas nome e telefone - email e CPF são readonly)
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await axios.put(`${API_URL}/users/profile`, {
        nome: profileData.nome,
        telefone: profileData.telefone
      });

      if (response.data.success) {
        setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
        
        if (updateUser) {
          updateUser(response.data.data);
        }

        const storedUser = localStorage.getItem('@WhatsAppDispatcher:user');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          localStorage.setItem('@WhatsAppDispatcher:user', JSON.stringify({
            ...userData,
            ...response.data.data
          }));
        }
      }
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Erro ao atualizar perfil' 
      });
    } finally {
      setLoading(false);
    }
  };

  // Atualizar dados do tenant (apenas nome e telefone - email e CNPJ são readonly)
  const handleUpdateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await axios.put(`${API_URL}/users/profile/tenant`, {
        nome: tenantData.nome,
        telefone: tenantData.telefone
      });

      if (response.data.success) {
        setMessage({ type: 'success', text: 'Dados da empresa atualizados com sucesso!' });
      }
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Erro ao atualizar dados da empresa' 
      });
    } finally {
      setLoading(false);
    }
  };

  // Alterar senha
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'As senhas não coincidem' });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'A senha deve ter no mínimo 6 caracteres' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await axios.post(`${API_URL}/users/profile/change-password`, passwordData);

      if (response.data.success) {
        setMessage({ type: 'success', text: 'Senha alterada com sucesso!' });
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      }
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Erro ao alterar senha' 
      });
    } finally {
      setLoading(false);
    }
  };

  // Upload de avatar
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'A imagem deve ter no máximo 5MB' });
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setMessage({ type: 'error', text: 'Formato inválido. Use: JPG, PNG, GIF ou WEBP' });
      return;
    }

    setUploadingAvatar(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const response = await axios.post(`${API_URL}/users/profile/avatar`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setMessage({ type: 'success', text: 'Foto atualizada com sucesso!' });
        setAvatar(response.data.data.avatar);
        setAvatarPreview(buildFileUrl(response.data.data.avatarUrl || response.data.data.avatar));

        const storedUser = localStorage.getItem('@WhatsAppDispatcher:user');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          localStorage.setItem('@WhatsAppDispatcher:user', JSON.stringify({
            ...userData,
            avatar: response.data.data.avatar
          }));
        }
      }
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Erro ao fazer upload da foto' 
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Remover avatar
  const handleRemoveAvatar = async () => {
    if (!confirm('Deseja realmente remover sua foto de perfil?')) return;

    setUploadingAvatar(true);
    setMessage(null);

    try {
      const response = await axios.delete(`${API_URL}/users/profile/avatar`);

      if (response.data.success) {
        setMessage({ type: 'success', text: 'Foto removida com sucesso!' });
        setAvatar(null);
        setAvatarPreview(null);

        const storedUser = localStorage.getItem('@WhatsAppDispatcher:user');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          localStorage.setItem('@WhatsAppDispatcher:user', JSON.stringify({
            ...userData,
            avatar: null
          }));
        }
      }
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Erro ao remover foto' 
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <>
      <Head>
        <title>Meu Perfil | Disparador NettSistemas</title>
      </Head>
      
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
        {/* Header Único do Perfil */}
        <header className="bg-gradient-to-r from-dark-900 to-dark-800 border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Logo do Sistema */}
          <div className="mb-6 flex justify-center">
            <SystemLogo size="medium" />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-blue-500 p-4 rounded-2xl">
                <FaUserCircle className="text-white text-3xl" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-white">Meu Perfil</h1>
                <p className="text-base text-gray-400">Editar informações pessoais e da empresa</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold transition-all flex items-center gap-2"
              >
                <FaArrowLeft /> Voltar
              </button>
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold transition-all flex items-center gap-2"
              >
                <FaHome /> Início
              </button>

              {/* Separador */}
              <div className="w-px h-8 bg-white/20"></div>

              {/* Logout */}
              <button
                onClick={() => {
                  signOut();
                  router.push('/login');
                }}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-all flex items-center gap-2 shadow-lg hover:shadow-xl"
                title="Sair do sistema"
              >
                <FaSignOutAlt /> Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Mensagem de feedback */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl border-2 flex items-center gap-3 ${
            message.type === 'success' 
              ? 'bg-green-500/20 border-green-500/40 text-green-300' 
              : 'bg-red-500/20 border-red-500/40 text-red-300'
          }`}>
            {message.type === 'success' ? <FaCheckCircle className="text-2xl" /> : <FaExclamationTriangle className="text-2xl" />}
            <p className="font-bold">{message.text}</p>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Seção de Avatar */}
          <div className="lg:col-span-1">
            <div className="bg-dark-800/50 backdrop-blur-xl border-2 border-white/10 rounded-3xl p-8 shadow-2xl">
              <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-2">
                <FaCamera className="text-blue-400" /> Foto de Perfil
              </h2>

              <div className="flex flex-col items-center">
                {/* Avatar Preview */}
                <div className="relative mb-6">
                  {avatarPreview ? (
                    <img 
                      src={avatarPreview} 
                      alt="Avatar" 
                      className="w-40 h-40 rounded-full object-cover border-4 border-blue-500 shadow-xl"
                    />
                  ) : (
                    <div className="w-40 h-40 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center border-4 border-blue-500 shadow-xl">
                      <FaUserCircle className="text-white text-8xl" />
                    </div>
                  )}
                  
                  {uploadingAvatar && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-white"></div>
                    </div>
                  )}
                </div>

                {/* Botões de Avatar */}
                <div className="w-full space-y-3">
                  <label className="block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                      disabled={uploadingAvatar}
                    />
                    <div className="px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer">
                      <FaCamera /> {avatar ? 'Alterar Foto' : 'Enviar Foto'}
                    </div>
                  </label>

                  {avatar && (
                    <button
                      onClick={handleRemoveAvatar}
                      disabled={uploadingAvatar}
                      className="w-full px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                    >
                      <FaTrash /> Remover Foto
                    </button>
                  )}
                </div>

                <p className="text-gray-400 text-sm mt-4 text-center">
                  Formatos: JPG, PNG, GIF, WEBP<br />
                  Tamanho máximo: 5MB
                </p>
              </div>
            </div>
          </div>

          {/* Seções de Dados Pessoais, Empresa e Senha */}
          <div className="lg:col-span-2 space-y-8">
            {/* Dados Pessoais */}
            <div className="bg-dark-800/50 backdrop-blur-xl border-2 border-white/10 rounded-3xl p-8 shadow-2xl">
              <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-2">
                <FaUser className="text-emerald-400" /> Dados Pessoais
              </h2>

              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white font-bold mb-2">
                      <FaUser className="inline mr-2" /> Nome Completo
                    </label>
                    <input
                      type="text"
                      value={profileData.nome}
                      onChange={(e) => setProfileData({ ...profileData, nome: e.target.value })}
                      className="w-full px-4 py-3 bg-dark-900/50 border-2 border-white/10 rounded-xl text-white focus:border-emerald-500 focus:outline-none transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-white font-bold mb-2">
                      <FaEnvelope className="inline mr-2" /> Email
                    </label>
                    <input
                      type="email"
                      value={profileData.email}
                      readOnly
                      className="w-full px-4 py-3 bg-dark-700/70 border-2 border-white/5 rounded-xl text-gray-400 cursor-not-allowed"
                      title="O email não pode ser alterado pois é usado como identificador"
                    />
                    <p className="text-xs text-gray-500 mt-1">* O email não pode ser alterado</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white font-bold mb-2">
                      <FaPhone className="inline mr-2" /> Telefone
                    </label>
                    <input
                      type="tel"
                      value={profileData.telefone}
                      onChange={(e) => setProfileData({ ...profileData, telefone: e.target.value })}
                      className="w-full px-4 py-3 bg-dark-900/50 border-2 border-white/10 rounded-xl text-white focus:border-emerald-500 focus:outline-none transition-all"
                      placeholder="(11) 99999-9999"
                    />
                  </div>

                  <div>
                    <label className="block text-white font-bold mb-2">
                      <FaIdCard className="inline mr-2" /> CPF
                    </label>
                    <input
                      type="text"
                      value={profileData.documento || 'Não informado'}
                      readOnly
                      className="w-full px-4 py-3 bg-dark-700/70 border-2 border-white/5 rounded-xl text-gray-400 cursor-not-allowed"
                      title="O CPF não pode ser alterado pois é usado como identificador"
                    />
                    <p className="text-xs text-gray-500 mt-1">* O CPF não pode ser alterado</p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-6 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Salvando...
                    </>
                  ) : (
                    <>
                      <FaSave /> Salvar Alterações
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Dados da Empresa - APENAS PARA ADMINS */}
            {user?.role === 'admin' && (
              <div className="bg-dark-800/50 backdrop-blur-xl border-2 border-white/10 rounded-3xl p-8 shadow-2xl">
                <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-2">
                  <FaBuilding className="text-purple-400" /> Dados da Empresa
                </h2>

              <form onSubmit={handleUpdateTenant} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white font-bold mb-2">
                      <FaBuilding className="inline mr-2" /> Nome da Empresa
                    </label>
                    <input
                      type="text"
                      value={tenantData.nome}
                      onChange={(e) => setTenantData({ ...tenantData, nome: e.target.value })}
                      className="w-full px-4 py-3 bg-dark-900/50 border-2 border-white/10 rounded-xl text-white focus:border-purple-500 focus:outline-none transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-white font-bold mb-2">
                      <FaEnvelope className="inline mr-2" /> Email da Empresa
                    </label>
                    <input
                      type="email"
                      value={tenantData.email}
                      readOnly
                      className="w-full px-4 py-3 bg-dark-700/70 border-2 border-white/5 rounded-xl text-gray-400 cursor-not-allowed"
                      title="O email da empresa não pode ser alterado pois é usado como identificador"
                    />
                    <p className="text-xs text-gray-500 mt-1">* O email não pode ser alterado</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white font-bold mb-2">
                      <FaPhone className="inline mr-2" /> Telefone
                    </label>
                    <input
                      type="tel"
                      value={tenantData.telefone}
                      onChange={(e) => setTenantData({ ...tenantData, telefone: e.target.value })}
                      className="w-full px-4 py-3 bg-dark-900/50 border-2 border-white/10 rounded-xl text-white focus:border-purple-500 focus:outline-none transition-all"
                      placeholder="(11) 99999-9999"
                    />
                  </div>

                  <div>
                    <label className="block text-white font-bold mb-2">
                      <FaIdCard className="inline mr-2" /> CNPJ
                    </label>
                    <input
                      type="text"
                      value={tenantData.documento || 'Não informado'}
                      readOnly
                      className="w-full px-4 py-3 bg-dark-700/70 border-2 border-white/5 rounded-xl text-gray-400 cursor-not-allowed"
                      title="O CNPJ não pode ser alterado pois é usado como identificador"
                    />
                    <p className="text-xs text-gray-500 mt-1">* O CNPJ não pode ser alterado</p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-6 py-4 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Salvando...
                    </>
                  ) : (
                    <>
                      <FaSave /> Salvar Dados da Empresa
                    </>
                  )}
                </button>
              </form>
            </div>
            )}

            {/* Alteração de Senha */}
            <div className="bg-dark-800/50 backdrop-blur-xl border-2 border-white/10 rounded-3xl p-8 shadow-2xl">
              <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-2">
                <FaLock className="text-orange-400" /> Alterar Senha
              </h2>

              <form onSubmit={handleChangePassword} className="space-y-6">
                <div>
                  <label className="block text-white font-bold mb-2">
                    <FaLock className="inline mr-2" /> Senha Atual
                  </label>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-900/50 border-2 border-white/10 rounded-xl text-white focus:border-orange-500 focus:outline-none transition-all"
                    required
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white font-bold mb-2">
                      <FaLock className="inline mr-2" /> Nova Senha
                    </label>
                    <input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      className="w-full px-4 py-3 bg-dark-900/50 border-2 border-white/10 rounded-xl text-white focus:border-orange-500 focus:outline-none transition-all"
                      required
                      minLength={6}
                    />
                  </div>

                  <div>
                    <label className="block text-white font-bold mb-2">
                      <FaLock className="inline mr-2" /> Confirmar Nova Senha
                    </label>
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      className="w-full px-4 py-3 bg-dark-900/50 border-2 border-white/10 rounded-xl text-white focus:border-orange-500 focus:outline-none transition-all"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-6 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Alterando...
                    </>
                  ) : (
                    <>
                      <FaLock /> Alterar Senha
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
      </div>
    </>
  );
}
