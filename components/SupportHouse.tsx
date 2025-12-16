import React, { useState, useMemo } from 'react';
import { db } from '../services/store';
import { PatientStay } from '../types';
import { Home, Plus, X, Calendar, User, Clock, CheckCircle, LogOut, Users, FileText, Building, AlertTriangle, Trash2 } from 'lucide-react';
import { PatientAutocomplete, formatDate, formatInputText } from './Shared';
import { useNotification } from './NotificationContext';

// Helper para calcular ocupação em tempo real (Paciente + Acompanhante)
const getHouseOccupancy = (houseId: string) => {
    return db.patientStays
        .filter(s => s.supportHouseId === houseId && s.status === 'active')
        .reduce((total, stay) => total + 1 + (stay.hasCompanion ? 1 : 0), 0);
};

const StayModal = ({ onClose, onSave }: { onClose: () => void, onSave: () => void }) => {
    const [patientId, setPatientId] = useState('');
    const [houseId, setHouseId] = useState('');
    const [entryDate, setEntryDate] = useState('');
    const [entryTime, setEntryTime] = useState('');
    const [expectedExitDate, setExpectedExitDate] = useState('');
    const [hasCompanion, setHasCompanion] = useState(false);
    const [companionName, setCompanionName] = useState('');
    const [notes, setNotes] = useState('');
    
    const { notify } = useNotification();

    const handleSave = () => {
        if (!patientId || !houseId || !entryDate) {
            notify("Preencha os campos obrigatórios (Paciente, Casa e Data de Entrada).", "error");
            return;
        }

        const house = db.supportHouses.find(h => h.id === houseId);
        if (!house) return;

        // Validação de Capacidade
        const currentOccupancy = getHouseOccupancy(houseId);
        const newOccupants = 1 + (hasCompanion ? 1 : 0);
        
        if (currentOccupancy + newOccupants > house.capacity) {
            alert(`Capacidade Excedida!\n\nA casa "${house.name}" possui apenas ${house.capacity - currentOccupancy} vagas livres no momento, mas este registro requer ${newOccupants} vaga(s).`);
            return;
        }

        try {
            db.addPatientStay({
                patientId,
                patientName: '', // store fills this
                supportHouseId: houseId,
                supportHouseName: '', // store fills this
                entryDate,
                entryTime: entryTime || '12:00',
                expectedExitDate,
                hasCompanion,
                companionName: hasCompanion ? companionName : undefined,
                notes
            });
            notify("Entrada registrada com sucesso!", "success");
            onSave();
        } catch (e: any) {
            notify(e.message, "error");
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]">
                
                {/* Header */}
                <div className="flex justify-between items-start p-6 border-b border-slate-100 bg-white sticky top-0 z-10">
                    <div className="flex flex-col">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Building size={20} className="text-teal-600" /> Registrar Estadia
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Check-in de paciente em casa de apoio.</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-8 flex-1">
                    
                    {/* Section 1: Identification */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                                <User size={14} className="text-teal-600"/> Paciente
                            </label>
                            <PatientAutocomplete 
                                patients={db.patients}
                                selectedId={patientId}
                                onChange={(id) => {
                                    setPatientId(id);
                                    const p = db.patients.find(pt => pt.id === id);
                                    if (p) {
                                        setHasCompanion(p.allowsCompanion);
                                        setCompanionName(p.companionName || '');
                                    }
                                }}
                                placeholder="Buscar paciente..."
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                                <Home size={14} className="text-teal-600"/> Casa de Apoio
                            </label>
                            <select 
                                className="w-full border border-slate-200 p-2.5 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all text-sm"
                                value={houseId}
                                onChange={e => setHouseId(e.target.value)}
                            >
                                <option value="">Selecione o Local...</option>
                                {db.supportHouses.map(h => {
                                    const occ = getHouseOccupancy(h.id);
                                    const isFull = occ >= h.capacity;
                                    return (
                                        <option key={h.id} value={h.id} disabled={isFull}>
                                            {isFull ? '[LOTADA] ' : ''}{h.name} (Ocupação: {occ}/{h.capacity})
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                    </div>

                    {/* Section 2: Timing Details */}
                    <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-100 space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2 mb-2">
                            <Clock size={16} className="text-teal-600" />
                            <span className="text-sm font-bold text-slate-700">Detalhes de Entrada e Saída</span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Data Entrada</label>
                                <input 
                                    type="date" 
                                    className="w-full border border-slate-200 p-2.5 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all text-sm" 
                                    value={entryDate} 
                                    onChange={e => setEntryDate(e.target.value)} 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Hora Entrada</label>
                                <input 
                                    type="time" 
                                    className="w-full border border-slate-200 p-2.5 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all text-sm" 
                                    value={entryTime} 
                                    onChange={e => setEntryTime(e.target.value)} 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Previsão Saída</label>
                                <input 
                                    type="date" 
                                    className="w-full border border-slate-200 p-2.5 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all text-sm" 
                                    value={expectedExitDate} 
                                    onChange={e => setExpectedExitDate(e.target.value)} 
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Extras */}
                    <div className="space-y-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1 md:max-w-xs">
                                <label 
                                    className={`w-full flex items-center justify-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all select-none ${hasCompanion ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                >
                                    <input 
                                        type="checkbox" 
                                        className="hidden"
                                        checked={hasCompanion} 
                                        onChange={e => setHasCompanion(e.target.checked)} 
                                    />
                                    <Users size={16} className={hasCompanion ? 'text-blue-600' : 'text-slate-400'} />
                                    <span className="text-sm font-bold">Com Acompanhante?</span>
                                </label>
                                {hasCompanion && <p className="text-[10px] text-blue-500 mt-1 text-center font-bold">+1 Vaga será utilizada</p>}
                            </div>
                            
                            {hasCompanion && (
                                <div className="flex-1 space-y-1.5 animate-in fade-in slide-in-from-left-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nome do Acompanhante</label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-slate-200 p-2.5 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all text-sm"
                                        placeholder="Nome completo..."
                                        value={companionName}
                                        onChange={e => setCompanionName(formatInputText(e.target.value))}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                                <FileText size={12} /> Observações
                            </label>
                            <textarea 
                                className="w-full border border-slate-200 p-3 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all text-sm resize-none" 
                                rows={2} 
                                value={notes} 
                                onChange={e => setNotes(formatInputText(e.target.value))} 
                                placeholder="Informações adicionais sobre a estadia..."
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 sticky bottom-0">
                    <button 
                        onClick={onClose} 
                        className="px-6 py-2.5 text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-lg font-bold transition-colors text-sm"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSave} 
                        className="px-8 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-bold shadow-lg shadow-teal-600/20 transition-all transform active:scale-95 text-sm flex items-center gap-2"
                    >
                        <CheckCircle size={16} /> Confirmar Check-in
                    </button>
                </div>
            </div>
        </div>
    );
};

const CheckOutModal = ({ stay, onClose, onConfirm }: { stay: PatientStay, onClose: () => void, onConfirm: (date: string, time: string) => void }) => {
    const [exitDate, setExitDate] = useState(new Date().toISOString().split('T')[0]);
    const [exitTime, setExitTime] = useState(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    
    // Importa o sistema de notificação para manter padrão
    const { notify } = useNotification();

    const handleConfirm = () => {
        if (!exitDate || !exitTime) {
            notify("Informe a data e hora de saída.", "warning");
            return;
        }
        
        // Validação de segurança no front-end para feedback rápido
        if (exitDate < stay.entryDate) {
            notify(`A data de saída não pode ser anterior à data de entrada (${formatDate(stay.entryDate)}).`, "error");
            return;
        }
        
        onConfirm(exitDate, exitTime);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                <div className="flex items-center gap-3 mb-4 text-slate-800">
                    <div className="bg-amber-100 p-2 rounded-full text-amber-600">
                        <LogOut size={24} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold">Registrar Saída (Check-out)</h2>
                        <p className="text-xs text-slate-500">Confirme os dados de saída do paciente.</p>
                    </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 mb-6 space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Paciente:</span>
                        <span className="font-bold text-slate-800">{stay.patientName}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Casa de Apoio:</span>
                        <span className="font-bold text-slate-800">{stay.supportHouseName}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Entrada:</span>
                        <span className="font-mono text-slate-700">{formatDate(stay.entryDate)} às {stay.entryTime}</span>
                    </div>
                </div>

                <div className="space-y-4 mb-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data de Saída</label>
                        <input 
                            type="date" 
                            className="w-full border border-slate-200 p-2 rounded-lg text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none" 
                            value={exitDate} 
                            onChange={e => setExitDate(e.target.value)} 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hora de Saída</label>
                        <input 
                            type="time" 
                            className="w-full border border-slate-200 p-2 rounded-lg text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none" 
                            value={exitTime} 
                            onChange={e => setExitTime(e.target.value)} 
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold text-sm">Cancelar</button>
                    <button onClick={handleConfirm} className="px-6 py-2 bg-slate-800 text-white hover:bg-slate-900 rounded-lg font-bold text-sm shadow-lg shadow-slate-800/20">Confirmar Saída</button>
                </div>
            </div>
        </div>
    );
};

export const SupportHouseManager: React.FC = () => {
    const [stays, setStays] = useState<PatientStay[]>(db.patientStays);
    const [showModal, setShowModal] = useState(false);
    
    // Check-out Modal State
    const [checkOutStay, setCheckOutStay] = useState<PatientStay | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const { notify } = useNotification();

    const refresh = () => {
        setStays([...db.patientStays]);
        setRefreshKey(p => p + 1);
    };

    const confirmCheckOut = (date: string, time: string) => {
        if (checkOutStay) {
            try {
                // Tenta realizar check-out (a store lançará erro se data for inválida)
                db.checkOutPatientStay(checkOutStay.id, date, time);
                setCheckOutStay(null);
                refresh();
                notify("Check-out realizado com sucesso.", "success");
            } catch (e: any) {
                notify(e.message, "error");
            }
        }
    };

    const handleDelete = (id: string) => {
        if (confirm("ATENÇÃO: Deseja realmente excluir este registro? \n\nUse esta opção apenas para lançamentos errados. Para saída de paciente, use o botão 'Check-out'.")) {
            db.deletePatientStay(id);
            refresh();
            notify("Registro excluído com sucesso.", "success");
        }
    };

    const activeStays = stays.filter(s => s.status === 'active');
    const historyStays = stays.filter(s => s.status !== 'active');

    // Calcula total de pessoas (pacientes + acompanhantes) hospedadas
    const totalCurrentOccupants = activeStays.reduce((acc, s) => acc + 1 + (s.hasCompanion ? 1 : 0), 0);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Home className="text-teal-600" /> Gestão de Casas de Apoio
                    </h1>
                    <p className="text-slate-500 text-sm">Controle de estadias e hospedagem de pacientes</p>
                </div>
                <button 
                    onClick={() => setShowModal(true)}
                    className="bg-teal-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-teal-700 shadow-sm transition-all hover:scale-105 active:scale-95"
                >
                    <Plus size={18} /> <span>Registrar Entrada (Check-in)</span>
                </button>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Active Stays */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex justify-between items-center">
                        <h3 className="font-bold text-emerald-800 flex items-center gap-2">
                            <CheckCircle size={18} /> Hospedagens Ativas
                        </h3>
                        <span className="bg-white px-2 py-0.5 rounded text-xs font-bold text-emerald-600 border border-emerald-200">
                            {totalCurrentOccupants} Ocupantes (Total)
                        </span>
                    </div>
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-700 uppercase text-xs font-bold">
                            <tr>
                                <th className="p-4">Paciente</th>
                                <th className="p-4">Casa de Apoio</th>
                                <th className="p-4">Entrada</th>
                                <th className="p-4">Previsão Saída</th>
                                <th className="p-4">Acompanhante</th>
                                <th className="p-4 text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {activeStays.length === 0 && (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">Nenhum paciente hospedado no momento.</td></tr>
                            )}
                            {activeStays.map(s => (
                                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 font-bold text-slate-900">{s.patientName}</td>
                                    <td className="p-4">{s.supportHouseName}</td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-1 font-mono">
                                            <Calendar size={12} /> {formatDate(s.entryDate)}
                                        </div>
                                        <div className="text-xs text-slate-500 pl-4">{s.entryTime}</div>
                                    </td>
                                    <td className="p-4">
                                        {s.expectedExitDate ? formatDate(s.expectedExitDate) : '-'}
                                    </td>
                                    <td className="p-4">
                                        {s.hasCompanion ? <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">Sim ({s.companionName})</span> : <span className="text-slate-400">-</span>}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button 
                                                onClick={() => setCheckOutStay(s)}
                                                className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900 flex items-center gap-1 shadow-sm transition-all transform active:scale-95"
                                            >
                                                <LogOut size={12} /> Check-out
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(s.id)}
                                                className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                                                title="Excluir (Erro de Lançamento)"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* History */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden opacity-90 hover:opacity-100 transition-opacity">
                    <div className="p-4 bg-slate-50 border-b border-slate-200">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                            <Clock size={18} /> Histórico Recente
                        </h3>
                    </div>
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold">
                            <tr>
                                <th className="p-4">Paciente</th>
                                <th className="p-4">Casa</th>
                                <th className="p-4">Entrada</th>
                                <th className="p-4">Saída</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-600">
                            {historyStays.slice(0, 5).map(s => (
                                <tr key={s.id} className="hover:bg-slate-50/50">
                                    <td className="p-4">{s.patientName}</td>
                                    <td className="p-4">{s.supportHouseName}</td>
                                    <td className="p-4 font-mono text-xs">{formatDate(s.entryDate)}</td>
                                    <td className="p-4 font-mono text-xs">{s.exitDate ? formatDate(s.exitDate) : '-'}</td>
                                    <td className="p-4"><span className="bg-slate-100 px-2 py-0.5 rounded text-xs uppercase font-bold text-slate-500">Concluído</span></td>
                                    <td className="p-4 text-right">
                                        <button 
                                            onClick={() => handleDelete(s.id)}
                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                                            title="Excluir Registro"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && <StayModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); refresh(); }} />}
            
            {checkOutStay && (
                <CheckOutModal 
                    stay={checkOutStay} 
                    onClose={() => setCheckOutStay(null)} 
                    onConfirm={confirmCheckOut} 
                />
            )}
        </div>
    );
};