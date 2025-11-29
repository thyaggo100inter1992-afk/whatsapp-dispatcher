import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  FaGlobe, FaEye, FaEdit, FaSave, FaTimes, FaCheckCircle,
  FaChartLine, FaUsers, FaEnvelope, FaCopy, FaExternalLinkAlt, FaImage, FaTrash, FaUpload, FaWhatsapp
} from 'react-icons/fa';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import AdminLayout from '@/components/admin/AdminLayout';
import axios from 'axios';
import { buildFileUrl, getApiBaseUrl } from '@/utils/urlHelpers';

interface LandingStats {
  total_leads: number;
  total_trials: number;
  total_conversions: number;
  recent_leads: Array<{
    id: number;
    nome: string;
    email: string;
    telefone: string;
    empresa: string;
    created_at: string;
  }>;
}

export default function AdminLandingPage() {
  const router = useRouter();
  const { signOut } = useAuth();
  const notify = useNotifications();
  const [stats, setStats] = useState<LandingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [landingUrl, setLandingUrl] = useState('');
  const [systemLogo, setSystemLogo] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [editingWhatsapp, setEditingWhatsapp] = useState(false);
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [screenshots, setScreenshots] = useState<any[]>([]);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);

  const API_BASE_URL = getApiBaseUrl();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || `${API_BASE_URL}/api`;
  const FRONTEND_URL = typeof window !== 'undefined' ? window.location.origin : API_BASE_URL;

  useEffect(() => {
    loadStats();
    loadSystemLogo();
    loadWhatsappNumber();
    loadScreenshots();
    setLandingUrl(`${FRONTEND_URL}/site`);
  }, []);

  const loadSystemLogo = async () => {
    try {
      const response = await axios.get(`${API_URL.replace(/\/api$/, '')}/api/public/logo`);
      console.log('📥 Logo response:', response.data);
      
      if (response.data && response.data.logo) {
        setSystemLogo(response.data.logo);
        console.log('✅ Logo carregada:', response.data.logo);
      } else {
        console.log('⚠️ Nenhuma logo configurada');
      }
    } catch (error: any) {
      console.error('❌ Erro ao carregar logo:', error.message);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      notify.error(
        'Arquivo muito grande!',
        'O tamanho máximo permitido é 5MB.'
      );
      return;
    }

    if (!file.type.startsWith('image/')) {
      notify.error(
        'Tipo de arquivo inválido',
        'Apenas imagens são permitidas (JPG, PNG, GIF, WebP).'
      );
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('logo', file);

    try {
      await api.post('/admin/system-settings/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      notify.success(
        'Logo atualizada!',
        'A logo do sistema foi atualizada com sucesso.'
      );
      loadSystemLogo();
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      notify.error(
        'Erro ao fazer upload',
        error.response?.data?.message || 'Não foi possível fazer upload da logo. Tente novamente.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    const confirmed = await notify.confirm({
      title: 'Remover logo do sistema?',
      message: 'Tem certeza que deseja remover a logo?\nEsta ação não pode ser desfeita.',
      type: 'warning',
      confirmText: 'Sim, remover',
      cancelText: 'Cancelar'
    });

    if (!confirmed) return;

    try {
      await api.delete('/admin/system-settings/logo');
      notify.success(
        'Logo removida!',
        'A logo do sistema foi removida com sucesso.'
      );
      loadSystemLogo();
    } catch (error: any) {
      console.error('Erro ao remover logo:', error);
      notify.error(
        'Erro ao remover logo',
        'Não foi possível remover a logo. Tente novamente.'
      );
    }
  };

  const loadWhatsappNumber = async () => {
    try {
      const response = await api.get('/admin/system-settings');
      console.log('📞 Configurações carregadas:', response.data);
      
      if (response.data.success && response.data.data) {
        // Buscar no array de configurações
        const whatsappSetting = response.data.data.find((s: any) => s.setting_key === 'landing_whatsapp');
        const messageSetting = response.data.data.find((s: any) => s.setting_key === 'landing_whatsapp_message');
        
        if (whatsappSetting && whatsappSetting.setting_value) {
          setWhatsappNumber(whatsappSetting.setting_value);
          console.log('📞 WhatsApp encontrado:', whatsappSetting.setting_value);
        } else {
          console.log('📞 Nenhum WhatsApp configurado');
        }
        
        if (messageSetting && messageSetting.setting_value) {
          setWhatsappMessage(messageSetting.setting_value);
          console.log('💬 Mensagem encontrada:', messageSetting.setting_value);
        } else {
          setWhatsappMessage('Olá! Gostaria de saber mais sobre o Disparador NettSistemas');
        }
      }
    } catch (error: any) {
      console.error('❌ Erro ao carregar número do WhatsApp:', error);
    }
  };

  const saveWhatsappNumber = async () => {
    if (!whatsappNumber) {
      notify.warning(
        'Campo obrigatório',
        'Por favor, digite um número de WhatsApp.'
      );
      return;
    }

    if (!whatsappMessage) {
      notify.warning(
        'Campo obrigatório',
        'Por favor, digite uma mensagem padrão para o WhatsApp.'
      );
      return;
    }

    // Validar formato do número
    const cleanNumber = whatsappNumber.replace(/\D/g, '');
    if (cleanNumber.length < 10) {
      notify.error(
        'Número inválido!',
        'Use o formato: DDI + DDD + Número\nExemplo: 5511999999999'
      );
      return;
    }

    setSavingWhatsapp(true);
    try {
      // Salvar número
      await api.put('/admin/system-settings', {
        key: 'landing_whatsapp',
        value: cleanNumber
      });
      
      // Salvar mensagem
      await api.put('/admin/system-settings', {
        key: 'landing_whatsapp_message',
        value: whatsappMessage
      });
      
      notify.success(
        'Configurações salvas!',
        'As configurações do WhatsApp foram atualizadas com sucesso.'
      );
      setWhatsappNumber(cleanNumber);
      setEditingWhatsapp(false);
      loadWhatsappNumber();
    } catch (error: any) {
      console.error('Erro ao salvar configurações:', error);
      notify.error(
        'Erro ao salvar',
        error.response?.data?.message || 'Não foi possível salvar as configurações do WhatsApp. Tente novamente.'
      );
    } finally {
      setSavingWhatsapp(false);
    }
  };

  const loadStats = async () => {
    try {
      setLoading(true);

      // Buscar leads da landing page
      const leadsQuery = await api.get('/admin/landing/leads');
      
      setStats({
        total_leads: leadsQuery.data.total || 0,
        total_trials: leadsQuery.data.trials || 0,
        total_conversions: leadsQuery.data.conversions || 0,
        recent_leads: leadsQuery.data.recent || []
      });
    } catch (error: any) {
      console.error('Erro ao carregar estatísticas:', error);
      
      // Se o endpoint não existir ainda, criar dados fake para visualização
      setStats({
        total_leads: 0,
        total_trials: 0,
        total_conversions: 0,
        recent_leads: []
      });
    } finally {
      setLoading(false);
    }
  };

  const loadScreenshots = async () => {
    try {
      const response = await api.get('/admin/screenshots');
      if (response.data.success) {
        setScreenshots(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar screenshots:', error);
    }
  };

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      notify.error(
        'Tipo de arquivo inválido',
        'Por favor, selecione apenas imagens (JPG, PNG, GIF, WebP).'
      );
      return;
    }

    // Validar tamanho (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      notify.error(
        'Imagem muito grande!',
        'O tamanho máximo permitido é 5MB.'
      );
      return;
    }

    setUploadingScreenshot(true);
    try {
      console.log('📸 [FRONTEND] Iniciando upload...', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });

      const formData = new FormData();
      formData.append('screenshot', file);

      console.log('📸 [FRONTEND] FormData criado');

      // Criar uma instância do Axios sem interceptors para uploads
      const token = localStorage.getItem('@WhatsAppDispatcher:token');
      const response = await axios.post(
        `${API_URL}/admin/screenshots/upload`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            // NÃO definir Content-Type - deixar o navegador definir automaticamente
          },
        }
      );

      console.log('✅ [FRONTEND] Upload concluído:', response.data);
      notify.success(
        'Screenshot enviado!',
        'A imagem foi adicionada com sucesso à landing page.'
      );
      loadScreenshots();
      e.target.value = '';
    } catch (error: any) {
      console.error('❌ [FRONTEND] Erro ao fazer upload:', error);
      console.error('❌ [FRONTEND] Response:', error.response?.data);
      notify.error(
        'Erro ao enviar screenshot',
        error.response?.data?.message || 'Não foi possível enviar a imagem. Tente novamente.'
      );
    } finally {
      setUploadingScreenshot(false);
    }
  };

  const handleDeleteScreenshot = async (id: number, filename: string) => {
    const confirmed = await notify.confirm({
      title: 'Excluir screenshot?',
      message: `Tem certeza que deseja excluir este screenshot?\nEsta ação não pode ser desfeita.`,
      type: 'danger',
      confirmText: 'Sim, excluir',
      cancelText: 'Cancelar'
    });

    if (!confirmed) return;

    try {
      await api.delete(`/admin/screenshots/${id}`);
      notify.success(
        'Screenshot excluído!',
        'O screenshot foi removido da landing page.'
      );
      loadScreenshots();
    } catch (error: any) {
      console.error('Erro ao excluir screenshot:', error);
      notify.error(
        'Erro ao excluir',
        error.response?.data?.message || 'Não foi possível excluir o screenshot. Tente novamente.'
      );
    }
  };

  const moveScreenshot = async (id: number, direction: 'up' | 'down') => {
    const currentIndex = screenshots.findIndex(s => s.id === id);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= screenshots.length) return;

    try {
      // Atualizar ordem no backend
      const currentScreenshot = screenshots[currentIndex];
      const targetScreenshot = screenshots[newIndex];

      await api.put(`/admin/screenshots/${currentScreenshot.id}/ordem`, { ordem: newIndex });
      await api.put(`/admin/screenshots/${targetScreenshot.id}/ordem`, { ordem: currentIndex });

      // Recarregar lista
      loadScreenshots();
    } catch (error: any) {
      console.error('Erro ao reordenar screenshot:', error);
      notify.error(
        'Erro ao reordenar',
        error.response?.data?.message || 'Não foi possível reordenar o screenshot. Tente novamente.'
      );
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    notify.success(
      'Link copiado!',
      'O link da landing page foi copiado para a área de transferência.'
    );
  };

  const openLandingPage = () => {
    window.open(landingUrl, '_blank');
  };

  const deleteLead = async (leadId: number, leadNome: string) => {
    const confirmed = await notify.confirm({
      title: 'Excluir lead?',
      message: `Tem certeza que deseja excluir o lead "${leadNome}"?\nEsta ação não pode ser desfeita.`,
      type: 'danger',
      confirmText: 'Sim, excluir',
      cancelText: 'Cancelar'
    });

    if (!confirmed) return;

    try {
      await api.delete(`/admin/landing/leads/${leadId}`);
      notify.success(
        'Lead excluído!',
        'O lead foi removido com sucesso.'
      );
      loadStats(); // Recarregar a lista
    } catch (error: any) {
      console.error('Erro ao excluir lead:', error);
      notify.error(
        'Erro ao excluir lead',
        error.response?.data?.message || 'Não foi possível excluir o lead. Tente novamente.'
      );
    }
  };

  return (
    <AdminLayout
      title="Gerenciar Landing Page"
      subtitle="Configure e acompanhe sua página de vendas"
      icon={<FaGlobe className="text-3xl text-white" />}
      currentPage="landing"
    >
      <div className="space-y-6">
        {/* Logo do Sistema para Landing Page */}
        <div className="bg-gradient-to-r from-blue-900/50 to-indigo-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-blue-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FaImage className="text-3xl text-blue-300" />
              <div>
                <h3 className="text-xl font-bold text-white">Logo da Landing Page</h3>
                <p className="text-gray-400 text-sm">Esta logo aparecerá no header e footer da landing page</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Preview da Logo */}
            <div className="bg-gray-800 rounded-xl p-6 border-2 border-gray-700">
              {systemLogo ? (
                <img
                  src={buildFileUrl(systemLogo) || undefined}
                  alt="Logo do Sistema"
                  className="max-h-20 max-w-xs object-contain"
                />
              ) : (
                <div className="h-20 w-40 flex items-center justify-center text-gray-500">
                  Nenhuma logo configurada
                </div>
              )}
            </div>

            {/* Botões de Ação */}
            <div className="flex gap-3">
              <label className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold cursor-pointer flex items-center gap-2 transition-all">
                <FaUpload />
                {uploading ? 'Enviando...' : 'Upload Logo'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>

              {systemLogo && (
                <button
                  onClick={handleRemoveLogo}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold flex items-center gap-2 transition-all"
                >
                  <FaTrash /> Remover
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
            <p className="text-blue-300 text-sm">
              💡 <strong>Dica:</strong> Use uma imagem PNG transparente com dimensões 200x60px (horizontal) para melhor resultado.
            </p>
          </div>
        </div>

        {/* WhatsApp da Landing Page */}
        <div className="bg-gradient-to-r from-green-900/50 to-emerald-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-green-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FaWhatsapp className="text-3xl text-green-300" />
              <div>
                <h3 className="text-xl font-bold text-white">WhatsApp de Contato</h3>
                <p className="text-gray-400 text-sm">Número que aparecerá no botão flutuante da landing page</p>
              </div>
            </div>
            {!editingWhatsapp && (
              <button
                onClick={() => setEditingWhatsapp(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex items-center gap-2 transition-all"
              >
                <FaEdit /> Editar
              </button>
            )}
          </div>

          {editingWhatsapp ? (
            <div className="space-y-4">
              <div>
                <label className="block text-white font-bold mb-2">Número do WhatsApp (com DDI)</label>
                <input
                  type="text"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="Ex: 5511999999999"
                  className="w-full px-4 py-3 bg-gray-800 border-2 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"
                />
                <p className="text-gray-400 text-xs mt-2">
                  Formato: DDI + DDD + Número (somente números, sem espaços ou caracteres especiais)
                </p>
              </div>

              <div>
                <label className="block text-white font-bold mb-2">Mensagem Padrão</label>
                <textarea
                  value={whatsappMessage}
                  onChange={(e) => setWhatsappMessage(e.target.value)}
                  placeholder="Ex: Olá! Gostaria de saber mais sobre..."
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-800 border-2 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-green-500 focus:outline-none resize-none"
                />
                <p className="text-gray-400 text-xs mt-2">
                  Esta mensagem será preenchida automaticamente quando o cliente clicar no botão do WhatsApp
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={saveWhatsappNumber}
                  disabled={savingWhatsapp}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  <FaSave /> {savingWhatsapp ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  onClick={() => {
                    setEditingWhatsapp(false);
                    loadWhatsappNumber();
                  }}
                  className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-bold flex items-center gap-2 transition-all"
                >
                  <FaTimes /> Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-xl p-4 border-2 border-gray-700">
              {whatsappNumber ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-gray-400 text-xs mb-1">Número:</p>
                      <p className="text-white font-mono text-lg">+{whatsappNumber}</p>
                    </div>
                    <div className="text-green-400 text-3xl">
                      <FaCheckCircle />
                    </div>
                  </div>
                  
                  {whatsappMessage && (
                    <div className="border-t border-gray-700 pt-3">
                      <p className="text-gray-400 text-xs mb-2">Mensagem Padrão:</p>
                      <p className="text-white text-sm bg-gray-900 p-3 rounded-lg italic">
                        "{whatsappMessage}"
                      </p>
                    </div>
                  )}
                  
                  <div className="border-t border-gray-700 pt-3">
                    <a
                      href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage || '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-400 hover:text-green-300 text-sm flex items-center gap-2"
                    >
                      <FaWhatsapp /> Testar no WhatsApp <FaExternalLinkAlt className="text-xs" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  Nenhum número configurado
                </div>
              )}
            </div>
          )}

          <div className="mt-4 p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
            <p className="text-green-300 text-sm">
              💡 <strong>Dica:</strong> O botão flutuante do WhatsApp aparecerá no canto inferior direito da landing page.
            </p>
          </div>
        </div>

        {/* Screenshots do Sistema */}
        <div className="bg-gradient-to-r from-blue-900/50 to-cyan-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-blue-500">
          <div className="flex items-center gap-3 mb-4">
            <FaImage className="text-3xl text-blue-300" />
            <div>
              <h3 className="text-xl font-bold text-white">Screenshots do Sistema</h3>
              <p className="text-gray-400 text-sm">Adicione imagens que serão exibidas na landing page</p>
            </div>
          </div>

          {/* Upload */}
          <div className="mb-6">
            <label className="block cursor-pointer">
              <div className="border-2 border-dashed border-blue-500 rounded-lg p-8 text-center hover:border-blue-400 hover:bg-blue-900/20 transition-all">
                <FaUpload className="text-4xl text-blue-400 mx-auto mb-3" />
                <p className="text-white font-bold mb-1">
                  {uploadingScreenshot ? 'Enviando...' : 'Clique para fazer upload'}
                </p>
                <p className="text-gray-400 text-sm">PNG, JPG, GIF ou WebP (máx. 5MB)</p>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleScreenshotUpload}
                className="hidden"
                disabled={uploadingScreenshot}
              />
            </label>
          </div>

          {/* Lista de Screenshots */}
          {screenshots.length > 0 ? (
            <div>
              <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                Screenshots Cadastrados ({screenshots.length})
                <span className="text-xs text-gray-500 font-normal">• Arraste para reordenar</span>
              </h4>
              <div className="space-y-4">
                {screenshots.map((screenshot, index) => (
                  <div
                    key={screenshot.id}
                    className="bg-gray-900/50 rounded-xl border-2 border-gray-700 hover:border-blue-500 transition-all group p-4"
                  >
                    <div className="flex gap-4">
                      {/* Ordem */}
                      <div className="flex flex-col items-center justify-center bg-blue-600/20 border-2 border-blue-500 rounded-lg px-3 py-2">
                        <span className="text-2xl font-black text-blue-400">#{index + 1}</span>
                        <span className="text-xs text-gray-400">Ordem</span>
                      </div>
                      
                      {/* Preview */}
                      <div className="w-40 h-24 bg-gray-800 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={buildFileUrl(screenshot.path) || undefined}
                          alt={screenshot.titulo || 'Screenshot'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      
                      {/* Informações */}
                      <div className="flex-1 min-w-0">
                        <div className="mb-2">
                          <label className="text-gray-400 text-xs block mb-1">Título (opcional)</label>
                          <input
                            type="text"
                            value={screenshot.titulo || ''}
                            placeholder="Ex: Dashboard Principal"
                            className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                            readOnly
                          />
                        </div>
                        <div>
                          <label className="text-gray-400 text-xs block mb-1">Descrição (opcional)</label>
                          <input
                            type="text"
                            value={screenshot.descricao || ''}
                            placeholder="Ex: Gerencie todas as suas campanhas em um só lugar"
                            className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                            readOnly
                          />
                        </div>
                        <div className="mt-2 text-xs text-gray-500 truncate">
                          📁 {screenshot.filename}
                        </div>
                      </div>
                      
                      {/* Ações */}
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleDeleteScreenshot(screenshot.id, screenshot.filename)}
                          className="p-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all flex items-center gap-2"
                          title="Excluir Screenshot"
                        >
                          <FaTrash /> Excluir
                        </button>
                        <div className="flex flex-col gap-1 text-center">
                          <button
                            onClick={() => moveScreenshot(screenshot.id, 'up')}
                            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={index === 0}
                            title="Mover para cima"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => moveScreenshot(screenshot.id, 'down')}
                            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={index === screenshots.length - 1}
                            title="Mover para baixo"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FaImage className="text-5xl mx-auto mb-3 opacity-30" />
              <p>Nenhum screenshot cadastrado</p>
              <p className="text-sm mt-1">Faça upload da primeira imagem acima</p>
            </div>
          )}

          <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
            <p className="text-blue-300 text-sm">
              💡 <strong>Dica:</strong> As imagens aparecerão automaticamente na seção "Veja o Sistema em Ação" da landing page.
            </p>
          </div>
        </div>

        {/* URL da Landing Page */}
        <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-purple-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FaGlobe className="text-3xl text-purple-300" />
              <div>
                <h3 className="text-xl font-bold text-white">URL da Landing Page</h3>
                <p className="text-gray-400 text-sm">Compartilhe este link para atrair novos clientes</p>
              </div>
            </div>
            <button
              onClick={openLandingPage}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold flex items-center gap-2 transition-all"
            >
              <FaExternalLinkAlt /> Visualizar
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={landingUrl}
              readOnly
              className="flex-1 px-4 py-3 bg-gray-800 text-white rounded-lg border border-purple-500 font-mono"
            />
            <button
              onClick={() => copyToClipboard(landingUrl)}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-2 transition-all"
            >
              <FaCopy /> Copiar
            </button>
          </div>
        </div>

        {/* Estatísticas */}
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-purple-500"></div>
            <p className="text-white mt-4 text-xl">Carregando estatísticas...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card: Total de Leads */}
              <div className="bg-gray-800/70 backdrop-blur-sm rounded-2xl p-6 border-2 border-blue-500/30 hover:border-blue-500 transition-all">
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-blue-500/20 p-4 rounded-xl">
                    <FaEnvelope className="text-3xl text-blue-400" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Total de Leads</p>
                    <h3 className="text-4xl font-black text-white">{stats?.total_leads || 0}</h3>
                  </div>
                </div>
                <p className="text-gray-400 text-sm">
                  Pessoas que entraram em contato pela landing page
                </p>
              </div>

              {/* Card: Contas Trial */}
              <div className="bg-gray-800/70 backdrop-blur-sm rounded-2xl p-6 border-2 border-green-500/30 hover:border-green-500 transition-all">
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-green-500/20 p-4 rounded-xl">
                    <FaUsers className="text-3xl text-green-400" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Contas Trial Criadas</p>
                    <h3 className="text-4xl font-black text-white">{stats?.total_trials || 0}</h3>
                  </div>
                </div>
                <p className="text-gray-400 text-sm">
                  Usuários que iniciaram teste grátis
                </p>
              </div>

              {/* Card: Conversões */}
              <div className="bg-gray-800/70 backdrop-blur-sm rounded-2xl p-6 border-2 border-purple-500/30 hover:border-purple-500 transition-all">
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-purple-500/20 p-4 rounded-xl">
                    <FaChartLine className="text-3xl text-purple-400" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Conversões (Pagantes)</p>
                    <h3 className="text-4xl font-black text-white">{stats?.total_conversions || 0}</h3>
                  </div>
                </div>
                <p className="text-gray-400 text-sm">
                  Clientes que realizaram pagamento
                </p>
              </div>
            </div>

            {/* Taxa de Conversão */}
            {stats && stats.total_trials > 0 && (
              <div className="bg-gradient-to-r from-emerald-900/30 to-green-900/30 backdrop-blur-sm rounded-2xl p-6 border-2 border-emerald-500/30">
                <div className="flex items-center gap-4">
                  <FaCheckCircle className="text-4xl text-emerald-400" />
                  <div>
                    <p className="text-gray-400 text-sm">Taxa de Conversão Trial → Pagante</p>
                    <h3 className="text-3xl font-bold text-white">
                      {((stats.total_conversions / stats.total_trials) * 100).toFixed(1)}%
                    </h3>
                  </div>
                </div>
              </div>
            )}

            {/* Leads Recentes */}
            <div className="bg-gray-800/70 backdrop-blur-sm rounded-2xl p-6 border-2 border-gray-700">
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <FaEnvelope className="text-purple-400" />
                Leads Recentes
              </h3>

              {stats?.recent_leads && stats.recent_leads.length > 0 ? (
                <div className="space-y-4">
                  {stats.recent_leads.map((lead) => (
                    <div
                      key={lead.id}
                      className="bg-gray-900/50 rounded-xl p-4 border border-gray-700 hover:border-purple-500 transition-all"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <h4 className="text-lg font-bold text-white">{lead.nome}</h4>
                          <p className="text-gray-400 text-sm">{lead.email}</p>
                          {lead.telefone && (
                            <p className="text-gray-500 text-sm">{lead.telefone}</p>
                          )}
                          {lead.empresa && (
                            <p className="text-purple-400 text-sm mt-1">
                              🏢 {lead.empresa}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="text-right">
                            <p className="text-gray-500 text-xs">
                              {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                            </p>
                            <p className="text-gray-500 text-xs">
                              {new Date(lead.created_at).toLocaleTimeString('pt-BR')}
                            </p>
                          </div>
                          <button
                            onClick={() => deleteLead(lead.id, lead.nome)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                            title="Excluir lead"
                          >
                            <FaTrash className="text-xs" /> Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FaEnvelope className="text-6xl text-gray-700 mx-auto mb-4" />
                  <p className="text-gray-400">Nenhum lead registrado ainda</p>
                  <p className="text-gray-500 text-sm mt-2">
                    Compartilhe a landing page para começar a receber leads
                  </p>
                </div>
              )}
            </div>

            {/* Informações sobre a Landing Page */}
            <div className="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 backdrop-blur-sm rounded-2xl p-6 border-2 border-blue-500/30">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                <FaCheckCircle className="text-blue-400" />
                Funcionalidades Ativas na Landing Page
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 text-white">
                  <FaCheckCircle className="text-green-400" />
                  <span>✅ Exibição automática de planos do sistema</span>
                </div>
                <div className="flex items-center gap-3 text-white">
                  <FaCheckCircle className="text-green-400" />
                  <span>✅ Sincronização em tempo real com planos</span>
                </div>
                <div className="flex items-center gap-3 text-white">
                  <FaCheckCircle className="text-green-400" />
                  <span>✅ Criação automática de conta trial (7 dias)</span>
                </div>
                <div className="flex items-center gap-3 text-white">
                  <FaCheckCircle className="text-green-400" />
                  <span>✅ Link direto para checkout de pagamento</span>
                </div>
                <div className="flex items-center gap-3 text-white">
                  <FaCheckCircle className="text-green-400" />
                  <span>✅ Formulário de contato para leads</span>
                </div>
                <div className="flex items-center gap-3 text-white">
                  <FaCheckCircle className="text-green-400" />
                  <span>✅ Design moderno e responsivo</span>
                </div>
              </div>

              <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-xl">
                <p className="text-yellow-300 text-sm">
                  💡 <strong>Dica:</strong> Quando você criar, editar ou remover planos no painel de Gerenciamento de Planos,
                  as alterações aparecerão automaticamente na landing page!
                </p>
              </div>
            </div>

            {/* Ações Rápidas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => router.push('/admin/plans')}
                className="px-6 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
              >
                <FaEdit /> Editar Planos
              </button>
              
              <button
                onClick={openLandingPage}
                className="px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
              >
                <FaEye /> Ver Landing Page
              </button>
              
              <button
                onClick={loadStats}
                className="px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
              >
                <FaChartLine /> Atualizar Stats
              </button>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
