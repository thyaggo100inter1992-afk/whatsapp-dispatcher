import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  FaCloudUploadAlt, FaImage, FaFilePdf, FaVideo,
  FaTrash, FaCopy, FaCheck, FaEdit, FaTimes, FaDownload, FaFile
} from 'react-icons/fa';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import AdminLayout from '@/components/admin/AdminLayout';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ToastContainer, useToast } from '@/components/Toast';

interface PublicFile {
  id: number;
  filename: string;
  original_filename: string;
  file_path: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  description: string | null;
  uploaded_by: number;
  uploaded_by_name: string;
  uploaded_by_email: string;
  created_at: string;
  updated_at: string;
}

export default function AdminArquivos() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { notifications, showNotification, removeNotification } = useToast();
  const [files, setFiles] = useState<PublicFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/files');
      setFiles(response.data.data);
      setError('');
    } catch (err: any) {
      console.error('Erro ao carregar arquivos:', err);
      if (err.response?.status === 403) {
        setError('Acesso negado. Apenas super administradores podem acessar esta página.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    signOut();
    router.push('/login');
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await uploadFile(e.target.files[0]);
    }
  };

  const uploadFile = async (file: File) => {
    try {
      setUploading(true);

      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/admin/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        showNotification('✅ Arquivo enviado!', 'success');
        loadFiles();
      }
    } catch (err: any) {
      console.error('Erro ao fazer upload:', err);
      showNotification('❌ Erro ao enviar arquivo', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Tem certeza que deseja deletar "${name}"?`)) return;

    try {
      await api.delete(`/admin/files/${id}`);
      showNotification('✅ Arquivo deletado!', 'success');
      loadFiles();
    } catch (err) {
      showNotification('❌ Erro ao deletar arquivo', 'error');
    }
  };

  const handleCopyLink = (url: string, id: number) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleEditStart = (file: PublicFile) => {
    setEditingId(file.id);
    setEditDescription(file.description || '');
  };

  const handleEditSave = async (id: number) => {
    try {
      await api.put(`/admin/files/${id}`, {
        description: editDescription
      });
      showNotification('✅ Descrição atualizada!', 'success');
      setEditingId(null);
      loadFiles();
    } catch (err) {
      showNotification('❌ Erro ao atualizar', 'error');
    }
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditDescription('');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <FaImage className="text-blue-400" size={24} />;
    } else if (mimeType.startsWith('video/')) {
      return <FaVideo className="text-purple-400" size={24} />;
    } else if (mimeType === 'application/pdf') {
      return <FaFilePdf className="text-red-400" size={24} />;
    }
    return <FaFile className="text-gray-400" size={24} />;
  };

  const getFileUrl = (file: PublicFile) => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api$/, '') || 'https://api.sistemasnettsistemas.com.br';
    return `${API_BASE}${file.file_url}`;
  };

  const getFilePreview = (file: PublicFile) => {
    const fileUrl = getFileUrl(file);
    
    if (file.mime_type.startsWith('image/')) {
      return (
        <img
          src={fileUrl}
          alt={file.original_filename}
          className="w-full h-48 object-cover rounded-t-lg"
        />
      );
    } else if (file.mime_type.startsWith('video/')) {
      return (
        <video
          src={fileUrl}
          className="w-full h-48 object-cover rounded-t-lg"
          controls={false}
        />
      );
    } else if (file.mime_type === 'application/pdf') {
      return (
        <div className="w-full h-48 bg-gradient-to-br from-red-500 to-red-700 rounded-t-lg flex items-center justify-center">
          <FaFilePdf size={64} className="text-white" />
        </div>
      );
    }
    return (
      <div className="w-full h-48 bg-gradient-to-br from-gray-600 to-gray-800 rounded-t-lg flex items-center justify-center">
        <FaFile size={64} className="text-white" />
      </div>
    );
  };

  return (
    <AdminLayout
      title="Arquivos Públicos"
      subtitle="Gerencie imagens, vídeos e PDFs"
      icon={<FaCloudUploadAlt className="text-3xl text-white" />}
      currentPage="arquivos"
    >
      <div>
        {/* Upload Area */}
        <div className="mb-8">
          <div
            className={`border-4 border-dashed rounded-xl p-12 text-center transition-all ${
              dragActive
                ? 'border-purple-400 bg-purple-500/20'
                : 'border-purple-500/30 bg-gray-800/50 hover:border-purple-400 hover:bg-purple-500/10'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              accept="image/*,video/*,application/pdf"
              className="hidden"
            />
            
            {uploading ? (
              <div className="animate-pulse">
                <FaCloudUploadAlt className="mx-auto text-purple-400 mb-4" size={64} />
                <p className="text-white text-xl font-bold">Enviando arquivo...</p>
              </div>
            ) : (
              <>
                <FaCloudUploadAlt className="mx-auto text-purple-400 mb-4" size={64} />
                <p className="text-white text-xl font-bold mb-2">Arraste arquivos aqui ou clique para selecionar</p>
                <p className="text-gray-400">Suporta: Imagens, Vídeos e PDFs</p>
              </>
            )}
          </div>
        </div>

        {/* Files Grid */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-xl border-2 border-purple-500/30 p-6">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <FaImage className="text-purple-400" />
            Arquivos ({files.length})
          </h2>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Carregando arquivos...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-12">
              <FaCloudUploadAlt className="mx-auto text-gray-600 mb-4" size={64} />
              <p className="text-gray-400">Nenhum arquivo enviado ainda</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {files.map((file) => (
                <div key={file.id} className="bg-gray-900/70 rounded-lg overflow-hidden border-2 border-purple-500/30 hover:border-purple-400 transition-all group">
                  {/* Preview */}
                  <div className="relative">
                    {getFilePreview(file)}
                    <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded-lg flex items-center gap-2">
                      {getFileIcon(file.mime_type)}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="text-white font-bold truncate mb-2" title={file.original_filename}>
                      {file.original_filename}
                    </h3>

                    {editingId === file.id ? (
                      <div className="mb-3">
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Descrição..."
                          className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg border border-purple-500 focus:outline-none mb-2"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditSave(file.id)}
                            className="flex-1 px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-bold transition-all"
                          >
                            <FaCheck />
                          </button>
                          <button
                            onClick={handleEditCancel}
                            className="flex-1 px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-bold transition-all"
                          >
                            <FaTimes />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {file.description && (
                          <p className="text-gray-400 text-sm mb-2 line-clamp-2">
                            {file.description}
                          </p>
                        )}
                      </>
                    )}

                    <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                      <span>{formatFileSize(file.file_size)}</span>
                      <span>{format(new Date(file.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleCopyLink(getFileUrl(file), file.id)}
                        className={`px-3 py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1 ${
                          copiedId === file.id
                            ? 'bg-green-500 text-white'
                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                        }`}
                        title="Copiar Link"
                      >
                        {copiedId === file.id ? <FaCheck /> : <FaCopy />}
                      </button>
                      <button
                        onClick={() => handleEditStart(file)}
                        className="px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-bold text-xs transition-all flex items-center justify-center"
                        title="Editar Descrição"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => handleDelete(file.id, file.original_filename)}
                        className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold text-xs transition-all flex items-center justify-center"
                        title="Deletar"
                      >
                        <FaTrash />
                      </button>
                    </div>

                    {/* Link Display */}
                    <div className="mt-3 p-2 bg-gray-800 rounded-lg">
                      <input
                        type="text"
                        value={getFileUrl(file)}
                        readOnly
                        className="w-full bg-transparent text-gray-400 text-xs outline-none select-all"
                        onClick={(e) => e.currentTarget.select()}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* 🔔 NOTIFICAÇÕES TOAST */}
      <ToastContainer notifications={notifications} onRemove={removeNotification} />
    </AdminLayout>
  );
}



