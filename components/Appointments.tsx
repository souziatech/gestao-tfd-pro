import React, { useState, useMemo, useEffect, useRef } from 'react';
import { db } from '../services/store';
import { Appointment, Patient } from '../types';
import { Plus, Edit, Search, Calendar, CheckCircle, Clock, AlertTriangle, Paperclip, Upload, FileText, Trash2, Download, X, RotateCcw, ChevronDown, User, XCircle, AlertCircle, MapPin, Stethoscope, ArrowRight, Filter } from 'lucide-react';
import { NewTripModal } from './TripManagement';
import { maskCPF, formatDate, PatientAutocomplete, formatInputText } from './Shared';
import { useNotification } from './NotificationContext';

export const AppointmentManager: React.FC = () => {
  // Main state: Starts empty
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Filters State
  const [filterDate, setFilterDate] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTreatment, setFilterTreatment] = useState('');
  const [filterOnlyReturn, setFilterOnlyReturn] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<Partial<Appointment>>({});
  
  const [showTripModal, setShowTripModal] = useState(false);
  const [pendingAppointmentForTrip, setPendingAppointmentForTrip] = useState<Appointment | undefined>(undefined);

  const { notify } = useNotification();

  const handleSearch = () => {
      let filtered = db.appointments;

      // Apply Filters directly from DB
      if (filterDate) {
          filtered = filtered.filter(a => a.date === filterDate);
      }
      if (filterName) {
          const term = filterName.toLowerCase();
          filtered = filtered.filter(a => a.patientName.toLowerCase().includes(term));
      }
      if (filterLocation) {
          const term = filterLocation.toLowerCase();
          filtered = filtered.filter(a => (a.destinationName || '').toLowerCase().includes(term));
      }
      if (filterTreatment) {
          filtered = filtered.filter(a => a.treatmentId === filterTreatment);
      }
      if (filterStatus) {
          filtered = filtered.filter(a => a.status === filterStatus);
      }
      if (filterOnlyReturn) {
          filtered = filtered.filter(a => a.isReturn);
      }

      // Sort
      filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setAppointments(filtered);
      setHasSearched(true);
  };

  const clearFilters = () => {
      setFilterDate(''); setFilterName(''); setFilterLocation(''); setFilterStatus(''); setFilterTreatment(''); setFilterOnlyReturn(false);
      setAppointments([]);
      setHasSearched(false);
  };

  const refresh = () => {
      if (hasSearched) handleSearch();
  };

  const handleSave = () => {
    if (!formData.patientId || !formData.date) {
        alert("Paciente e Data são obrigatórios.");
        return;
    }
    
    // --- VALIDAÇÃO DE DATA RETROATIVA ---
    const today = new Date().toISOString().split('T')[0];
    // Verifica se o status é 'ativo' (pendente, agendada, reagendada) ou se é um novo registro (status undefined/null)
    const isActiveStatus = !formData.status || ['pending', 'scheduled_trip', 'rescheduled'].includes(formData.status);
    
    // Se for ativo/novo e a data for menor que hoje, bloqueia.
    if (isActiveStatus && formData.date < today) {
         alert("Data Inválida: O sistema não permite novos agendamentos para datas retroativas (anteriores a hoje).");
         return;
    }
    // ------------------------------------

    // Validation: Needs Treatment OR Destination
    if (!formData.treatmentId && !formData.destinationId) {
        alert("Selecione um Tipo de Tratamento ou um Local de Atendimento.");
        return;
    }

    // DUPLICATE VALIDATION
    if (db.checkDuplicateAppointment(formData.patientId, formData.date, formData.treatmentId, formData.destinationId, formData.id)) {
        alert("AVISO: Já existe uma consulta agendada para este paciente, nesta mesma data e para este mesmo tratamento/local.");
        return;
    }

    const patient = db.patients.find(p => p.id === formData.patientId);
    const treatment = db.treatmentTypes.find(s => s.id === formData.treatmentId);
    const destination = db.destinations.find(d => d.id === formData.destinationId);

    const commonData = {
        patientName: patient?.name || '',
        treatmentName: treatment?.name || '',
        destinationName: destination?.name || ''
    };

    if (formData.id) {
       const idx = db.appointments.findIndex(a => a.id === formData.id);
       if (idx >= 0) {
           const existingAppt = db.appointments[idx];

           if (existingAppt.status === 'scheduled_trip' && existingAppt.tripId && formData.date !== existingAppt.date) {
               if (confirm(`A data da consulta foi alterada de ${formatDate(existingAppt.date)} para ${formatDate(formData.date || '')}. \n\nIsto irá remover o passageiro da viagem agendada. Deseja continuar?`)) {
                   db.updateAppointmentStatus(existingAppt.id, 'pending');
                   formData.status = 'pending';
                   formData.tripId = undefined;
               } else {
                   return; 
               }
           }

           if (formData.status === 'scheduled_trip' && formData.tripId && (!existingAppt.tripId || existingAppt.tripId !== formData.tripId)) {
               try {
                  db.assignAppointmentToTrip(formData.id, formData.tripId);
               } catch (e: any) {
                   alert(e.message);
                   return;
               }
           }
           
           if ((formData.status === 'cancelled' || formData.status === 'missed') && formData.tripId) {
               db.updateAppointmentStatus(formData.id, formData.status);
               const updated = db.appointments.find(a => a.id === formData.id);
               if (updated) {
                   Object.assign(updated, {
                       ...formData,
                       tripId: undefined,
                       ...commonData
                   });
                   db.save();
               }
           } else {
               db.appointments[idx] = { 
                   ...db.appointments[idx], 
                   ...formData,
                   ...commonData
                } as Appointment;
                db.save();
           }
       }
    } else {
       const newApp: Appointment = {
           id: Date.now().toString(),
           patientId: formData.patientId,
           patientName: patient?.name || 'Desconhecido',
           destinationId: formData.destinationId,
           destinationName: destination?.name || '',
           treatmentId: formData.treatmentId,
           treatmentName: treatment?.name || '',
           date: formData.date,
           time: formData.time || '00:00',
           notes: formData.notes || '',
           documents: formData.documents || '',
           status: 'pending',
           isReturn: formData.isReturn || false
       };
       db.appointments.push(newApp);
       db.save();
    }
    notify('Agendamento salvo com sucesso!', 'success');
    refresh();
    setShowModal(false);
    setFormData({});
  };

  const updateStatus = (id: string, newStatus: string) => {
      const appt = db.appointments.find(a => a.id === id);
      if (!appt) return;

      if (newStatus === 'scheduled_trip') {
          setFormData({ ...appt, status: 'scheduled_trip' });
          setShowModal(true);
          return;
      }

      if ((newStatus === 'cancelled' || newStatus === 'missed') && appt.status === 'scheduled_trip') {
          if (!window.confirm("Esta consulta está vinculada a uma viagem. Mudar o status removerá o passageiro da viagem. Deseja continuar?")) {
              return;
          }
      }

      try {
        db.updateAppointmentStatus(id, newStatus as any);
        refresh();
        if (newStatus === 'cancelled') notify('Consulta cancelada.', 'warning');
        else if (newStatus === 'missed') notify('Consulta marcada como FALTOU.', 'error');
        else notify('Status da consulta atualizado.', 'info');
      } catch (e: any) {
        alert(e.message);
      }
  };

  const handleDelete = (id: string) => {
      if (confirm("Tem certeza que deseja excluir esta consulta? Se estiver vinculada a uma viagem, o passageiro será removido.")) {
          try {
              db.deleteAppointment(id);
              refresh();
              notify('Consulta excluída com sucesso.', 'success');
          } catch (e: any) {
              notify(e.message, 'error');
          }
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { 
        alert("O arquivo é muito grande (Máx 5MB)");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        const fileData = {
          name: file.name,
          type: file.type,
          data: result
        };
        setFormData({ ...formData, documents: JSON.stringify(fileData) });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeFile = () => {
      setFormData({ ...formData, documents: '' });
  };

  const openDocument = (docString: string) => {
      if (!docString) return;
      try {
          const doc = JSON.parse(docString);
          if (doc.data) {
              const link = document.createElement('a');
              link.href = doc.data;
              link.download = doc.name || 'documento';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
          }
      } catch (e) {
          alert("Nota de documento: " + docString);
      }
  };

  const availableTripsForDate = useMemo(() => {
      if (!formData.date) return [];
      return db.trips.filter(t => t.date === formData.date);
  }, [formData.date, db.trips]);

  const handleCreateTripClick = () => {
    if (formData.patientId && formData.date && (formData.treatmentId || formData.destinationId)) {
        const tempAppt = {
            ...formData,
            id: formData.id || 'temp', 
            patientName: db.patients.find(p => p.id === formData.patientId)?.name || '',
            treatmentName: db.treatmentTypes.find(s => s.id === formData.treatmentId)?.name || '',
            destinationName: db.destinations.find(d => d.id === formData.destinationId)?.name || '',
        } as Appointment;

        if (!formData.id) {
            const newId = Date.now().toString();
            const newApp = { ...tempAppt, id: newId, status: 'pending' as const };
            db.appointments.push(newApp);
            db.save();
            setPendingAppointmentForTrip(newApp);
        } else {
            setPendingAppointmentForTrip(tempAppt);
        }

        setShowModal(false);
        setShowTripModal(true);
    } else {
        alert("Preencha Paciente, Data e o Local/Tratamento antes de criar a viagem.");
    }
  };

  const getStatusColor = (status: string) => {
      switch(status) {
          case 'pending': return 'bg-yellow-100 text-yellow-800';
          case 'scheduled_trip': return 'bg-blue-100 text-blue-800';
          case 'completed': return 'bg-green-100 text-green-800';
          case 'cancelled': return 'bg-red-100 text-red-800';
          case 'missed': return 'bg-orange-100 text-orange-800';
          case 'rescheduled': return 'bg-purple-100 text-purple-800';
          default: return 'bg-slate-100 text-slate-800';
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-800">Agendamento de Consultas</h1>
        <button onClick={() => { setFormData({}); setShowModal(true); }} className="bg-teal-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-teal-700 shadow-sm transition-all hover:scale-105 active:scale-95">
          <Plus size={18} /> <span>Nova Consulta</span>
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-3 items-end">
              <div className="col-span-1">
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Data</label>
                  <input 
                    type="date" 
                    className="w-full border border-slate-200 rounded-lg p-2 text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 transition-colors" 
                    value={filterDate} 
                    onChange={e => setFilterDate(e.target.value)} 
                  />
              </div>
              <div className="col-span-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Paciente</label>
                  <input 
                    type="text" 
                    placeholder="Nome do paciente" 
                    className="w-full border border-slate-200 rounded-lg p-2 text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400 transition-colors" 
                    value={filterName} 
                    onChange={e => setFilterName(e.target.value)} 
                  />
              </div>
              <div className="col-span-1">
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Local</label>
                  <input 
                    type="text" 
                    placeholder="Hospital/Clínica" 
                    className="w-full border border-slate-200 rounded-lg p-2 text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400 transition-colors" 
                    value={filterLocation} 
                    onChange={e => setFilterLocation(e.target.value)} 
                  />
              </div>
              <div className="col-span-1">
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Status</label>
                  <select 
                    className="w-full border border-slate-200 rounded-lg p-2 text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 transition-colors" 
                    value={filterStatus} 
                    onChange={e => setFilterStatus(e.target.value)}
                  >
                      <option value="">Todos</option>
                      <option value="pending">Pendente</option>
                      <option value="scheduled_trip">Em Viagem</option>
                      <option value="completed">Concluída</option>
                      <option value="cancelled">Cancelada</option>
                  </select>
              </div>
              <div className="col-span-1 flex items-end">
                  <button onClick={handleSearch} className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-slate-900 transition-colors">
                      <Search size={16} /> Buscar
                  </button>
              </div>
          </div>
          {/* Advanced / Extra Filters toggle row could go here */}
          <div className="mt-3 flex flex-wrap gap-4 items-center border-t border-slate-100 pt-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" className="rounded text-purple-600" checked={filterOnlyReturn} onChange={e => setFilterOnlyReturn(e.target.checked)} />
                  <span className={`text-sm font-medium ${filterOnlyReturn ? 'text-purple-700' : 'text-slate-600'}`}>Apenas Retornos</span>
              </label>
              <div className="flex-1"></div>
              {(hasSearched || filterDate || filterName || filterLocation || filterStatus) && (
                  <button onClick={clearFilters} className="text-sm text-red-500 hover:underline">Limpar Filtros</button>
              )}
          </div>
      </div>

      {/* RESULTS TABLE */}
      {!hasSearched ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <Filter size={48} className="mb-4 opacity-20" />
              <p className="font-medium">Utilize os filtros acima para encontrar consultas.</p>
          </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
            <div className="p-3 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase">
                {appointments.length} Consultas Encontradas
            </div>
            <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-800 font-semibold text-sm">
                    <tr>
                        <th className="px-6 py-4">Data</th>
                        <th className="px-6 py-4">Horário</th>
                        <th className="px-6 py-4">Paciente</th>
                        <th className="px-6 py-4">Tratamento e Local</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                    {appointments.length === 0 && (
                        <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                                <Search size={32} className="text-slate-300" />
                                <p>Nenhum resultado para os filtros aplicados.</p>
                            </td>
                        </tr>
                    )}
                    {appointments.map(a => {
                        const treatmentData = a.treatmentId ? db.treatmentTypes.find(t => t.id === a.treatmentId) : null;
                        const specialistName = treatmentData?.specialistName;
                        
                        return (
                        <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-900">{formatDate(a.date)}</td>
                            <td className="px-6 py-4 text-slate-700 font-mono">{a.time}</td>
                            <td className="px-6 py-4 text-slate-900">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">{a.patientName}</span>
                                    {a.isReturn && (
                                        <span className="flex items-center gap-1 text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                            Retorno
                                        </span>
                                    )}
                                    {a.documents && (
                                        <button 
                                            onClick={() => openDocument(a.documents!)}
                                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1.5 rounded-full transition-colors ml-1"
                                            title="Baixar Documento/Anexo"
                                        >
                                            <FileText size={14} />
                                        </button>
                                    )}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex flex-col">
                                    {(a.treatmentName || a.destinationName) ? (
                                        <>
                                            {a.treatmentName && (
                                                <div className="text-slate-900 font-bold flex flex-col gap-0.5">
                                                    <span className="flex items-center gap-1"><Stethoscope size={14} className="text-slate-400" /> {a.treatmentName}</span>
                                                    {specialistName && <span className="text-xs text-teal-600 font-medium pl-5">{specialistName}</span>}
                                                </div>
                                            )}
                                            {a.destinationName && (
                                                <span className="text-slate-600 text-xs flex items-center gap-1 mt-1 pl-0.5">
                                                    <MapPin size={12} className="text-slate-400" /> {a.destinationName}
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <span className="text-slate-400 italic">Não especificado</span>
                                    )}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="relative group inline-block">
                                    <select 
                                        value={a.status} 
                                        onChange={(e) => updateStatus(a.id, e.target.value)}
                                        className={`appearance-none pl-3 pr-8 py-1.5 text-xs rounded-full font-bold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-teal-500 transition-shadow ${getStatusColor(a.status)}`}
                                    >
                                        <option value="pending">Pendente</option>
                                        <option value="scheduled_trip">Em Viagem</option>
                                        <option value="completed">Concluída</option>
                                        <option value="cancelled">Cancelada</option>
                                        <option value="missed">Faltou</option>
                                        <option value="rescheduled">Reagendada</option>
                                    </select>
                                    <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                                </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-1">
                                    <button onClick={() => { setFormData(a); setShowModal(true); }} className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors"><Edit size={16} /></button>
                                    <button onClick={() => handleDelete(a.id)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"><Trash2 size={16} /></button>
                                </div>
                            </td>
                        </tr>
                    )})}
                </tbody>
            </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start p-6 border-b border-slate-100 bg-white sticky top-0 z-10">
              <div className="flex flex-col">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  {formData.id ? <Edit size={20} className="text-teal-600" /> : <Plus size={20} className="text-teal-600" />}
                  {formData.id ? 'Editar Agendamento' : 'Nova Consulta'}
                </h2>
                <p className="text-sm text-slate-500 mt-1">Preencha os dados clínicos e de agendamento do paciente.</p>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-8 flex-1">
              
              {/* SECTION 1: Patient Selection */}
              <div className="space-y-3">
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    <User size={14} className="text-teal-600" /> Seleção do Paciente
                 </label>
                 <PatientAutocomplete 
                    patients={db.patients}
                    selectedId={formData.patientId || ''}
                    onChange={(id) => setFormData({...formData, patientId: id})}
                    disabled={!!formData.id}
                    placeholder="Digite o nome ou CPF do paciente..."
                  />
              </div>

              {/* SECTION 2: Clinical Data */}
              <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-100 space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2 mb-2">
                     <Stethoscope size={16} className="text-teal-600" /> 
                     <span className="text-sm font-bold text-slate-700">Dados Clínicos e Localização</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tipo de Tratamento</label>
                          <select 
                              className="w-full border border-slate-200 p-2.5 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all text-sm" 
                              value={formData.treatmentId || ''} 
                              onChange={e => {
                                  const treatId = e.target.value;
                                  const treatment = db.treatmentTypes.find(s => s.id === treatId);
                                  setFormData({
                                      ...formData, 
                                      treatmentId: treatId,
                                      destinationId: treatment?.defaultDestinationId || formData.destinationId
                                  });
                              }}
                          >
                              <option value="">-- Selecione (Opcional) --</option>
                              {db.treatmentTypes.map(s => (
                                  <option key={s.id} value={s.id}>
                                      {s.name} {s.specialistName ? `(${s.specialistName})` : ''}
                                  </option>
                              ))}
                          </select>
                      </div>

                      <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Local de Atendimento</label>
                          <select 
                              className="w-full border border-slate-200 p-2.5 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all text-sm" 
                              value={formData.destinationId || ''} 
                              onChange={e => setFormData({...formData, destinationId: e.target.value})}
                          >
                              <option value="">-- Selecione o Local --</option>
                              {db.destinations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                      </div>
                  </div>
              </div>

              {/* SECTION 3: Scheduling */}
              <div className="grid grid-cols-12 gap-6">
                 <div className="col-span-12 md:col-span-4 space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                        <Calendar size={12} /> Data
                    </label>
                    <input type="date" className="w-full border border-slate-200 p-2.5 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all text-sm" value={formData.date || ''} onChange={e => setFormData({...formData, date: e.target.value})} />
                 </div>
                 <div className="col-span-12 md:col-span-3 space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                        <Clock size={12} /> Horário
                    </label>
                    <input type="time" className="w-full border border-slate-200 p-2.5 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all text-sm" value={formData.time || ''} onChange={e => setFormData({...formData, time: e.target.value})} />
                 </div>
                 <div className="col-span-12 md:col-span-5 flex items-end">
                    <label 
                        htmlFor="isReturn" 
                        className={`w-full flex items-center justify-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all select-none ${formData.isReturn ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                        <input 
                            type="checkbox" 
                            id="isReturn" 
                            className="hidden"
                            checked={formData.isReturn || false}
                            onChange={e => setFormData({...formData, isReturn: e.target.checked})}
                        />
                        <RotateCcw size={16} className={formData.isReturn ? 'text-purple-600' : 'text-slate-400'} />
                        <span className="text-sm font-bold">É um Retorno?</span>
                    </label>
                 </div>
              </div>

              {/* SECTION 4: Extras */}
              <div className="space-y-4">
                  <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Observações</label>
                      <textarea 
                        className="w-full border border-slate-200 p-3 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all text-sm resize-none" 
                        rows={3} 
                        placeholder="Detalhes adicionais sobre a consulta ou paciente..."
                        value={formData.notes || ''} 
                        onChange={e => setFormData({...formData, notes: formatInputText(e.target.value)})} 
                      />
                  </div>

                  <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1"><Paperclip size={12}/> Anexos (Encaminhamento/Exames)</label>
                      
                      {!formData.documents ? (
                          <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center bg-slate-50 hover:bg-teal-50 hover:border-teal-300 transition-all cursor-pointer relative group">
                              <input 
                                type="file" 
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={handleFileChange}
                                accept=".pdf,.jpg,.jpeg,.png"
                              />
                              <div className="bg-white p-3 rounded-full shadow-sm group-hover:scale-110 transition-transform mb-3">
                                <Upload className="text-slate-400 group-hover:text-teal-500" size={24} />
                              </div>
                              <span className="text-sm font-bold text-slate-600 group-hover:text-teal-700">Clique para fazer upload</span>
                              <span className="text-xs text-slate-400 mt-1">PDF, Imagens (Max 5MB)</span>
                          </div>
                      ) : (
                          <div className="flex items-center justify-between bg-blue-50 border border-blue-100 p-4 rounded-xl">
                              <div className="flex items-center gap-4 overflow-hidden">
                                  <div className="bg-white p-2.5 rounded-lg text-blue-600 shadow-sm border border-blue-100">
                                      <FileText size={20} />
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                      <span className="text-sm font-bold text-slate-800 truncate">
                                        {(() => {
                                            try { return JSON.parse(formData.documents).name } catch { return "Documento Anexado" }
                                        })()}
                                      </span>
                                      <span className="text-xs text-slate-500">Pronto para envio</span>
                                  </div>
                              </div>
                              <button 
                                onClick={removeFile}
                                className="text-slate-400 hover:text-red-500 hover:bg-white p-2 rounded-lg transition-colors"
                                title="Remover arquivo"
                              >
                                  <Trash2 size={18} />
                              </button>
                          </div>
                      )}
                  </div>
              </div>
              
              {/* SECTION 5: Status & Trip Linking (Only if editing) */}
              {formData.id && (
                  <div className="bg-white border-t border-slate-100 pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-1">
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Status Atual</label>
                           <select 
                             className="w-full border border-slate-200 p-2.5 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm" 
                             value={formData.status} 
                             onChange={e => setFormData({...formData, status: e.target.value as any, tripId: e.target.value !== 'scheduled_trip' ? undefined : formData.tripId})}
                           >
                               <option value="pending">Pendente</option>
                               <option value="scheduled_trip">Em Viagem</option>
                               <option value="completed" disabled={formData.status === 'scheduled_trip' && formData.tripId && db.trips.find(t => t.id === formData.tripId)?.status !== 'Concluída'}>
                                   Concluída
                               </option>
                               <option value="cancelled">Cancelada</option>
                               <option value="missed">Faltou</option>
                               <option value="rescheduled">Reagendada</option>
                           </select>
                        </div>
                        
                        <div className="md:col-span-2">
                           {(formData.status === 'cancelled' || formData.status === 'missed') && formData.tripId && (
                              <div className="h-full flex items-center p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
                                  <AlertCircle size={16} className="mr-2 flex-shrink-0" />
                                  <span>O passageiro será removido da viagem.</span>
                              </div>
                           )}
                           {formData.status === 'scheduled_trip' && (
                               <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100 space-y-3">
                                   <label className="text-xs font-bold text-blue-700 uppercase tracking-wide block">Vinculação de Viagem</label>
                                   
                                   {availableTripsForDate.length > 0 ? (
                                       <select 
                                         className="w-full border border-blue-200 p-2.5 rounded-lg text-slate-900 text-sm bg-white focus:ring-2 focus:ring-blue-400"
                                         value={formData.tripId || ''}
                                         onChange={e => setFormData({...formData, tripId: e.target.value})}
                                       >
                                           <option value="">-- Selecione uma Viagem Existente --</option>
                                           {availableTripsForDate.map(t => {
                                               const freeSeats = t.totalSeats - t.occupiedSeats;
                                               const isFull = freeSeats <= 0;
                                               return (
                                               <option key={t.id} value={t.id} disabled={isFull}>
                                                   {isFull ? '[LOTADO] ' : ''}{t.time} - {t.vehicleModel} - {t.destination} ({freeSeats} vagas)
                                               </option>
                                           )})}
                                       </select>
                                   ) : (
                                       <p className="text-sm text-slate-500 italic">Não há viagens criadas para esta data ({formatDate(formData.date || '')}).</p>
                                   )}
                                   
                                   <div className="flex items-center gap-3">
                                      <div className="h-px bg-blue-200 flex-1"></div>
                                      <span className="text-[10px] font-bold text-blue-400 uppercase">Ou</span>
                                      <div className="h-px bg-blue-200 flex-1"></div>
                                   </div>

                                   <button 
                                     onClick={handleCreateTripClick}
                                     className="w-full py-2 bg-white border border-blue-200 text-blue-700 font-bold rounded-lg text-sm hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
                                   >
                                       <Calendar size={14} /> Criar Nova Viagem para esta Data
                                   </button>
                               </div>
                           )}
                        </div>
                      </div>
                  </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 sticky bottom-0">
              <button 
                onClick={() => setShowModal(false)} 
                className="px-6 py-2.5 text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-lg font-bold transition-colors text-sm"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave} 
                className="px-8 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-bold shadow-lg shadow-teal-600/20 transition-all transform active:scale-95 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={formData.status === 'scheduled_trip' && !formData.tripId}
              >
                <CheckCircle size={16} /> Salvar Agendamento
              </button>
            </div>
          </div>
        </div>
      )}

      {showTripModal && pendingAppointmentForTrip && (
          <NewTripModal 
            onClose={() => setShowTripModal(false)}
            onSave={() => {
                setShowTripModal(false);
                refresh();
                setPendingAppointmentForTrip(undefined);
            }}
            preSelectedAppointment={pendingAppointmentForTrip}
          />
      )}
    </div>
  );
};