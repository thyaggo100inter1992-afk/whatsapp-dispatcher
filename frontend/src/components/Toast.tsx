import React, { useState, useEffect } from 'react';

export interface ToastNotification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export interface ToastProps {
  notifications: ToastNotification[];
  onRemove: (id: number) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ notifications, onRemove }) => {
  return (
    <div className="fixed top-20 right-6 z-[9999] space-y-3 max-w-md pointer-events-none">
      {notifications.map(notification => (
        <div
          key={notification.id}
          className={`
            pointer-events-auto
            animate-toast-enter
            backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl border-2
            transform transition-all duration-300 hover:scale-105 hover:shadow-3xl
            ${notification.type === 'success' ? 'bg-gradient-to-r from-green-500 to-emerald-600 border-green-400' : ''}
            ${notification.type === 'error' ? 'bg-gradient-to-r from-red-500 to-rose-600 border-red-400' : ''}
            ${notification.type === 'info' ? 'bg-gradient-to-r from-blue-500 to-cyan-600 border-blue-400' : ''}
            ${notification.type === 'warning' ? 'bg-gradient-to-r from-yellow-500 to-orange-600 border-yellow-400' : ''}
          `}
        >
          <div className="p-5">
            <div className="flex items-start gap-4">
              {/* Ícone animado */}
              <div className="flex-shrink-0">
                {notification.type === 'success' && (
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center animate-icon-bounce">
                    <span className="text-3xl">✅</span>
                  </div>
                )}
                {notification.type === 'error' && (
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center animate-icon-bounce">
                    <span className="text-3xl">❌</span>
                  </div>
                )}
                {notification.type === 'info' && (
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center animate-icon-bounce">
                    <span className="text-3xl">💡</span>
                  </div>
                )}
                {notification.type === 'warning' && (
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center animate-icon-bounce">
                    <span className="text-3xl">⚠️</span>
                  </div>
                )}
              </div>
              
              {/* Mensagem */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-base leading-snug break-words">
                  {notification.message}
                </p>
              </div>
              
              {/* Botão fechar */}
              <button
                onClick={() => onRemove(notification.id)}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-all"
                title="Fechar"
              >
                <span className="text-xl font-bold">×</span>
              </button>
            </div>
          </div>
          
          {/* Barra de progresso */}
          <div className="h-1 bg-white/30">
            <div 
              className="h-full bg-white animate-progress"
              style={{ animationDuration: '5s' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// Hook customizado para gerenciar notificações
export const useToast = () => {
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    
    // Remover automaticamente após 5 segundos
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return {
    notifications,
    showNotification,
    removeNotification
  };
};
