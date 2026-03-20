import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ConfirmationModal, ConfirmationOptions } from '../components/common/ConfirmationModal';
import { PromptModal, PromptOptions } from '../components/common/PromptModal';

interface ConfirmationContextValue {
  confirm: (options: ConfirmationOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const ConfirmationContext = createContext<ConfirmationContextValue | undefined>(undefined);

interface ConfirmationState extends ConfirmationOptions {
  isOpen: boolean;
  resolve: (value: boolean) => void;
}

interface PromptState extends PromptOptions {
  isOpen: boolean;
  resolve: (value: string | null) => void;
}

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmationState>({
    isOpen: false,
    title: '',
    message: '',
    resolve: () => {},
  });

  const [promptState, setPromptState] = useState<PromptState>({
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

  const prompt = useCallback((options: PromptOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      setPromptState({
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

  const handlePromptConfirm = useCallback((value: string) => {
    promptState.resolve(value);
    setPromptState((prev) => ({ ...prev, isOpen: false }));
  }, [promptState.resolve]);

  const handlePromptCancel = useCallback(() => {
    promptState.resolve(null);
    setPromptState((prev) => ({ ...prev, isOpen: false }));
  }, [promptState.resolve]);

  return (
    <ConfirmationContext.Provider value={{ confirm, prompt }}>
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
      <PromptModal
        isOpen={promptState.isOpen}
        title={promptState.title}
        message={promptState.message}
        placeholder={promptState.placeholder}
        defaultValue={promptState.defaultValue}
        confirmLabel={promptState.confirmLabel}
        cancelLabel={promptState.cancelLabel}
        inputType={promptState.inputType}
        required={promptState.required}
        validator={promptState.validator}
        onConfirm={handlePromptConfirm}
        onCancel={handlePromptCancel}
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
