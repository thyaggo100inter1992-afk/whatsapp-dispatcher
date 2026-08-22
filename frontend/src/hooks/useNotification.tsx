import { useState, useCallback, useRef } from 'react';
import Toast from '@/components/ui/Toast';

interface Notification {
  id: number;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
  duration?: number;
}

let notificationId = 0;

const DEFAULT_DURATION: Record<Notification['type'], number> = {
  success: 3500,
  info: 4000,
  warning: 4500,
  error: 5500,
};

export function useNotification() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const removeNotification = useCallback((id: number) => {
    const t = timersRef.current.get(id);
    if (t) {
      clearTimeout(t);
      timersRef.current.delete(id);
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const showNotification = useCallback((
    type: 'success' | 'error' | 'info' | 'warning',
    title: string,
    message?: string,
    duration?: number
  ) => {
    const id = ++notificationId;
    const ms = duration ?? DEFAULT_DURATION[type];
    setNotifications((prev) => [...prev, { id, type, title, message, duration: ms }]);

    // Auto-remove também no hook (garantia extra, além do Toast)
    if (ms > 0) {
      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, ms);
      timersRef.current.set(id, timer);
    }
  }, []);

  const success = useCallback((title: string, message?: string, duration?: number) => {
    showNotification('success', title, message, duration);
  }, [showNotification]);

  const error = useCallback((title: string, message?: string, duration?: number) => {
    showNotification('error', title, message, duration);
  }, [showNotification]);

  const warning = useCallback((title: string, message?: string, duration?: number) => {
    showNotification('warning', title, message, duration);
  }, [showNotification]);

  const info = useCallback((title: string, message?: string, duration?: number) => {
    showNotification('info', title, message, duration);
  }, [showNotification]);

  const NotificationContainer = useCallback(() => {
    return (
      <>
        {notifications.map((notification, index) => (
          <div
            key={notification.id}
            style={{
              position: 'fixed',
              top: `${20 + index * 110}px`,
              right: '20px',
              zIndex: 9999,
            }}
          >
            <Toast
              type={notification.type}
              title={notification.title}
              message={notification.message}
              duration={notification.duration}
              onClose={() => removeNotification(notification.id)}
            />
          </div>
        ))}
      </>
    );
  }, [notifications, removeNotification]);

  return {
    success,
    error,
    warning,
    info,
    NotificationContainer,
  };
}
