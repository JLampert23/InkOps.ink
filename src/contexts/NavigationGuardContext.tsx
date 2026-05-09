import { createContext, useCallback, useContext, useRef, ReactNode } from 'react';

type GuardCheck = () => Promise<boolean>;

interface NavigationGuardContextValue {
  registerGuard: (check: GuardCheck) => void;
  clearGuard: () => void;
  navigate: (action: () => void | Promise<void>) => Promise<void>;
}

const NavigationGuardContext = createContext<NavigationGuardContextValue>({
  registerGuard: () => {},
  clearGuard: () => {},
  navigate: async (action) => {
    await action();
  },
});

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  // Single active guard at a time. The component that "owns" leave-confirmation
  // (currently QuoteBuilder when it has unsaved edits) registers a check that
  // resolves true to proceed or false to cancel the navigation.
  const guardRef = useRef<GuardCheck | null>(null);

  const registerGuard = useCallback((check: GuardCheck) => {
    guardRef.current = check;
  }, []);

  const clearGuard = useCallback(() => {
    guardRef.current = null;
  }, []);

  const navigate = useCallback(async (action: () => void | Promise<void>) => {
    const guard = guardRef.current;
    if (guard) {
      const proceed = await guard();
      if (!proceed) return;
    }
    await action();
  }, []);

  return (
    <NavigationGuardContext.Provider value={{ registerGuard, clearGuard, navigate }}>
      {children}
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard() {
  return useContext(NavigationGuardContext);
}
