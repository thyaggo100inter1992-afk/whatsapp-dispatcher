import { useEffect } from 'react';
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaTimes, FaExclamationTriangle } from 'react-icons/fa';

interface ToastProps {
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
  duration?: number;
  onClose: () => void;
}

export default function Toast({ type, title, message, duration = 4000, onClose }: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const styles = {
    success: {
      bg: 'from-emerald-500/20 to-emerald-600/10',
      border: 'border-emerald-500',
      icon: <FaCheckCircle className="text-emerald-400 text-2xl" />,
      iconBg: 'bg-emerald-500/20',
    },
    error: {
      bg: 'from-red-500/20 to-red-600/10',
      border: 'border-red-500',
      icon: <FaExclamationCircle className="text-red-400 text-2xl" />,
      iconBg: 'bg-red-500/20',
    },
    warning: {
      bg: 'from-yellow-500/20 to-yellow-600/10',
      border: 'border-yellow-500',
      icon: <FaExclamationTriangle className="text-yellow-400 text-2xl" />,
      iconBg: 'bg-yellow-500/20',
    },
    info: {
      bg: 'from-blue-500/20 to-blue-600/10',
      border: 'border-blue-500',
      icon: <FaInfoCircle className="text-blue-400 text-2xl" />,
      iconBg: 'bg-blue-500/20',
    },
  };

  const style = styles[type];

  return (
    <div
      className={`fixed top-4 right-4 z-[9999] max-w-md w-full animate-slide-in-right`}
      style={{
        animation: 'slideInRight 0.3s ease-out',
      }}
    >
      <div className={`bg-gradient-to-br ${style.bg} backdrop-blur-sm border-2 ${style.border} rounded-2xl p-4 shadow-2xl`}>
        <div className="flex items-start gap-4">
          <div className={`${style.iconBg} rounded-xl p-3 flex-shrink-0`}>
            {style.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-white font-bold text-lg mb-1">{title}</h4>
            {message && (
              <p className="text-gray-300 text-sm whitespace-pre-line">{message}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
          >
            <FaTimes />
          </button>
        </div>
      </div>
    </div>
  );
}

