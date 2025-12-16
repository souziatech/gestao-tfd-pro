export enum UserRole {
  ADMIN = 'ADMIN',
  ATTENDANT = 'ATTENDANT',
  DRIVER = 'DRIVER',
  VIEWER = 'VIEWER'
}

export enum TripStatus {
  SCHEDULED = 'Agendada',
  BOARDING = 'Embarque',
  COMPLETED = 'Concluída',
  CANCELLED = 'Cancelada'
}

export type PermissionKey = 
  | 'view_dashboard'
  | 'view_patients' | 'manage_patients'
  | 'view_appointments' | 'manage_appointments'
  | 'view_trips' | 'manage_trips'
  | 'view_stays' | 'manage_stays'
  | 'view_financial' | 'manage_financial'
  | 'view_resources' | 'manage_resources' // Veículos, Motoristas, Destinos
  | 'manage_users' // Novo: Acesso à aba Usuários
  | 'manage_system' // Novo: Acesso a Backup e Instituição
  | 'view_reports';

export interface Institution {
  name: string;
  subtitle: string; // Ex: Secretaria Municipal de Saúde
  address: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  logo: string; // Base64 image string
}

// CONFIGURAÇÃO DE BACKUP
export type BackupModel = 'manual' | 'auto_download' | 'local_snapshot';

export interface BackupConfig {
  model: BackupModel;
  intervalMinutes: number; // Para auto_download
  retentionCount: number; // Para local_snapshot (quantas versoes guardar)
  lastBackupAt: string | null;
}

export interface User {
  id: string;
  name: string;
  login: string;
  email?: string;
  auth_uid?: string;
  password?: string; // Added for management simulation (deprecated when using Supabase Auth)
  role: UserRole;
  permissions: PermissionKey[]; // Lista de permissões granulares
}

export interface Patient {
  id: string;
  name: string;
  cpf: string;
  birthDate: string; // Nova: Data de Nascimento
  susCard: string;
  phone: string;
  status: 'active' | 'inactive'; // Novo campo de Status
  isTFD?: boolean; // Novo: Indica se é paciente do programa TFD (true) ou passageiro comum (false)
  
  // Endereço Completo
  address: string; // Logradouro + Número
  neighborhood: string; // Bairro
  city: string; // Cidade
  referencePoint: string; // Ponto de Referência
  
  emergencyContact: string;
  medicalNotes: string;
  
  // 1º Companion
  allowsCompanion: boolean;
  companionName?: string;
  companionCPF?: string;

  // 2º Companion
  allowsSecondCompanion?: boolean;
  secondCompanionName?: string;
  secondCompanionCPF?: string;
  secondCompanionJustification?: string;

  // Bank Information (For Payments)
  bankName?: string;
  agency?: string;
  accountNumber?: string;
  accountType?: string; // Corrente, Poupança
  accountHolder?: string;
}

export interface Companion {
  id: string;
  patientId?: string; // Optional link to default patient
  name: string;
  cpf: string;
  phone: string;
  relationship: string;
  notes: string;
}

// RENAMED FROM Specialist TO TreatmentType
export interface TreatmentType {
  id: string;
  name: string; // e.g., "Hemodiálise", "Oncologia"
  specialistName?: string; // NEW: The Doctor/Specialist name linked to this treatment
  // address removed/hidden as it's usually linked to Destination
  notes: string;
  defaultDestinationId?: string; // Link to a registered Destination
}

export interface Destination {
  id: string;
  name: string;
  address: string;
  phone: string;
}

// --- SUPPORT HOUSE INTERFACES ---
export interface SupportHouse {
  id: string;
  name: string;
  address: string;
  phone: string;
  dailyCost: number; // Custo estimado por dia
  capacity: number;
}

export interface PatientStay {
  id: string;
  patientId: string;
  patientName: string;
  supportHouseId: string;
  supportHouseName: string;
  entryDate: string;
  entryTime: string;
  expectedExitDate?: string;
  exitDate?: string; // Actual exit
  exitTime?: string;
  hasCompanion: boolean;
  companionName?: string;
  notes: string;
  status: 'active' | 'completed' | 'cancelled';
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  
  // Destination Info
  destinationId?: string;
  destinationName?: string;

  // Treatment Info (Renamed from Specialist)
  treatmentId?: string; 
  treatmentName?: string; 
  
  date: string;
  time: string;
  notes: string;
  documents?: string; // Links or descriptions of attached docs
  status: 'pending' | 'scheduled_trip' | 'completed' | 'cancelled' | 'missed' | 'rescheduled';
  tripId?: string; // Links to the trip if scheduled
  isReturn?: boolean; // Indicates if this is a return appointment/trip
}

export interface Driver {
  id: string;
  name: string;
  document: string;
  cnh: string;
  phone: string;
  active: boolean;
}

export interface Vehicle {
  id: string;
  model: string;
  plate: string;
  capacity: number;
  status: 'active' | 'maintenance';
}

export interface TripPassenger {
  id: string;
  tripId: string;
  patientId: string;
  patientName: string;
  isCompanion: boolean;
  relatedPatientName?: string; // If this is a companion, who are they with?
  relatedPatientId?: string; // Strict link to patient ID
  companionName?: string; // If this is a patient, who is their companion?
  status: 'confirmed' | 'missing' | 'boarded';
  
  origin?: string; // Specific boarding location (Pickup)
  destination?: string; // Specific drop-off location (Hospital/Clinic)
  appointmentTime?: string; // New: Time of the medical appointment

  appointmentId?: string; // Link back to the appointment request
  isReturn?: boolean; // Indicates if this is a return trip for this passenger
  isRoundTrip?: boolean; // Indicates if this is a Round Trip (Ida e Volta)
  dropOffTime?: string; // Time passenger was dropped off
  
  // Financials
  stipendAmount?: number; // Valor da Diária
  stipendStatus?: 'pending' | 'paid' | 'none';
  
  // Ticket info
  ticketNumber?: string;
  ticketImage?: string; // Base64 image
}

export type AccountabilityStatus = 'pending' | 'analyzing' | 'approved' | 'rejected';
export type ExpenseType = 'driver' | 'stipend' | 'fuel' | 'maintenance' | 'food' | 'accommodation' | 'other';
export type ExpenseStatus = 'pending' | 'approved' | 'rejected';

export interface ExtraExpense {
  id: string;
  description: string;
  amount: number;
  type: ExpenseType;
  date: string;
  status: ExpenseStatus;
  notes?: string;
}

export interface PatientPayment {
  id: string;
  
  // Patient Info
  patientId: string;
  patientName: string;
  cpf: string; // Patient CPF
  
  // Trip/Consultation Info
  hospital: string; // "HOSPITAL" column
  date: string; // "DATA DA CONSULTA"
  specialty: string; // "ESPEC." column
  
  // Bank Info Snapshot (Snapshot at time of payment)
  accountHolder: string; // "TITULAR DA CONTA"
  holderCPF: string; // "CPF" (of holder)
  bankName: string; // "BANCO"
  agency: string; // "AG"
  accountNumber: string; // "C/P"
  
  // Values
  hasCompanion: boolean; // "ACOMP." (Sim/Não)
  mealValue: number; // "VALOR DA REFEIÇÃO" (Unit value for patient)
  companionValue: number; // "ACOMPANHANT" (Unit value for companion)
  tripQty: number; // "QND. DE VIAGEM"
  
  totalValue: number; // "AJUDA DE CUSTO" ((Meal + Comp) * Qty)
  
  referenceMonth: string;
  referenceYear: string;
  status: 'pending' | 'paid' | 'cancelled';

  // Attachments (Docs Base64 JSON Strings)
  attachments?: {
    identity?: string; // RG/CPF
    address?: string; // Comprovante Residência
    medical?: string; // Atestado Médico / TFD
    proxy?: string; // Procuração
  };
}

export interface Trip {
  id: string;
  date: string;
  time: string;
  origin: string; // Base origin (e.g. Health Center)
  destination: string;
  
  // Treatment Info (Renamed from Specialist)
  treatmentId: string;
  treatmentName: string;
  
  driverId: string;
  driverName: string;
  vehicleId: string;
  vehicleModel: string;
  vehiclePlate: string;
  totalSeats: number;
  occupiedSeats: number; // Patients + Companions
  passengers: TripPassenger[];
  status: TripStatus;
  notes: string;
  
  // Financials
  driverFee?: number; // Custo do Motorista
  driverPaid?: boolean;
  
  // Advanced Financials
  accountabilityStatus: AccountabilityStatus;
  extraExpenses: ExtraExpense[];
}