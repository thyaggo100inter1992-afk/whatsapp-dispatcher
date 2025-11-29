import { useState, useCallback, ReactNode } from 'react';
import ConfirmModal from '@/components/ui/ConfirmModal';

interface ConfirmOptions {
  title: string;
  message: string | ReactNode;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info' | 'success' | 'error';
  showCancel?: boolean;
}

export function useConfirm() {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    title: '',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    type: 'warning',
  });
  const [resolver, setResolver] = useState<{
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions({
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      type: 'warning',
      showCancel: true,
      ...opts,
    });
    setIsOpen(true);

    return new Promise<boolean>((resolve) => {
      setResolver({ resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    resolver?.resolve(true);
  }, [resolver]);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    resolver?.resolve(false);
  }, [resolver]);

  const ConfirmDialog = useCallback(() => {
    return (
      <ConfirmModal
        isOpen={isOpen}
        title={options.title}
        message={options.message}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        type={(options.type === 'error' ? 'danger' : options.type) || 'warning'}
        showCancelButton={options.showCancel !== false}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    );
  }, [isOpen, options, handleConfirm, handleCancel]);

  return {
    confirm,
    ConfirmDialog,
  };
}
