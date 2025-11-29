import React, { useState, useRef } from 'react';
import { FaImage, FaVideo, FaMusic, FaFilePdf, FaTrash, FaPlay, FaPause, FaPlus, FaCheckCircle, FaFile, FaUpload } from 'react-icons/fa';
import styles from '@/styles/AudioRecorder.module.css';

interface UploadedFile {
  id: string;
  file: File;
  type: 'image' | 'video' | 'audio' | 'document';
  previewUrl: string;
  name: string;
  size: number;
  uploadedData?: any;
}

interface MultiMediaUploaderProps {
  onFilesChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
}

export default function MultiMediaUploader({ 
  onFilesChange, 
  maxFiles = 10,
  maxSizeMB = 16 
}: MultiMediaUploaderProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [playbackStates, setPlaybackStates] = useState<Record<string, { currentTime: number; duration: number; isPlaying: boolean }>>({});
  const mediaRefs = useRef<Record<string, HTMLMediaElement>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileType = (mimeType: string): 'image' | 'video' | 'audio' | 'document' => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image': return <FaImage className="text-3xl text-blue-400" />;
      case 'video': return <FaVideo className="text-3xl text-purple-400" />;
      case 'audio': return <FaMusic className="text-3xl text-green-400" />;
      case 'document': return <FaFilePdf className="text-3xl text-red-400" />;
      default: return <FaFile className="text-3xl text-gray-400" />;
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Validar quantidade
    if (uploadedFiles.length + files.length > maxFiles) {
      alert(`❌ Máximo de ${maxFiles} arquivos permitidos`);
      return;
    }

    files.forEach(file => {
      // Validar tamanho
      if (file.size > maxSizeMB * 1024 * 1024) {
        alert(`❌ Arquivo "${file.name}" excede o tamanho máximo de ${maxSizeMB}MB`);
        return;
      }

      const fileType = getFileType(file.type);
      const previewUrl = URL.createObjectURL(file);

      const newFile: UploadedFile = {
        id: Date.now().toString() + Math.random(),
        file,
        type: fileType,
        previewUrl,
        name: file.name,
        size: file.size
      };

      const updatedFiles = [...uploadedFiles, newFile];
      setUploadedFiles(updatedFiles);
      onFilesChange(updatedFiles);
    });

    // Limpar input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (id: string) => {
    const file = uploadedFiles.find(f => f.id === id);
    if (file) {
      URL.revokeObjectURL(file.previewUrl);
    }
    const updatedFiles = uploadedFiles.filter(f => f.id !== id);
    setUploadedFiles(updatedFiles);
    onFilesChange(updatedFiles);
    
    // Limpar estado de reprodução
    const newPlaybackStates = { ...playbackStates };
    delete newPlaybackStates[id];
    setPlaybackStates(newPlaybackStates);
  };

  const togglePlayPause = (id: string) => {
    const mediaElement = mediaRefs.current[id];
    if (!mediaElement) return;

    const currentState = playbackStates[id];
    
    if (currentState?.isPlaying) {
      mediaElement.pause();
      setPlaybackStates({
        ...playbackStates,
        [id]: { ...currentState, isPlaying: false }
      });
    } else {
      // Pausar todos os outros
      Object.keys(mediaRefs.current).forEach(otherId => {
        if (otherId !== id && mediaRefs.current[otherId]) {
          mediaRefs.current[otherId].pause();
          if (playbackStates[otherId]) {
            setPlaybackStates(prev => ({
              ...prev,
              [otherId]: { ...prev[otherId], isPlaying: false }
            }));
          }
        }
      });

      mediaElement.play();
      setPlaybackStates({
        ...playbackStates,
        [id]: { ...currentState, isPlaying: true }
      });
    }
  };

  const handleTimeUpdate = (id: string) => {
    const mediaElement = mediaRefs.current[id];
    if (mediaElement) {
      setPlaybackStates(prev => ({
        ...prev,
        [id]: {
          ...prev[id],
          currentTime: mediaElement.currentTime,
          duration: mediaElement.duration
        }
      }));
    }
  };

  const handleSeek = (id: string, time: number) => {
    const mediaElement = mediaRefs.current[id];
    if (mediaElement) {
      mediaElement.currentTime = time;
      setPlaybackStates(prev => ({
        ...prev,
        [id]: { ...prev[id], currentTime: time }
      }));
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatSize = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  const renderFilePreview = (file: UploadedFile, index: number) => {
    const state = playbackStates[file.id] || { currentTime: 0, duration: 0, isPlaying: false };

    return (
      <div key={file.id} className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-2 border-blue-500/40 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="bg-blue-500/20 rounded-full p-3">
                {getFileIcon(file.type)}
              </div>
              <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1">
                <FaCheckCircle className="text-white text-xs" />
              </div>
            </div>
            <div>
              <p className="font-bold text-white text-lg">
                {file.type === 'image' && '🖼️ Imagem'}
                {file.type === 'video' && '🎥 Vídeo'}
                {file.type === 'audio' && '🎵 Áudio'}
                {file.type === 'document' && '📄 Documento'}
                {' #'}{index + 1}
              </p>
              <p className="text-sm text-white/60 truncate max-w-xs">
                {file.name} · {formatSize(file.size)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => removeFile(file.id)}
            className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-lg font-bold transition-all flex items-center gap-2"
          >
            <FaTrash className="text-sm" /> Remover
          </button>
        </div>

        {/* PREVIEW DE IMAGEM */}
        {file.type === 'image' && (
          <div className="bg-dark-700/50 rounded-xl p-4">
            <img
              src={file.previewUrl}
              alt={file.name}
              className="max-w-full h-auto max-h-96 rounded-lg mx-auto object-contain"
            />
          </div>
        )}

        {/* PLAYER DE VÍDEO */}
        {file.type === 'video' && (
          <div className="bg-dark-700/50 rounded-xl p-4 space-y-3">
            <video
              ref={(el) => {
                if (el) mediaRefs.current[file.id] = el;
              }}
              src={file.previewUrl}
              onTimeUpdate={() => handleTimeUpdate(file.id)}
              onLoadedMetadata={() => {
                const videoElement = mediaRefs.current[file.id] as HTMLVideoElement;
                if (videoElement) {
                  setPlaybackStates(prev => ({
                    ...prev,
                    [file.id]: {
                      currentTime: 0,
                      duration: videoElement.duration,
                      isPlaying: false
                    }
                  }));
                }
              }}
              onEnded={() => {
                setPlaybackStates(prev => ({
                  ...prev,
                  [file.id]: { ...prev[file.id], isPlaying: false }
                }));
              }}
              className="w-full max-h-80 rounded-lg bg-black"
              controls
            />
            <div className="text-center text-sm text-white/60">
              Duração: {formatTime(state.duration)}
            </div>
          </div>
        )}

        {/* PLAYER DE ÁUDIO */}
        {file.type === 'audio' && (
          <div className="bg-dark-700/50 rounded-xl p-4 space-y-3">
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => togglePlayPause(file.id)}
                className={`w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-full flex items-center justify-center shadow-lg shadow-green-500/30 transition-all transform hover:scale-105 ${styles.playButton}`}
              >
                {state.isPlaying ? <FaPause className="text-2xl ml-0" /> : <FaPlay className="text-2xl ml-1" />}
              </button>
            </div>

            <div className="space-y-1">
              <input
                type="range"
                min="0"
                max={state.duration || 0}
                value={state.currentTime || 0}
                onChange={(e) => handleSeek(file.id, parseFloat(e.target.value))}
                className={`${styles.audioSlider} w-full`}
                style={{
                  background: `linear-gradient(to right, #10b981 0%, #10b981 ${((state.currentTime || 0) / (state.duration || 1)) * 100}%, rgba(255,255,255,0.2) ${((state.currentTime || 0) / (state.duration || 1)) * 100}%, rgba(255,255,255,0.2) 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-white/60 font-mono">
                <span>{formatTime(state.currentTime || 0)}</span>
                <span>{formatTime(state.duration || 0)}</span>
              </div>
            </div>

            <div className="text-center text-sm">
              {state.isPlaying ? (
                <p className="text-green-300 font-bold animate-pulse">▶️ Reproduzindo...</p>
              ) : state.currentTime > 0 && state.currentTime < state.duration ? (
                <p className="text-yellow-300 font-bold">⏸️ Pausado</p>
              ) : state.currentTime >= state.duration && state.duration > 0 ? (
                <p className="text-green-300 font-bold">✅ Concluído</p>
              ) : (
                <p className="text-white/60">Clique para reproduzir</p>
              )}
            </div>

            <audio
              ref={(el) => {
                if (el) mediaRefs.current[file.id] = el;
              }}
              src={file.previewUrl}
              onTimeUpdate={() => handleTimeUpdate(file.id)}
              onLoadedMetadata={() => {
                const audioElement = mediaRefs.current[file.id] as HTMLAudioElement;
                if (audioElement) {
                  setPlaybackStates(prev => ({
                    ...prev,
                    [file.id]: {
                      currentTime: 0,
                      duration: audioElement.duration,
                      isPlaying: false
                    }
                  }));
                }
              }}
              onEnded={() => {
                setPlaybackStates(prev => ({
                  ...prev,
                  [file.id]: { ...prev[file.id], isPlaying: false }
                }));
              }}
              className="hidden"
            />
          </div>
        )}

        {/* PREVIEW DE DOCUMENTO */}
        {file.type === 'document' && (
          <div className="bg-dark-700/50 rounded-xl p-6 text-center">
            <FaFilePdf className="text-6xl text-red-400 mx-auto mb-3" />
            <p className="text-white font-bold">{file.name}</p>
            <p className="text-white/60 text-sm">Documento PDF pronto para envio</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Lista de Arquivos */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-4">
          <p className="text-white font-bold text-lg flex items-center gap-2">
            📎 Arquivos Selecionados ({uploadedFiles.length}/{maxFiles})
          </p>
          
          {uploadedFiles.map((file, index) => renderFilePreview(file, index))}
        </div>
      )}

      {/* Botão de Upload */}
      {uploadedFiles.length < maxFiles && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            id="multi-media-upload"
            accept="image/*,video/*,audio/*,application/pdf"
            onChange={handleFileSelect}
            multiple
            className="hidden"
          />
          <label
            htmlFor="multi-media-upload"
            className="block w-full px-6 py-8 bg-dark-700/80 border-2 border-dashed border-blue-500/40 rounded-xl hover:border-blue-500 hover:bg-blue-500/5 transition-all cursor-pointer"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="bg-blue-500/20 rounded-full p-4">
                <FaUpload className="text-5xl text-blue-400" />
              </div>
              <p className="text-white text-lg font-bold">
                {uploadedFiles.length === 0 ? '📎 Selecionar Arquivos' : '📎 Adicionar Mais Arquivos'}
              </p>
              <p className="text-white/60 text-sm text-center">
                📷 Imagens · 🎥 Vídeos · 🎵 Áudios · 📄 PDFs<br />
                Clique ou arraste arquivos (Máx: {maxSizeMB}MB cada)
              </p>
              {uploadedFiles.length > 0 && (
                <p className="text-blue-300 text-xs font-bold">
                  ✅ {uploadedFiles.length} arquivo(s) já selecionado(s)
                </p>
              )}
            </div>
          </label>
        </>
      )}

      {uploadedFiles.length >= maxFiles && (
        <div className="bg-yellow-500/10 border-2 border-yellow-500/40 rounded-xl p-4 text-center">
          <p className="text-yellow-300 font-bold">
            ⚠️ Limite de {maxFiles} arquivos atingido
          </p>
          <p className="text-white/60 text-sm mt-1">
            Remova algum arquivo para adicionar mais
          </p>
        </div>
      )}
    </div>
  );
}










