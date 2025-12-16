-- Seed básico: usuário administrador para permitir login (ajuste senha/role conforme necessário)
INSERT INTO users (id, name, login, password, role, permissions, created_at)
VALUES (
  gen_random_uuid()::text,
  'Administrador',
  'admin',
  'admin123',
  'ADMIN',
  '["view_dashboard","view_patients","manage_patients","view_appointments","manage_appointments","view_trips","manage_trips","view_stays","manage_stays","view_financial","manage_financial","view_resources","manage_resources","manage_users","manage_system","view_reports"]'::jsonb,
  now()
) ON CONFLICT (login) DO UPDATE SET password = EXCLUDED.password, name = EXCLUDED.name, role = EXCLUDED.role, permissions = EXCLUDED.permissions;
