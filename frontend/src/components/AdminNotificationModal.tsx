import { useState, useEffect } from 'react';
import { FaTimes, FaInfoCircle, FaExclamationTriangle, FaExclamationCircle, FaCheckCircle, FaExternalLinkAlt } from 'react-icons/fa';
import api from '@/services/api';

interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'urgent' | 'success';
  link_url?: string;
  link_text?: string;
  icon_name?: string;
}

export default function AdminNotificationModal() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const response = await api.get('/notifications/active');
      const unreadNotifications = response.data.notifications || [];
      
      if (unreadNotifications.length > 0) {
        setNotifications(unreadNotifications);
        setIsVisible(true);
      }
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    }
  };

  const handleClose = async () => {
    if (notifications.length === 0) return;

    const currentNotification = notifications[currentIndex];

    try {
      // Marcar como lida
      await api.post(`/notifications/${currentNotification.id}/read`);

      // Se houver mais notificações, mostrar a próxima
      if (currentIndex < notifications.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        // Todas foram lidas
        setIsVisible(false);
        setNotifications([]);
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
      // Mesmo com erro, fechar o modal
      setIsVisible(false);
    }
  };

  const handleLinkClick = async () => {
    if (notifications.length === 0) return;

    const currentNotification = notifications[currentIndex];

    try {
      // Marcar como clicada
      await api.post(`/notifications/${currentNotification.id}/click`);
    } catch (error) {
      console.error('Erro ao registrar clique:', error);
    }
  };

  if (!isVisible || notifications.length === 0) {
    return null;
  }

  const currentNotification = notifications[currentIndex];

  const getTypeStyles = (type: string) => {
    const styles = {
      info: {
        bg: 'from-blue-500 to-blue-600',
        icon: FaInfoCircle,
        iconColor: 'text-blue-500',
        borderColor: 'border-blue-500'
      },
      warning: {
        bg: 'from-yellow-500 to-yellow-600',
        icon: FaExclamationTriangle,
        iconColor: 'text-yellow-500',
        borderColor: 'border-yellow-500'
      },
      urgent: {
        bg: 'from-red-500 to-red-600',
        icon: FaExclamationCircle,
        iconColor: 'text-red-500',
        borderColor: 'border-red-500'
      },
      success: {
        bg: 'from-green-500 to-green-600',
        icon: FaCheckCircle,
        iconColor: 'text-green-500',
        borderColor: 'border-green-500'
      }
    };

    return styles[type as keyof typeof styles] || styles.info;
  };

  const typeStyle = getTypeStyles(currentNotification.type);
  const Icon = typeStyle.icon;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9998] animate-fadeIn" />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full animate-slideUp overflow-hidden">
          {/* Header com gradiente */}
          <div className={`bg-gradient-to-r ${typeStyle.bg} p-6 relative`}>
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full p-2 transition-all"
              aria-label="Fechar"
            >
              <FaTimes className="text-xl" />
            </button>

            <div className="flex items-center gap-4">
              <div className="bg-white/20 backdrop-blur-md p-4 rounded-2xl">
                <Icon className="text-4xl text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-white mb-1">
                  {currentNotification.title}
                </h2>
                {notifications.length > 1 && (
                  <p className="text-white/80 text-sm">
                    Notificação {currentIndex + 1} de {notifications.length}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-8">
            <div 
              className="text-gray-700 text-lg leading-relaxed mb-6"
              dangerouslySetInnerHTML={{ __html: currentNotification.message }}
            />

            {/* Link/Botão */}
            {currentNotification.link_url && (
              <a
                href={currentNotification.link_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleLinkClick}
                className={`inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r ${typeStyle.bg} hover:opacity-90 text-white rounded-xl font-bold transition-all shadow-lg`}
              >
                {currentNotification.link_text || 'Saiba Mais'}
                <FaExternalLinkAlt />
              </a>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-8 py-4 flex justify-between items-center border-t">
            <p className="text-sm text-gray-500">
              {notifications.length > 1 
                ? `Você tem ${notifications.length - currentIndex} notificação(ões) pendente(s)`
                : 'Clique em "Fechar" para continuar'
              }
            </p>
            <button
              onClick={handleClose}
              className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-bold transition-all"
            >
              {currentIndex < notifications.length - 1 ? 'Próxima' : 'Fechar'}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(50px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.4s ease-out;
        }
      `}</style>
    </>
  );
}

