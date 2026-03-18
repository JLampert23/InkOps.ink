import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ConfirmationModal, ConfirmationOptions } from '../components/common/ConfirmationModal';

interface ConfirmationContextValue {
  confirm: (options: ConfirmationOptions) => Promise<boolean>;
}

const ConfirmationContext = createContext<ConfirmationContextValue | undefined>(undefined);

interface ConfirmationState extends ConfirmationOptions {
  isOpen: boolean;
  resolve: (value: boolean) => void;
}

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmationState>({
    isOpen: false,
    title: '',
    message: '',
    resolve: () => {},
  });

  const confirm = useCallback((options: ConfirmationOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        ...options,
        isOpen: true,
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve(true);
    setState((prev) => ({ ...prev, isOpen: false }));
  }, [state.resolve]);

  const handleCancel = useCallback(() => {
    state.resolve(false);
    setState((prev) => ({ ...prev, isOpen: false }));
  }, [state.resolve]);

  return (
    <ConfirmationContext.Provider value={{ confirm }}>
      {children}
      <ConfirmationModal
        isOpen={state.isOpen}
        title={state.title}
        message={state.message}
        confirmLabel={state.confirmLabel}
        cancelLabel={state.cancelLabel}
        variant={state.variant}
        icon={state.icon}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmationContext.Provider>
  );
}

export function useConfirmation() {
  const context = useContext(ConfirmationContext);
  if (!context) {
    throw new Error('useConfirmation must be used within ConfirmationProvider');
  }
  return context;
}
