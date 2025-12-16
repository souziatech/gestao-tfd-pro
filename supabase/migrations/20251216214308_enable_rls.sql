-- Habilitar Row Level Security e adicionar políticas básicas

-- NOTE: Estas políticas permitem READ para clientes anônimos (frontend)
-- enquanto restringem gravações (INSERT/UPDATE/DELETE) apenas a usuários
-- autenticados (role = 'authenticated'). Para regras mais restritas,
-- integre com Supabase Auth ou ajuste as condições das policies.

-- USERS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_allow_select_anon ON users FOR SELECT USING (true);
CREATE POLICY users_require_authenticated_write ON users FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- PATIENT_PAYMENTS (sensitive financial data)
ALTER TABLE patient_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_allow_select_anon ON patient_payments FOR SELECT USING (true);
CREATE POLICY payments_require_authenticated_write ON patient_payments FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- EXTRA_EXPENSES
ALTER TABLE extra_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY expenses_allow_select_anon ON extra_expenses FOR SELECT USING (true);
CREATE POLICY expenses_require_authenticated_write ON extra_expenses FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- PATIENT_STAYS (sensitive personal data)
ALTER TABLE patient_stays ENABLE ROW LEVEL SECURITY;
CREATE POLICY stays_allow_select_anon ON patient_stays FOR SELECT USING (true);
CREATE POLICY stays_require_authenticated_write ON patient_stays FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Observação: revise e ajuste conforme seu fluxo de autenticação.
