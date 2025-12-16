import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard, Reports } from './components/Views';
import { PatientManager, ResourceManager } from './components/Registry';
import { TripManager } from './components/TripManagement';
import { AppointmentManager } from './components/Appointments';
import { FinancialManager } from './components/Financial';
import { SupportHouseManager } from './components/SupportHouse';
import { NotificationProvider } from './components/NotificationContext';
import { AuthProvider, useAuth } from './components/AuthContext';
import { Login } from './components/Login';
import { db } from './services/store';
import { Loader } from 'lucide-react';

// Wrapper for protected routes
const ProtectedRoute = () => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

function App() {
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initApp = async () => {
      await db.init();
      setIsInitializing(false);
    };
    initApp();
  }, []);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-600">
        <Loader size={48} className="animate-spin text-teal-600 mb-4" />
        <h2 className="text-xl font-bold">Carregando Sistema TFD...</h2>
        <p className="text-sm">Sincronizando dados com o servidor.</p>
      </div>
    );
  }

  return (
    <HashRouter>
      <AuthProvider>
        <NotificationProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/patients" element={<PatientManager />} />
              <Route path="/appointments" element={<AppointmentManager />} />
              <Route path="/trips" element={<TripManager />} />
              <Route path="/stays" element={<SupportHouseManager />} />
              <Route path="/financial" element={<FinancialManager />} />
              <Route path="/resources" element={<ResourceManager />} />
              <Route path="/reports" element={<Reports />} />
            </Route>

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </NotificationProvider>
      </AuthProvider>
    </HashRouter>
  );
}

export default App;