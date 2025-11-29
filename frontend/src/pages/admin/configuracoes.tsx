import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { FaCog, FaUpload, FaTrash, FaSave, FaImage, FaPalette, FaWhatsapp } from 'react-icons/fa';
import api from '@/services/api';

interface SystemSettings {
  system_logo: string | null;
  system_name: string;
  system_primary_color: string;
  system_secondary_color: string;
  system_favicon: string | null;
  login_background: string | null;
  support_phone: string;
}

export default function SystemConfigPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // Estados para edição
  const [systemName, setSystemName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#10b981');
  const [secondaryColor, setSecondaryColor] = useState('#3b82f6');
  const [supportPhone, setSupportPhone] = useState('5562998449494');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/system-settings/public');
      setSettings(response.data.data);
      setSystemName(response.data.data.system_name || '');
      setPrimaryColor(response.data.data.system_primary_color || '#10b981');
      setSecondaryColor(response.data.data.system_secondary_color || '#3b82f6');
      setSupportPhone(response.data.data.support_phone || '5562998449494');
    } catch (error: any) {
      console.error('Erro ao buscar configurações:', error);
      showMessage('error', 'Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showMessage('error', 'Arquivo muito grande! Máximo 5MB');
      return;
    }

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      showMessage('error', 'Apenas imagens são permitidas');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('logo', file);

    try {
      const response = await api.post('/admin/system-settings/logo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      showMessage('success', 'Logo atualizada com sucesso!');
      fetchSettings(); // Recarregar configurações
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      showMessage('error', error.response?.data?.message || 'Erro ao fazer upload da logo');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!confirm('Tem certeza que deseja remover a logo?')) return;

    try {
      await api.delete('/admin/system-settings/logo');
      showMessage('success', 'Logo removida com sucesso!');
      fetchSettings();
    } catch (error: any) {
      console.error('Erro ao remover logo:', error);
      showMessage('error', 'Erro ao remover logo');
    }
  };

  const handleSaveSettings = async () => {
    setUploading(true);
    try {
      // Salvar nome do sistema
      await api.put('/admin/system-settings', {
        key: 'system_name',
        value: systemName
      });

      // Salvar cor primária
      await api.put('/admin/system-settings', {
        key: 'system_primary_color',
        value: primaryColor
      });

      // Salvar cor secundária
      await api.put('/admin/system-settings', {
        key: 'system_secondary_color',
        value: secondaryColor
      });

      // Salvar telefone de suporte
      await api.put('/admin/system-settings', {
        key: 'support_phone',
        value: supportPhone
      });

      showMessage('success', 'Configurações salvas com sucesso!');
      fetchSettings();
    } catch (error: any) {
      console.error('Erro ao salvar configurações:', error);
      showMessage('error', 'Erro ao salvar configurações');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Configurações do Sistema" icon={<FaCog />} currentPage="configuracoes">
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-500"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Configurações do Sistema"
      subtitle="Personalize a aparência e configurações globais"
      icon={<FaCog />}
      currentPage="configuracoes"
    >
      {/* Mensagem de Feedback */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-500/20 border-2 border-green-500 text-green-200' : 'bg-red-500/20 border-2 border-red-500 text-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        {/* Logo do Sistema */}
        <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border-2 border-purple-500/30 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <FaImage className="text-3xl text-purple-400" />
            <div>
              <h2 className="text-2xl font-black text-white">Logo do Sistema</h2>
              <p className="text-gray-400 text-sm">Esta logo aparecerá em todas as páginas do sistema</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Preview da Logo */}
            <div className="bg-gray-900/50 border-2 border-gray-700 rounded-xl p-6">
              <p className="text-gray-400 text-sm mb-4 font-bold">Preview:</p>
              {settings?.system_logo ? (
                <div className="flex flex-col items-center gap-4">
                  <img
                    src={`http://localhost:3001${settings.system_logo}`}
                    alt="Logo do Sistema"
                    className="max-h-40 object-contain bg-white/5 p-4 rounded-lg"
                  />
                  <button
                    onClick={handleRemoveLogo}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-all flex items-center gap-2"
                    disabled={uploading}
                  >
                    <FaTrash /> Remover Logo
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center h-40 bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-600">
                  <p className="text-gray-500">Nenhuma logo configurada</p>
                </div>
              )}
            </div>

            {/* Upload */}
            <div className="bg-gray-900/50 border-2 border-gray-700 rounded-xl p-6">
              <p className="text-gray-400 text-sm mb-4 font-bold">Upload:</p>
              <div className="space-y-4">
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-blue-300 text-xs">
                    📋 <strong>Dicas:</strong><br />
                    • Tamanho máximo: 5MB<br />
                    • Formatos: JPG, PNG, GIF, SVG, WebP<br />
                    • Recomendado: PNG transparente<br />
                    • Dimensões sugeridas: 200x60px
                  </p>
                </div>

                <label className="block cursor-pointer">
                  <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2 text-center">
                    {uploading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Enviando...
                      </>
                    ) : (
                      <>
                        <FaUpload /> Selecionar Logo
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Informações Gerais */}
        <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-2 border-blue-500/30 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <FaCog className="text-3xl text-blue-400" />
            <div>
              <h2 className="text-2xl font-black text-white">Informações Gerais</h2>
              <p className="text-gray-400 text-sm">Nome e identidade do sistema</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-gray-300 font-bold mb-2">Nome do Sistema</label>
              <input
                type="text"
                value={systemName}
                onChange={(e) => setSystemName(e.target.value)}
                className="w-full bg-gray-800 border-2 border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                placeholder="Ex: Disparador NettSistemas"
              />
            </div>

            <div>
              <label className="block text-gray-300 font-bold mb-2 flex items-center gap-2">
                <FaWhatsapp className="text-green-400" />
                Telefone de Suporte (WhatsApp)
              </label>
              <input
                type="text"
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-gray-800 border-2 border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                placeholder="Ex: 5562998449494"
                maxLength={15}
              />
              <p className="text-gray-500 text-xs mt-2">
                📋 Formato: Código do país + DDD + número (sem espaços ou caracteres especiais)
              </p>
              {supportPhone && (
                <a
                  href={`https://wa.me/${supportPhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-all text-sm"
                >
                  <FaWhatsapp /> Testar Link
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Cores do Sistema */}
        <div className="bg-gradient-to-br from-pink-900/50 to-pink-800/30 border-2 border-pink-500/30 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <FaPalette className="text-3xl text-pink-400" />
            <div>
              <h2 className="text-2xl font-black text-white">Cores do Sistema</h2>
              <p className="text-gray-400 text-sm">Personalize as cores da interface</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-gray-300 font-bold mb-2">Cor Primária</label>
              <div className="flex gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-12 w-20 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="flex-1 bg-gray-800 border-2 border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-pink-500"
                  placeholder="#10b981"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-300 font-bold mb-2">Cor Secundária</label>
              <div className="flex gap-3">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="h-12 w-20 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="flex-1 bg-gray-800 border-2 border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-pink-500"
                  placeholder="#3b82f6"
                />
              </div>
            </div>
          </div>

          {/* Preview das Cores */}
          <div className="mt-6 p-4 bg-gray-900/50 border-2 border-gray-700 rounded-lg">
            <p className="text-gray-400 text-sm mb-3 font-bold">Preview:</p>
            <div className="flex gap-4">
              <div style={{ backgroundColor: primaryColor }} className="flex-1 h-20 rounded-lg flex items-center justify-center text-white font-bold shadow-lg">
                Primária
              </div>
              <div style={{ backgroundColor: secondaryColor }} className="flex-1 h-20 rounded-lg flex items-center justify-center text-white font-bold shadow-lg">
                Secundária
              </div>
            </div>
          </div>
        </div>

        {/* Botão Salvar */}
        <div className="flex justify-end">
          <button
            onClick={handleSaveSettings}
            disabled={uploading}
            className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl font-black text-lg transition-all flex items-center gap-3 shadow-xl disabled:opacity-50"
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Salvando...
              </>
            ) : (
              <>
                <FaSave /> Salvar Configurações
              </>
            )}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}

