
import React, { useState, useMemo } from 'react';
import { db } from '../services/store';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, 
  AreaChart, Area, PieChart as RePieChart, Pie, Cell 
} from 'recharts';
import { 
  Users, Calendar, Bus, AlertCircle, ClipboardList, Filter, Search, X, Printer, 
  MapPin, User, Stethoscope, ChevronDown, ChevronUp, History, Clock, CheckCircle, 
  DollarSign, TrendingUp, FileText, RotateCcw, ArrowRight, Briefcase, Home, File as FileIcon
} from 'lucide-react';
import { Trip, Appointment, TripStatus } from '../types';
import { SensitiveData, formatDate, maskCPF } from './Shared';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const Dashboard: React.FC = () => {
  const trips = db.trips;
  const appointments = db.appointments;
  const patients = db.patients;
  const today = new Date().toISOString().split('T')[0];
  
  const tripsToday = trips.filter(t => t.date === today);
  const appointmentsPending = appointments.filter(a => a.status === 'pending').length;
  
  const activityData = useMemo(() => {
      const data = [];
      for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          data.push({
              name: `${d.getDate()}/${d.getMonth()+1}`,
              Viagens: trips.filter(t => t.date === dateStr).length,
              Consultas: appointments.filter(a => a.date === dateStr).length
          });
      }
      return data;
  }, [trips, appointments]);

  const statusData = useMemo(() => {
      const relevantTrips = trips.filter(t => t.date >= today);
      const counts = { [TripStatus.SCHEDULED]: 0, [TripStatus.BOARDING]: 0, [TripStatus.COMPLETED]: 0, [TripStatus.CANCELLED]: 0 };
      relevantTrips.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++; });
      return [
          { name: 'Agendadas', value: counts[TripStatus.SCHEDULED], color: '#3b82f6' },
          { name: 'Embarque', value: counts[TripStatus.BOARDING], color: '#f59e0b' },
          { name: 'Concluídas', value: counts[TripStatus.COMPLETED], color: '#10b981' },
          { name: 'Canceladas', value: counts[TripStatus.CANCELLED], color: '#ef4444' },
      ].filter(d => d.value > 0);
  }, [trips, today]);

  const nextTrips = useMemo(() => {
      return trips
        .filter(t => t.date >= today && t.status !== TripStatus.CANCELLED && t.status !== TripStatus.COMPLETED)
        .sort((a, b) => {
            const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
            if (dateDiff !== 0) return dateDiff;
            return a.time.localeCompare(b.time);
        })
        .slice(0, 5);
  }, [trips, today]);

  const DashboardCard = ({ icon: Icon, label, value, subtext, colorClass, iconBgClass }: any) => (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="flex justify-between items-start">
              <div>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{label}</p>
                  <h3 className="text-3xl font-bold text-slate-800">{value}</h3>
                  {subtext && <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">{subtext}</p>}
              </div>
              <div className={`p-3 rounded-lg ${iconBgClass}`}><Icon size={24} className={colorClass} /></div>
          </div>
      </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Visão Geral</h1>
                <p className="text-slate-500 text-sm">Resumo operacional de {new Date().toLocaleDateString('pt-BR')}</p>
            </div>
            <div className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 font-medium shadow-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div> Sistema Online
            </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <DashboardCard icon={Bus} label="Viagens Hoje" value={tripsToday.length} subtext={`${tripsToday.reduce((acc, t) => acc + t.occupiedSeats, 0)} passageiros agendados`} iconBgClass="bg-blue-50" colorClass="text-blue-600" />
            <DashboardCard icon={ClipboardList} label="Consultas Pendentes" value={appointmentsPending} subtext="Aguardando agendamento" iconBgClass="bg-amber-50" colorClass="text-amber-600" />
            <DashboardCard icon={Users} label="Total Pacientes" value={patients.length} subtext="Cadastrados no sistema" iconBgClass="bg-teal-50" colorClass="text-teal-600" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-6"><h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><TrendingUp size={20} className="text-slate-400"/> Movimentação (7 Dias)</h3></div>
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={activityData}>
                            <defs>
                                <linearGradient id="colorTrips" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0d9488" stopOpacity={0.1}/><stop offset="95%" stopColor="#0d9488" stopOpacity={0}/></linearGradient>
                                <linearGradient id="colorAppt" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                            <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Area type="monotone" dataKey="Viagens" stroke="#0d9488" strokeWidth={3} fillOpacity={1} fill="url(#colorTrips)" />
                            <Area type="monotone" dataKey="Consultas" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorAppt)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col">
                <h3 className="text-lg font-bold text-slate-800 mb-2">Status das Viagens</h3>
                <div className="flex-1 min-h-[200px] relative">
                    {statusData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <RePieChart>
                                <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                    {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </RePieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">Sem dados para exibir</div>
                    )}
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2"><Clock size={18} className="text-teal-600"/> Próximas Saídas</h3>
                    <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded-full">{nextTrips.length} Agendadas</span>
                </div>
                <div className="divide-y divide-slate-50">
                    {nextTrips.map(t => {
                        const occupancy = Math.round((t.occupiedSeats / t.totalSeats) * 100);
                        return (
                            <div key={t.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg border bg-slate-50 border-slate-100 text-slate-600">
                                        <span className="text-xs font-bold uppercase">{new Date(t.date).getDate()}</span>
                                        <span className="text-[10px] font-bold">{t.time}</span>
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{t.destination}</p>
                                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                            <span>{t.vehicleModel}</span><span>•</span><span>{t.driverName}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-bold text-slate-700 mb-1">{t.occupiedSeats}/{t.totalSeats}</div>
                                    <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${occupancy > 90 ? 'bg-red-400' : 'bg-green-400'}`} style={{ width: `${occupancy}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-50 bg-slate-50/50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2"><AlertCircle size={18} className="text-amber-500"/> Pendências</h3>
                </div>
                <div className="p-6 space-y-4">
                    <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-100 bg-amber-50">
                        <div className="p-2 bg-white rounded-full text-amber-500 shadow-sm"><ClipboardList size={16}/></div>
                        <div>
                            <p className="text-sm font-bold text-slate-800">{appointmentsPending} Consultas Pendentes</p>
                            <p className="text-xs text-slate-600 mt-1">Pacientes aguardando definição de transporte.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export const Reports: React.FC = () => {
    const [reportType, setReportType] = useState<'trips' | 'appointments' | 'patients' | 'stays'>('trips');
    
    // Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [search, setSearch] = useState(''); 
    const [filterVehicle, setFilterVehicle] = useState('');
    const [filterTreatmentType, setFilterTreatmentType] = useState(''); 
    const [filterStatus, setFilterStatus] = useState('');
    const [filterDestination, setFilterDestination] = useState('');
    const [filterPatientId, setFilterPatientId] = useState('');
    const [filterIsReturn, setFilterIsReturn] = useState('');
    const [filterSupportHouse, setFilterSupportHouse] = useState(''); 

    const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);

    const clearFilters = () => {
        setStartDate(''); setEndDate(''); setSearch(''); setFilterVehicle('');
        setFilterTreatmentType(''); setFilterStatus(''); setFilterDestination(''); setFilterPatientId(''); setFilterIsReturn(''); setFilterSupportHouse('');
    };

    const uniqueDestinations = useMemo(() => {
        const tripDests = new Set(db.trips.map(t => t.destination).filter(Boolean));
        const registeredDests = db.destinations.map(d => d.name);
        registeredDests.forEach(d => tripDests.add(d));
        return Array.from(tripDests).sort();
    }, [db.trips, db.destinations]);

    const sortedPatients = useMemo(() => {
        return [...db.patients].sort((a, b) => a.name.localeCompare(b.name));
    }, [db.patients]);

    const filteredTrips = useMemo(() => {
        return db.trips.filter(t => {
            const matchDate = (!startDate || t.date >= startDate) && (!endDate || t.date <= endDate);
            const matchVehicle = !filterVehicle || t.vehicleId === filterVehicle;
            const matchStatus = !filterStatus || t.status === filterStatus;
            const matchTreatment = !filterTreatmentType || t.treatmentId === filterTreatmentType; 
            const matchDestination = !filterDestination || t.destination === filterDestination;
            const matchPatient = !filterPatientId || (t.passengers || []).some(p => p.patientId === filterPatientId);
            const strictMatchReturn = !filterIsReturn || (filterIsReturn === 'true' 
                ? (t.passengers || []).some(p => p.isReturn) 
                : (t.passengers || []).every(p => !p.isReturn)
            );
            
            const searchLower = search.toLowerCase();
            // Translate status for search (Robust)
            const statusPT = 
                t.status === 'Agendada' ? 'agendada' : 
                t.status === 'Embarque' ? 'embarque' : 
                t.status === 'Concluída' ? 'concluída concluida' : 'cancelada';

            const matchSearch = !search || 
                t.notes.toLowerCase().includes(searchLower) || 
                t.origin.toLowerCase().includes(searchLower) ||
                t.destination.toLowerCase().includes(searchLower) ||
                t.driverName.toLowerCase().includes(searchLower) ||
                t.vehicleModel.toLowerCase().includes(searchLower) ||
                statusPT.includes(searchLower);

            return matchDate && matchVehicle && matchStatus && matchSearch && matchTreatment && matchDestination && matchPatient && strictMatchReturn;
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [startDate, endDate, search, filterVehicle, filterStatus, filterTreatmentType, filterDestination, filterPatientId, filterIsReturn, db.trips]);

    const filteredAppointments = useMemo(() => {
        return db.appointments.filter(a => {
            const matchDate = (!startDate || a.date >= startDate) && (!endDate || a.date <= endDate);
            const matchStatus = !filterStatus || a.status === filterStatus;
            const matchTreatment = !filterTreatmentType || a.treatmentId === filterTreatmentType;
            const matchDestination = !filterDestination || a.destinationName === filterDestination || (a.destinationId && db.destinations.find(d => d.id === a.destinationId)?.name === filterDestination);
            const matchPatient = !filterPatientId || a.patientId === filterPatientId;
            const matchReturn = !filterIsReturn || (filterIsReturn === 'true' ? a.isReturn : !a.isReturn);
            
            const searchLower = search.toLowerCase();
            // Translate status for search with variants for robustness (Accents)
            const statusPT = 
                a.status === 'pending' ? 'pendente' : 
                a.status === 'scheduled_trip' ? 'agendada em viagem' : 
                a.status === 'completed' ? 'concluída concluida' : 
                a.status === 'missed' ? 'faltou falta' : 
                a.status === 'rescheduled' ? 'reagendada' : 'cancelada';

            const matchSearch = !search || 
                a.notes.toLowerCase().includes(searchLower) ||
                a.patientName.toLowerCase().includes(searchLower) ||
                (a.treatmentName || '').toLowerCase().includes(searchLower) ||
                (a.destinationName || '').toLowerCase().includes(searchLower) ||
                statusPT.includes(searchLower);

            return matchDate && matchStatus && matchSearch && matchTreatment && matchPatient && matchReturn && matchDestination;
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [startDate, endDate, search, filterStatus, filterTreatmentType, filterDestination, filterPatientId, filterIsReturn, db.appointments]);

    const filteredStays = useMemo(() => {
        return db.patientStays.filter(s => {
            const stayStart = s.entryDate;
            const stayEnd = s.exitDate || s.expectedExitDate || new Date().toISOString().split('T')[0];
            
            const matchDate = (!startDate || stayEnd >= startDate) && (!endDate || stayStart <= endDate);
            const matchHouse = !filterSupportHouse || s.supportHouseId === filterSupportHouse;
            const matchStatus = !filterStatus || s.status === filterStatus;
            const matchPatient = !filterPatientId || s.patientId === filterPatientId;
            
            const searchLower = search.toLowerCase();
            const statusPT = s.status === 'active' ? 'ativo' : 'concluído concluido';
            const matchSearch = !search || 
                s.patientName.toLowerCase().includes(searchLower) || 
                s.supportHouseName.toLowerCase().includes(searchLower) ||
                statusPT.includes(searchLower);

            return matchDate && matchHouse && matchStatus && matchPatient && matchSearch;
        }).sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
    }, [startDate, endDate, search, filterSupportHouse, filterStatus, filterPatientId, db.patientStays]);

    const patientStats = useMemo(() => {
        return sortedPatients.filter(p => {
             const matchId = !filterPatientId || p.id === filterPatientId;
             const searchLower = search.toLowerCase();
             const matchSearch = !search || p.name.toLowerCase().includes(searchLower) || p.cpf.includes(search);
             let matchReturn = true;
             if (filterIsReturn) {
                 const hasReturnHistory = db.appointments.some(a => a.patientId === p.id && a.isReturn);
                 const hasReturnTrips = db.trips.some(t => (t.passengers || []).some(pax => pax.patientId === p.id && pax.isReturn));
                 matchReturn = filterIsReturn === 'true' ? (hasReturnHistory || hasReturnTrips) : !(hasReturnHistory || hasReturnTrips);
             }
             return matchId && matchSearch && matchReturn;
        }).map(p => {
            const pAppointments = db.appointments.filter(a => a.patientId === p.id);
            const completed = pAppointments.filter(a => a.status === 'completed').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const upcoming = pAppointments.filter(a => ['pending', 'scheduled_trip', 'rescheduled'].includes(a.status)).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const missed = pAppointments.filter(a => a.status === 'missed');
            
            return { patient: p, totalAppointments: pAppointments.length, upcoming, completed, missed };
        });
    }, [sortedPatients, filterPatientId, search, filterIsReturn, db.appointments, db.trips]);

    const stats = useMemo(() => {
        if (reportType === 'trips') {
            const totalPax = filteredTrips.reduce((acc, t) => acc + t.occupiedSeats, 0);
            const totalCompanions = filteredTrips.reduce((acc, t) => acc + (t.passengers?.filter(p => p.isCompanion).length || 0), 0);
            const totalPatients = totalPax - totalCompanions;
            return { total: filteredTrips.length, pax: totalPax, patients: totalPatients, companions: totalCompanions, confirmed: filteredTrips.filter(t => t.status === TripStatus.SCHEDULED).length };
        } else if (reportType === 'appointments') {
             return { total: filteredAppointments.length, pending: filteredAppointments.filter(a => a.status === 'pending').length, completed: filteredAppointments.filter(a => a.status === 'completed').length };
        } else if (reportType === 'stays') {
             const active = filteredStays.filter(s => s.status === 'active').length;
             const totalPeople = filteredStays.reduce((acc, s) => acc + 1 + (s.hasCompanion ? 1 : 0), 0);
             const estimatedCost = filteredStays.reduce((acc, s) => {
                 const house = db.supportHouses.find(h => h.id === s.supportHouseId);
                 if (!house) return acc;
                 const start = new Date(s.entryDate);
                 const end = new Date(s.exitDate || s.expectedExitDate || new Date().toISOString().split('T')[0]);
                 const diffTime = Math.abs(end.getTime() - start.getTime());
                 const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1; 
                 return acc + (diffDays * house.dailyCost);
             }, 0);
             return { total: filteredStays.length, active, totalPeople, estimatedCost };
        } else {
             return { 
                total: patientStats.length, 
                totalAllowsCompanion: patientStats.filter(s => s.patient.allowsCompanion).length, 
                withUpcoming: patientStats.filter(p => p.upcoming.length > 0).length, 
                totalCompleted: patientStats.reduce((acc, p) => acc + p.completed.length, 0) 
            };
        }
    }, [filteredTrips, filteredAppointments, patientStats, filteredStays, reportType]);

    const exportToExcel = () => {
        let dataToExport: any[] = [];
        let fileName = `Relatorio_${reportType}_${new Date().toISOString().split('T')[0]}`;

        if (reportType === 'trips') {
            dataToExport = filteredTrips.map(t => {
                const totalPax = t.occupiedSeats;
                const comps = (t.passengers || []).filter(p => p.isCompanion).length;
                const pats = totalPax - comps;
                const treat = db.treatmentTypes.find(tr => tr.id === t.treatmentId);
                const specName = treat?.specialistName || '';

                return {
                    Data: formatDate(t.date), Hora: t.time, Destino: t.destination, Origem: t.origin, 
                    Veiculo: t.vehicleModel, Placa: t.vehiclePlate, Motorista: t.driverName,
                    Tratamento: t.treatmentName, Especialista: specName,
                    Total_Passageiros: totalPax, Qtd_Pacientes: pats, Qtd_Acompanhantes: comps,
                    Tem_Retorno: (t.passengers || []).some(p => p.isReturn) ? 'Sim' : 'Não',
                    Status: t.status, Notas: t.notes
                };
            });
        } else if (reportType === 'appointments') {
            dataToExport = filteredAppointments.map(a => {
                const treat = a.treatmentId ? db.treatmentTypes.find(t => t.id === a.treatmentId) : null;
                return {
                    Data: formatDate(a.date), Horario: a.time, Nome_Paciente: a.patientName,
                    Tipo_Tratamento: a.treatmentName || '-',
                    Especialista: treat?.specialistName || '-',
                    Local: a.destinationName || '-',
                    Status: a.status === 'pending' ? 'Pendente' : a.status === 'scheduled_trip' ? 'Agendada' : a.status === 'completed' ? 'Concluída' : a.status === 'missed' ? 'Faltou' : a.status === 'rescheduled' ? 'Reagendada' : 'Cancelada',
                    Observacoes: a.notes
                };
            });
        } else if (reportType === 'patients') {
            dataToExport = patientStats.map(s => ({
                Paciente: s.patient.name, CPF: s.patient.cpf, Telefone: s.patient.phone,
                Direito_Acomp: s.patient.allowsCompanion ? 'Sim' : 'Não',
                Total_Consultas: s.totalAppointments, Proximas: s.upcoming.length, Concluidas: s.completed.length, Faltas: s.missed.length
            }));
        } else if (reportType === 'stays') {
            dataToExport = filteredStays.map(s => {
                 const house = db.supportHouses.find(h => h.id === s.supportHouseId);
                 const start = new Date(s.entryDate);
                 const end = new Date(s.exitDate || s.expectedExitDate || new Date().toISOString().split('T')[0]);
                 const diffTime = Math.abs(end.getTime() - start.getTime());
                 const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
                 const cost = diffDays * (house?.dailyCost || 0);

                return {
                    Paciente: s.patientName,
                    Casa_Apoio: s.supportHouseName,
                    Entrada: formatDate(s.entryDate),
                    Saida_Real_Prevista: formatDate(s.exitDate || s.expectedExitDate || ''),
                    Dias: diffDays,
                    Custo_Estimado: cost,
                    Acompanhante: s.hasCompanion ? 'Sim' : 'Não',
                    Status: s.status === 'active' ? 'Ativo' : 'Concluído'
                };
            });
        }

        if (dataToExport.length === 0) { alert("Não há dados para exportar."); return; }
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Relatorio");
        XLSX.writeFile(wb, `${fileName}.xlsx`);
    };

    const generatePDF = () => {
        const doc = new jsPDF();
        const institution = db.institution;

        // Header
        if (institution.logo) {
             try {
                 doc.addImage(institution.logo, 'PNG', 14, 8, 20, 20); 
             } catch (e) {
                 console.warn("Logo error", e);
             }
        }
        
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(institution.name || "RELATÓRIOS TFD", 105, 15, { align: 'center' });
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(institution.subtitle || "", 105, 20, { align: 'center' });

        doc.setFontSize(18);
        doc.text(`Relatório de ${reportType === 'trips' ? 'Viagens' : reportType === 'appointments' ? 'Consultas' : reportType === 'stays' ? 'Casas de Apoio' : 'Pacientes'}`, 14, 35);
        doc.setFontSize(11);
        doc.text(`Período: ${startDate ? formatDate(startDate) : 'Início'} a ${endDate ? formatDate(endDate) : 'Fim'}`, 14, 42);

        if (reportType === 'trips') {
            const tableColumn = ["Data", "Hora", "Destino", "Veículo", "Tratamento", "Total Pax", "P/A", "Status"];
            const tableRows = filteredTrips.map(t => {
                const comps = (t.passengers || []).filter(p => p.isCompanion).length;
                const pats = t.occupiedSeats - comps;
                const treat = db.treatmentTypes.find(tr => tr.id === t.treatmentId);
                const treatmentStr = t.treatmentName + (treat?.specialistName ? `\n(${treat.specialistName})` : '');

                return [formatDate(t.date), t.time, t.destination, t.vehicleModel, treatmentStr, t.occupiedSeats, `${pats}/${comps}`, t.status];
            });
            autoTable(doc, { head: [tableColumn], body: tableRows, startY: 50, styles: { fontSize: 8 }, headStyles: { fillColor: [13, 148, 136] } });
            
            const grandTotalPax = filteredTrips.reduce((acc, t) => acc + t.occupiedSeats, 0);
            const grandTotalCompanions = filteredTrips.reduce((acc, t) => acc + (t.passengers?.filter(p => p.isCompanion).length || 0), 0);
            const grandTotalPatients = grandTotalPax - grandTotalCompanions;
            const finalY = (doc as any).lastAutoTable.finalY + 20;
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text("Resumo do Período:", 14, finalY);
            doc.setFont("helvetica", "normal");
            doc.text(`Total de Viagens: ${filteredTrips.length}`, 14, finalY + 6);
            doc.text(`Total de Passageiros (Geral): ${grandTotalPax}`, 14, finalY + 12);
            doc.text(`Total de Pacientes: ${grandTotalPatients}`, 14, finalY + 18);
            doc.text(`Total de Acompanhantes: ${grandTotalCompanions}`, 14, finalY + 24);
        } else if (reportType === 'appointments') {
            const tableColumn = ["Data", "Horário", "Nome do Paciente", "Tratamento / Especialista", "Status", "Obs"];
            const tableRows = filteredAppointments.map(a => {
                const treat = a.treatmentId ? db.treatmentTypes.find(t => t.id === a.treatmentId) : null;
                const treatmentStr = (a.treatmentName || '-') + (treat?.specialistName ? `\n(${treat.specialistName})` : '');
                
                return [
                    formatDate(a.date), a.time, a.patientName, treatmentStr, 
                    a.status === 'pending' ? 'Pendente' : a.status === 'scheduled_trip' ? 'Agendada' : a.status === 'completed' ? 'Concluída' : a.status === 'missed' ? 'Faltou' : a.status === 'rescheduled' ? 'Reagendada' : 'Cancelada',
                    a.notes
                ]
            });
            autoTable(doc, { head: [tableColumn], body: tableRows, startY: 50, styles: { fontSize: 8 }, headStyles: { fillColor: [13, 148, 136] } });
        } else if (reportType === 'patients') {
            const tableColumn = ["Nome", "CPF", "Telefone", "Acomp?", "Consultas", "Futuras", "Concluídas", "Faltas"];
            const tableRows = patientStats.map(s => [
                s.patient.name,
                maskCPF(s.patient.cpf),
                s.patient.phone,
                s.patient.allowsCompanion ? 'Sim' : 'Não',
                s.totalAppointments,
                s.upcoming.length,
                s.completed.length,
                s.missed.length
            ]);
            autoTable(doc, { head: [tableColumn], body: tableRows, startY: 50, styles: { fontSize: 8 }, headStyles: { fillColor: [13, 148, 136] } });
        } else if (reportType === 'stays') {
             const tableColumn = ["Paciente", "Casa", "Entrada", "Saída", "Dias", "Custo Est.", "Acomp?", "Status"];
             const tableRows = filteredStays.map(s => {
                 const house = db.supportHouses.find(h => h.id === s.supportHouseId);
                 const start = new Date(s.entryDate);
                 const end = new Date(s.exitDate || s.expectedExitDate || new Date().toISOString().split('T')[0]);
                 const diffTime = Math.abs(end.getTime() - start.getTime());
                 const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
                 const cost = diffDays * (house?.dailyCost || 0);

                 return [
                    s.patientName, s.supportHouseName, formatDate(s.entryDate), 
                    formatDate(s.exitDate || s.expectedExitDate || ''),
                    diffDays, `R$ ${cost.toFixed(2)}`, s.hasCompanion ? 'Sim' : 'Não',
                    s.status === 'active' ? 'Ativo' : 'Concluído'
                 ];
             });
             autoTable(doc, { head: [tableColumn], body: tableRows, startY: 50, styles: { fontSize: 8 }, headStyles: { fillColor: [13, 148, 136] } });
        }

        const pageCount = (doc as any).internal.getNumberOfPages();
        for(let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.text(`Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
        }

        doc.save(`Relatorio_${reportType}.pdf`);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="text-teal-600"/> Relatórios Gerenciais
                </h1>
                <div className="flex gap-2">
                     <button onClick={exportToExcel} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-green-700 shadow-sm">
                        <FileIcon size={18} /> Excel
                    </button>
                    <button onClick={generatePDF} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-slate-900 shadow-sm">
                        <Printer size={18} /> PDF
                    </button>
                </div>
            </div>

            {/* Config & Filters */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <div className="flex border-b border-slate-100 mb-5 overflow-x-auto">
                    <button onClick={() => { setReportType('trips'); clearFilters(); }} className={`px-6 py-3 font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${reportType === 'trips' ? 'border-teal-600 text-teal-700 bg-teal-50/50 rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><Bus size={18} /> Viagens</button>
                    <button onClick={() => { setReportType('appointments'); clearFilters(); }} className={`px-6 py-3 font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${reportType === 'appointments' ? 'border-teal-600 text-teal-700 bg-teal-50/50 rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><ClipboardList size={18} /> Consultas</button>
                    <button onClick={() => { setReportType('patients'); clearFilters(); }} className={`px-6 py-3 font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${reportType === 'patients' ? 'border-teal-600 text-teal-700 bg-teal-50/50 rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><Users size={18} /> Pacientes</button>
                    <button onClick={() => { setReportType('stays'); clearFilters(); }} className={`px-6 py-3 font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${reportType === 'stays' ? 'border-teal-600 text-teal-700 bg-teal-50/50 rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><Home size={18}/> Casas de Apoio</button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Data Início</label>
                        <input type="date" className="w-full border border-slate-200 p-2.5 rounded-lg text-slate-800 text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-teal-500/20 transition-all" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Data Fim</label>
                        <input type="date" className="w-full border border-slate-200 p-2.5 rounded-lg text-slate-800 text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-teal-500/20 transition-all" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Busca Textual</label>
                        <div className="relative">
                            <input type="text" className="w-full border border-slate-200 p-2.5 pl-9 rounded-lg text-slate-800 text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-teal-500/20 transition-all" placeholder={reportType === 'patients' ? "Nome ou CPF" : "Destino, Status, Nome..."} value={search} onChange={e => setSearch(e.target.value)} />
                            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                        </div>
                    </div>

                    {/* Specific Filters */}
                    {reportType === 'trips' && (
                        <>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Status</label>
                                <select className="w-full border border-slate-200 p-2.5 rounded-lg text-slate-800 text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-teal-500/20 transition-all" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                                    <option value="">Todos</option>
                                    <option value={TripStatus.SCHEDULED}>Agendada</option>
                                    <option value={TripStatus.BOARDING}>Embarque</option>
                                    <option value={TripStatus.COMPLETED}>Concluída</option>
                                    <option value={TripStatus.CANCELLED}>Cancelada</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Veículo</label>
                                <select className="w-full border border-slate-200 p-2.5 rounded-lg text-slate-800 text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-teal-500/20 transition-all" value={filterVehicle} onChange={e => setFilterVehicle(e.target.value)}>
                                    <option value="">Todos</option>
                                    {db.vehicles.map(v => <option key={v.id} value={v.id}>{v.model} ({v.plate})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Destino</label>
                                <select className="w-full border border-slate-200 p-2.5 rounded-lg text-slate-800 text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-teal-500/20 transition-all" value={filterDestination} onChange={e => setFilterDestination(e.target.value)}>
                                    <option value="">Todos</option>
                                    {uniqueDestinations.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Tipo Trecho</label>
                                <select className="w-full border border-slate-200 p-2.5 rounded-lg text-slate-800 text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-teal-500/20 transition-all" value={filterIsReturn} onChange={e => setFilterIsReturn(e.target.value)}>
                                    <option value="">Todos</option>
                                    <option value="true">Com Retorno</option>
                                    <option value="false">Só Ida</option>
                                </select>
                            </div>
                        </>
                    )}

                    {reportType === 'appointments' && (
                         <>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Status</label>
                                <select className="w-full border border-slate-200 p-2.5 rounded-lg text-slate-800 text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-teal-500/20 transition-all" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                                    <option value="">Todos</option>
                                    <option value="pending">Pendente</option>
                                    <option value="scheduled_trip">Em Viagem</option>
                                    <option value="completed">Concluída</option>
                                    <option value="cancelled">Cancelada</option>
                                    <option value="missed">Faltou</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Tipo Tratamento</label>
                                <select className="w-full border border-slate-200 p-2.5 rounded-lg text-slate-800 text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-teal-500/20 transition-all" value={filterTreatmentType} onChange={e => setFilterTreatmentType(e.target.value)}>
                                    <option value="">Todos</option>
                                    {db.treatmentTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Local/Destino</label>
                                <select className="w-full border border-slate-200 p-2.5 rounded-lg text-slate-800 text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-teal-500/20 transition-all" value={filterDestination} onChange={e => setFilterDestination(e.target.value)}>
                                    <option value="">Todos</option>
                                    {db.destinations.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                                </select>
                            </div>
                        </>
                    )}

                    {reportType === 'stays' && (
                        <>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Casa de Apoio</label>
                                <select className="w-full border border-slate-200 p-2.5 rounded-lg text-slate-800 text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-teal-500/20 transition-all" value={filterSupportHouse} onChange={e => setFilterSupportHouse(e.target.value)}>
                                    <option value="">Todas</option>
                                    {db.supportHouses.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Status</label>
                                <select className="w-full border border-slate-200 p-2.5 rounded-lg text-slate-800 text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-teal-500/20 transition-all" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                                    <option value="">Todos</option>
                                    <option value="active">Ativo (Hospedado)</option>
                                    <option value="completed">Concluído</option>
                                </select>
                            </div>
                        </>
                    )}
                </div>
                
                <div className="flex justify-end mt-4">
                     <button onClick={clearFilters} className="text-slate-500 hover:text-slate-700 text-sm underline">Limpar Filtros</button>
                </div>
            </div>

            {/* Results */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700">Resultados da Pesquisa</h3>
                    
                    {reportType === 'trips' && (
                        <div className="flex gap-3 text-xs">
                             <span className="font-bold text-teal-700">{stats.total} Viagens</span>
                             <span className="font-bold text-blue-700">{stats.pax} Pax Total</span>
                             <span className="text-slate-500">({stats.patients} Pacientes / {stats.companions} Acomp)</span>
                        </div>
                    )}
                    {reportType === 'stays' && (
                        <div className="flex gap-3 text-xs">
                             <span className="font-bold text-teal-700">{stats.active} Ativos</span>
                             <span className="font-bold text-blue-700">{stats.totalPeople} Pessoas</span>
                             <span className="font-bold text-slate-600">Custo Est: R$ {Number(stats.estimatedCost).toFixed(2)}</span>
                        </div>
                    )}
                </div>

                <div className="overflow-x-auto">
                    {reportType === 'trips' && (
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100 text-slate-700 font-bold uppercase">
                                <tr>
                                    <th className="p-3">Data/Hora</th>
                                    <th className="p-3">Destino</th>
                                    <th className="p-3">Veículo</th>
                                    <th className="p-3">Motorista</th>
                                    <th className="p-3 text-center">Lotação</th>
                                    <th className="p-3 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                {filteredTrips.map(t => (
                                    <tr key={t.id} className="hover:bg-slate-50">
                                        <td className="p-3 font-mono">{formatDate(t.date)} {t.time}</td>
                                        <td className="p-3 font-bold text-teal-800">{t.destination}</td>
                                        <td className="p-3">{t.vehicleModel}</td>
                                        <td className="p-3">{t.driverName}</td>
                                        <td className="p-3 text-center font-bold">{t.occupiedSeats}</td>
                                        <td className="p-3 text-center"><span className="px-2 py-1 rounded bg-slate-200 text-slate-700 text-[10px] uppercase font-bold">{t.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {reportType === 'appointments' && (
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100 text-slate-700 font-bold uppercase">
                                <tr>
                                    <th className="p-3">Data</th>
                                    <th className="p-3">Paciente</th>
                                    <th className="p-3">Tratamento</th>
                                    <th className="p-3">Local</th>
                                    <th className="p-3 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                {filteredAppointments.map(a => (
                                    <tr key={a.id} className="hover:bg-slate-50">
                                        <td className="p-3 font-mono">{formatDate(a.date)} {a.time}</td>
                                        <td className="p-3 font-bold">{a.patientName}</td>
                                        <td className="p-3">{a.treatmentName}</td>
                                        <td className="p-3">{a.destinationName}</td>
                                        <td className="p-3 text-center">
                                            <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold ${
                                                a.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                a.status === 'missed' ? 'bg-red-100 text-red-700' :
                                                'bg-blue-100 text-blue-700'
                                            }`}>{a.status === 'pending' ? 'Pendente' : a.status === 'scheduled_trip' ? 'Agendada' : a.status === 'completed' ? 'Concluída' : a.status === 'missed' ? 'Faltou' : a.status === 'rescheduled' ? 'Reagendada' : 'Cancelada'}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {reportType === 'patients' && (
                         <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100 text-slate-700 font-bold uppercase">
                                <tr>
                                    <th className="p-3">Paciente</th>
                                    <th className="p-3">CPF</th>
                                    <th className="p-3 text-center">Direito Acomp?</th>
                                    <th className="p-3 text-center">Consultas</th>
                                    <th className="p-3 text-center">Futuras</th>
                                    <th className="p-3 text-center">Faltas</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                {patientStats.map(s => (
                                    <tr key={s.patient.id} className="hover:bg-slate-50">
                                        <td className="p-3 font-bold text-slate-800">{s.patient.name}</td>
                                        <td className="p-3 font-mono">{maskCPF(s.patient.cpf)}</td>
                                        <td className="p-3 text-center">{s.patient.allowsCompanion ? 'SIM' : '-'}</td>
                                        <td className="p-3 text-center font-bold">{s.totalAppointments}</td>
                                        <td className="p-3 text-center text-blue-600 font-bold">{s.upcoming.length}</td>
                                        <td className="p-3 text-center text-red-500 font-bold">{s.missed.length}</td>
                                    </tr>
                                ))}
                            </tbody>
                         </table>
                    )}

                    {reportType === 'stays' && (
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100 text-slate-700 font-bold uppercase">
                                <tr>
                                    <th className="p-3">Paciente</th>
                                    <th className="p-3">Casa de Apoio</th>
                                    <th className="p-3 text-center">Entrada</th>
                                    <th className="p-3 text-center">Saída</th>
                                    <th className="p-3 text-center">Acomp?</th>
                                    <th className="p-3 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                {filteredStays.map(s => (
                                    <tr key={s.id} className="hover:bg-slate-50">
                                        <td className="p-3 font-bold text-slate-800">{s.patientName}</td>
                                        <td className="p-3">{s.supportHouseName}</td>
                                        <td className="p-3 text-center font-mono">{formatDate(s.entryDate)}</td>
                                        <td className="p-3 text-center font-mono">{formatDate(s.exitDate || s.expectedExitDate || '')}</td>
                                        <td className="p-3 text-center">{s.hasCompanion ? 'SIM' : '-'}</td>
                                        <td className="p-3 text-center">
                                            <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold ${
                                                s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
                                            }`}>{s.status === 'active' ? 'Ativo' : 'Concluído'}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                         </table>
                    )}
                </div>
            </div>
        </div>
    );
};
