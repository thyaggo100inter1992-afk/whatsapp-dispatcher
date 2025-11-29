import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FaCloudUploadAlt, FaTrash, FaFile, FaImage, FaVideo, FaMusic } from 'react-icons/fa';
import { uploadAPI } from '@/services/api';

// Configuração da URL base da API
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '');

interface MediaUploadProps {
  onUploadSuccess: (data: any) => void;
  acceptedTypes?: string;
  maxSize?: number;
}

export default function MediaUpload({
  onUploadSuccess,
  acceptedTypes = 'image/*,video/*,audio/*,application/pdf',
  maxSize = 10485760, // 10MB
}: MediaUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file'); // Padrão Upload de Arquivo
  const [mediaUrl, setMediaUrl] = useState('');

  const handleUrlSubmit = () => {
    if (!mediaUrl.trim()) {
      setError('Digite uma URL válida');
      return;
    }

    // Detectar tipo de mídia pela extensão
    const url = mediaUrl.toLowerCase();
    let mimeType = 'image/jpeg';
    
    if (url.includes('.png')) mimeType = 'image/png';
    else if (url.includes('.gif')) mimeType = 'image/gif';
    else if (url.includes('.mp4')) mimeType = 'video/mp4';
    else if (url.includes('.pdf')) mimeType = 'application/pdf';
    else if (url.includes('.mp3')) mimeType = 'audio/mpeg';

    const data = {
      url: mediaUrl,
      mimetype: mimeType, // ✅ CORRIGIDO: Usar "mimetype" para consistência com backend
      filename: mediaUrl.split('/').pop() || 'media',
    };

    setUploadedFile(data);
    onUploadSuccess(data);
    setError('');
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      setError('');
      setUploading(true);

      try {
        const response = await uploadAPI.uploadMedia(file);
        const data = response.data; // ✅ Corrigido: backend retorna dados diretamente em response.data
        
        setUploadedFile(data);
        onUploadSuccess(data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Erro ao fazer upload');
      } finally {
        setUploading(false);
      }
    },
    [onUploadSuccess]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedTypes.split(',').reduce((acc, type) => ({ ...acc, [type.trim()]: [] }), {}),
    maxSize,
    multiple: false,
  });

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <FaImage className="text-blue-400" />;
    if (mimeType.startsWith('video/')) return <FaVideo className="text-purple-400" />;
    if (mimeType.startsWith('audio/')) return <FaMusic className="text-pink-400" />;
    return <FaFile className="text-gray-400" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleRemove = () => {
    setUploadedFile(null);
    setError('');
  };

  if (uploadedFile) {
    return (
      <div className="card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl">
              {getFileIcon(uploadedFile.mimetype)}
            </div>
            <div>
              <p className="font-medium text-white">{uploadedFile.originalname || uploadedFile.filename}</p>
              <p className="text-sm text-white/50">
                {uploadedFile.size ? formatFileSize(uploadedFile.size) : 'URL externa'}
              </p>
            </div>
          </div>
          <button
            onClick={handleRemove}
            className="btn btn-danger"
          >
            <FaTrash />
            Remover
          </button>
        </div>

        {uploadedFile.mimetype?.startsWith('image/') && (
          <div className="mt-4">
            <img
              src={uploadedFile.url.startsWith('http') ? uploadedFile.url : `${API_BASE_URL}${uploadedFile.url}`}
              alt="Preview"
              className="max-w-full h-auto max-h-64 rounded-lg"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Tabs para selecionar modo */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setUploadMode('file')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            uploadMode === 'file'
              ? 'bg-primary-500 text-white'
              : 'bg-white/5 text-white/60 hover:bg-white/10'
          }`}
        >
          📁 Upload de Arquivo
        </button>
        <button
          onClick={() => setUploadMode('url')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            uploadMode === 'url'
              ? 'bg-primary-500 text-white'
              : 'bg-white/5 text-white/60 hover:bg-white/10'
          }`}
        >
          🔗 URL da Mídia
        </button>
      </div>

      {/* Modo Upload */}
      {uploadMode === 'file' && (
        <div
          {...getRootProps()}
          className={`card cursor-pointer border-2 border-dashed transition-all ${
            isDragActive
              ? 'border-primary-500 bg-primary-500/10'
              : 'border-white/20 hover:border-primary-500/50'
          }`}
        >
          <input {...getInputProps()} />
          
          <div className="text-center py-8">
            <FaCloudUploadAlt className="text-6xl text-primary-500 mx-auto mb-4" />
            
            {uploading ? (
              <div>
                <p className="text-lg font-medium mb-2">Fazendo upload...</p>
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                  <div className="bg-primary-500 h-full animate-pulse" style={{ width: '70%' }} />
                </div>
              </div>
            ) : (
              <>
                <p className="text-lg font-medium mb-2">
                {isDragActive
                  ? 'Solte o arquivo aqui'
                  : 'Arraste o arquivo aqui ou clique para selecionar'}
              </p>
              <p className="text-sm text-white/50">
                Imagem, Vídeo, Áudio ou Documento (Máx: {formatFileSize(maxSize)})
              </p>
            </>
          )}
        </div>
        </div>
      )}

      {/* Modo URL */}
      {uploadMode === 'url' && (
        <div className="card">
          <h3 className="text-lg font-bold mb-4 text-primary-300">🔗 Inserir URL da Mídia</h3>
          <p className="text-white/60 text-sm mb-4">
            Cole aqui o link direto da sua imagem/vídeo/áudio (ex: https://exemplo.com/imagem.jpg)
          </p>
          <div className="flex gap-3">
            <input
              type="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="https://exemplo.com/media/imagem.jpg"
              className="input flex-1"
            />
            <button
              onClick={handleUrlSubmit}
              className="btn btn-primary"
            >
              ✅ Adicionar
            </button>
          </div>
          <p className="text-xs text-white/40 mt-2">
            💡 Formatos suportados: .jpg, .png, .gif, .mp4, .mp3, .pdf
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}

