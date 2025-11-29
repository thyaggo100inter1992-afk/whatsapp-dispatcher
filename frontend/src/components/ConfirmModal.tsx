import React from 'react';
import { FaExclamationTriangle, FaCheckCircle, FaInfoCircle, FaTimes } from 'react-icons/fa';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  type?: 'warning' | 'danger' | 'success' | 'info';
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  showCancel?: boolean;
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
  showCancel = true,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case 'danger':
        return {
          icon: FaExclamationTriangle,
          iconBg: 'bg-red-500/20',
          iconColor: 'text-red-400',
          headerBg: 'from-red-600/30 to-red-700/20',
          borderColor: 'border-red-500/40',
          confirmBg: 'from-red-500 to-red-600 hover:from-red-600 hover:to-red-700',
          confirmShadow: 'shadow-red-500/40',
        };
      case 'success':
        return {
          icon: FaCheckCircle,
          iconBg: 'bg-green-500/20',
          iconColor: 'text-green-400',
          headerBg: 'from-green-600/30 to-green-700/20',
          borderColor: 'border-green-500/40',
          confirmBg: 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700',
          confirmShadow: 'shadow-green-500/40',
        };
      case 'info':
        return {
          icon: FaInfoCircle,
          iconBg: 'bg-blue-500/20',
          iconColor: 'text-blue-400',
          headerBg: 'from-blue-600/30 to-blue-700/20',
          borderColor: 'border-blue-500/40',
          confirmBg: 'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
          confirmShadow: 'shadow-blue-500/40',
        };
      default: // warning
        return {
          icon: FaExclamationTriangle,
          iconBg: 'bg-yellow-500/20',
          iconColor: 'text-yellow-400',
          headerBg: 'from-yellow-600/30 to-yellow-700/20',
          borderColor: 'border-yellow-500/40',
          confirmBg: 'from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700',
          confirmShadow: 'shadow-yellow-500/40',
        };
    }
  };

  const styles = getTypeStyles();
  const Icon = styles.icon;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fadeIn">
      <div className="bg-dark-800/95 backdrop-blur-xl border-2 border-white/10 rounded-2xl shadow-2xl w-full max-w-md animate-scaleIn">
        {/* Header */}
        <div className={`bg-gradient-to-r ${styles.headerBg} backdrop-blur-xl border-b-2 ${styles.borderColor} p-6 rounded-t-2xl`}>
          <div className="flex items-start gap-4">
            <div className={`${styles.iconBg} p-3 rounded-xl`}>
              <Icon className={`text-3xl ${styles.iconColor}`} />
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-black text-white mb-1">
                {title}
              </h3>
            </div>
            {showCancel && (
              <button
                onClick={onCancel}
                className="text-white/60 hover:text-white transition-colors"
              >
                <FaTimes className="text-xl" />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="text-white/90 text-base leading-relaxed">
            {typeof message === 'string' ? (
              <p className="whitespace-pre-line">{message}</p>
            ) : (
              message
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 flex gap-3 justify-end">
          {showCancel && (
            <button
              onClick={onCancel}
              className="px-6 py-3 bg-dark-700 hover:bg-dark-600 text-white font-bold rounded-xl transition-all duration-200 border-2 border-white/20"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`px-6 py-3 bg-gradient-to-r ${styles.confirmBg} text-white font-bold rounded-xl transition-all duration-200 shadow-lg ${styles.confirmShadow}`}
          >
            {confirmText}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes scaleIn {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}


