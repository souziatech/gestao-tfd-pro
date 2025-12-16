import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import { HeartPulse, Lock, User, ArrowRight } from 'lucide-react';
import { db } from '../services/store';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const ok = await login(username, password);
      if (ok) {
        navigate('/');
      } else {
        setError('Credenciais inválidas. Verifique usuário e senha.');
      }
    } catch (err) {
      setError('Erro ao tentar autenticar. Verifique a conexão.');
    }
  };

  const institution = db.institution;

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
        
        {/* Left Side - Brand */}
        <div className="md:w-1/2 bg-gradient-to-br from-teal-700 to-teal-900 p-12 text-white flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
             <div className="w-64 h-64 rounded-full bg-white absolute -top-10 -left-10"></div>
             <div className="w-96 h-96 rounded-full bg-white absolute bottom-0 right-0"></div>
          </div>
          
          <div className="relative z-10">
            <div className="bg-white/10 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm border border-white/20">
              <HeartPulse size={32} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Gestão TFD Pro</h1>
            <p className="text-teal-100 text-lg mb-8">Tratamento Fora de Domicílio</p>
            
            <div className="space-y-4">
                <div className="bg-white/5 p-4 rounded-lg backdrop-blur-sm border border-white/10">
                    <p className="text-sm font-medium opacity-90">"Eficiência no transporte e cuidado com quem mais precisa."</p>
                </div>
                {institution && (
                    <div className="text-xs text-teal-200 mt-8 opacity-75">
                        <p>{institution.name}</p>
                        <p>{institution.city} - {institution.state}</p>
                    </div>
                )}
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="md:w-1/2 p-12 flex flex-col justify-center">
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-800">Bem-vindo(a) de volta!</h2>
                <p className="text-slate-500">Por favor, insira suas credenciais para acessar.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Usuário / Login</label>
                    <div className="relative">
                        <User className="absolute left-3 top-3 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            className="w-full border border-slate-200 bg-slate-50 rounded-lg py-3 pl-10 pr-4 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
                            placeholder="Seu usuário de acesso"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Senha</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                        <input 
                            type="password" 
                            className="w-full border border-slate-200 bg-slate-50 rounded-lg py-3 pl-10 pr-4 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
                            placeholder="Sua senha secreta"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                </div>

                {error && (
                    <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                        {error}
                    </div>
                )}

                <button 
                    type="submit" 
                    className="w-full bg-teal-600 text-white font-bold py-3.5 rounded-lg hover:bg-teal-700 shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2 transition-transform active:scale-95"
                >
                    Acessar Sistema <ArrowRight size={18} />
                </button>
            </form>

            <div className="mt-8 text-center border-b border-slate-100 pb-6 mb-6">
                <p className="text-xs text-slate-400">
                    Esqueceu sua senha? Contate o administrador do sistema.
                </p>
            </div>

            <div className="text-center">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                    WM Sistemas IA
                </p>
                <p className="text-[10px] text-slate-400">
                    Suporte: (99) 98460-2079 | suporte@i2asys.com.br
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};