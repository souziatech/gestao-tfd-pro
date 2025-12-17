import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Use env or fallback (same values used in services/supabaseClient.ts)
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://yqbcopyfxlstioocfpqz.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYmNvcHlmeGxzdGlvb2NmcHF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MTQ1MTksImV4cCI6MjA4MTQ5MDUxOX0.afyGYFmrl4TOq40RxfVVcEZ_zq9rPOi6uygXywcC1qw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const tables = [
  'institution','patients','companions','treatment_types','destinations','support_houses','patient_stays','drivers','vehicles','trips','trip_passengers','appointments','users','patient_payments','extra_expenses'
];

async function run(){
  const out = {};
  for (const t of tables){
    try{
      const { data, error } = await supabase.from(t).select('*');
      if (error){
        console.warn('Erro ao exportar', t, error.message);
        out[t] = { error: error.message };
      } else {
        out[t] = data;
        console.log('Exportado', t, '(', data.length, 'registros)');
      }
    }catch(e){
      console.error('Exceção exportando', t, e.message);
      out[t] = { error: e.message };
    }
  }
  const file = path.resolve('supabase','backups', `backup-export-${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
  fs.writeFileSync(file, JSON.stringify(out,null,2),'utf-8');
  console.log('Backup exportado em', file);
}

run();
