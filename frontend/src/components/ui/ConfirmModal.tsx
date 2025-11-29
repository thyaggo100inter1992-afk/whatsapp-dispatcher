import { FaCheckCircle, FaExclamationTriangle, FaInfoCircle, FaTimes } from 'react-icons/fa';
import { useEffect } from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'warning' | 'danger' | 'info' | 'success';
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  type = 'warning',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  // Close on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const styles = {
    warning: {
      icon: <FaExclamationTriangle className="text-6xl text-yellow-400 drop-shadow-lg" />,
      iconBg: 'bg-gradient-to-br from-yellow-500/20 to-yellow-600/10',
      confirmBtn: 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700',
      glow: 'shadow-yellow-500/30',
    },
    danger: {
      icon: <FaExclamationTriangle className="text-6xl text-red-400 drop-shadow-lg" />,
      iconBg: 'bg-gradient-to-br from-red-500/20 to-red-600/10',
      confirmBtn: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700',
      glow: 'shadow-red-500/30',
    },
    info: {
      icon: <FaInfoCircle className="text-6xl text-blue-400 drop-shadow-lg" />,
      iconBg: 'bg-gradient-to-br from-blue-500/20 to-blue-600/10',
      confirmBtn: 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
      glow: 'shadow-blue-500/30',
    },
    success: {
      icon: <FaCheckCircle className="text-6xl text-emerald-400 drop-shadow-lg" />,
      iconBg: 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10',
      confirmBtn: 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700',
      glow: 'shadow-emerald-500/30',
    },
  };

  const style = styles[type];

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md animate-scale-in">
        <div className={`
          bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900
          border-2 border-white/20
          rounded-3xl
          shadow-2xl ${style.glow}
          overflow-hidden
        `}>
          {/* Icon Container */}
          <div className={`${style.iconBg} p-8 flex justify-center`}>
            <div className="animate-icon-bounce">
              {style.icon}
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <h3 className="text-2xl font-bold text-white mb-3 text-center">
              {title}
            </h3>
            <div className="text-gray-300 text-center leading-relaxed whitespace-pre-line">
              {message}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 p-6 pt-0">
            <button
              onClick={onCancel}
              className="
                flex-1 px-6 py-3 
                bg-gray-700/50 hover:bg-gray-700
                text-white font-semibold
                rounded-xl
                border border-gray-600
                transition-all duration-200
                active:scale-95
                hover:shadow-lg
              "
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`
                flex-1 px-6 py-3
                ${style.confirmBtn}
                text-white font-semibold
                rounded-xl
                transition-all duration-200
                active:scale-95
                shadow-lg hover:shadow-xl
              `}
            >
              {confirmText}
            </button>
          </div>

          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full blur-2xl" />
        </div>
      </div>
    </div>
  );
}
