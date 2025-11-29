import React from 'react';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ToastContainerProps {
  toasts: Toast[];
  onClose: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
  // Verificação de segurança: se toasts não existir ou não for array, retorna null
  if (!toasts || !Array.isArray(toasts)) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            animate-toast-enter backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl border-2
            transform transition-all duration-300 hover:scale-105
            ${toast.type === 'success' ? 'bg-gradient-to-r from-green-500 to-emerald-600 border-green-400' : ''}
            ${toast.type === 'error' ? 'bg-gradient-to-r from-red-500 to-rose-600 border-red-400' : ''}
            ${toast.type === 'info' ? 'bg-gradient-to-r from-blue-500 to-cyan-600 border-blue-400' : ''}
            ${toast.type === 'warning' ? 'bg-gradient-to-r from-yellow-500 to-orange-600 border-yellow-400' : ''}
          `}
        >
          <div className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                {toast.type === 'success' && (
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <span className="text-3xl">✅</span>
                  </div>
                )}
                {toast.type === 'error' && (
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <span className="text-3xl">❌</span>
                  </div>
                )}
                {toast.type === 'info' && (
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <span className="text-3xl">💡</span>
                  </div>
                )}
                {toast.type === 'warning' && (
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <span className="text-3xl">⚠️</span>
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-base leading-snug break-words">
                  {toast.message}
                </p>
              </div>
              
              <button
                onClick={() => onClose(toast.id)}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-all"
                title="Fechar"
              >
                <span className="text-xl font-bold">×</span>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;




