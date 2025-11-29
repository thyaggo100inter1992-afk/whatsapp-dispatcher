import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  FaVideo, FaUpload, FaTrash, FaEdit, FaCheck, FaTimes,
  FaPlayCircle, FaEye, FaEyeSlash
} from 'react-icons/fa';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import AdminLayout from '@/components/admin/AdminLayout';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ToastContainer, useToast } from '@/components/Toast';

interface Tutorial {
  id: number;
  titulo: string;
  descricao: string | null;
  filename: string;
  filepath: string;
  file_size: number;
  mime_type: string;
  duracao: number | null;
  categoria: string | null;
  ordem: number;
  ativo: boolean;
  uploaded_by: number | null;
  created_at: string;
  updated_at: string;
}

export default function AdminTutoriais() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { notifications, showNotification, removeNotification } = useToast();
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState({
    titulo: '',
    descricao: '',
    categoria: '',
    ordem: 0,
    ativo: true
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');

  // Dados do novo upload
  const [newTutorial, setNewTutorial] = useState({
    titulo: '',
    descricao: '',
    categoria: '',
    ordem: 0,
    ativo: true
  });

  useEffect(() => {
    loadTutorials();
  }, []);

  const loadTutorials = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/tutorials');
      setTutorials(response.data.data);
    } catch (err: any) {
      console.error('Erro ao carregar tutoriais:', err);
      if (err.response?.status === 403) {
        showNotification('❌ Acesso negado', 'error');
        router.push('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await uploadTutorial(e.target.files[0]);
    }
  };

  const uploadTutorial = async (file: File) => {
    try {
      if (!newTutorial.titulo.trim()) {
        showNotification('⚠️ Preencha o título', 'warning');
        return;
      }

      // Validar se é vídeo
      if (!file.type.startsWith('video/')) {
        showNotification('❌ Apenas vídeos permitidos', 'error');
        return;
      }

      setUploading(true);

      const formData = new FormData();
      formData.append('video', file);
      formData.append('titulo', newTutorial.titulo);
      formData.append('descricao', newTutorial.descricao);
      formData.append('categoria', newTutorial.categoria);
      formData.append('ordem', newTutorial.ordem.toString());
      formData.append('ativo', newTutorial.ativo.toString());

      const response = await api.post('/admin/tutorials/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        showNotification('✅ Vídeo enviado!', 'success');
        // Limpar formulário
        setNewTutorial({
          titulo: '',
          descricao: '',
          categoria: '',
          ordem: 0,
          ativo: true
        });
        // Recarregar lista
        loadTutorials();
      }
    } catch (err: any) {
      console.error('Erro ao fazer upload:', err);
      alert('❌ Erro ao enviar vídeo: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number, titulo: string) => {
    if (!confirm(`Tem certeza que deseja deletar o tutorial "${titulo}"?`)) return;

    try {
      await api.delete(`/admin/tutorials/${id}`);
      alert('✅ Tutorial deletado com sucesso!');
      loadTutorials();
    } catch (err) {
      alert('❌ Erro ao deletar tutorial');
    }
  };

  const handleEditStart = (tutorial: Tutorial) => {
    setEditingId(tutorial.id);
    setEditData({
      titulo: tutorial.titulo,
      descricao: tutorial.descricao || '',
      categoria: tutorial.categoria || '',
      ordem: tutorial.ordem,
      ativo: tutorial.ativo
    });
  };

  const handleEditSave = async (id: number) => {
    try {
      await api.put(`/admin/tutorials/${id}`, editData);
      alert('✅ Tutorial atualizado!');
      setEditingId(null);
      loadTutorials();
    } catch (err) {
      alert('❌ Erro ao atualizar tutorial');
    }
  };

  const handleEditCancel = () => {
    setEditingId(null);
  };

  const toggleAtivo = async (id: number, currentStatus: boolean) => {
    try {
      await api.put(`/admin/tutorials/${id}`, {
        ativo: !currentStatus
      });
      loadTutorials();
    } catch (err) {
      alert('❌ Erro ao alterar status');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const loadVideoUrl = async (id: number) => {
    try {
      // Buscar o vídeo com autenticação usando a instância api configurada
      const response = await api.get(`/tutorials/stream/${id}`, {
        responseType: 'blob'
      });
      
      // Criar um blob URL
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
    } catch (error) {
      console.error('Erro ao carregar vídeo:', error);
      alert('Erro ao carregar vídeo');
    }
  };

  const handleTutorialClick = async (tutorial: Tutorial) => {
    setSelectedTutorial(tutorial);
    await loadVideoUrl(tutorial.id);
  };

  const handleCloseModal = () => {
    setSelectedTutorial(null);
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl); // Limpar o blob URL
      setVideoUrl('');
    }
  };

  return (
    <AdminLayout
      title="Vídeos Tutoriais"
      subtitle="Gerencie vídeos explicativos da plataforma"
      icon={<FaVideo className="text-3xl text-white" />}
      currentPage="tutoriais"
    >
      <div className="space-y-8">
        {/* Upload Area */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-xl border-2 border-purple-500/30 p-6">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <FaUpload className="text-purple-400" />
            Fazer Upload de Novo Tutorial
          </h2>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">
                  Título do Tutorial *
                </label>
                <input
                  type="text"
                  value={newTutorial.titulo}
                  onChange={(e) => setNewTutorial({ ...newTutorial, titulo: e.target.value })}
                  placeholder="Ex: Como criar uma campanha"
                  className="w-full bg-gray-900 text-white px-4 py-3 rounded-lg border-2 border-purple-500/30 focus:border-purple-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">
                  Categoria
                </label>
                <input
                  type="text"
                  value={newTutorial.categoria}
                  onChange={(e) => setNewTutorial({ ...newTutorial, categoria: e.target.value })}
                  placeholder="Ex: Campanhas, Templates, API..."
                  className="w-full bg-gray-900 text-white px-4 py-3 rounded-lg border-2 border-purple-500/30 focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2">
                Descrição
              </label>
              <textarea
                value={newTutorial.descricao}
                onChange={(e) => setNewTutorial({ ...newTutorial, descricao: e.target.value })}
                placeholder="Descreva o conteúdo do vídeo..."
                rows={3}
                className="w-full bg-gray-900 text-white px-4 py-3 rounded-lg border-2 border-purple-500/30 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">
                  Ordem de Exibição
                </label>
                <input
                  type="number"
                  value={newTutorial.ordem}
                  onChange={(e) => setNewTutorial({ ...newTutorial, ordem: parseInt(e.target.value) || 0 })}
                  className="w-full bg-gray-900 text-white px-4 py-3 rounded-lg border-2 border-purple-500/30 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newTutorial.ativo}
                    onChange={(e) => setNewTutorial({ ...newTutorial, ativo: e.target.checked })}
                    className="w-5 h-5"
                  />
                  <span className="text-white font-bold">Ativo (visível para usuários)</span>
                </label>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleFileSelect}
                  disabled={uploading || !newTutorial.titulo.trim()}
                  className={`w-full px-6 py-3 rounded-lg font-bold text-white transition-all flex items-center justify-center gap-2 ${
                    uploading || !newTutorial.titulo.trim()
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                  }`}
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <FaUpload />
                      Selecionar Vídeo
                    </>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  accept="video/*"
                  className="hidden"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tutorials List */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-xl border-2 border-purple-500/30 p-6">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <FaVideo className="text-purple-400" />
            Tutoriais Cadastrados ({tutorials.length})
          </h2>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Carregando tutoriais...</p>
            </div>
          ) : tutorials.length === 0 ? (
            <div className="text-center py-12">
              <FaVideo className="mx-auto text-gray-600 mb-4" size={64} />
              <p className="text-gray-400">Nenhum tutorial cadastrado ainda</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tutorials.map((tutorial) => (
                <div
                  key={tutorial.id}
                  className={`bg-gray-900/70 rounded-lg p-6 border-2 transition-all ${
                    tutorial.ativo ? 'border-green-500/30' : 'border-gray-500/30'
                  }`}
                >
                  {editingId === tutorial.id ? (
                    // Modo de Edição
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-gray-300 mb-2">Título</label>
                          <input
                            type="text"
                            value={editData.titulo}
                            onChange={(e) => setEditData({ ...editData, titulo: e.target.value })}
                            className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg border border-purple-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-gray-300 mb-2">Categoria</label>
                          <input
                            type="text"
                            value={editData.categoria}
                            onChange={(e) => setEditData({ ...editData, categoria: e.target.value })}
                            className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg border border-purple-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-gray-300 mb-2">Descrição</label>
                        <textarea
                          value={editData.descricao}
                          onChange={(e) => setEditData({ ...editData, descricao: e.target.value })}
                          rows={2}
                          className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg border border-purple-500 focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-gray-300 mb-2">Ordem</label>
                          <input
                            type="number"
                            value={editData.ordem}
                            onChange={(e) => setEditData({ ...editData, ordem: parseInt(e.target.value) || 0 })}
                            className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg border border-purple-500 focus:outline-none"
                          />
                        </div>
                        <div className="flex items-end">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={editData.ativo}
                              onChange={(e) => setEditData({ ...editData, ativo: e.target.checked })}
                              className="w-4 h-4"
                            />
                            <span className="text-white text-sm">Ativo</span>
                          </label>
                        </div>
                        <button
                          onClick={() => handleEditSave(tutorial.id)}
                          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2"
                        >
                          <FaCheck /> Salvar
                        </button>
                        <button
                          onClick={handleEditCancel}
                          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2"
                        >
                          <FaTimes /> Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Modo de Visualização
                    <div className="flex flex-col md:flex-row gap-6">
                      {/* Preview do Vídeo */}
                      <div className="w-full md:w-64 flex-shrink-0">
                        <div className="w-full h-40 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                          <FaVideo className="text-white text-5xl opacity-60" />
                        </div>
                      </div>

                      {/* Informações */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                              {tutorial.titulo}
                              {tutorial.ativo ? (
                                <span className="text-xs px-2 py-1 bg-green-500 text-white rounded-full">ATIVO</span>
                              ) : (
                                <span className="text-xs px-2 py-1 bg-gray-500 text-white rounded-full">INATIVO</span>
                              )}
                            </h3>
                            {tutorial.categoria && (
                              <span className="text-sm text-purple-400">📁 {tutorial.categoria}</span>
                            )}
                          </div>
                        </div>

                        {tutorial.descricao && (
                          <p className="text-gray-400 text-sm">{tutorial.descricao}</p>
                        )}

                        <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                          <span>📦 {formatFileSize(tutorial.file_size)}</span>
                          <span>📅 {format(new Date(tutorial.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
                          <span>🔢 Ordem: {tutorial.ordem}</span>
                        </div>

                        {/* Ações */}
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => toggleAtivo(tutorial.id, tutorial.ativo)}
                            className={`px-4 py-2 rounded-lg font-bold text-white transition-all flex items-center gap-2 ${
                              tutorial.ativo
                                ? 'bg-yellow-500 hover:bg-yellow-600'
                                : 'bg-green-500 hover:bg-green-600'
                            }`}
                          >
                            {tutorial.ativo ? <FaEyeSlash /> : <FaEye />}
                            {tutorial.ativo ? 'Desativar' : 'Ativar'}
                          </button>
                          <button
                            onClick={() => handleEditStart(tutorial)}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold transition-all flex items-center gap-2"
                          >
                            <FaEdit /> Editar
                          </button>
                          <button
                            onClick={() => handleDelete(tutorial.id, tutorial.titulo)}
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-all flex items-center gap-2"
                          >
                            <FaTrash /> Deletar
                          </button>
                          <button
                            onClick={() => handleTutorialClick(tutorial)}
                            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-bold transition-all flex items-center gap-2"
                          >
                            <FaPlayCircle /> Assistir
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Vídeo */}
      {selectedTutorial && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-5xl bg-gray-900 rounded-xl overflow-hidden">
            {/* Header do Modal */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">{selectedTutorial.titulo}</h2>
                {selectedTutorial.categoria && (
                  <span className="text-sm text-white/80">📁 {selectedTutorial.categoria}</span>
                )}
              </div>
              <button
                onClick={handleCloseModal}
                className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg transition-all"
              >
                <FaTimes size={24} />
              </button>
            </div>

            {/* Vídeo */}
            <div className="relative bg-black" style={{ paddingBottom: '56.25%' }}>
              {videoUrl ? (
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  className="absolute inset-0 w-full h-full"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-white text-xl">⏳ Carregando vídeo...</p>
                </div>
              )}
            </div>

            {/* Descrição */}
            {selectedTutorial.descricao && (
              <div className="p-6 bg-gray-800">
                <h3 className="text-lg font-bold text-white mb-2">Sobre este tutorial</h3>
                <p className="text-gray-300">{selectedTutorial.descricao}</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* 🔔 NOTIFICAÇÕES TOAST */}
      <ToastContainer notifications={notifications} onRemove={removeNotification} />
    </AdminLayout>
  );
}

