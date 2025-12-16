import React from 'react';
import { LayoutDashboard, Users, Calendar, Bus, FileText, Settings, LogOut, HeartPulse, ClipboardList, DollarSign, Home } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { db } from '../services/store';
import { useAuth } from './AuthContext';

const NavItem = ({ to, icon: Icon, label, active }: { to: string, icon: any, label: string, active: boolean }) => (
  <Link
    to={to}
    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
      active ? 'bg-teal-600 text-white' : 'text-slate-700 hover:bg-teal-50 hover:text-teal-600'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </Link>
);

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { user, logout } = useAuth();

  const getRoleLabel = (role: string) => {
      switch(role) {
          case 'ADMIN': return 'Administrador';
          case 'ATTENDANT': return 'Atendente';
          case 'DRIVER': return 'Motorista';
          case 'VIEWER': return 'Visualizador';
          default: return role;
      }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 fixed h-full z-10 hidden md:flex flex-col no-print">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="bg-teal-600 p-2 rounded-lg shrink-0 shadow-sm">
            <HeartPulse className="text-white" size={24} />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold text-slate-800 leading-tight">TFD Pro Municipal</span>
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Versão 2.5.0</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {db.hasPermission('view_dashboard') && (
            <NavItem to="/" icon={LayoutDashboard} label="Dashboard" active={location.pathname === '/'} />
          )}
          
          {db.hasPermission('view_patients') && (
            <NavItem to="/patients" icon={Users} label="Pacientes" active={location.pathname === '/patients'} />
          )}
          
          {db.hasPermission('view_appointments') && (
            <NavItem to="/appointments" icon={ClipboardList} label="Consultas" active={location.pathname === '/appointments'} />
          )}
          
          {db.hasPermission('view_trips') && (
            <NavItem to="/trips" icon={Calendar} label="Viagens" active={location.pathname.startsWith('/trips')} />
          )}
          
          {db.hasPermission('view_stays') && (
            <NavItem to="/stays" icon={Home} label="Casas de Apoio" active={location.pathname === '/stays'} />
          )}
          
          {db.hasPermission('view_financial') && (
            <NavItem to="/financial" icon={DollarSign} label="Financeiro" active={location.pathname === '/financial'} />
          )}
          
          {db.hasPermission('view_resources') && (
            <NavItem to="/resources" icon={Bus} label="Recursos" active={location.pathname === '/resources'} />
          )}
          
          {db.hasPermission('view_reports') && (
            <NavItem to="/reports" icon={FileText} label="Relatórios" active={location.pathname === '/reports'} />
          )}
        </nav>

        <div className="p-4 border-t border-slate-200 bg-slate-50/30">
          {/* User Profile Card */}
          {user && (
            <div className="flex items-center gap-3 mb-4 px-2 pb-3 border-b border-slate-200/50">
              <div className="h-10 w-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold border border-teal-200 shadow-sm">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-bold text-slate-800 truncate" title={user.name}>{user.name}</p>
                <p className="text-xs text-slate-500 font-medium truncate">
                  {getRoleLabel(user.role)}
                </p>
              </div>
            </div>
          )}

          <button 
            onClick={logout}
            className="flex items-center space-x-3 px-4 py-2.5 text-red-600 hover:bg-red-50 w-full rounded-lg transition-colors border border-transparent hover:border-red-100 group"
          >
            <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium text-sm">Sair do Sistema</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header (Visible only on small screens) */}
      <div className="md:hidden fixed w-full bg-white z-20 border-b p-4 flex justify-between items-center no-print shadow-sm">
         <div className="flex items-center gap-2">
            <HeartPulse className="text-teal-600" size={20} />
            <div>
                <span className="font-bold text-slate-800 block leading-none">TFD Pro Municipal</span>
                <span className="text-[10px] text-slate-400">v2.5.0</span>
            </div>
         </div>
         {/* Simple menu trigger could go here */}
      </div>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 pt-20 md:pt-8 print:ml-0 print:p-0">
        {children}
      </main>
    </div>
  );
};