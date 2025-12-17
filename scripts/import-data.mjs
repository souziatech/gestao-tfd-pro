import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Gerando migration a partir da fixture...');
execSync('node scripts/generate-import-migration.mjs', { stdio: 'inherit' });

const migrationsDir = path.resolve('supabase','migrations');
const files = fs.readdirSync(migrationsDir).filter(f => f.includes('_import_fixtures.sql')).sort();
if (files.length === 0) {
  console.error('Nenhuma migration de import encontrada. Saindo.');
  process.exit(1);
}
const latest = files[files.length-1];
console.log('Migration a aplicar:', latest);

console.log('Executando `supabase db push` para aplicar a migration (pode solicitar login/interação)...');
try{
  execSync('npx supabase db push', { stdio: 'inherit' });
  console.log('Migração aplicada com sucesso.');
}catch(e){
  console.error('Erro aplicando migration:', e.message);
  process.exit(1);
}

console.log('Import concluída. Verifique integridade dos dados no painel do Supabase.');
