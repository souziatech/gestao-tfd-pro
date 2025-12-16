import { createClient } from '@supabase/supabase-js';

// Access env variables safely by casting import.meta to any
const env = (import.meta as any).env;

// Usa as chaves fornecidas como fallback caso as variáveis de ambiente não estejam definidas
const supabaseUrl = env?.VITE_SUPABASE_URL || 'https://yqbcopyfxlstioocfpqz.supabase.co';
const supabaseAnonKey = env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYmNvcHlmeGxzdGlvb2NmcHF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MTQ1MTksImV4cCI6MjA4MTQ5MDUxOX0.afyGYFmrl4TOq40RxfVVcEZ_zq9rPOi6uygXywcC1qw';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL ou Key não encontradas. O sistema funcionará em modo offline/localstorage.');
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);