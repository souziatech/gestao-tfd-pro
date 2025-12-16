import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface Notification {
  id: string;
  message: string;
  type: NotificationType;
}

interface NotificationContextType {
  notify: (message: string, type: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const notify = useCallback((message: string, type: NotificationType) => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, message, type }]);

    // Auto remove after 4 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  }, []);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none">
        {notifications.map(n => (
          <div 
            key={n.id}
            className={`pointer-events-auto min-w-[300px] max-w-sm rounded-lg shadow-lg border p-4 flex items-start gap-3 transform transition-all duration-300 animate-in slide-in-from-right-10 ${
              n.type === 'success' ? 'bg-white border-green-200 text-green-800' :
              n.type === 'error' ? 'bg-white border-red-200 text-red-800' :
              n.type === 'warning' ? 'bg-white border-amber-200 text-amber-800' :
              'bg-white border-blue-200 text-blue-800'
            }`}
          >
            <div className={`mt-0.5 ${
               n.type === 'success' ? 'text-green-500' :
               n.type === 'error' ? 'text-red-500' :
               n.type === 'warning' ? 'text-amber-500' :
               'text-blue-500'
            }`}>
                {n.type === 'success' && <CheckCircle size={20} />}
                {n.type === 'error' && <AlertCircle size={20} />}
                {n.type === 'warning' && <AlertTriangle size={20} />}
                {n.type === 'info' && <Info size={20} />}
            </div>
            
            <div className="flex-1">
                <h4 className="font-bold text-sm capitalize mb-0.5">{n.type === 'error' ? 'Erro' : n.type === 'warning' ? 'Atenção' : n.type === 'success' ? 'Sucesso' : 'Informação'}</h4>
                <p className="text-sm opacity-90 leading-tight">{n.message}</p>
            </div>

            <button onClick={() => removeNotification(n.id)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};