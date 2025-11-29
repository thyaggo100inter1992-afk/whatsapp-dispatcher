import React, { useState, useRef } from 'react';
import { FaMicrophone, FaStop, FaPause, FaPlay, FaTrash, FaCheckCircle, FaPlus } from 'react-icons/fa';
import styles from '@/styles/AudioRecorder.module.css';

interface RecordedAudio {
  id: string;
  blob: Blob;
  url: string;
  duration: number;
  uploadedData?: any;
}

interface MultiAudioRecorderProps {
  onAudiosChange: (audios: RecordedAudio[]) => void;
  onAudiosUpload: (audios: RecordedAudio[]) => void;
}

export default function MultiAudioRecorder({ onAudiosChange, onAudiosUpload }: MultiAudioRecorderProps) {
  const [recordedAudios, setRecordedAudios] = useState<RecordedAudio[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const [playbackStates, setPlaybackStates] = useState<Record<string, { currentTime: number; duration: number; isPlaying: boolean }>>({});

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/ogg; codecs=opus' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Criar objeto de áudio para obter duração
        const audio = new Audio(audioUrl);
        audio.addEventListener('loadedmetadata', () => {
          const newAudio: RecordedAudio = {
            id: Date.now().toString(),
            blob: audioBlob,
            url: audioUrl,
            duration: Math.floor(audio.duration),
          };
          
          const updatedAudios = [...recordedAudios, newAudio];
          setRecordedAudios(updatedAudios);
          onAudiosChange(updatedAudios);
        });
        
        // Para o stream para liberar o microfone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);

      // Iniciar timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Erro ao acessar microfone:', error);
      alert('❌ Erro ao acessar o microfone. Verifique as permissões do navegador.');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const removeAudio = (id: string) => {
    const audio = recordedAudios.find(a => a.id === id);
    if (audio) {
      URL.revokeObjectURL(audio.url);
    }
    const updatedAudios = recordedAudios.filter(a => a.id !== id);
    setRecordedAudios(updatedAudios);
    onAudiosChange(updatedAudios);
    
    // Limpar estado de reprodução
    const newPlaybackStates = { ...playbackStates };
    delete newPlaybackStates[id];
    setPlaybackStates(newPlaybackStates);
  };

  const togglePlayPause = (id: string) => {
    const audioElement = audioRefs.current[id];
    if (!audioElement) return;

    const currentState = playbackStates[id];
    
    if (currentState?.isPlaying) {
      audioElement.pause();
      setPlaybackStates({
        ...playbackStates,
        [id]: { ...currentState, isPlaying: false }
      });
    } else {
      // Pausar todos os outros áudios
      Object.keys(audioRefs.current).forEach(otherId => {
        if (otherId !== id && audioRefs.current[otherId]) {
          audioRefs.current[otherId].pause();
          if (playbackStates[otherId]) {
            setPlaybackStates(prev => ({
              ...prev,
              [otherId]: { ...prev[otherId], isPlaying: false }
            }));
          }
        }
      });

      audioElement.play();
      setCurrentPlayingId(id);
      setPlaybackStates({
        ...playbackStates,
        [id]: { ...currentState, isPlaying: true }
      });
    }
  };

  const handleTimeUpdate = (id: string) => {
    const audioElement = audioRefs.current[id];
    if (audioElement) {
      setPlaybackStates(prev => ({
        ...prev,
        [id]: {
          ...prev[id],
          currentTime: audioElement.currentTime,
          duration: audioElement.duration
        }
      }));
    }
  };

  const handleSeek = (id: string, time: number) => {
    const audioElement = audioRefs.current[id];
    if (audioElement) {
      audioElement.currentTime = time;
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

  return (
    <div className="space-y-4">
      {/* Lista de Áudios Gravados */}
      {recordedAudios.length > 0 && (
        <div className="space-y-4">
          <p className="text-white font-bold text-lg">
            🎵 Áudios Gravados ({recordedAudios.length})
          </p>
          
          {recordedAudios.map((audio, index) => {
            const state = playbackStates[audio.id] || { currentTime: 0, duration: audio.duration, isPlaying: false };
            
            return (
              <div key={audio.id} className="bg-gradient-to-br from-green-500/10 to-blue-500/10 border-2 border-green-500/40 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="bg-green-500/20 rounded-full p-3">
                        <FaMicrophone className="text-2xl text-green-400" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1">
                        <FaCheckCircle className="text-white text-xs" />
                      </div>
                    </div>
                    <div>
                      <p className="font-bold text-white text-lg">
                        Áudio #{index + 1}
                      </p>
                      <p className="text-sm text-white/60">
                        Duração: {formatTime(audio.duration)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAudio(audio.id)}
                    className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-lg font-bold transition-all flex items-center gap-2"
                  >
                    <FaTrash className="text-sm" /> Remover
                  </button>
                </div>

                {/* Player de Áudio */}
                <div className="bg-dark-700/50 rounded-xl p-4 space-y-3">
                  {/* Botão Play/Pause */}
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => togglePlayPause(audio.id)}
                      className={`w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 ${styles.playButton}`}
                    >
                      {state.isPlaying ? <FaPause className="text-2xl ml-0" /> : <FaPlay className="text-2xl ml-1" />}
                    </button>
                  </div>

                  {/* Barra de Progresso */}
                  <div className="space-y-1">
                    <input
                      type="range"
                      min="0"
                      max={state.duration || 0}
                      value={state.currentTime || 0}
                      onChange={(e) => handleSeek(audio.id, parseFloat(e.target.value))}
                      className={`${styles.audioSlider} w-full`}
                      style={{
                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((state.currentTime || 0) / (state.duration || 1)) * 100}%, rgba(255,255,255,0.2) ${((state.currentTime || 0) / (state.duration || 1)) * 100}%, rgba(255,255,255,0.2) 100%)`
                      }}
                    />
                    <div className="flex justify-between text-xs text-white/60 font-mono">
                      <span>{formatTime(state.currentTime || 0)}</span>
                      <span>{formatTime(state.duration || audio.duration)}</span>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="text-center text-sm">
                    {state.isPlaying ? (
                      <p className="text-blue-300 font-bold animate-pulse">▶️ Reproduzindo...</p>
                    ) : state.currentTime > 0 && state.currentTime < state.duration ? (
                      <p className="text-yellow-300 font-bold">⏸️ Pausado</p>
                    ) : state.currentTime >= state.duration && state.duration > 0 ? (
                      <p className="text-green-300 font-bold">✅ Concluído</p>
                    ) : (
                      <p className="text-white/60">Clique para reproduzir</p>
                    )}
                  </div>
                </div>

                {/* Audio element */}
                <audio
                  ref={(el) => {
                    if (el) audioRefs.current[audio.id] = el;
                  }}
                  src={audio.url}
                  onTimeUpdate={() => handleTimeUpdate(audio.id)}
                  onLoadedMetadata={() => {
                    const audioElement = audioRefs.current[audio.id];
                    if (audioElement) {
                      setPlaybackStates(prev => ({
                        ...prev,
                        [audio.id]: {
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
                      [audio.id]: { ...prev[audio.id], isPlaying: false }
                    }));
                    setCurrentPlayingId(null);
                  }}
                  className="hidden"
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Área de Gravação */}
      {!isRecording ? (
        <button
          type="button"
          onClick={startRecording}
          className="w-full px-6 py-8 bg-dark-700/80 border-2 border-dashed border-red-500/40 rounded-xl hover:border-red-500 hover:bg-red-500/5 transition-all flex flex-col items-center gap-3"
        >
          <div className="bg-red-500/20 rounded-full p-4">
            <FaMicrophone className="text-5xl text-red-400" />
          </div>
          <p className="text-white text-lg font-bold">
            {recordedAudios.length === 0 ? '🎤 Gravar Nota de Voz' : '🎤 Gravar Mais Uma Nota de Voz'}
          </p>
          <p className="text-white/60 text-sm">
            Clique para começar a gravar pelo microfone
          </p>
          {recordedAudios.length > 0 && (
            <p className="text-green-300 text-xs font-bold">
              ✅ {recordedAudios.length} áudio(s) já gravado(s)
            </p>
          )}
        </button>
      ) : (
        <div className="bg-dark-700/80 border-2 border-red-500/40 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`relative ${!isPaused ? 'animate-pulse' : ''}`}>
                <FaMicrophone className="text-4xl text-red-400" />
                {!isPaused && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
                )}
              </div>
              <div>
                <p className="font-bold text-white text-xl">
                  {isPaused ? '⏸️ Pausado' : '🔴 Gravando...'}
                </p>
                <p className="text-lg text-white/80 font-mono">{formatTime(recordingTime)}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={stopRecording}
              className="flex-1 px-6 py-4 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
            >
              <FaStop /> Parar e Salvar
            </button>

            {isPaused ? (
              <button
                type="button"
                onClick={resumeRecording}
                className="flex-1 px-6 py-4 bg-green-500/20 hover:bg-green-500/30 text-green-300 border-2 border-green-500/40 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
              >
                <FaPlay /> Retomar
              </button>
            ) : (
              <button
                type="button"
                onClick={pauseRecording}
                className="flex-1 px-6 py-4 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border-2 border-yellow-500/40 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
              >
                <FaPause /> Pausar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}










