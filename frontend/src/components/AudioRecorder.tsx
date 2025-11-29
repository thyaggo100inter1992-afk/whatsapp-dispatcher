import React, { useState, useRef, useEffect } from 'react';
import { FaMicrophone, FaStop, FaPause, FaPlay, FaTrash, FaDownload, FaCheckCircle } from 'react-icons/fa';
import styles from '@/styles/AudioRecorder.module.css';

interface AudioRecorderProps {
  onAudioReady: (audioBlob: Blob, audioUrl: string) => void;
  onRemove: () => void;
  initialAudioUrl?: string;
  initialRecordingTime?: number;
}

export default function AudioRecorder({ onAudioReady, onRemove, initialAudioUrl, initialRecordingTime }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<string | null>(initialAudioUrl || null);
  const [recordingTime, setRecordingTime] = useState(initialRecordingTime || 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Inicializar com áudio existente se fornecido
  useEffect(() => {
    if (initialAudioUrl) {
      setRecordedAudio(initialAudioUrl);
    }
    if (initialRecordingTime) {
      setRecordingTime(initialRecordingTime);
    }
  }, [initialAudioUrl, initialRecordingTime]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

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
        setRecordedAudio(audioUrl);
        onAudioReady(audioBlob, audioUrl);
        
        // Para o stream para liberar o microfone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);

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

  const handleRemove = () => {
    if (recordedAudio) {
      URL.revokeObjectURL(recordedAudio);
    }
    setRecordedAudio(null);
    setRecordingTime(0);
    chunksRef.current = [];
    onRemove();
  };

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Se já tem áudio gravado
  if (recordedAudio) {
    return (
      <div className="bg-gradient-to-br from-green-500/10 to-blue-500/10 border-2 border-green-500/40 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <FaMicrophone className="text-4xl text-green-400" />
              <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1">
                <FaCheckCircle className="text-white text-xs" />
              </div>
            </div>
            <div>
              <p className="font-bold text-white text-xl">✅ Áudio Pronto para Enviar</p>
              <p className="text-sm text-white/60">Duração: {formatTime(recordingTime)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-lg font-bold transition-all flex items-center gap-2"
          >
            <FaTrash /> Remover
          </button>
        </div>

        {/* PLAYER DE ÁUDIO COM CONTROLES */}
        <div className="bg-dark-700/50 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-center mb-3">
            <p className="text-blue-300 font-bold text-lg">
              🎧 Ouça o áudio antes de enviar:
            </p>
          </div>

          {/* Botão Play/Pause Grande */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={togglePlayPause}
              className={`w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-full flex items-center justify-center shadow-xl shadow-blue-500/50 transition-all transform hover:scale-105 ${styles.playButton}`}
            >
              {isPlaying ? <FaPause className="text-3xl ml-0" /> : <FaPlay className="text-3xl ml-1" />}
            </button>
          </div>

          {/* Barra de Progresso */}
          <div className="space-y-2">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className={`${styles.audioSlider} w-full`}
              style={{
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(currentTime / duration) * 100}%, rgba(255,255,255,0.2) ${(currentTime / duration) * 100}%, rgba(255,255,255,0.2) 100%)`
              }}
            />
            <div className="flex justify-between text-sm text-white/60 font-mono">
              <span>{formatTime(Math.floor(currentTime))}</span>
              <span>{formatTime(Math.floor(duration || recordingTime))}</span>
            </div>
          </div>

          {/* Status de Reprodução */}
          <div className="text-center">
            {isPlaying ? (
              <p className="text-blue-300 font-bold animate-pulse">
                ▶️ Reproduzindo...
              </p>
            ) : currentTime > 0 && currentTime < duration ? (
              <p className="text-yellow-300 font-bold">⏸️ Pausado</p>
            ) : currentTime >= duration && duration > 0 ? (
              <p className="text-green-300 font-bold">✅ Reprodução concluída</p>
            ) : (
              <p className="text-white/60">Pronto para reproduzir</p>
            )}
          </div>
        </div>

        <audio
          ref={audioRef}
          src={recordedAudio}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      </div>
    );
  }

  // Se está gravando
  if (isRecording) {
    return (
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
            <FaStop /> Parar Gravação
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
    );
  }

  // Botão inicial para começar a gravar
  return (
    <button
      type="button"
      onClick={startRecording}
      className="w-full px-6 py-8 bg-dark-700/80 border-2 border-dashed border-white/20 rounded-xl hover:border-red-500 hover:bg-red-500/5 transition-all flex flex-col items-center gap-3"
    >
      <FaMicrophone className="text-5xl text-red-400" />
      <p className="text-white text-lg font-bold">🎤 Gravar Nota de Voz</p>
      <p className="text-white/60 text-sm">
        Clique para começar a gravar pelo microfone
      </p>
    </button>
  );
}

