import ModernToast from './ModernToast';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
  duration?: number;
}

interface ModernToastContainerProps {
  toasts: Toast[];
  onClose: (id: string) => void;
}

export default function ModernToastContainer({ toasts, onClose }: ModernToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-[99999] flex flex-col gap-3 pointer-events-none">
      <div className="flex flex-col gap-3 pointer-events-auto">
        {toasts.map((toast) => (
          <ModernToast
            key={toast.id}
            {...toast}
            onClose={onClose}
          />
        ))}
      </div>
    </div>
  );
}


