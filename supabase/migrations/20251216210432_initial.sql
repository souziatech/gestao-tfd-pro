-- Schema SQL para o projeto TFD - compatível com Supabase (Postgres)
-- Cria tipos, tabelas e seeds iniciais usados pelo frontend

-- Extensões úteis
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums
DO $$ BEGIN
		IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trip_status') THEN
				CREATE TYPE trip_status AS ENUM ('Agendada','Embarque','Concluída','Cancelada');
		END IF;
		IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
				CREATE TYPE appointment_status AS ENUM ('pending','scheduled_trip','completed','cancelled','missed','rescheduled');
		END IF;
		IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'patient_status') THEN
				CREATE TYPE patient_status AS ENUM ('active','inactive');
		END IF;
		IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_status') THEN
				CREATE TYPE vehicle_status AS ENUM ('active','maintenance');
		END IF;
		IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stay_status') THEN
				CREATE TYPE stay_status AS ENUM ('active','completed','cancelled');
		END IF;
		IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stipend_status') THEN
				CREATE TYPE stipend_status AS ENUM ('pending','paid','none');
		END IF;
		IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'accountability_status') THEN
				CREATE TYPE accountability_status AS ENUM ('pending','analyzing','approved','rejected');
		END IF;
		IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
				CREATE TYPE user_role AS ENUM ('ADMIN','ATTENDANT','DRIVER','VIEWER');
		END IF;
		IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expense_type') THEN
				CREATE TYPE expense_type AS ENUM ('driver','stipend','fuel','maintenance','food','accommodation','other');
		END IF;
		IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expense_status') THEN
				CREATE TYPE expense_status AS ENUM ('pending','approved','rejected');
		END IF;
END$$;

-- Tabelas principais
CREATE TABLE IF NOT EXISTS institution (
	id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
	name TEXT NOT NULL,
	subtitle TEXT,
	address TEXT,
	city TEXT,
	state TEXT,
	phone TEXT,
	email TEXT,
	logo TEXT,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS patients (
	id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
	name TEXT NOT NULL,
	cpf TEXT,
	birth_date DATE,
	sus_card TEXT,
	phone TEXT,
	status patient_status DEFAULT 'active',
	is_tfd BOOLEAN DEFAULT false,
	address TEXT,
	neighborhood TEXT,
	city TEXT,
	reference_point TEXT,
	emergency_contact TEXT,
	medical_notes TEXT,
	allows_companion BOOLEAN DEFAULT false,
	companion_name TEXT,
	companion_cpf TEXT,
	allows_second_companion BOOLEAN DEFAULT false,
	second_companion_name TEXT,
	second_companion_cpf TEXT,
	second_companion_justification TEXT,
	bank_name TEXT,
	agency TEXT,
	account_number TEXT,
	account_type TEXT,
	account_holder TEXT,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS companions (
	id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
	patient_id TEXT REFERENCES patients(id) ON DELETE SET NULL,
	name TEXT,
	cpf TEXT,
	phone TEXT,
	relationship TEXT,
	notes TEXT
);

CREATE TABLE IF NOT EXISTS destinations (
	id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
	name TEXT NOT NULL,
	address TEXT,
	phone TEXT
);

CREATE TABLE IF NOT EXISTS treatment_types (
	id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
	name TEXT NOT NULL,
	specialist_name TEXT,
	notes TEXT,
	default_destination_id TEXT REFERENCES destinations(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS support_houses (
	id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
	name TEXT NOT NULL,
	address TEXT,
	phone TEXT,
	daily_cost NUMERIC DEFAULT 0,
	capacity INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS patient_stays (
	id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
	patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE,
	patient_name TEXT,
	support_house_id TEXT REFERENCES support_houses(id) ON DELETE SET NULL,
	support_house_name TEXT,
	entry_date DATE,
	entry_time TEXT,
	expected_exit_date DATE,
	exit_date DATE,
	exit_time TEXT,
	has_companion BOOLEAN DEFAULT false,
	companion_name TEXT,
	notes TEXT,
	status stay_status DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS drivers (
	id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
	name TEXT NOT NULL,
	document TEXT,
	cnh TEXT,
	phone TEXT,
	active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS vehicles (
	id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
	model TEXT NOT NULL,
	plate TEXT,
	capacity INTEGER DEFAULT 0,
	status vehicle_status DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS trips (
	id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
	date DATE,
	time TEXT,
	origin TEXT,
	destination TEXT,
	treatment_id TEXT REFERENCES treatment_types(id) ON DELETE SET NULL,
	treatment_name TEXT,
	driver_id TEXT REFERENCES drivers(id) ON DELETE SET NULL,
	driver_name TEXT,
	vehicle_id TEXT REFERENCES vehicles(id) ON DELETE SET NULL,
	vehicle_model TEXT,
	vehicle_plate TEXT,
	total_seats INTEGER DEFAULT 0,
	occupied_seats INTEGER DEFAULT 0,
	status trip_status DEFAULT 'Agendada',
	notes TEXT,
	driver_fee NUMERIC DEFAULT 0,
	driver_paid BOOLEAN DEFAULT false,
	accountability_status accountability_status DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS appointments (
	id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
	patient_id TEXT REFERENCES patients(id) ON DELETE SET NULL,
	patient_name TEXT,
	destination_id TEXT REFERENCES destinations(id) ON DELETE SET NULL,
	destination_name TEXT,
	treatment_id TEXT REFERENCES treatment_types(id) ON DELETE SET NULL,
	treatment_name TEXT,
	date DATE,
	time TEXT,
	notes TEXT,
	documents TEXT,
	status appointment_status DEFAULT 'pending',
	trip_id TEXT REFERENCES trips(id) ON DELETE SET NULL,
	is_return BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS trip_passengers (
	id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
	trip_id TEXT REFERENCES trips(id) ON DELETE CASCADE,
	patient_id TEXT REFERENCES patients(id) ON DELETE SET NULL,
	patient_name TEXT,
	is_companion BOOLEAN DEFAULT false,
	related_patient_name TEXT,
	related_patient_id TEXT,
	companion_name TEXT,
	status TEXT DEFAULT 'confirmed',
	origin TEXT,
	destination TEXT,
	appointment_time TEXT,
	appointment_id TEXT REFERENCES appointments(id) ON DELETE SET NULL,
	is_return BOOLEAN DEFAULT false,
	is_round_trip BOOLEAN DEFAULT false,
	drop_off_time TEXT,
	stipend_amount NUMERIC DEFAULT 0,
	stipend_status stipend_status DEFAULT 'none',
	ticket_number TEXT,
	ticket_image TEXT
);

CREATE TABLE IF NOT EXISTS users (
	id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
	name TEXT NOT NULL,
	login TEXT UNIQUE,
	password TEXT,
	role user_role DEFAULT 'ATTENDANT',
	permissions JSONB,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS patient_payments (
	id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
	patient_id TEXT REFERENCES patients(id) ON DELETE SET NULL,
	patient_name TEXT,
	cpf TEXT,
	hospital TEXT,
	date DATE,
	specialty TEXT,
	account_holder TEXT,
	holder_cpf TEXT,
	bank_name TEXT,
	agency TEXT,
	account_number TEXT,
	has_companion BOOLEAN DEFAULT false,
	meal_value NUMERIC DEFAULT 0,
	companion_value NUMERIC DEFAULT 0,
	trip_qty INTEGER DEFAULT 1,
	total_value NUMERIC DEFAULT 0,
	reference_month TEXT,
	reference_year TEXT,
	status TEXT DEFAULT 'pending',
	attachments JSONB
);

CREATE TABLE IF NOT EXISTS extra_expenses (
	id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
	trip_id TEXT REFERENCES trips(id) ON DELETE CASCADE,
	description TEXT,
	amount NUMERIC DEFAULT 0,
	type expense_type DEFAULT 'other',
	date DATE,
	status expense_status DEFAULT 'pending',
	notes TEXT
);

-- Indexes para performance
CREATE INDEX IF NOT EXISTS idx_patients_cpf ON patients (cpf);
CREATE INDEX IF NOT EXISTS idx_users_login ON users (login);
CREATE INDEX IF NOT EXISTS idx_trips_date ON trips (date);

-- Seed inicial para institution (utilizado pelo app ao detectar banco novo)
INSERT INTO institution (id, name, subtitle, address, city, state, phone, email, logo)
VALUES (
	gen_random_uuid()::text,
	'PREFEITURA MUNICIPAL DE COROATÁ',
	'SECRETARIA MUNICIPAL DE SAÚDE - TFD',
	'Av. Magalhães de Almeida, S/N',
	'Coroatá',
	'MA',
	'(99) 3641-1122',
	'tfd@coroata.ma.gov.br',
	''
)
ON CONFLICT (id) DO NOTHING;

-- Observação: caso prefira executar passo-a-passo, cole este arquivo no editor SQL do Supabase e execute.


