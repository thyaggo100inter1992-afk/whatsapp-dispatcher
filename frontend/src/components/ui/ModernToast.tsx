import { useEffect, useState } from 'react';
import { 
  FaCheckCircle, 
  FaExclamationCircle, 
  FaInfoCircle, 
  FaTimes, 
  FaExclamationTriangle 
} from 'react-icons/fa';

interface ModernToastProps {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
  duration?: number;
  onClose: (id: string) => void;
}

export default function ModernToast({ 
  id, 
  type, 
  title, 
  message, 
  duration = 5000, 
  onClose 
}: ModernToastProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (duration > 0) {
      // Progress bar animation
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev - (100 / (duration / 50));
          return newProgress < 0 ? 0 : newProgress;
        });
      }, 50);

      // Auto close timer
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => {
        clearTimeout(timer);
        clearInterval(progressInterval);
      };
    }
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose(id);
    }, 300);
  };

  const styles = {
    success: {
      gradient: 'from-emerald-500/30 via-emerald-600/20 to-transparent',
      border: 'border-emerald-500/60',
      glow: 'shadow-emerald-500/50',
      icon: <FaCheckCircle className="text-emerald-400 text-2xl drop-shadow-lg" />,
      iconBg: 'bg-gradient-to-br from-emerald-500/30 to-emerald-600/20',
      progress: 'bg-gradient-to-r from-emerald-400 to-emerald-500',
    },
    error: {
      gradient: 'from-red-500/30 via-red-600/20 to-transparent',
      border: 'border-red-500/60',
      glow: 'shadow-red-500/50',
      icon: <FaExclamationCircle className="text-red-400 text-2xl drop-shadow-lg" />,
      iconBg: 'bg-gradient-to-br from-red-500/30 to-red-600/20',
      progress: 'bg-gradient-to-r from-red-400 to-red-500',
    },
    warning: {
      gradient: 'from-yellow-500/30 via-yellow-600/20 to-transparent',
      border: 'border-yellow-500/60',
      glow: 'shadow-yellow-500/50',
      icon: <FaExclamationTriangle className="text-yellow-400 text-2xl drop-shadow-lg" />,
      iconBg: 'bg-gradient-to-br from-yellow-500/30 to-yellow-600/20',
      progress: 'bg-gradient-to-r from-yellow-400 to-yellow-500',
    },
    info: {
      gradient: 'from-blue-500/30 via-blue-600/20 to-transparent',
      border: 'border-blue-500/60',
      glow: 'shadow-blue-500/50',
      icon: <FaInfoCircle className="text-blue-400 text-2xl drop-shadow-lg" />,
      iconBg: 'bg-gradient-to-br from-blue-500/30 to-blue-600/20',
      progress: 'bg-gradient-to-r from-blue-400 to-blue-500',
    },
  };

  const style = styles[type];

  return (
    <div
      className={`
        relative overflow-hidden
        w-full max-w-md
        bg-gradient-to-br ${style.gradient}
        backdrop-blur-xl
        border-2 ${style.border}
        rounded-2xl
        shadow-2xl ${style.glow}
        transform transition-all duration-300 ease-out
        ${isExiting ? 'animate-toast-exit' : 'animate-toast-enter'}
      `}
    >
      {/* Content */}
      <div className="relative z-10 p-4">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={`
            ${style.iconBg} 
            rounded-xl p-3 
            flex-shrink-0
            backdrop-blur-sm
            shadow-lg
            animate-icon-bounce
          `}>
            {style.icon}
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0 pt-1">
            <h4 className="text-white font-bold text-base mb-1 drop-shadow-md">
              {title}
            </h4>
            {message && (
              <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-line">
                {message}
              </p>
            )}
          </div>

          {/* Close Button */}
          <button
            onClick={handleClose}
            className="
              text-gray-400 hover:text-white 
              transition-all duration-200
              flex-shrink-0
              p-1 rounded-lg
              hover:bg-white/10
              active:scale-95
            "
            aria-label="Fechar notificação"
          >
            <FaTimes className="text-lg" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
          <div
            className={`h-full ${style.progress} transition-all duration-50 ease-linear`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
    </div>
  );
}


