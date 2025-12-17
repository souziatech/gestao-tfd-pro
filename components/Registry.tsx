import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/store';
import { Patient, Vehicle, Driver, TreatmentType, Destination, UserRole, SupportHouse, Institution, PermissionKey } from '../types';
import { Plus, Trash2, Edit, Search, MapPin, User, FileText, Phone, Shield, Download, Upload, Wallet, Building, History, Calendar, Bus, Stethoscope, Home, Image as ImageIcon, ClipboardList, CheckSquare, Square, Code } from 'lucide-react';
import { SensitiveData, maskCPF, formatDate, maskPhone, maskSUS, maskCNH, formatInputText } from './Shared';
import { useNotification } from './NotificationContext';

// --- Generic Table Component ---
const Table = ({ headers, children }: { headers: string[], children?: React.ReactNode }) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-slate-50 text-slate-800 font-semibold text-sm">
          <tr>
            {headers.map((h, i) => <th key={i} className="px-6 py-4">{h}</th>)}
            <th className="px-6 py-4 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {children}
        </tbody>
      </table>
    </div>
  </div>
);

// --- Patient Manager ---
export const PatientManager: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]); // Start empty for performance
  const [hasSearched, setHasSearched] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<Partial<Patient>>({});
  const [search, setSearch] = useState('');
  
  // State for Modal Tabs (Edit View)
  const [activeModalTab, setActiveModalTab] = useState<'registration' | 'history'>('registration');

  const { notify } = useNotification();

  // Optimized refresh: only re-fetch if we have a search term, otherwise clear
  const refresh = () => {
      if (search.length > 0) {
          handleSearch();
      } else {
          setPatients([]);
          setHasSearched(false);
      }
  };

  const handleSearch = (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      
      if (!search.trim()) {
          setPatients([]);
          setHasSearched(false);
          return;
      }

      const term = search.toLowerCase();
      // Filter directly from DB source
      const results = db.patients.filter(p => 
          p.name.toLowerCase().includes(term) || 
          p.cpf.includes(term)
      );
      
      setPatients(results);
      setHasSearched(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.cpf) {
        notify("Nome e CPF obrigatórios", "error");
        return;
    }
    
    // Validate second companion justification
    if (formData.allowsSecondCompanion && !formData.secondCompanionJustification) {
        notify("É obrigatório informar a justificativa para o 2º acompanhante.", "warning");
        return;
    }
    
    const dataToSave = {
        ...formData,
        status: formData.status || 'active',
        isTFD: formData.isTFD !== false // default to true if undefined
    };

    if (formData.id) {
       // Update
       const idx = db.patients.findIndex(p => p.id === formData.id);
       if (idx >= 0) db.patients[idx] = dataToSave as Patient;
    } else {
       // Create
       db.patients.push({ 
           ...dataToSave, 
           id: Date.now().toString(), 
           allowsCompanion: formData.allowsCompanion || false 
       } as Patient);
    }
    db.save();
    refresh();
    setShowModal(false);
    setFormData({});
    notify(formData.id ? "Paciente atualizado!" : "Paciente criado com sucesso!", "success");
  };

  const handleDelete = (id: string) => {
      if (confirm("Deseja excluir este paciente? Esta ação não pode ser desfeita.")) {
          try {
              db.deletePatient(id);
              refresh();
              notify("Paciente excluído com sucesso.", "success");
          } catch (e: any) {
              notify(e.message, "error");
          }
      }
  };

  const getPatientTrips = (patientId: string) => {
      return db.trips.filter(t => 
          (t.passengers || []).some(p => p.patientId === patientId)
      ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const getPatientAppointments = (patientId: string) => {
      return db.appointments.filter(a => 
          a.patientId === patientId
      ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Pacientes</h1>
        <button onClick={() => { setFormData({ isTFD: true }); setShowModal(true); setActiveModalTab('registration'); }} className="bg-teal-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-teal-700 shadow-sm transition-transform active:scale-95">
          <Plus size={18} /> <span>Novo Paciente</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                type="text" 
                placeholder="Busque por Nome ou CPF..." 
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 bg-slate-50 focus:bg-white transition-colors"
                value={search}
                onChange={e => setSearch(e.target.value)}
                />
            </div>
            <button type="submit" className="bg-slate-800 text-white px-6 rounded-lg font-bold hover:bg-slate-900 transition-colors">
                Buscar
            </button>
          </form>
      </div>

      {/* Results Area */}
      {!hasSearched ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <Search size={48} className="mb-4 opacity-20" />
              <p className="font-medium">Utilize a barra de busca acima para encontrar pacientes.</p>
              <p className="text-xs">Digite o nome ou CPF e tecle Enter.</p>
          </div>
      ) : patients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="bg-slate-100 p-3 rounded-full mb-3"><User size={24} className="text-slate-400"/></div>
              <p className="font-bold">Nenhum paciente encontrado.</p>
              <p className="text-sm">Verifique o termo digitado ou cadastre um novo paciente.</p>
          </div>
      ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="mb-2 text-xs text-slate-500 font-bold uppercase tracking-wide ml-1">
                {patients.length} Resultado(s) Encontrado(s)
            </div>
            <Table headers={['Nome', 'CPF', 'Cidade', 'Status', 'Tipo', 'Telefone', 'Acompanhante?']}>
                {patients.map(p => {
                return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-900">
                            <div>{p.name}</div>
                            <div className="text-xs text-slate-500">{formatDate(p.birthDate)}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-700">
                            <SensitiveData text={p.cpf} type="cpf" />
                        </td>
                        <td className="px-6 py-4 text-slate-700">{p.city || '-'}</td>
                        <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${p.status === 'inactive' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {p.status === 'inactive' ? 'Inativo' : 'Ativo'}
                            </span>
                        </td>
                        <td className="px-6 py-4">
                            {p.isTFD !== false ? (
                            <span className="text-xs font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded-full flex items-center w-fit gap-1"><Stethoscope size={12}/> TFD</span> 
                            ) : (
                            <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-full">Outro</span>
                            )}
                        </td>
                        <td className="px-6 py-4 text-slate-700">{p.phone}</td>
                        <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.allowsCompanion ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'}`}>
                            {p.allowsCompanion ? 'Sim' : 'Não'}
                        </span>
                        {p.allowsSecondCompanion && (
                            <span className="ml-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                +1
                            </span>
                        )}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={() => { setFormData(p); setShowModal(true); setActiveModalTab('registration'); }} className="text-blue-600 hover:bg-blue-50 p-1 rounded"><Edit size={18} /></button>
                        <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={18} /></button>
                        </td>
                    </tr>
                );
                })}
            </Table>
          </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-slate-900">
            
            {/* Modal Header */}
            <div className="p-6 pb-0">
                <h2 className="text-xl font-bold text-slate-800">{formData.id ? 'Editar' : 'Novo'} Paciente</h2>
            </div>

            {/* MODAL TABS */}
            {formData.id && (
                <div className="flex border-b border-slate-100 px-6 mt-4">
                    <button 
                        onClick={() => setActiveModalTab('registration')}
                        className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeModalTab === 'registration' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <User size={16}/> Dados Cadastrais
                    </button>
                    <button 
                        onClick={() => setActiveModalTab('history')}
                        className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeModalTab === 'history' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <History size={16}/> Histórico Completo
                    </button>
                </div>
            )}

            <div className="p-6 overflow-y-auto flex-1">
                {activeModalTab === 'registration' ? (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-sm font-bold text-teal-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                                <User size={16} /> Dados Pessoais
                            </h3>
                            
                            <div className="mb-4 bg-blue-50 border border-blue-100 p-3 rounded-lg flex items-center gap-3">
                                <input type="checkbox" id="isTFDCheck" className="w-5 h-5 text-teal-600 rounded" checked={formData.isTFD !== false} onChange={e => setFormData({...formData, isTFD: e.target.checked})} />
                                <div><label htmlFor="isTFDCheck" className="text-sm font-bold text-slate-800 cursor-pointer">É Paciente TFD?</label><p className="text-xs text-slate-500">Marque se este paciente utilizará o transporte para Tratamento Fora de Domicílio.</p></div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-2"><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label><input type="text" className="w-full border p-2 rounded text-slate-900 bg-slate-50 focus:bg-white" value={formData.name || ''} onChange={e => setFormData({...formData, name: formatInputText(e.target.value)})} /></div>
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label><select className="w-full border p-2 rounded text-slate-900 bg-slate-50 focus:bg-white" value={formData.status || 'active'} onChange={e => setFormData({...formData, status: e.target.value as any})}><option value="active">Ativo</option><option value="inactive">Inativo</option></select></div>
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Nascimento</label><input type="date" className="w-full border p-2 rounded text-slate-900 bg-slate-50 focus:bg-white" value={formData.birthDate || ''} onChange={e => setFormData({...formData, birthDate: e.target.value})} /></div>
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">CPF</label><input type="text" maxLength={14} className="w-full border p-2 rounded text-slate-900 bg-slate-50 focus:bg-white" value={formData.cpf || ''} onChange={e => setFormData({...formData, cpf: maskCPF(e.target.value)})} placeholder="000.000.000-00" /></div>
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cartão SUS</label><input type="text" maxLength={19} className="w-full border p-2 rounded text-slate-900 bg-slate-50 focus:bg-white" value={formData.susCard || ''} onChange={e => setFormData({...formData, susCard: maskSUS(e.target.value)})} placeholder="000 0000 0000 0000" /></div>
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone / Celular</label><input type="text" maxLength={15} className="w-full border p-2 rounded text-slate-900 bg-slate-50 focus:bg-white" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: maskPhone(e.target.value)})} placeholder="(00) 00000-0000" /></div>
                            </div>
                        </div>
                        
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <h3 className="text-sm font-bold text-teal-700 uppercase tracking-wide mb-3 flex items-center gap-2"><MapPin size={16} /> Endereço Completo</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2"><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Logradouro e Número</label><input type="text" className="w-full border p-2 rounded text-slate-900 bg-white" value={formData.address || ''} onChange={e => setFormData({...formData, address: formatInputText(e.target.value)})} /></div>
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bairro</label><input type="text" className="w-full border p-2 rounded text-slate-900 bg-white" value={formData.neighborhood || ''} onChange={e => setFormData({...formData, neighborhood: formatInputText(e.target.value)})} /></div>
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cidade</label><input type="text" className="w-full border p-2 rounded text-slate-900 bg-white" value={formData.city || ''} onChange={e => setFormData({...formData, city: formatInputText(e.target.value)})} /></div>
                                <div className="md:col-span-2"><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ponto de Referência</label><input type="text" className="w-full border p-2 rounded text-slate-900 bg-white" value={formData.referencePoint || ''} onChange={e => setFormData({...formData, referencePoint: formatInputText(e.target.value)})} /></div>
                            </div>
                        </div>
                        
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <h3 className="text-sm font-bold text-teal-700 uppercase tracking-wide mb-3 flex items-center gap-2"><Wallet size={16} /> Dados Bancários</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Banco</label><input type="text" className="w-full border p-2 rounded text-slate-900 bg-white" value={formData.bankName || ''} onChange={e => setFormData({...formData, bankName: formatInputText(e.target.value)})} /></div>
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Agência</label><input type="text" className="w-full border p-2 rounded text-slate-900 bg-white" value={formData.agency || ''} onChange={e => setFormData({...formData, agency: e.target.value})} /></div>
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Conta</label><input type="text" className="w-full border p-2 rounded text-slate-900 bg-white" value={formData.accountNumber || ''} onChange={e => setFormData({...formData, accountNumber: e.target.value})} /></div>
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo</label><select className="w-full border p-2 rounded text-slate-900 bg-white" value={formData.accountType || ''} onChange={e => setFormData({...formData, accountType: e.target.value})}><option value="">Selecione</option><option value="Corrente">Corrente</option><option value="Poupança">Poupança</option></select></div>
                                <div className="md:col-span-2"><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Titular (Se diferente)</label><input type="text" className="w-full border p-2 rounded text-slate-900 bg-white" value={formData.accountHolder || ''} onChange={e => setFormData({...formData, accountHolder: formatInputText(e.target.value)})} /></div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-teal-700 uppercase tracking-wide mb-3 flex items-center gap-2"><FileText size={16} /> Detalhes Adicionais</h3>
                            <div className="grid grid-cols-1 gap-4">
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contato de Emergência</label><input type="text" className="w-full border p-2 rounded text-slate-900 bg-slate-50" value={formData.emergencyContact || ''} onChange={e => setFormData({...formData, emergencyContact: formatInputText(e.target.value)})} placeholder="Nome e Telefone" /></div>
                                {formData.isTFD !== false && (
                                    <div className="flex flex-col gap-3 border p-3 rounded bg-blue-50 border-blue-100">
                                        <div className="flex items-center space-x-2"><input type="checkbox" id="allowsComp" className="w-4 h-4 text-teal-600 rounded" checked={formData.allowsCompanion || false} onChange={e => setFormData({...formData, allowsCompanion: e.target.checked})} /><label htmlFor="allowsComp" className="text-sm font-bold text-slate-700">Paciente tem direito a acompanhante?</label></div>
                                        {formData.allowsCompanion && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-6">
                                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Acompanhante 1</label><input type="text" className="w-full border p-2 rounded text-slate-900 bg-white" value={formData.companionName || ''} onChange={e => setFormData({...formData, companionName: formatInputText(e.target.value)})} /></div>
                                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">CPF Acompanhante 1</label><input type="text" maxLength={14} className="w-full border p-2 rounded text-slate-900 bg-white" value={formData.companionCPF || ''} onChange={e => setFormData({...formData, companionCPF: maskCPF(e.target.value)})} placeholder="000.000.000-00" /></div>
                                                <div className="md:col-span-2 pt-2 border-t border-blue-200 mt-2">
                                                    <div className="flex items-center space-x-2 mb-2"><input type="checkbox" id="allowsSecondComp" className="w-4 h-4 text-purple-600 rounded" checked={formData.allowsSecondCompanion || false} onChange={e => setFormData({...formData, allowsSecondCompanion: e.target.checked})} /><label htmlFor="allowsSecondComp" className="text-sm font-bold text-purple-800">Necessita de 2º Acompanhante?</label></div>
                                                    {formData.allowsSecondCompanion && (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-4">
                                                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Acompanhante 2</label><input type="text" className="w-full border p-2 rounded text-slate-900 bg-white" value={formData.secondCompanionName || ''} onChange={e => setFormData({...formData, secondCompanionName: formatInputText(e.target.value)})} /></div>
                                                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">CPF Acompanhante 2</label><input type="text" maxLength={14} className="w-full border p-2 rounded text-slate-900 bg-white" value={formData.secondCompanionCPF || ''} onChange={e => setFormData({...formData, secondCompanionCPF: maskCPF(e.target.value)})} placeholder="000.000.000-00" /></div>
                                                            <div className="md:col-span-2"><label className="block text-xs font-bold text-red-600 uppercase mb-1">Justificativa (Obrigatório)</label><textarea className="w-full border p-2 rounded text-slate-900 bg-white border-red-200" rows={2} value={formData.secondCompanionJustification || ''} onChange={e => setFormData({...formData, secondCompanionJustification: formatInputText(e.target.value)})} /></div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Observações Médicas</label><textarea className="w-full border p-2 rounded h-20 text-slate-900 bg-slate-50" value={formData.medicalNotes || ''} onChange={e => setFormData({...formData, medicalNotes: formatInputText(e.target.value)})} /></div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {formData.id && (
                            <>
                                <div className="space-y-2">
                                    <h3 className="text-sm font-bold text-teal-700 uppercase tracking-wide flex items-center gap-2 border-b pb-2"><Bus size={16} /> Histórico de Viagens</h3>
                                    <div className="overflow-x-auto bg-slate-50 rounded-lg border border-slate-200">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-slate-100 text-slate-600 font-bold uppercase">
                                                <tr><th className="p-3">Data</th><th className="p-3">Destino</th><th className="p-3">Veículo</th><th className="p-3 text-center">Tipo</th><th className="p-3 text-center">Status</th></tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {getPatientTrips(formData.id).length === 0 ? (<tr><td colSpan={5} className="p-4 text-center text-slate-400 italic">Nenhuma viagem registrada.</td></tr>) : (getPatientTrips(formData.id).map(t => { const pRec = t.passengers.find(p => p.patientId === formData.id); return (<tr key={t.id} className="hover:bg-slate-100 transition-colors"><td className="p-3 font-mono text-slate-700">{formatDate(t.date)} {t.time}</td><td className="p-3 text-slate-700 font-medium">{t.destination}</td><td className="p-3 text-slate-700">{t.vehicleModel}</td><td className="p-3 text-center text-slate-700">{pRec?.isRoundTrip ? 'IDA+VOLTA' : 'SÓ IDA'}</td><td className="p-3 text-center"><span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${t.status === 'Concluída' ? 'bg-green-100 text-green-800' : t.status === 'Cancelada' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{t.status}</span></td></tr>); }))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-sm font-bold text-teal-700 uppercase tracking-wide flex items-center gap-2 border-b pb-2"><ClipboardList size={16} /> Histórico de Consultas</h3>
                                    <div className="overflow-x-auto bg-slate-50 rounded-lg border border-slate-200">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-slate-100 text-slate-600 font-bold uppercase"><tr><th className="p-3">Data</th><th className="p-3">Tratamento</th><th className="p-3">Local</th><th className="p-3 text-center">Status</th><th className="p-3">Obs</th></tr></thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {getPatientAppointments(formData.id).length === 0 ? (<tr><td colSpan={5} className="p-4 text-center text-slate-400 italic">Nenhuma consulta registrada.</td></tr>) : (getPatientAppointments(formData.id).map(a => (<tr key={a.id} className="hover:bg-slate-100 transition-colors"><td className="p-3 font-mono text-slate-700">{formatDate(a.date)} {a.time}</td><td className="p-3 font-bold text-slate-800">{a.treatmentName || '-'}</td><td className="p-3 text-slate-700">{a.destinationName || '-'}</td><td className="p-3 text-center"><span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${a.status === 'completed' ? 'bg-green-100 text-green-800' : a.status === 'missed' ? 'bg-orange-100 text-orange-800' : a.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{a.status === 'pending' ? 'Pendente' : a.status === 'scheduled_trip' ? 'Em Viagem' : a.status === 'completed' ? 'Concluída' : a.status === 'missed' ? 'Faltou' : a.status === 'rescheduled' ? 'Reagendada' : 'Cancelada'}</span></td><td className="p-3 text-slate-600 truncate max-w-[150px]" title={a.notes}>{a.notes}</td></tr>)))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {activeModalTab === 'registration' && (
                <div className="mt-auto p-6 flex justify-end space-x-3 border-t border-slate-100 bg-white">
                    <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2 text-slate-700 hover:bg-slate-100 rounded border">Cancelar</button>
                    <button onClick={handleSave} className="px-6 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 font-medium">Salvar Paciente</button>
                </div>
            )}
            {activeModalTab === 'history' && (
                <div className="mt-auto p-6 flex justify-end space-x-3 border-t border-slate-100 bg-white">
                    <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2 text-slate-700 hover:bg-slate-100 rounded border">Fechar</button>
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const InstitutionManager: React.FC = () => {
    const [data, setData] = useState<Institution>(db.institution);
    const { notify } = useNotification();
  
    const handleChange = (field: keyof Institution, value: string) => {
        setData(prev => ({ ...prev, [field]: value }));
    };
  
    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    handleChange('logo', ev.target.result as string);
                }
            };
            reader.readAsDataURL(file);
        }
    };
  
    const handleSave = () => {
        db.updateInstitution(data);
        notify("Dados da instituição atualizados com sucesso!", "success");
    };
  
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Dados da Instituição (Cabeçalho de Relatórios)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Nome da Instituição (Título)</label>
                        <input className="w-full border p-2 rounded bg-slate-50" value={data.name} onChange={e => handleChange('name', formatInputText(e.target.value))} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Subtítulo (Departamento)</label>
                        <input className="w-full border p-2 rounded bg-slate-50" value={data.subtitle} onChange={e => handleChange('subtitle', formatInputText(e.target.value))} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Endereço</label>
                        <input className="w-full border p-2 rounded bg-slate-50" value={data.address} onChange={e => handleChange('address', formatInputText(e.target.value))} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Cidade</label>
                            <input className="w-full border p-2 rounded bg-slate-50" value={data.city} onChange={e => handleChange('city', formatInputText(e.target.value))} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Estado</label>
                            <input className="w-full border p-2 rounded bg-slate-50" value={data.state} onChange={e => handleChange('state', formatInputText(e.target.value))} />
                        </div>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Telefone</label>
                            <input className="w-full border p-2 rounded bg-slate-50" value={data.phone} onChange={e => handleChange('phone', maskPhone(e.target.value))} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                            <input className="w-full border p-2 rounded bg-slate-50" value={data.email} onChange={e => handleChange('email', e.target.value)} />
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-center justify-center border-l border-slate-100 pl-6">
                     <label className="text-xs font-bold text-slate-500 uppercase mb-2">Logotipo (Relatórios)</label>
                     <div className="w-48 h-48 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center bg-slate-50 relative overflow-hidden group hover:border-teal-400 transition-colors">
                        {data.logo ? (
                            <img src={data.logo} alt="Logo" className="w-full h-full object-contain p-2" />
                        ) : (
                            <div className="text-center p-4">
                                <ImageIcon className="mx-auto text-slate-300 mb-2" size={32} />
                                <span className="text-slate-400 text-xs">Clique para enviar imagem</span>
                            </div>
                        )}
                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleLogoUpload} />
                     </div>
                     {data.logo && <button onClick={() => handleChange('logo', '')} className="text-xs text-red-500 mt-2 hover:underline">Remover Logo</button>}
                </div>
            </div>
            <div className="mt-6 flex justify-end">
                <button onClick={handleSave} className="bg-teal-600 text-white px-6 py-2 rounded font-bold hover:bg-teal-700 shadow-sm flex items-center gap-2">
                    <CheckSquare size={18} /> Salvar Configurações
                </button>
            </div>
        </div>
    );
};

// --- Resources Manager ---
export const ResourceManager: React.FC = () => {
  // Renamed 'specialists' to 'treatmentTypes'
  const [activeTab, setActiveTab] = useState<'vehicles' | 'drivers' | 'treatmentTypes' | 'destinations' | 'users' | 'backup' | 'supportHouses' | 'institution'>('vehicles');
  const [refreshKey, setRefreshKey] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [formType, setFormType] = useState<'vehicle' | 'driver' | 'treatmentType' | 'destination' | 'user' | 'supportHouse'>('vehicle');
  
  // Specific state for user permissions
  const [userPermissions, setUserPermissions] = useState<PermissionKey[]>([]);

  const { notify } = useNotification();

  // Check Role for Tabs Visibility
  const isAdmin = db.currentUser?.role === UserRole.ADMIN;

  const refresh = () => setRefreshKey(prev => prev + 1);

  const handleSave = (e: React.FormEvent) => {
      e.preventDefault();
      const formData = new FormData(e.target as HTMLFormElement);
      const data: any = Object.fromEntries(formData.entries());
      data.id = editItem?.id || Date.now().toString();

      // Apply formatInputText to text fields in resource forms
      if (data.model) data.model = formatInputText(data.model);
      if (data.plate) data.plate = formatInputText(data.plate);
      if (data.name) data.name = formatInputText(data.name);
      if (data.specialistName) data.specialistName = formatInputText(data.specialistName);
      if (data.notes) data.notes = formatInputText(data.notes);
      if (data.address) data.address = formatInputText(data.address);

      if (formType === 'vehicle') {
          data.capacity = parseInt(data.capacity);
          const list = db.vehicles;
          const idx = list.findIndex(i => i.id === data.id);
          if (idx >= 0) list[idx] = data; else list.push(data);
      } else if (formType === 'driver') {
          data.active = data.active === 'on';
          const list = db.drivers;
          const idx = list.findIndex(i => i.id === data.id);
          if (idx >= 0) list[idx] = data; else list.push(data);
      } else if (formType === 'treatmentType') { // Renamed Logic
          const list = db.treatmentTypes;
          const idx = list.findIndex(i => i.id === data.id);
          if (idx >= 0) list[idx] = data; else list.push(data);
      } else if (formType === 'destination') {
          const list = db.destinations;
          const idx = list.findIndex(i => i.id === data.id);
          if (idx >= 0) list[idx] = data; else list.push(data);
      } else if (formType === 'user') {
          // IMPORTANT: Handle permissions separately as they are not in simple formData inputs
          data.permissions = userPermissions;
          
          const list = db.users;
          const idx = list.findIndex(i => i.id === data.id);
          if (idx >= 0) list[idx] = data; else list.push(data);
      } else if (formType === 'supportHouse') {
          data.dailyCost = parseFloat(data.dailyCost);
          data.capacity = parseInt(data.capacity);
          const list = db.supportHouses;
          const idx = list.findIndex(i => i.id === data.id);
          if (idx >= 0) list[idx] = data; else list.push(data);
      }
      
      db.save();
      refresh();
      setShowModal(false);
      notify(`${formType === 'vehicle' ? 'Veículo' : formType === 'driver' ? 'Motorista' : 'Registro'} salvo com sucesso!`, "success");
  };

  const handleDelete = (type: typeof formType, id: string) => {
      if (confirm("Deseja excluir este registro?")) {
          try {
              db.deleteResource(type, id);
              refresh();
              notify("Registro excluído com sucesso.", "success");
          } catch (e: any) {
              notify(e.message, "error");
          }
      }
  };

  const openAddModal = (type: typeof formType) => {
      setFormType(type);
      setEditItem(null);
      
      if (type === 'user') {
          setUserPermissions([]); // Default empty or prefill logic could go here
      }
      setShowModal(true);
  };
  
  const openEditModal = (type: typeof formType, item: any) => {
      setFormType(type);
      setEditItem(item);
      
      if (type === 'user') {
          setUserPermissions(item.permissions || db.getPermissionsForRole(item.role));
      }
      setShowModal(true);
  };

  // Helper for Permission Checkboxes
  const togglePermission = (perm: PermissionKey) => {
      if (userPermissions.includes(perm)) {
          setUserPermissions(userPermissions.filter(p => p !== perm));
      } else {
          setUserPermissions([...userPermissions, perm]);
      }
  };

  const PermissionCheckbox = ({ label, permKey }: { label: string, permKey: PermissionKey }) => (
      <div 
        onClick={() => togglePermission(permKey)}
        className={`cursor-pointer border rounded-lg p-2 flex items-center gap-2 transition-colors select-none ${userPermissions.includes(permKey) ? 'bg-teal-50 border-teal-200 text-teal-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
      >
          {userPermissions.includes(permKey) ? <CheckSquare size={16} className="text-teal-600" /> : <Square size={16} className="text-slate-300" />}
          <span className="text-xs font-bold">{label}</span>
      </div>
  );

  const VehicleList = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h3 className="text-lg font-semibold text-slate-800">Veículos</h3><button onClick={() => openAddModal('vehicle')} className="bg-teal-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 text-sm hover:bg-teal-700"><Plus size={16} /> Novo</button></div>
      <Table headers={['Modelo', 'Placa', 'Capacidade', 'Status']}>
        {db.vehicles.map(v => (
          <tr key={v.id}><td className="px-6 py-4 text-slate-900">{v.model}</td><td className="px-6 py-4 font-mono text-slate-700">{v.plate}</td><td className="px-6 py-4 text-slate-700">{v.capacity} Lugares</td><td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs uppercase font-medium ${v.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{v.status === 'active' ? 'Ativo' : 'Manutenção'}</span></td><td className="px-6 py-4 text-right space-x-2"><button onClick={() => openEditModal('vehicle', v)} className="text-slate-400 hover:text-blue-600"><Edit size={18} /></button><button onClick={() => handleDelete('vehicle', v.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={18} /></button></td></tr>
        ))}
      </Table>
    </div>
  );
  
  const DriverList = () => (<div className="space-y-4"><div className="flex justify-between items-center"><h3 className="text-lg font-semibold text-slate-800">Motoristas</h3><button onClick={() => openAddModal('driver')} className="bg-teal-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 text-sm hover:bg-teal-700"><Plus size={16} /> Novo</button></div><Table headers={['Nome', 'CNH', 'Telefone', 'Status']}>{db.drivers.map(d => (<tr key={d.id}><td className="px-6 py-4 text-slate-900">{d.name}</td><td className="px-6 py-4 text-slate-700">{d.cnh}</td><td className="px-6 py-4 text-slate-700">{d.phone}</td><td className="px-6 py-4 text-slate-700">{d.active ? 'Ativo' : 'Inativo'}</td><td className="px-6 py-4 text-right space-x-2"><button onClick={() => openEditModal('driver', d)} className="text-slate-400 hover:text-blue-600"><Edit size={18} /></button><button onClick={() => handleDelete('driver', d.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={18} /></button></td></tr>))}</Table></div>);
  const TreatmentTypeList = () => (<div className="space-y-4"><div className="flex justify-between items-center"><h3 className="text-lg font-semibold text-slate-800">Tipos de Tratamento</h3><button onClick={() => openAddModal('treatmentType')} className="bg-teal-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 text-sm hover:bg-teal-700"><Plus size={16} /> Novo</button></div><Table headers={['Nome do Tratamento', 'Especialista (Profissional)', 'Instituição / Local Padrão', 'Notas']}>{db.treatmentTypes.map(s => { const dest = db.destinations.find(d => d.id === s.defaultDestinationId); return (<tr key={s.id}><td className="px-6 py-4 text-slate-900 font-bold">{s.name}</td><td className="px-6 py-4 text-slate-700">{s.specialistName ? (<span className="text-teal-700 font-medium flex items-center gap-1"><User size={14}/> {s.specialistName}</span>) : <span className="text-slate-400 text-xs italic">Não informado</span>}</td><td className="px-6 py-4 text-slate-700">{dest ? (<span className="flex items-center gap-1 text-blue-600 font-medium"><Building size={14}/> {dest.name}</span>) : <span className="text-slate-400 italic">Não vinculado</span>}</td><td className="px-6 py-4 text-slate-700">{s.notes}</td><td className="px-6 py-4 text-right space-x-2"><button onClick={() => openEditModal('treatmentType', s)} className="text-slate-400 hover:text-blue-600"><Edit size={18} /></button><button onClick={() => handleDelete('treatmentType', s.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={18} /></button></td></tr>); })}</Table></div>);
  const DestinationList = () => (<div className="space-y-4"><div className="flex justify-between items-center"><h3 className="text-lg font-semibold text-slate-800">Destinos (Instituições/Hospitais)</h3><button onClick={() => openAddModal('destination')} className="bg-teal-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 text-sm hover:bg-teal-700"><Plus size={16} /> Novo</button></div><Table headers={['Nome da Instituição', 'Endereço / Cidade', 'Contato']}>{db.destinations.map(d => (<tr key={d.id}><td className="px-6 py-4 text-slate-900 font-medium">{d.name}</td><td className="px-6 py-4 text-slate-700 flex items-center gap-2"><MapPin size={14} className="text-slate-400"/> {d.address}</td><td className="px-6 py-4 text-slate-700"><div className="flex items-center gap-2"><Phone size={14} className="text-slate-400"/> {d.phone}</div></td><td className="px-6 py-4 text-right space-x-2"><button onClick={() => openEditModal('destination', d)} className="text-slate-400 hover:text-blue-600"><Edit size={18} /></button><button onClick={() => handleDelete('destination', d.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={18} /></button></td></tr>))}</Table></div>);
  const SupportHouseList = () => (<div className="space-y-4"><div className="flex justify-between items-center"><h3 className="text-lg font-semibold text-slate-800">Casas de Apoio</h3><button onClick={() => openAddModal('supportHouse')} className="bg-teal-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 text-sm hover:bg-teal-700"><Plus size={16} /> Nova Casa</button></div><Table headers={['Nome do Local', 'Endereço / Contato', 'Custo Diária', 'Capacidade']}>{db.supportHouses.map(h => (<tr key={h.id}><td className="px-6 py-4 text-slate-900 font-medium">{h.name}</td><td className="px-6 py-4 text-slate-700"><div className="flex flex-col text-xs"><span className="flex items-center gap-1"><MapPin size={12}/> {h.address}</span><span className="flex items-center gap-1"><Phone size={12}/> {h.phone}</span></div></td><td className="px-6 py-4 text-slate-700">R$ {h.dailyCost.toFixed(2)}</td><td className="px-6 py-4 text-slate-700">{h.capacity} Pessoas</td><td className="px-6 py-4 text-right space-x-2"><button onClick={() => openEditModal('supportHouse', h)} className="text-slate-400 hover:text-blue-600"><Edit size={18} /></button><button onClick={() => handleDelete('supportHouse', h.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={18} /></button></td></tr>))}</Table></div>);
  
  const SystemBackup = () => { 
      const fileInputRef = React.useRef<HTMLInputElement>(null); 
      const { notify } = useNotification(); 
      const handleImportClick = () => { fileInputRef.current?.click(); }; 
      const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; if (confirm("ATENÇÃO: Importar um backup substituirá TODOS os dados atuais do sistema. Deseja continuar?")) { try { await db.importDatabase(file); notify("Dados importados com sucesso! A página será recarregada.", "success"); setTimeout(() => window.location.reload(), 1500); } catch (err: any) { notify("Erro ao importar: " + err.message, "error"); } } if (fileInputRef.current) fileInputRef.current.value = ''; }; 
      return (
        <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-start gap-3"><Shield className="text-amber-600 mt-1" size={24} /><div><h3 className="font-bold text-amber-800">Área de Segurança de Dados</h3><p className="text-sm text-amber-700 mt-1">Faça o backup regular dos seus dados. Como este sistema roda localmente no seu navegador, limpar o cache ou trocar de computador resultará na perda dos dados se você não tiver um backup.</p></div></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center text-center"><div className="bg-blue-100 p-4 rounded-full text-blue-600 mb-4"><Download size={32} /></div><h3 className="font-bold text-lg text-slate-800">Exportar Backup</h3><button onClick={() => db.exportDatabase()} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 w-full mt-4">Baixar Cópia de Segurança</button></div><div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center text-center"><div className="bg-emerald-100 p-4 rounded-full text-emerald-600 mb-4"><Upload size={32} /></div><h3 className="font-bold text-lg text-slate-800">Restaurar Dados</h3><input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} /><button onClick={handleImportClick} className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-emerald-700 w-full mt-4">Selecionar Arquivo de Backup</button></div></div>
            
            {/* Developer Info */}
            <div className="pt-8 mt-8 border-t border-slate-200 text-center">
                <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1 flex items-center justify-center gap-1"><Code size={12}/> Sistema TFD Pro Municipal</p>
                <p className="text-xs text-slate-500">Desenvolvido por <span className="font-bold text-slate-700">Waldeilson Souza & Maycon Souza</span></p>
                <div className="text-[10px] text-slate-400 mt-2 flex justify-center gap-4">
                    <span>Suporte: (99) 98460-2079</span>
                    <span>Email: suporte@i2asys.com.br</span>
                </div>
            </div>
        </div>
      ); 
  };

  const UserList = () => (
      <div className="space-y-4">
          <div className="flex justify-between items-center"><h3 className="text-lg font-semibold text-slate-800">Usuários do Sistema</h3><button onClick={() => openAddModal('user')} className="bg-teal-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 text-sm hover:bg-teal-700"><Plus size={16} /> Novo Usuário</button></div>
          <Table headers={['Nome', 'Login (Email)', 'Permissão (Cargo)']}>
              {db.users.map(u => (
                  <tr key={u.id}>
                      <td className="px-6 py-4 text-slate-900 font-medium">{u.name}</td>
                      <td className="px-6 py-4 text-slate-700 font-mono text-xs">{u.login}</td>
                      <td className="px-6 py-4 text-slate-700">
                          <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${u.role === UserRole.ADMIN ? 'bg-purple-100 text-purple-800' : u.role === UserRole.DRIVER ? 'bg-blue-100 text-blue-800' : u.role === UserRole.ATTENDANT ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                              {u.role === UserRole.ADMIN ? 'Administrador' : u.role === UserRole.ATTENDANT ? 'Atendente' : u.role === UserRole.DRIVER ? 'Motorista' : 'Visualizador'}
                          </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2"><button onClick={() => openEditModal('user', u)} className="text-slate-400 hover:text-blue-600"><Edit size={18} /></button><button onClick={() => handleDelete('user', u.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={18} /></button></td>
                  </tr>
              ))}
          </Table>
      </div>
  );

  // Tabs Configuration based on permissions logic
  // "restricted: true" means ONLY ADMIN can see it.
  const allTabs = [
      { id: 'vehicles', label: 'Veículos', restricted: false },
      { id: 'drivers', label: 'Motoristas', restricted: false },
      { id: 'treatmentTypes', label: 'Tipos de Tratamento', restricted: false },
      { id: 'destinations', label: 'Destinos / Locais', restricted: false },
      { id: 'supportHouses', label: 'Casas de Apoio', restricted: false },
      { id: 'users', label: 'Usuários', restricted: true }, // Restricted to ADMIN
      { id: 'institution', label: 'Instituição', restricted: true }, // Restricted to ADMIN
      { id: 'backup', label: 'Sistema / Backup', restricted: true }, // Restricted to ADMIN
  ];

  const visibleTabs = allTabs.filter(t => !t.restricted || isAdmin);

  // Effect to reset active tab if current selection is invalid for the user
  useEffect(() => {
      const isCurrentTabVisible = visibleTabs.some(t => t.id === activeTab);
      if (!isCurrentTabVisible && visibleTabs.length > 0) {
          setActiveTab(visibleTabs[0].id as any);
      }
  }, [isAdmin, visibleTabs, activeTab]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Recursos</h1>
      <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg w-full md:w-fit">
        {/* Tab Buttons */}
        {visibleTabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>{tab.label}</button>
        ))}
      </div>

      {activeTab === 'vehicles' && <VehicleList />}
      {activeTab === 'drivers' && <DriverList />}
      {activeTab === 'treatmentTypes' && <TreatmentTypeList />}
      {activeTab === 'destinations' && <DestinationList />}
      {activeTab === 'supportHouses' && <SupportHouseList />}
      
      {/* Protected Tabs */}
      {activeTab === 'users' && isAdmin && <UserList />}
      {activeTab === 'institution' && isAdmin && <InstitutionManager />}
      {activeTab === 'backup' && isAdmin && <SystemBackup />}

      {/* Shared Resource Modal */}
      {showModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <form onSubmit={handleSave} className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 text-slate-900 flex flex-col max-h-[90vh]">
                  <h2 className="text-xl font-bold mb-4 text-slate-800 border-b pb-2 capitalize">
                      {editItem ? 'Editar' : 'Novo'} {formType === 'vehicle' ? 'Veículo' : formType === 'driver' ? 'Motorista' : formType === 'treatmentType' ? 'Tipo de Tratamento' : formType === 'user' ? 'Usuário' : formType === 'supportHouse' ? 'Casa de Apoio' : 'Destino'}
                  </h2>
                  <div className="space-y-4 overflow-y-auto flex-1 p-1">
                      {/* ... other form types ... */}
                      {formType === 'vehicle' && (
                          <>{/* ... vehicle inputs ... */}<div className="space-y-4"><div><label className="text-xs font-bold text-slate-500 uppercase">Modelo</label><input name="model" required defaultValue={editItem?.model} className="w-full border p-2 rounded bg-slate-50 focus:bg-white" onChange={(e) => e.target.value = formatInputText(e.target.value)} /></div><div><label className="text-xs font-bold text-slate-500 uppercase">Placa</label><input name="plate" required defaultValue={editItem?.plate} className="w-full border p-2 rounded bg-slate-50 focus:bg-white" onChange={(e) => e.target.value = formatInputText(e.target.value)} /></div><div><label className="text-xs font-bold text-slate-500 uppercase">Capacidade</label><input name="capacity" type="number" required defaultValue={editItem?.capacity} className="w-full border p-2 rounded bg-slate-50 focus:bg-white" /></div><div><label className="text-xs font-bold text-slate-500 uppercase">Status</label><select name="status" defaultValue={editItem?.status || 'active'} className="w-full border p-2 rounded bg-slate-50 focus:bg-white"><option value="active">Ativo</option><option value="maintenance">Manutenção</option></select></div></div></>
                      )}
                      {formType === 'driver' && (
                          <>{/* ... driver inputs ... */}<div className="space-y-4"><div><label className="text-xs font-bold text-slate-500 uppercase">Nome</label><input name="name" required defaultValue={editItem?.name} className="w-full border p-2 rounded bg-slate-50 focus:bg-white" onChange={(e) => e.target.value = formatInputText(e.target.value)} /></div><div><label className="text-xs font-bold text-slate-500 uppercase">CNH</label><input name="cnh" required defaultValue={editItem?.cnh} maxLength={11} onChange={(e) => e.target.value = maskCNH(e.target.value)} className="w-full border p-2 rounded bg-slate-50 focus:bg-white" placeholder="Apenas números" /></div><div><label className="text-xs font-bold text-slate-500 uppercase">Telefone</label><input name="phone" required defaultValue={editItem?.phone} maxLength={15} onChange={(e) => e.target.value = maskPhone(e.target.value)} className="w-full border p-2 rounded bg-slate-50 focus:bg-white" placeholder="(00) 00000-0000" /></div><div><label className="text-xs font-bold text-slate-500 uppercase">Documento (CPF)</label><input name="document" defaultValue={editItem?.document} maxLength={14} onChange={(e) => e.target.value = maskCPF(e.target.value)} className="w-full border p-2 rounded bg-slate-50 focus:bg-white" placeholder="000.000.000-00" /></div><div className="flex items-center gap-2 pt-2"><input type="checkbox" name="active" defaultChecked={editItem?.active !== false} id="activeCheck" /><label htmlFor="activeCheck" className="text-sm font-bold text-slate-700">Ativo?</label></div></div></>
                      )}
                      {formType === 'treatmentType' && (
                          <>{/* ... treatment inputs ... */}<div className="space-y-4"><div><label className="text-xs font-bold text-slate-500 uppercase">Nome do Tratamento</label><input name="name" required defaultValue={editItem?.name} className="w-full border p-2 rounded bg-slate-50 focus:bg-white" onChange={(e) => e.target.value = formatInputText(e.target.value)} placeholder="Ex: HEMODIÁLISE, ONCOLOGIA" /></div><div><label className="text-xs font-bold text-slate-500 uppercase">Nome do Profissional / Especialista</label><input name="specialistName" defaultValue={editItem?.specialistName} className="w-full border p-2 rounded bg-slate-50 focus:bg-white" onChange={(e) => e.target.value = formatInputText(e.target.value)} placeholder="Ex: DR. JOÃO SILVA" /></div><div><label className="text-xs font-bold text-slate-500 uppercase">Instituição / Local Padrão</label><select name="defaultDestinationId" defaultValue={editItem?.defaultDestinationId || ''} className="w-full border p-2 rounded bg-slate-50 focus:bg-white"><option value="">-- Selecione o Local --</option>{db.destinations.map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}</select></div><div><label className="text-xs font-bold text-slate-500 uppercase">Notas</label><input name="notes" defaultValue={editItem?.notes} className="w-full border p-2 rounded bg-slate-50 focus:bg-white" onChange={(e) => e.target.value = formatInputText(e.target.value)} /></div></div></>
                      )}
                      {formType === 'destination' && (
                          <>{/* ... destination inputs ... */}<div className="space-y-4"><div><label className="text-xs font-bold text-slate-500 uppercase">Nome da Instituição (Hospital/Clínica)</label><input name="name" required defaultValue={editItem?.name} className="w-full border p-2 rounded bg-slate-50 focus:bg-white" onChange={(e) => e.target.value = formatInputText(e.target.value)} placeholder="Ex: HOSPITAL DAS CLÍNICAS" /></div><div><label className="text-xs font-bold text-slate-500 uppercase">Endereço Completo</label><input name="address" required defaultValue={editItem?.address} className="w-full border p-2 rounded bg-slate-50 focus:bg-white" onChange={(e) => e.target.value = formatInputText(e.target.value)} /></div><div><label className="text-xs font-bold text-slate-500 uppercase">Contato (Telefone)</label><input name="phone" required defaultValue={editItem?.phone} maxLength={15} onChange={(e) => e.target.value = maskPhone(e.target.value)} className="w-full border p-2 rounded bg-slate-50 focus:bg-white" placeholder="(00) 00000-0000" /></div></div></>
                      )}
                      {formType === 'supportHouse' && (
                          <>{/* ... supportHouse inputs ... */}<div className="space-y-4"><div><label className="text-xs font-bold text-slate-500 uppercase">Nome da Casa</label><input name="name" required defaultValue={editItem?.name} className="w-full border p-2 rounded bg-slate-50 focus:bg-white" onChange={(e) => e.target.value = formatInputText(e.target.value)} /></div><div><label className="text-xs font-bold text-slate-500 uppercase">Endereço</label><input name="address" required defaultValue={editItem?.address} className="w-full border p-2 rounded bg-slate-50 focus:bg-white" onChange={(e) => e.target.value = formatInputText(e.target.value)} /></div><div><label className="text-xs font-bold text-slate-500 uppercase">Telefone</label><input name="phone" required defaultValue={editItem?.phone} maxLength={15} onChange={(e) => e.target.value = maskPhone(e.target.value)} className="w-full border p-2 rounded bg-slate-50 focus:bg-white" placeholder="(00) 00000-0000" /></div><div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold text-slate-500 uppercase">Custo Diária (R$)</label><input name="dailyCost" type="number" step="0.01" required defaultValue={editItem?.dailyCost} className="w-full border p-2 rounded bg-slate-50 focus:bg-white" /></div><div><label className="text-xs font-bold text-slate-500 uppercase">Capacidade</label><input name="capacity" type="number" required defaultValue={editItem?.capacity} className="w-full border p-2 rounded bg-slate-50 focus:bg-white" /></div></div></div></>
                      )}
                      
                      {/* USER FORM WITH PERMISSIONS */}
                      {formType === 'user' && isAdmin && (
                          <>
                              <div><label className="text-xs font-bold text-slate-500 uppercase">Nome</label><input name="name" required defaultValue={editItem?.name} className="w-full border p-2 rounded bg-slate-50 focus:bg-white" onChange={(e) => e.target.value = formatInputText(e.target.value)} /></div>
                              <div><label className="text-xs font-bold text-slate-500 uppercase">Login (Email)</label><input name="login" required defaultValue={editItem?.login} className="w-full border p-2 rounded bg-slate-50 focus:bg-white" /></div>
                              <div><label className="text-xs font-bold text-slate-500 uppercase">Senha</label><input name="password" type="password" required defaultValue={editItem?.password} className="w-full border p-2 rounded bg-slate-50 focus:bg-white" /></div>
                              <div>
                                  <label className="text-xs font-bold text-slate-500 uppercase">Permissão (Cargo)</label>
                                  <select 
                                    name="role" 
                                    required 
                                    defaultValue={editItem?.role || UserRole.VIEWER} 
                                    className="w-full border p-2 rounded bg-slate-50 focus:bg-white"
                                    onChange={(e) => {
                                        // Auto-fill default permissions when role changes, if user wants defaults
                                        const role = e.target.value as UserRole;
                                        const defaults = db.getPermissionsForRole(role);
                                        setUserPermissions(defaults);
                                    }}
                                  >
                                      <option value={UserRole.ADMIN}>Administrador</option>
                                      <option value={UserRole.ATTENDANT}>Atendente</option>
                                      <option value={UserRole.DRIVER}>Motorista</option>
                                      <option value={UserRole.VIEWER}>Visualizador</option>
                                  </select>
                              </div>

                              <div className="pt-2 border-t border-slate-100">
                                  <label className="text-xs font-bold text-teal-700 uppercase mb-2 block flex items-center gap-1">
                                      <Shield size={12}/> Permissões de Acesso Granular
                                  </label>
                                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                                      <PermissionCheckbox label="Painel (Dashboard)" permKey="view_dashboard" />
                                      <PermissionCheckbox label="Relatórios" permKey="view_reports" />
                                      
                                      <PermissionCheckbox label="Ver Pacientes" permKey="view_patients" />
                                      <PermissionCheckbox label="Gerir Pacientes" permKey="manage_patients" />
                                      
                                      <PermissionCheckbox label="Ver Consultas" permKey="view_appointments" />
                                      <PermissionCheckbox label="Gerir Consultas" permKey="manage_appointments" />
                                      
                                      <PermissionCheckbox label="Ver Viagens" permKey="view_trips" />
                                      <PermissionCheckbox label="Gerir Viagens" permKey="manage_trips" />
                                      
                                      <PermissionCheckbox label="Ver Casas Apoio" permKey="view_stays" />
                                      <PermissionCheckbox label="Gerir Casas Apoio" permKey="manage_stays" />
                                      
                                      <PermissionCheckbox label="Ver Financeiro" permKey="view_financial" />
                                      <PermissionCheckbox label="Gerir Financeiro" permKey="manage_financial" />
                                      
                                      <PermissionCheckbox label="Ver Recursos (Users)" permKey="view_resources" />
                                      <PermissionCheckbox label="Gerir Recursos (Users)" permKey="manage_resources" />
                                  </div>
                              </div>
                          </>
                      )}
                  </div>
                  <div className="mt-6 flex justify-end space-x-3 pt-3 border-t border-slate-100">
                      <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded border">Cancelar</button>
                      <button type="submit" className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 font-medium">Salvar</button>
                  </div>
              </form>
          </div>
      )}
    </div>
  );
};