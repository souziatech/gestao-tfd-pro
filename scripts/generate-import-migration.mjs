import fs from 'fs';
import path from 'path';

const fixturePath = path.resolve('fixtures/restore-2025-12-16.json');
const migrationsDir = path.resolve('supabase','migrations');

function snake(s){
  // Better snake case: preserve common acronyms (CPF, CNH, TFD) and handle runs of capitals
  s = s.replace(/[- ]/g,'_');
  // Insert underscore between lower->Upper transitions
  s = s.replace(/([a-z0-9])([A-Z])/g, '$1_$2');
  // Insert underscore between Upper->UpperLower transitions
  s = s.replace(/([A-Z])([A-Z][a-z])/g, '$1_$2');
  // Normalize common acronyms to lowercase (CPF, CNH, TFD)
  s = s.replace(/CPF/gi, 'CPF').replace(/CNH/gi, 'CNH').replace(/TFD/gi, 'TFD');
  return s.toLowerCase();
}

function inferType(val){
  if (val === null) return 'TEXT';
  if (Array.isArray(val) || typeof val === 'object') return 'JSONB';
  if (typeof val === 'boolean') return 'BOOLEAN';
  if (typeof val === 'number' && Number.isInteger(val)) return 'INTEGER';
  if (typeof val === 'number') return 'NUMERIC';
  if (typeof val === 'string'){
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return 'DATE';
    if (/^\d{4}-\d{2}-\d{2}T/.test(val)) return 'TIMESTAMP WITH TIME ZONE';
    return 'TEXT';
  }
  return 'TEXT';
}

function sqlValue(val){
  if (val === null || val === undefined) return 'NULL';
  if (Array.isArray(val) || typeof val === 'object'){
    return `$$${JSON.stringify(val).replace(/\$/g,'') }$$::jsonb`;
  }
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string'){
    // Use dollar-quoting to avoid escaping issues
    return `$$${val.replace(/\$/g,'')}$$`;
  }
  return `$$${String(val).replace(/\$/g,'')}$$`;
}

function ensureDir(dir){
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function generate(){
  const raw = fs.readFileSync(fixturePath, 'utf-8');
  const data = JSON.parse(raw);
  ensureDir(migrationsDir);

  // Map fixture keys to DB table names
  const mapKeyToTable = {
    'treatmentTypes':'treatment_types',
    'supportHouses':'support_houses',
    'patientPayments':'patient_payments',
    'patientStays':'patient_stays',
    'trips':'trips',
    'trip_passengers':'trip_passengers',
    'drivers':'drivers',
    'vehicles':'vehicles',
    'destinations':'destinations',
    'patients':'patients',
    'users':'users',
    'appointments':'appointments',
    'extra_expenses':'extra_expenses',
    'companions':'companions',
    'institution':'institution'
  };

  // IMPORTANT: Order respects foreign key constraints
  // destinations first (no FKs), then treatmentTypes (FK to destinations), then others
  const order = [
    'destinations', // No FKs; needed by treatment_types
    'treatmentTypes', // FK to destinations
    'supportHouses', // No FKs
    'drivers', // No FKs
    'vehicles', // No FKs
    'patients', // No FKs
    'companions', // FK to patients
    'users', // No FKs
    'trips', // FK to treatment_types, drivers, vehicles
    'appointments', // FK to patients, treatment_types, destinations, trips
    'trip_passengers', // FK to trips, patients, appointments
    'patientPayments', // FK to patients
    'patientStays', // FK to patients, support_houses
    'extra_expenses', // FK to trips
    'institution'
  ];

  let sql = `-- Migration gerada automaticamente para importar fixtures (merge/upsert)\n-- Geração: ${new Date().toISOString()}\n\n`;

  for (const key of order){
    const table = mapKeyToTable[key];
    if (!data[key]) continue;

    const rows = Array.isArray(data[key]) ? data[key] : [data[key]];

    // Ensure table exists minimally
    sql += `CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY);\n`;

    // Collect columns and types
    const columns = {};
    for (const r of rows){
      for (const origKey of Object.keys(r)){
        if (origKey === 'id') continue;
        const col = snake(origKey);
        const t = inferType(r[origKey]);
        columns[col] = columns[col] || t;
      }
    }

    // Add columns if missing
    for (const [col,t] of Object.entries(columns)){
      sql += `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${t};\n`;
    }

    // Inserts (upsert) per row
    for (const r of rows){
      const cols = ['id'];
      const vals = [sqlValue(r.id || genId())];
      const updates = [];
      for (const origKey of Object.keys(r)){
        if (origKey === 'id') continue;
        const col = snake(origKey);
        cols.push(col);
        vals.push(sqlValue(r[origKey]));
        updates.push(`${col} = EXCLUDED.${col}`);
      }
      // For users table, delete by login first (unique constraint)
      if (table === 'users' && r.login){
        sql += `DELETE FROM ${table} WHERE login = ${sqlValue(r.login)};\n`;
      }
      sql += `INSERT INTO ${table} (${cols.join(',')}) VALUES (${vals.join(',')}) ON CONFLICT (id) DO UPDATE SET ${updates.join(',')};\n`;

      // Special handling: nested arrays like trips.passengers and trips.extraExpenses
      if (key === 'trips' && Array.isArray(r.passengers)){
        for (const p of r.passengers){
          // Map to trip_passengers table
          const tpCols = ['id','trip_id','patient_id','patient_name','is_companion','status','origin','destination','is_round_trip'];
          const tpVals = [sqlValue(p.id || genId()), sqlValue(r.id), sqlValue(p.patientId), sqlValue(p.patientName), sqlValue(p.isCompanion), sqlValue(p.status), sqlValue(p.origin), sqlValue(p.destination), sqlValue(p.isRoundTrip)];
          sql += `INSERT INTO trip_passengers (${tpCols.join(',')}) VALUES (${tpVals.join(',')}) ON CONFLICT (id) DO UPDATE SET ${tpCols.slice(1).map(c=>`${c}=EXCLUDED.${c}`).join(',')};\n`;
        }
      }

      if (key === 'trips' && Array.isArray(r.extraExpenses)){
        for (const ex of r.extraExpenses){
          const exCols = ['id','trip_id','description','amount','type','date','status'];
          const exVals = [sqlValue(ex.id || genId()), sqlValue(r.id), sqlValue(ex.description), sqlValue(ex.amount), sqlValue(ex.type), sqlValue(ex.date), sqlValue(ex.status)];
          sql += `INSERT INTO extra_expenses (${exCols.join(',')}) VALUES (${exVals.join(',')}) ON CONFLICT (id) DO UPDATE SET ${exCols.slice(1).map(c=>`${c}=EXCLUDED.${c}`).join(',')};\n`;
        }
      }
    }

    sql += '\n';
  }

  // Helper genId function fallback
  sql = `-- NOTICE: This migration does minimal type inference and creates missing columns as TEXT/JSONB/NUMERIC/BOOLEAN/DATE when possible.\n` + sql;

  const fname = path.join(migrationsDir, `${timestamp()}_import_fixtures.sql`);
  fs.writeFileSync(fname, sql, 'utf-8');
  console.log('Migration gerada em', fname);
}

function genId(){
  return 'gen_' + Math.random().toString(36).slice(2,10);
}

function timestamp(){
  const d = new Date();
  const YYYY = d.getFullYear();
  const MM = String(d.getMonth()+1).padStart(2,'0');
  const DD = String(d.getDate()).padStart(2,'0');
  const hh = String(d.getHours()).padStart(2,'0');
  const mm = String(d.getMinutes()).padStart(2,'0');
  const ss = String(d.getSeconds()).padStart(2,'0');
  return `${YYYY}${MM}${DD}${hh}${mm}${ss}`;
}

generate();
