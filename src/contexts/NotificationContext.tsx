import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: NotificationType;
}

interface NotificationContextType {
  showNotification: (type: NotificationType, title: string, message?: string, duration?: number) => void;
  addNotification: (type: NotificationType, title: string, message?: string, duration?: number) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<(ConfirmOptions & { resolve: (value: boolean) => void }) | null>(null);

  const showNotification = useCallback((type: NotificationType, title: string, message?: string, duration: number = 4000) => {
    const id = Math.random().toString(36).substring(7);
    const notification: Notification = { id, type, title, message, duration };

    setNotifications(prev => [...prev, notification]);

    if (duration > 0) {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, duration);
    }
  }, []);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmDialog({ ...options, resolve });
    });
  }, []);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleConfirm = (result: boolean) => {
    if (confirmDialog) {
      confirmDialog.resolve(result);
      setConfirmDialog(null);
    }
  };

  const getColors = (type: NotificationType) => {
    switch (type) {
      case 'success': return 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-300';
      case 'error': return 'bg-gradient-to-br from-rose-50 to-red-50 border-rose-300';
      case 'warning': return 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-300';
      case 'info': return 'bg-gradient-to-br from-sky-50 to-blue-50 border-sky-300';
    }
  };

  const getIconColor = (type: NotificationType) => {
    switch (type) {
      case 'success': return 'text-emerald-600';
      case 'error': return 'text-rose-600';
      case 'warning': return 'text-amber-600';
      case 'info': return 'text-sky-600';
    }
  };

  const getIconBg = (type: NotificationType) => {
    switch (type) {
      case 'success': return 'bg-emerald-100';
      case 'error': return 'bg-rose-100';
      case 'warning': return 'bg-amber-100';
      case 'info': return 'bg-sky-100';
    }
  };

  return (
    <NotificationContext.Provider value={{ showNotification, addNotification: showNotification, confirm }}>
      {children}

      {/* Notification Toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-3 max-w-md pointer-events-none">
        {notifications.map(notification => (
          <div
            key={notification.id}
            className={`${getColors(notification.type)} border-2 rounded-xl shadow-xl backdrop-blur-sm p-4 flex items-start gap-3 animate-slide-in pointer-events-auto`}
            style={{
              boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.15), 0 4px 8px -4px rgba(0, 0, 0, 0.1)'
            }}
          >
            <div className={`${getIconBg(notification.type)} ${getIconColor(notification.type)} p-2 rounded-lg flex-shrink-0`}>
              {notification.type === 'success' && <CheckCircle className="w-5 h-5" />}
              {notification.type === 'error' && <XCircle className="w-5 h-5" />}
              {notification.type === 'warning' && <AlertCircle className="w-5 h-5" />}
              {notification.type === 'info' && <Info className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-gray-900 leading-tight">{notification.title}</h4>
              {notification.message && (
                <p className="text-sm text-gray-700 mt-1.5 leading-relaxed">{notification.message}</p>
              )}
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="text-gray-500 hover:text-gray-700 transition-all duration-200 flex-shrink-0 hover:bg-white/50 rounded-lg p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Confirmation Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={() => handleConfirm(false)}
          />
          <div
            className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in"
            style={{
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}
          >
            <div className="flex items-start gap-4 mb-6">
              <div className={`${getIconBg(confirmDialog.type || 'info')} ${getIconColor(confirmDialog.type || 'info')} p-3 rounded-xl flex-shrink-0`}>
                {confirmDialog.type === 'success' && <CheckCircle className="w-6 h-6" />}
                {confirmDialog.type === 'error' && <XCircle className="w-6 h-6" />}
                {confirmDialog.type === 'warning' && <AlertCircle className="w-6 h-6" />}
                {(!confirmDialog.type || confirmDialog.type === 'info') && <Info className="w-6 h-6" />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold text-gray-900 leading-tight">{confirmDialog.title}</h3>
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">{confirmDialog.message}</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => handleConfirm(false)}
                className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                {confirmDialog.cancelText || 'Cancel'}
              </button>
              <button
                onClick={() => handleConfirm(true)}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-500/30"
              >
                {confirmDialog.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-in {
          from {
            transform: translateX(120%) translateY(-10px);
            opacity: 0;
          }
          to {
            transform: translateX(0) translateY(0);
            opacity: 1;
          }
        }

        @keyframes scale-in {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .animate-slide-in {
          animation: slide-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .animate-scale-in {
          animation: scale-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </NotificationContext.Provider>
  );
}
