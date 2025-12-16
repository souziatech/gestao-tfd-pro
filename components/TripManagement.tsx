import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/store';
import { Trip, TripPassenger, TripStatus, Appointment } from '../types';
import { Calendar, User, MapPin, Printer, CheckCircle, AlertCircle, X, Edit2, Trash2, ChevronDown, ChevronUp, AlertTriangle, RotateCcw, Clock, Stethoscope, Users, Search, Plus, ArrowRight, Bus, Phone } from 'lucide-react';
import { formatDate, PatientAutocomplete, maskCPF, formatInputText } from './Shared';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useNotification } from './NotificationContext';

// --- NEW TRIP MODAL ---
export interface NewTripModalProps {
  onClose: () => void;
  onSave: () => void;
  initialTrip?: Trip;
  preSelectedAppointment?: Appointment;
}

export const NewTripModal: React.FC<NewTripModalProps> = ({ onClose, onSave, initialTrip, preSelectedAppointment }) => {
  const { notify } = useNotification();
  // 1. Trip Configuration State
  const [tripDetails, setTripDetails] = useState({
    date: initialTrip?.date || preSelectedAppointment?.date || new Date().toISOString().split('T')[0],
    time: initialTrip?.time || preSelectedAppointment?.time || '05:00',
    origin: initialTrip?.origin || 'Secretaria de Saúde',
    destination: initialTrip?.destination || (preSelectedAppointment ? (preSelectedAppointment.destinationName || preSelectedAppointment.treatmentName) : ''),
    vehicleId: initialTrip?.vehicleId || '',
    driverId: initialTrip?.driverId || '',
    notes: initialTrip?.notes || '',
    treatmentId: initialTrip?.treatmentId || preSelectedAppointment?.treatmentId || '',
    status: initialTrip?.status || TripStatus.SCHEDULED
  });

  // 2. Passengers State (The Manifest)
  const [passengers, setPassengers] = useState<{ 
      patientId: string, 
      patientName: string,
      hasCompanion: boolean, 
      companionName?: string, 
      hasSecondCompanion?: boolean, 
      secondCompanionName?: string,
      appointmentId?: string, 
      isReturn?: boolean, 
      isRoundTrip?: boolean,
      origin?: string, 
      destination?: string, 
      appointmentTime?: string 
  }[]>(() => {
    if (initialTrip) {
        const result: any[] = [];
        const mainPassengers = (initialTrip.passengers || []).filter(p => !p.isCompanion);
        
        mainPassengers.forEach(main => {
            // Find companions linked to this main passenger
            // Note: In our store logic, companion rows usually have patientId set to the main patient's ID
            const comps = (initialTrip.passengers || []).filter(p => p.isCompanion && p.patientId === main.patientId);
            const comp1 = comps[0];
            const comp2 = comps[1];

            result.push({
                patientId: main.patientId,
                patientName: main.patientName,
                hasCompanion: !!comp1,
                companionName: comp1?.patientName,
                hasSecondCompanion: !!comp2,
                secondCompanionName: comp2?.patientName,
                appointmentId: main.appointmentId,
                isReturn: main.isReturn,
                isRoundTrip: main.isRoundTrip,
                origin: main.origin,
                destination: main.destination,
                appointmentTime: main.appointmentTime
            });
        });
        return result;
    } else if (preSelectedAppointment) {
        const pat = db.patients.find(p => p.id === preSelectedAppointment.patientId);
        if (pat) {
            return [{
                patientId: pat.id,
                patientName: pat.name,
                hasCompanion: pat.allowsCompanion,
                companionName: pat.companionName,
                hasSecondCompanion: pat.allowsSecondCompanion,
                secondCompanionName: pat.secondCompanionName,
                appointmentId: preSelectedAppointment.id,
                isReturn: preSelectedAppointment.isReturn,
                isRoundTrip: !preSelectedAppointment.isReturn,
                origin: pat.address,
                destination: preSelectedAppointment.destinationName || preSelectedAppointment.treatmentName,
                appointmentTime: preSelectedAppointment.time
            }];
        }
    }
    return [];
  });

  // 3. Suggestion Local State
  const [suggestionStates, setSuggestionStates] = useState<Record<string, {
      mode: 'one-way' | 'return' | 'round-trip',
      useCompanion: boolean,
      useSecondCompanion: boolean
  }>>({});

  // 4. Manual Add State
  const [activeTab, setActiveTab] = useState<'suggestions' | 'manual'>('suggestions');
  const [manualPaxId, setManualPaxId] = useState('');
  const [manualConfig, setManualConfig] = useState({
      hasCompanion: false, companionName: '', hasSecondCompanion: false, secondCompanionName: '',
      mode: 'round-trip' as 'one-way' | 'return' | 'round-trip',
      origin: '',
      appointmentTime: '' // New Field
  });

  // Effect to pre-fill origin when manual patient is selected
  useEffect(() => {
      if (manualPaxId && activeTab === 'manual') {
          const p = db.patients.find(pt => pt.id === manualPaxId);
          if (p) {
              setManualConfig(prev => ({ ...prev, origin: p.address || tripDetails.origin }));
          }
      }
  }, [manualPaxId, activeTab]);

  // --- COMPUTED VALUES ---
  const suggestions = useMemo(() => {
    if (!tripDetails.date) return [];
    return db.appointments.filter(a => {
        if (a.date !== tripDetails.date) return false;
        if (passengers.some(p => p.appointmentId === a.id)) return false;
        if (['cancelled', 'missed', 'completed'].includes(a.status)) return false;
        if (a.tripId && initialTrip && a.tripId !== initialTrip.id) return false;
        if (a.tripId && !initialTrip) return false;
        return true;
    });
  }, [tripDetails.date, passengers, initialTrip]);

  const selectedVehicle = db.vehicles.find(v => v.id === tripDetails.vehicleId);
  const totalOccupancy = passengers.reduce((acc, p) => acc + 1 + (p.hasCompanion ? 1 : 0) + (p.hasSecondCompanion ? 1 : 0), 0);
  const maxCapacity = selectedVehicle?.capacity || 0;
  
  const selectedManualPatient = useMemo(() => db.patients.find(p => p.id === manualPaxId), [manualPaxId]);
  
  // --- HANDLERS ---
  const initSuggestionState = (aptId: string, patient: any, apt: Appointment) => {
      if (suggestionStates[aptId]) return;
      setSuggestionStates(prev => ({
          ...prev,
          [aptId]: {
              mode: apt.isReturn ? 'return' : 'round-trip',
              useCompanion: patient.allowsCompanion,
              useSecondCompanion: patient.allowsSecondCompanion
          }
      }));
  };

  const handleAddSuggestion = (apt: Appointment) => {
      const patient = db.patients.find(p => p.id === apt.patientId);
      if (!patient) return;
      
      const state = suggestionStates[apt.id] || {
          mode: apt.isReturn ? 'return' : 'round-trip',
          useCompanion: patient.allowsCompanion,
          useSecondCompanion: patient.allowsSecondCompanion
      };

      const seatsNeeded = 1 + (state.useCompanion ? 1 : 0) + (state.useSecondCompanion ? 1 : 0);
      
      // VALIDATE CAPACITY
      if (selectedVehicle && (totalOccupancy + seatsNeeded > maxCapacity)) {
          if (!confirm(`ALERTA DE CAPACIDADE!\n\nO veículo selecionado (${selectedVehicle.model}) possui ${maxCapacity} lugares.\nAtualmente há ${totalOccupancy} ocupados.\n\nAdicionar este(s) passageiro(s) excederá a capacidade para ${totalOccupancy + seatsNeeded}.\n\nDeseja continuar mesmo assim?`)) return;
      }

      const travelCheck = db.isPatientTravelingOnDate(patient.id, tripDetails.date, initialTrip?.id);
      if (travelCheck.isTraveling) {
          if (!confirm(`AVISO: O paciente ${patient.name} já consta em OUTRA viagem no dia ${tripDetails.date} (Destino: ${travelCheck.tripInfo?.destination}).\n\nDeseja adicionar mesmo assim?`)) {
              return;
          }
      }

      setPassengers([...passengers, {
          patientId: patient.id,
          patientName: patient.name,
          hasCompanion: state.useCompanion,
          companionName: state.useCompanion ? patient.companionName : undefined,
          hasSecondCompanion: state.useSecondCompanion,
          secondCompanionName: state.useSecondCompanion ? patient.secondCompanionName : undefined,
          appointmentId: apt.id,
          isReturn: state.mode === 'return',
          isRoundTrip: state.mode === 'round-trip',
          origin: patient.address || tripDetails.origin,
          destination: apt.destinationName || apt.treatmentName || tripDetails.destination,
          appointmentTime: apt.time
      }]);
  };

  const handleManualAdd = () => {
      if (!manualPaxId) return;
      const patient = db.patients.find(p => p.id === manualPaxId);
      if (!patient) return;
      
      if (patient.isTFD !== false) {
          alert("Regra de Negócio: Pacientes TFD só podem ser adicionados se houver consulta agendada para o dia.\n\nPor favor, utilize a aba 'Consultas'.");
          return;
      }

      if (passengers.some(p => p.patientId === manualPaxId)) return alert("Paciente já adicionado nesta lista.");

      const travelCheck = db.isPatientTravelingOnDate(patient.id, tripDetails.date, initialTrip?.id);
      if (travelCheck.isTraveling) {
          if (!confirm(`AVISO: O passageiro ${patient.name} já consta em OUTRA viagem no dia ${tripDetails.date} (Destino: ${travelCheck.tripInfo?.destination}).\n\nDeseja adicionar mesmo assim?`)) {
              return;
          }
      }

      const isNonTFD = patient.isTFD === false;
      const useComp = isNonTFD ? false : manualConfig.hasCompanion;
      const useSecComp = isNonTFD ? false : manualConfig.hasSecondCompanion;

      // VALIDATE CAPACITY
      const seatsNeeded = 1 + (useComp ? 1 : 0) + (useSecComp ? 1 : 0);
      if (selectedVehicle && (totalOccupancy + seatsNeeded > maxCapacity)) {
          if (!confirm(`ALERTA DE CAPACIDADE!\n\nO veículo selecionado (${selectedVehicle.model}) possui ${maxCapacity} lugares.\nAtualmente há ${totalOccupancy} ocupados.\n\nAdicionar este(s) passageiro(s) excederá a capacidade para ${totalOccupancy + seatsNeeded}.\n\nDeseja continuar mesmo assim?`)) {
              return;
          }
      }

      setPassengers([...passengers, {
          patientId: patient.id,
          patientName: patient.name,
          hasCompanion: useComp,
          companionName: useComp ? manualConfig.companionName : undefined,
          hasSecondCompanion: useSecComp,
          secondCompanionName: useSecComp ? manualConfig.secondCompanionName : undefined,
          appointmentId: undefined,
          isReturn: manualConfig.mode === 'return',
          isRoundTrip: manualConfig.mode === 'round-trip',
          origin: manualConfig.origin || patient.address || tripDetails.origin,
          destination: tripDetails.destination,
          appointmentTime: manualConfig.appointmentTime || ''
      }]);
      setManualPaxId('');
      setManualConfig({
          hasCompanion: false, companionName: '', hasSecondCompanion: false, secondCompanionName: '',
          mode: 'round-trip', origin: '', appointmentTime: ''
      });
  };

  const updatePassenger = (index: number, field: string, value: any) => {
      const newPassengers = [...passengers];
      (newPassengers[index] as any)[field] = value;
      setPassengers(newPassengers);
  };

  const handleSaveTrip = () => {
      if (!tripDetails.date || !tripDetails.vehicleId || !tripDetails.driverId) {
          alert("Preencha Data, Veículo e Motorista.");
          return;
      }
      
      // --- VALIDAÇÃO DE DATA RETROATIVA ---
      const today = new Date().toISOString().split('T')[0];
      // Verifica se a viagem está em um status "ativo" (agendada, embarque)
      const isActiveStatus = [TripStatus.SCHEDULED, TripStatus.BOARDING].includes(tripDetails.status);
      
      // Se for nova viagem (!initialTrip), sempre bloqueia.
      // Se for edição, bloqueia apenas se o status não for finalizado (Concluída/Cancelada).
      if ((!initialTrip || isActiveStatus) && tripDetails.date < today) {
           alert("Data Inválida: O sistema não permite agendar viagens para datas retroativas (anteriores a hoje).");
           return;
      }
      // ------------------------------------

      if (passengers.length === 0) {
          alert("A lista de passageiros está vazia.");
          return;
      }

      if (selectedVehicle && totalOccupancy > selectedVehicle.capacity) {
          alert(`Capacidade Excedida!\n\nO veículo selecionado suporta apenas ${selectedVehicle.capacity} passageiros, mas a lista atual possui ${totalOccupancy}.\n\nRemova passageiros ou troque o veículo antes de salvar.`);
          return;
      }

      try {
          if (initialTrip) db.updateTrip(initialTrip.id, tripDetails, passengers);
          else db.addTrip(tripDetails, passengers);
          notify(initialTrip ? 'Viagem atualizada com sucesso!' : 'Viagem criada com sucesso!', 'success');
          onSave();
      } catch (e: any) {
          alert(e.message);
      }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* HEADER */}
        <div className="bg-white border-b border-slate-200 p-5 flex justify-between items-center shadow-sm z-20">
            <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    {initialTrip ? <Edit2 className="text-teal-600"/> : <Bus className="text-teal-600"/>}
                    {initialTrip ? 'Editar Viagem' : 'Nova Viagem'}
                </h2>
                <p className="text-sm text-slate-500">Planejamento logístico e manifesto de passageiros</p>
            </div>
            <div className="flex gap-3">
                <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors">Cancelar</button>
                <button onClick={handleSaveTrip} className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-bold shadow-lg shadow-teal-600/20 flex items-center gap-2">
                    <CheckCircle size={18}/> Salvar Viagem
                </button>
            </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-6">
                
                {/* 1. CONFIGURATION CARD (TOP) */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1 mb-4 border-b pb-2">
                        <Calendar size={14}/> Dados da Viagem
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div className="md:col-span-1">
                            <label className="text-xs font-bold text-slate-600 mb-1 block uppercase tracking-wide">Data de Saída</label>
                            <input type="date" className="w-full border border-slate-200 p-2.5 rounded-lg text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all text-sm" 
                                value={tripDetails.date} onChange={e => setTripDetails({...tripDetails, date: e.target.value})} />
                        </div>
                        <div className="md:col-span-1">
                            <label className="text-xs font-bold text-slate-600 mb-1 block uppercase tracking-wide">Horário</label>
                            <input type="time" className="w-full border border-slate-200 p-2.5 rounded-lg text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all text-sm" 
                                value={tripDetails.time} onChange={e => setTripDetails({...tripDetails, time: e.target.value})} />
                        </div>
                        <div className="md:col-span-1">
                            <label className="text-xs font-bold text-slate-600 mb-1 block uppercase tracking-wide">Veículo</label>
                            <select className="w-full border border-slate-200 p-2.5 rounded-lg text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all text-sm" 
                                value={tripDetails.vehicleId} onChange={e => setTripDetails({...tripDetails, vehicleId: e.target.value})}>
                                <option value="">Selecione...</option>
                                {db.vehicles.filter(v => v.status === 'active').map(v => (
                                    <option key={v.id} value={v.id}>{v.model} ({v.capacity} Lug.)</option>
                                ))}
                            </select>
                        </div>
                        <div className="md:col-span-1">
                            <label className="text-xs font-bold text-slate-600 mb-1 block uppercase tracking-wide">Motorista</label>
                            <select className="w-full border border-slate-200 p-2.5 rounded-lg text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all text-sm" 
                                value={tripDetails.driverId} onChange={e => setTripDetails({...tripDetails, driverId: e.target.value})}>
                                <option value="">Selecione...</option>
                                {db.drivers.filter(d => d.active).map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="md:col-span-1">
                            <label className="text-xs font-bold text-slate-600 mb-1 block uppercase tracking-wide">Destino Principal</label>
                            <input 
                                type="text" 
                                className="w-full border border-slate-200 p-2.5 rounded-lg text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all text-sm" 
                                placeholder="Cidade/Local"
                                value={tripDetails.destination} 
                                onChange={e => setTripDetails({...tripDetails, destination: formatInputText(e.target.value)})} 
                            />
                        </div>
                    </div>
                </div>

                {/* 2. SPLIT VIEW: ADD PASSENGERS (Left) vs MANIFEST (Right) */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 min-h-[500px]">
                    
                    {/* LEFT: ADD PASSENGER TOOLS */}
                    <div className="md:col-span-5 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                        <div className="flex border-b border-slate-100">
                            <button 
                                onClick={() => setActiveTab('suggestions')}
                                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'suggestions' ? 'border-teal-600 text-teal-700 bg-teal-50/50' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                            >
                                <Stethoscope size={16}/> Consultas ({suggestions.length})
                            </button>
                            <button 
                                onClick={() => setActiveTab('manual')}
                                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'manual' ? 'border-teal-600 text-teal-700 bg-teal-50/50' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                            >
                                <Plus size={16}/> Manual
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                            {activeTab === 'suggestions' ? (
                                <div className="space-y-3">
                                    {suggestions.length === 0 ? (
                                        <div className="text-center py-10 text-slate-400">
                                            <Search size={32} className="mx-auto mb-2 opacity-30"/>
                                            <p className="text-sm">Sem consultas para {formatDate(tripDetails.date)}</p>
                                        </div>
                                    ) : (
                                        suggestions.map(apt => {
                                            const patient = db.patients.find(p => p.id === apt.patientId);
                                            if (!patient) return null;
                                            
                                            // Initialize local state for this card
                                            initSuggestionState(apt.id, patient, apt);
                                            const state = suggestionStates[apt.id] || { mode: 'round-trip', useCompanion: false, useSecondCompanion: false };

                                            return (
                                                <div key={apt.id} className="bg-white border border-slate-200 rounded-lg p-3 hover:border-teal-300 transition-all shadow-sm">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <h4 className="font-bold text-slate-800 text-sm">{patient.name}</h4>
                                                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                                <MapPin size={10}/> {apt.destinationName || apt.treatmentName} <span className="text-slate-300">|</span> <Clock size={10}/> {apt.time}
                                                            </div>
                                                        </div>
                                                        {apt.isReturn && <span className="bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded font-bold uppercase">Retorno</span>}
                                                    </div>

                                                    {/* CARD CONTROLS */}
                                                    <div className="bg-slate-50 rounded border border-slate-100 p-2 mb-2 space-y-2">
                                                        {/* Trip Type Toggle */}
                                                        <div className="flex bg-white rounded border border-slate-200 p-0.5">
                                                            <button 
                                                                onClick={() => setSuggestionStates(p => ({...p, [apt.id]: {...state, mode: 'one-way'}}))}
                                                                className={`flex-1 text-[10px] font-bold py-1 rounded ${state.mode === 'one-way' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}
                                                            >
                                                                Só Ida
                                                            </button>
                                                            <button 
                                                                onClick={() => setSuggestionStates(p => ({...p, [apt.id]: {...state, mode: 'round-trip'}}))}
                                                                className={`flex-1 text-[10px] font-bold py-1 rounded ${state.mode === 'round-trip' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}
                                                            >
                                                                Ida+Volta
                                                            </button>
                                                            <button 
                                                                onClick={() => setSuggestionStates(p => ({...p, [apt.id]: {...state, mode: 'return'}}))}
                                                                className={`flex-1 text-[10px] font-bold py-1 rounded ${state.mode === 'return' ? 'bg-purple-600 text-white' : 'text-slate-500'}`}
                                                            >
                                                                Só Volta
                                                            </button>
                                                        </div>

                                                        {/* Companion Checks */}
                                                        <div className="flex flex-col gap-1">
                                                            {patient.allowsCompanion && (
                                                                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                                                                    <input type="checkbox" className="rounded text-teal-600" checked={state.useCompanion} onChange={e => setSuggestionStates(p => ({...p, [apt.id]: {...state, useCompanion: e.target.checked}}))} />
                                                                    <span>Acompanhante 1 ({patient.companionName})</span>
                                                                </label>
                                                            )}
                                                            {patient.allowsSecondCompanion && (
                                                                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                                                                    <input type="checkbox" className="rounded text-teal-600" checked={state.useSecondCompanion} onChange={e => setSuggestionStates(p => ({...p, [apt.id]: {...state, useSecondCompanion: e.target.checked}}))} />
                                                                    <span>Acompanhante 2 ({patient.secondCompanionName})</span>
                                                                </label>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <button onClick={() => handleAddSuggestion(apt)} className="w-full bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 font-bold text-xs py-1.5 rounded flex items-center justify-center gap-1 transition-colors">
                                                        <Plus size={14}/> Adicionar à Lista
                                                    </button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="bg-amber-50 border border-amber-100 p-3 rounded text-xs text-amber-800">
                                        Use esta opção apenas para pacientes que <strong>NÃO</strong> possuem consulta agendada (ex: caronas, administrativo).
                                    </div>
                                    
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Paciente</label>
                                        <PatientAutocomplete patients={db.patients} selectedId={manualPaxId} onChange={setManualPaxId} placeholder="Buscar paciente..." />
                                    </div>

                                    {selectedManualPatient && (
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Local de Embarque (Espera)</label>
                                            <div className="relative">
                                                <MapPin size={16} className="absolute left-3 top-2.5 text-slate-400" />
                                                <input
                                                    type="text"
                                                    className="w-full border border-slate-200 p-2 pl-9 rounded text-sm bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                                                    value={manualConfig.origin}
                                                    onChange={e => setManualConfig({...manualConfig, origin: formatInputText(e.target.value)})}
                                                    placeholder="Endereço ou Ponto de Referência"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {selectedManualPatient && selectedManualPatient.isTFD === false && (
                                         <div className="p-3 bg-white border rounded space-y-2">
                                            <div className="flex items-center gap-2">
                                                <input type="checkbox" checked={manualConfig.hasCompanion} onChange={e => setManualConfig({...manualConfig, hasCompanion: e.target.checked})} className="rounded" />
                                                <span className="text-sm">Levar Acompanhante?</span>
                                            </div>
                                            {manualConfig.hasCompanion && (
                                                <input type="text" placeholder="Nome do Acompanhante" className="w-full border p-1 rounded text-sm" value={manualConfig.companionName} onChange={e => setManualConfig({...manualConfig, companionName: formatInputText(e.target.value)})} />
                                            )}
                                         </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Tipo de Trecho</label>
                                            <select className="w-full border border-slate-200 p-2 rounded text-sm bg-white focus:ring-2 focus:ring-teal-500 outline-none" value={manualConfig.mode} onChange={e => setManualConfig({...manualConfig, mode: e.target.value as any})}>
                                                <option value="round-trip">Ida e Volta</option>
                                                <option value="one-way">Só Ida</option>
                                                <option value="return">Só Volta</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Horário Consulta</label>
                                            <input 
                                                type="time" 
                                                className="w-full border border-slate-200 p-2 rounded text-sm bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                                                value={manualConfig.appointmentTime} 
                                                onChange={e => setManualConfig({...manualConfig, appointmentTime: e.target.value})}
                                            />
                                        </div>
                                    </div>

                                    <button onClick={handleManualAdd} disabled={!manualPaxId} className="w-full bg-slate-800 text-white font-bold py-2 rounded hover:bg-slate-900 disabled:opacity-50 shadow-md">
                                        Adicionar Manualmente
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: MANIFEST LIST */}
                    <div className="md:col-span-7 bg-slate-50 rounded-xl shadow-inner border border-slate-200 flex flex-col overflow-hidden">
                        <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
                            <div>
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    <Users size={18}/> Manifesto de Passageiros
                                </h3>
                                <p className="text-xs text-slate-500">{passengers.length} Pessoas listadas</p>
                            </div>
                            <div className="text-right">
                                <div className={`text-sm font-bold ${maxCapacity > 0 && totalOccupancy > maxCapacity ? 'text-red-600' : 'text-slate-700'}`}>
                                    Lotação: {totalOccupancy} / {maxCapacity || '-'}
                                </div>
                                <div className="w-32 h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1">
                                    <div className={`h-full ${maxCapacity > 0 && totalOccupancy > maxCapacity ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${maxCapacity ? Math.min((totalOccupancy / maxCapacity) * 100, 100) : 0}%` }}></div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {passengers.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                                    <Bus size={48} className="mb-2"/>
                                    <p className="text-sm font-medium">Lista de passageiros vazia</p>
                                </div>
                            ) : (
                                passengers.map((p, idx) => (
                                    <div key={idx} className="bg-white border border-slate-200 p-3 rounded-lg flex items-center justify-between group hover:border-teal-300 transition-colors shadow-sm">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${p.hasCompanion || p.patientName.includes('Acompanhante') ? 'bg-blue-100 text-blue-700' : 'bg-teal-100 text-teal-700'}`}>
                                                {idx + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-slate-800 text-sm flex items-center gap-2 truncate">
                                                    {p.patientName}
                                                    {p.hasCompanion && <span className="bg-blue-50 text-blue-600 text-[10px] px-1.5 py-0.5 rounded border border-blue-100 flex-shrink-0">ACOMP</span>}
                                                </div>
                                                
                                                {/* Editables: Origin and Appointment Time */}
                                                <div className="mt-1.5 flex items-center gap-1.5">
                                                    <div className="flex-1 relative">
                                                        <MapPin size={10} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-teal-500" />
                                                        <input 
                                                            type="text" 
                                                            className="w-full text-xs border border-slate-200 rounded px-2 pl-5 py-1 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-teal-500 outline-none text-slate-700 placeholder:text-slate-400"
                                                            value={p.origin || ''}
                                                            placeholder="Local de Embarque/Espera"
                                                            onChange={(e) => updatePassenger(idx, 'origin', formatInputText(e.target.value))}
                                                        />
                                                    </div>
                                                    <div className="w-24 relative">
                                                        <Clock size={10} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-teal-500" />
                                                        <input 
                                                            type="time" 
                                                            className="w-full text-xs border border-slate-200 rounded px-2 pl-5 py-1 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-teal-500 outline-none text-slate-700"
                                                            value={p.appointmentTime || ''}
                                                            title="Horário da Consulta"
                                                            onChange={(e) => updatePassenger(idx, 'appointmentTime', e.target.value)}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                                                    {p.isReturn ? <span className="text-purple-600 font-bold flex items-center gap-0.5"><RotateCcw size={10}/> Retorno</span> : <span className="flex items-center gap-0.5"><ArrowRight size={10}/> Ida</span>}
                                                    <span className="text-slate-300">|</span>
                                                    <span className="truncate">Dest: {p.destination}</span>
                                                    {p.companionName && <span className="text-slate-400 italic truncate">(+ {p.companionName})</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => setPassengers(prev => prev.filter((_, i) => i !== idx))}
                                            className="text-slate-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors ml-2"
                                        >
                                            <X size={16}/>
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
      </div>
    </div>
  );
};

export const TripManager: React.FC = () => {
    const [trips, setTrips] = useState<Trip[]>(db.trips);
    const [showModal, setShowModal] = useState(false);
    const [editingTrip, setEditingTrip] = useState<Trip | undefined>(undefined);
    const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const { notify } = useNotification();

    const refresh = () => setTrips([...db.trips]);

    const handleDelete = (id: string) => {
        if (confirm("Deseja realmente excluir esta viagem?")) {
            db.deleteTrip(id);
            refresh();
            notify("Viagem excluída com sucesso.", "success");
        }
    };

    const handleStatusChange = (id: string, newStatus: TripStatus) => {
        db.updateTripStatus(id, newStatus);
        refresh();
        notify(`Status atualizado para: ${newStatus}`, "info");
    };

    const printManifest = (trip: Trip) => {
        const doc = new jsPDF();
        const institution = db.institution;

        // --- 1. HEADER (Instituição) ---
        if (institution.logo) {
            try { doc.addImage(institution.logo, 'PNG', 14, 8, 20, 20); } catch (e) { console.warn(e); }
        }
        
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(institution.name || "MANIFESTO DE VIAGEM TFD", 105, 15, { align: 'center' });
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(institution.subtitle || "LISTA DE PASSAGEIROS - ACOMPANHAMENTO", 105, 20, { align: 'center' });

        // --- 2. DADOS DA VIAGEM ---
        doc.setFontSize(10);
        doc.setLineWidth(0.1);
        doc.line(14, 25, 196, 25); // Linha Superior

        doc.setFont("helvetica", "bold");
        doc.text("DATA:", 14, 31);
        doc.setFont("helvetica", "normal");
        doc.text(formatDate(trip.date), 27, 31);

        doc.setFont("helvetica", "bold");
        doc.text("HORA:", 60, 31);
        doc.setFont("helvetica", "normal");
        doc.text(trip.time, 73, 31);

        doc.setFont("helvetica", "bold");
        doc.text("VEÍCULO:", 100, 31);
        doc.setFont("helvetica", "normal");
        doc.text(`${trip.vehicleModel} (${trip.vehiclePlate})`, 118, 31);

        doc.setFont("helvetica", "bold");
        doc.text("MOTORISTA:", 14, 37);
        doc.setFont("helvetica", "normal");
        doc.text(trip.driverName, 37, 37);

        doc.setFont("helvetica", "bold");
        doc.text("DESTINO:", 100, 37);
        doc.setFont("helvetica", "normal");
        doc.text(trip.destination, 118, 37);

        // --- 3. LÓGICA DE AGRUPAMENTO (Paciente + Acompanhantes) ---
        const organizedPassengers: any[] = [];
        const processedIds = new Set<string>();

        // Primeiro, pega todos que NÃO são acompanhantes (Pacientes principais)
        const mainPatients = (trip.passengers || []).filter(p => !p.isCompanion);

        mainPatients.forEach(patient => {
            // Busca dados extras do paciente (como CPF) do cadastro original
            const patientRecord = db.patients.find(p => p.id === patient.patientId);
            
            // Adiciona Paciente
            organizedPassengers.push({
                ...patient,
                displayType: 'PATIENT',
                cpf: patientRecord?.cpf || '' // Garante CPF se disponível
            });
            processedIds.add(patient.id);

            // Busca acompanhantes deste paciente específico
            const companions = (trip.passengers || []).filter(p => 
                p.isCompanion && 
                (p.relatedPatientId === patient.patientId || p.patientId === patient.patientId)
            );

            companions.forEach(comp => {
                if (!processedIds.has(comp.id)) {
                    organizedPassengers.push({
                        ...comp,
                        displayType: 'COMPANION',
                        cpf: comp.patientId ? db.patients.find(p => p.id === comp.patientId)?.companionCPF : '' // Tenta achar CPF do acomp
                    });
                    processedIds.add(comp.id);
                }
            });
        });

        // Adiciona orfãos (se houver erro de integridade, apenas por segurança)
        (trip.passengers || []).forEach(p => {
            if (!processedIds.has(p.id)) {
                organizedPassengers.push({ ...p, displayType: p.isCompanion ? 'COMPANION' : 'PATIENT', cpf: '' });
            }
        });

        // --- 4. GERAÇÃO DA TABELA ---
        const tableColumn = ["#", "NOME DO PASSAGEIRO", "CPF / RG", "LOCAL EMBARQUE", "DESTINO / OBS", "HORA\nCONS.", "ASSINATURA"];
        
        const tableRows = organizedPassengers.map((p, index) => {
            // Formatação do Nome (Recuo para acompanhantes)
            const nameDisplay = p.displayType === 'COMPANION' 
                ? `   ↳ Acomp.: ${p.patientName}` 
                : p.patientName;

            return [
                index + 1,
                nameDisplay,
                maskCPF(p.cpf || ''),
                p.origin || '-', 
                p.destination || trip.destination,
                p.appointmentTime || '-', // Coluna Validada de Horário
                "" // Espaço para assinatura
            ];
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 45,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2, valign: 'middle', lineColor: [200, 200, 200] },
            headStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: 'bold', lineWidth: 0.1 },
            columnStyles: { 
                0: { cellWidth: 7, halign: 'center' }, 
                1: { cellWidth: 60, fontStyle: 'bold' }, // Nome mais largo e negrito
                2: { cellWidth: 25 },
                3: { cellWidth: 35 },
                4: { cellWidth: 25 },
                5: { cellWidth: 12, halign: 'center', fontStyle: 'bold', textColor: [0, 0, 100] }, // Destaque na Hora
                6: { cellWidth: 25 }
            }
        });

        // Rodapé
        const pageCount = (doc as any).internal.getNumberOfPages();
        for(let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.text(`Impresso em: ${new Date().toLocaleString('pt-BR')} - Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
        }

        doc.save(`Manifesto_${formatDate(trip.date).replace(/\//g, '-')}.pdf`);
    };

    const toggleExpand = (id: string) => {
        setExpandedTripId(expandedTripId === id ? null : id);
    };

    const filteredTrips = trips.filter(t => 
        (t.destination.toLowerCase().includes(search.toLowerCase()) || 
         t.driverName.toLowerCase().includes(search.toLowerCase()) ||
         t.vehicleModel.toLowerCase().includes(search.toLowerCase())) &&
        (!dateFilter || t.date === dateFilter) &&
        (!statusFilter || t.status === statusFilter)
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="space-y-6">
            {/* Header & Controls */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Bus className="text-teal-600" /> Gestão de Viagens
                    </h1>
                    <button 
                        onClick={() => { setEditingTrip(undefined); setShowModal(true); }}
                        className="bg-teal-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-teal-700 shadow-sm transition-transform active:scale-95"
                    >
                        <Plus size={18} /> <span>Nova Viagem</span>
                    </button>
                </div>
                
                <div className="flex flex-wrap gap-4 items-center">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar por destino, motorista ou veículo..." 
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-sm bg-slate-50 focus:bg-white transition-colors"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <input 
                        type="date" 
                        className="border border-slate-200 p-2 rounded-lg text-sm text-slate-700 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
                        value={dateFilter}
                        onChange={e => setDateFilter(e.target.value)}
                    />
                    <select
                        className="border border-slate-200 p-2 rounded-lg text-sm text-slate-700 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                    >
                        <option value="">Todos Status</option>
                        <option value={TripStatus.SCHEDULED}>Agendada</option>
                        <option value={TripStatus.BOARDING}>Embarque</option>
                        <option value={TripStatus.COMPLETED}>Concluída</option>
                        <option value={TripStatus.CANCELLED}>Cancelada</option>
                    </select>
                </div>
            </div>

            {/* MAIN TABLE View */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-bold border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 w-10"></th>
                            <th className="px-6 py-4">Data / Hora</th>
                            <th className="px-6 py-4">Rota (Origem <ArrowRight size={10} className="inline"/> Destino)</th>
                            <th className="px-6 py-4">Veículo / Motorista</th>
                            <th className="px-6 py-4 text-center">Lotação</th>
                            <th className="px-6 py-4 text-center">Status</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                        {filteredTrips.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                                    <div className="flex flex-col items-center gap-2">
                                        <Bus size={32} className="opacity-20"/>
                                        <p>Nenhuma viagem encontrada.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                        {filteredTrips.map(trip => {
                            const isExpanded = expandedTripId === trip.id;
                            const occupancyPercent = Math.min((trip.occupiedSeats / trip.totalSeats) * 100, 100);
                            
                            return (
                                <React.Fragment key={trip.id}>
                                    <tr 
                                        className={`hover:bg-slate-50 transition-colors cursor-pointer border-l-4 ${isExpanded ? 'bg-slate-50 border-l-teal-500' : 'border-l-transparent'}`}
                                        onClick={() => toggleExpand(trip.id)}
                                    >
                                        <td className="px-6 py-4 text-center">
                                            {isExpanded ? <ChevronUp size={18} className="text-teal-600"/> : <ChevronDown size={18} className="text-slate-400"/>}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-800">{formatDate(trip.date)}</div>
                                            <div className="text-xs text-slate-500 flex items-center gap-1"><Clock size={12}/> {trip.time}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-800">{trip.destination}</div>
                                            <div className="text-xs text-slate-500 flex items-center gap-1">De: {trip.origin}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-800">{trip.vehicleModel} <span className="text-slate-400 text-xs">({trip.vehiclePlate})</span></div>
                                            <div className="text-xs text-slate-500 flex items-center gap-1"><User size={12}/> {trip.driverName}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col items-center w-24 mx-auto">
                                                <div className="text-xs font-bold mb-1">{trip.occupiedSeats} / {trip.totalSeats}</div>
                                                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full ${occupancyPercent > 100 ? 'bg-red-500' : 'bg-teal-500'}`} style={{ width: `${occupancyPercent}%` }}></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${
                                                trip.status === TripStatus.COMPLETED ? 'bg-green-100 text-green-700 border-green-200' :
                                                trip.status === TripStatus.CANCELLED ? 'bg-red-100 text-red-700 border-red-200' :
                                                trip.status === TripStatus.BOARDING ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                                'bg-blue-100 text-blue-700 border-blue-200'
                                            }`}>
                                                {trip.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                                                <button onClick={() => printManifest(trip)} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Imprimir Manifesto">
                                                    <Printer size={18} />
                                                </button>
                                                <button onClick={() => { setEditingTrip(trip); setShowModal(true); }} className="p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors" title="Editar">
                                                    <Edit2 size={18} />
                                                </button>
                                                <button onClick={() => handleDelete(trip.id)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Excluir">
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    
                                    {/* EXPANDED ROW DETAIL */}
                                    {isExpanded && (
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <td colSpan={7} className="px-6 py-4 cursor-default">
                                                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm animate-in slide-in-from-top-2">
                                                    
                                                    {/* Control Bar inside expansion */}
                                                    <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                                                        <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                                                            <Users size={16} className="text-teal-600"/> Lista de Passageiros (Manifesto Rápido)
                                                        </h4>
                                                        
                                                        {/* Quick Status Actions */}
                                                        {trip.status !== TripStatus.CANCELLED && trip.status !== TripStatus.COMPLETED && (
                                                            <div className="flex gap-2">
                                                                {trip.status === TripStatus.SCHEDULED && (
                                                                    <button 
                                                                        onClick={() => handleStatusChange(trip.id, TripStatus.BOARDING)}
                                                                        className="px-3 py-1.5 bg-amber-500 text-white rounded text-xs font-bold hover:bg-amber-600 shadow-sm"
                                                                    >
                                                                        Iniciar Embarque
                                                                    </button>
                                                                )}
                                                                <button 
                                                                    onClick={() => handleStatusChange(trip.id, TripStatus.COMPLETED)}
                                                                    className="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-700 shadow-sm"
                                                                >
                                                                    Concluir Viagem
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleStatusChange(trip.id, TripStatus.CANCELLED)}
                                                                    className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded text-xs font-bold hover:bg-red-100"
                                                                >
                                                                    Cancelar
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Passenger Table */}
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-xs text-left">
                                                            <thead className="bg-slate-100 text-slate-500 uppercase font-semibold">
                                                                <tr>
                                                                    <th className="p-2 w-8 text-center">#</th>
                                                                    <th className="p-2">Nome</th>
                                                                    <th className="p-2">Local Embarque</th>
                                                                    <th className="p-2">Destino</th>
                                                                    <th className="p-2 text-center">H. Cons.</th>
                                                                    <th className="p-2 text-center">Tipo</th>
                                                                    <th className="p-2 text-center">Status</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {trip.passengers.length === 0 ? (
                                                                    <tr><td colSpan={7} className="p-4 text-center text-slate-400 italic">Nenhum passageiro adicionado.</td></tr>
                                                                ) : (
                                                                    trip.passengers.map((p, idx) => (
                                                                        <tr key={idx} className="hover:bg-slate-50">
                                                                            <td className="p-2 text-center font-mono text-slate-400">{idx + 1}</td>
                                                                            <td className="p-2 font-bold text-slate-700">
                                                                                {p.patientName}
                                                                                {p.isCompanion && <div className="text-[10px] font-normal text-slate-400">Acomp. de {p.relatedPatientName}</div>}
                                                                            </td>
                                                                            <td className="p-2 text-slate-600">{p.origin || trip.origin}</td>
                                                                            <td className="p-2 text-slate-600">{p.destination || trip.destination}</td>
                                                                            <td className="p-2 text-center font-bold text-blue-600">{p.appointmentTime || '-'}</td>
                                                                            <td className="p-2 text-center">
                                                                                {p.isCompanion ? 
                                                                                    <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-bold border border-blue-100">ACOMP</span> : 
                                                                                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold">PACIENTE</span>
                                                                                }
                                                                            </td>
                                                                            <td className="p-2 text-center">
                                                                                <span className={`text-[10px] font-bold uppercase ${
                                                                                    p.status === 'boarded' ? 'text-green-600' :
                                                                                    p.status === 'missing' ? 'text-red-500' : 'text-blue-600'
                                                                                }`}>
                                                                                    {p.status === 'confirmed' ? 'Confirmado' : p.status === 'boarded' ? 'Embarcou' : 'Faltou'}
                                                                                </span>
                                                                            </td>
                                                                        </tr>
                                                                    ))
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <NewTripModal 
                    onClose={() => setShowModal(false)}
                    onSave={() => { setShowModal(false); refresh(); }}
                    initialTrip={editingTrip}
                />
            )}
        </div>
    );
};