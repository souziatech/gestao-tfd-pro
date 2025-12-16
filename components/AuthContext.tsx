import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../services/store';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  login: (login: string, pass: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(db.currentUser);

  // Sync with DB if it changes externally (e.g. reload from storage)
  useEffect(() => {
    setUser(db.currentUser);
  }, []);

  const login = async (login: string, pass: string) => {
    const success = await db.login(login, pass);
    if (success) {
      setUser(db.currentUser);
    }
    return success;
  };

  const logout = () => {
    db.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};