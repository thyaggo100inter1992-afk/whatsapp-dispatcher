import { useState, useEffect } from 'react';
import { FaUser, FaEnvelope, FaLock, FaSave, FaUserCircle } from 'react-icons/fa';
import AdminLayout from '@/components/admin/AdminLayout';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminProfile() {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha_atual: '',
    nova_senha: '',
    confirmar_senha: ''
  });

  useEffect(() => {
    if (user) {
      setFormData({
        nome: user.nome || '',
        email: user.email || '',
        senha_atual: '',
        nova_senha: '',
        confirmar_senha: ''
      });
      
      // Configurar preview do avatar
      if (user.avatar) {
        // Construir URL corretamente
        let avatarUrl = user.avatar;
        if (!avatarUrl.startsWith('http')) {
          if (avatarUrl.startsWith('/uploads')) {
            avatarUrl = `http://localhost:3001${avatarUrl}`;
          } else {
            avatarUrl = `http://localhost:3001/uploads/avatars/${avatarUrl}`;
          }
        }
        setAvatarPreview(avatarUrl);
      }
    }
  }, [user]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione uma imagem válida');
      return;
    }

    // Validar tamanho (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('A imagem deve ter no máximo 5MB');
      return;
    }

    try {
      setUploadingAvatar(true);
      setError('');

      // Preview local
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await api.post('/admin/profile/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        // Usar avatarUrl que retorna o caminho completo
        const avatarPath = response.data.data.avatarUrl || `/uploads/avatars/${response.data.data.avatar}`;
        updateUser({
          ...user!,
          avatar: avatarPath
        });
        setSuccess('✅ Foto atualizada com sucesso!');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      setError(error.response?.data?.message || 'Erro ao fazer upload da foto');
      setAvatarPreview(null);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');

    // Validações
    if (!formData.nome || !formData.email) {
      setError('Nome e email são obrigatórios');
      return;
    }

    // Se está alterando senha, validar
    if (formData.nova_senha) {
      if (!formData.senha_atual) {
        setError('Para alterar a senha, informe a senha atual');
        return;
      }
      if (formData.nova_senha !== formData.confirmar_senha) {
        setError('A nova senha e a confirmação não coincidem');
        return;
      }
      if (formData.nova_senha.length < 6) {
        setError('A nova senha deve ter no mínimo 6 caracteres');
        return;
      }
    }

    try {
      setLoading(true);

      // Preparar dados
      const dataToSend: any = {
        nome: formData.nome,
        email: formData.email
      };

      // Se estiver alterando senha, incluir no mesmo payload
      if (formData.nova_senha) {
        dataToSend.current_password = formData.senha_atual;
        dataToSend.new_password = formData.nova_senha;
      }

      // Atualizar perfil do Super Admin (uma única chamada)
      const profileResponse = await api.put('/admin/profile', dataToSend);

      // Atualizar contexto do usuário
      if (profileResponse.data.success) {
        updateUser({
          ...user!,
          nome: formData.nome,
          email: formData.email
        });

        setSuccess('✅ Perfil atualizado com sucesso!');
        
        // Limpar campos de senha
        setFormData({
          ...formData,
          senha_atual: '',
          nova_senha: '',
          confirmar_senha: ''
        });

        // Limpar mensagem de sucesso após 3 segundos
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error: any) {
      console.error('Erro ao atualizar perfil:', error);
      setError(error.response?.data?.message || 'Erro ao atualizar perfil');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout
      title="Meu Perfil"
      subtitle="Edite suas informações pessoais"
      icon={<FaUserCircle className="text-3xl text-white" />}
      currentPage="perfil"
    >
      <div className="max-w-3xl mx-auto">
        {/* Messages */}
        {error && (
          <div className="mb-6 bg-red-500/20 border-2 border-red-500 rounded-xl p-4">
            <p className="text-red-300 font-medium">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-500/20 border-2 border-green-500 rounded-xl p-4">
            <p className="text-green-300 font-medium">{success}</p>
          </div>
        )}

        {/* Profile Card */}
        <div className="bg-gray-800 border-2 border-gray-700 rounded-xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="relative inline-block">
              {avatarPreview || user?.avatar ? (
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-purple-500 mx-auto mb-4">
                  <img
                    src={avatarPreview || `http://localhost:3001${user?.avatar || ''}`}
                    alt={user?.nome}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center mx-auto mb-4 border-4 border-purple-500">
                  <FaUserCircle className="text-6xl text-white" />
                </div>
              )}
              
              {/* Botão de Upload */}
              <label
                htmlFor="avatar-upload"
                className="absolute bottom-2 right-0 bg-purple-600 hover:bg-purple-700 p-2 rounded-full cursor-pointer shadow-lg transition-all transform hover:scale-110"
                title="Alterar foto"
              >
                <FaUser className="text-white text-sm" />
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                  disabled={uploadingAvatar}
                />
              </label>
            </div>
            
            {uploadingAvatar && (
              <p className="text-purple-300 text-sm mt-2 animate-pulse">
                📤 Fazendo upload...
              </p>
            )}
            
            <h2 className="text-2xl font-bold text-white mb-1">{user?.nome}</h2>
            <p className="text-purple-300 text-sm font-medium">Super Administrador</p>
          </div>

          <div className="space-y-6">
            {/* Nome */}
            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2 flex items-center gap-2">
                <FaUser className="text-purple-400" /> Nome Completo
              </label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="w-full px-4 py-3 bg-gray-900 border-2 border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none transition-all"
                placeholder="Seu nome completo"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2 flex items-center gap-2">
                <FaEnvelope className="text-purple-400" /> E-mail
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 bg-gray-900 border-2 border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none transition-all"
                placeholder="seu@email.com"
              />
            </div>

            {/* Divider */}
            <div className="border-t-2 border-gray-700 my-6"></div>

            <div className="bg-purple-900/20 border-2 border-purple-500/30 rounded-xl p-4">
              <h3 className="text-lg font-bold text-purple-300 mb-4 flex items-center gap-2">
                <FaLock /> Alterar Senha (Opcional)
              </h3>

              <div className="space-y-4">
                {/* Senha Atual */}
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">
                    Senha Atual
                  </label>
                  <input
                    type="password"
                    value={formData.senha_atual}
                    onChange={(e) => setFormData({ ...formData, senha_atual: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-900 border-2 border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none transition-all"
                    placeholder="Digite sua senha atual"
                  />
                </div>

                {/* Nova Senha */}
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">
                    Nova Senha
                  </label>
                  <input
                    type="password"
                    value={formData.nova_senha}
                    onChange={(e) => setFormData({ ...formData, nova_senha: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-900 border-2 border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none transition-all"
                    placeholder="Digite a nova senha (mínimo 6 caracteres)"
                  />
                </div>

                {/* Confirmar Nova Senha */}
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">
                    Confirmar Nova Senha
                  </label>
                  <input
                    type="password"
                    value={formData.confirmar_senha}
                    onChange={(e) => setFormData({ ...formData, confirmar_senha: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-900 border-2 border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none transition-all"
                    placeholder="Confirme a nova senha"
                  />
                </div>

                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
                  <p className="text-sm text-blue-300">
                    💡 <strong>Dica:</strong> Deixe os campos de senha em branco se não quiser alterar a senha.
                  </p>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={loading}
              className={`w-full px-6 py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 shadow-lg ${
                loading
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-xl hover:shadow-2xl transform hover:scale-[1.02]'
              }`}
            >
              <FaSave className="text-xl" />
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>

        {/* Info Card */}
        <div className="mt-6 bg-gray-800/50 border-2 border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-3">ℹ️ Informações</h3>
          <ul className="space-y-2 text-gray-300 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-1">•</span>
              <span>O <strong>nome</strong> será exibido no cabeçalho do sistema</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-1">•</span>
              <span>O <strong>e-mail</strong> é usado para login no sistema</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-1">•</span>
              <span>A <strong>senha</strong> deve ter no mínimo 6 caracteres</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-1">•</span>
              <span>As alterações entram em vigor imediatamente após salvar</span>
            </li>
          </ul>
        </div>
      </div>
    </AdminLayout>
  );
}

