

import React, { useState, useMemo } from 'react';
import { db } from '../services/store';
import { PatientPayment } from '../types';
import { 
    DollarSign, Plus, X, Edit, Trash2, Printer, Search, 
    CheckCircle, Clock, Save, FileText, Banknote, Users, Upload, Eye, Paperclip
} from 'lucide-react';
import { PatientAutocomplete, maskCPF, formatDate, formatInputText } from './Shared';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useNotification } from './NotificationContext';

// --- PAYMENT MODAL (ADD/EDIT) ---
const PaymentModal = ({ 
    onClose, 
    onSave, 
    initialPayment 
}: { 
    onClose: () => void, 
    onSave: () => void, 
    initialPayment?: PatientPayment 
}) => {
    // Form State
    const [patientId, setPatientId] = useState(initialPayment?.patientId || '');
    const [date, setDate] = useState(initialPayment?.date || new Date().toISOString().split('T')[0]);
    
    // TFD Details
    const [hospital, setHospital] = useState(initialPayment?.hospital || '');
    const [specialty, setSpecialty] = useState(initialPayment?.specialty || '');
    
    // Financials
    const [mealValue, setMealValue] = useState(initialPayment?.mealValue || 20);
    const [hasCompanion, setHasCompanion] = useState(initialPayment?.hasCompanion || false);
    const [companionValue, setCompanionValue] = useState(initialPayment?.companionValue || 0);
    const [tripQty, setTripQty] = useState(initialPayment?.tripQty || 1);
    
    // Banking Snapshot (Editable)
    const [accountHolder, setAccountHolder] = useState(initialPayment?.accountHolder || '');
    const [holderCPF, setHolderCPF] = useState(initialPayment?.holderCPF || '');
    const [bankName, setBankName] = useState(initialPayment?.bankName || '');
    const [agency, setAgency] = useState(initialPayment?.agency || '');
    const [accountNumber, setAccountNumber] = useState(initialPayment?.accountNumber || '');

    // Documents
    const [docIdentity, setDocIdentity] = useState(initialPayment?.attachments?.identity || '');
    const [docAddress, setDocAddress] = useState(initialPayment?.attachments?.address || '');
    const [docMedical, setDocMedical] = useState(initialPayment?.attachments?.medical || '');
    const [docProxy, setDocProxy] = useState(initialPayment?.attachments?.proxy || '');

    const [status, setStatus] = useState<PatientPayment['status']>(initialPayment?.status || 'pending');

    // Auto-fill Logic
    const handlePatientSelect = (id: string) => {
        setPatientId(id);
        const p = db.patients.find(pt => pt.id === id);
        if (p) {
            // Financial Defaults
            setHasCompanion(p.allowsCompanion);
            setCompanionValue(p.allowsCompanion ? 20 : 0); // Default logic from PDF seems to be 20 for comp
            
            // Banking Defaults
            setAccountHolder(p.accountHolder || p.name);
            setHolderCPF(p.cpf); // Assuming holder is patient if not specified otherwise, or manual entry
            setBankName(p.bankName || '');
            setAgency(p.agency || '');
            setAccountNumber(p.accountNumber || '');

            // --- AUTO-FILL CLINICAL DATA ---
            // Find the most recent appointment for this patient to auto-populate destination/specialty
            const lastAppt = db.appointments
                .filter(a => a.patientId === id)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

            if (lastAppt) {
                setHospital(lastAppt.destinationName || '');
                setSpecialty(lastAppt.treatmentName || '');
                setDate(lastAppt.date); // Set the date to the appointment date
            }
        }
    };

    // Helper for File Upload
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) return alert("Arquivo muito grande (Máx 5MB).");
            const reader = new FileReader();
            reader.onload = (ev) => {
                const result = ev.target?.result as string;
                const fileData = JSON.stringify({ name: file.name, type: file.type, data: result });
                setter(fileData);
            };
            reader.readAsDataURL(file);
        }
    };

    const downloadDoc = (jsonStr: string) => {
        try {
            const { name, data } = JSON.parse(jsonStr);
            const link = document.createElement('a');
            link.href = data;
            link.download = name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            alert("Erro ao abrir arquivo.");
        }
    };

    const AttachmentField = ({ label, value, setter }: { label: string, value: string, setter: (v: string) => void }) => (
        <div className="border border-slate-200 rounded-lg p-3 flex flex-col gap-2 bg-slate-50">
            <span className="text-[10px] font-bold text-slate-500 uppercase">{label}</span>
            {!value ? (
                <label className="cursor-pointer bg-white border border-dashed border-slate-300 rounded p-2 flex items-center justify-center gap-2 hover:bg-slate-50 hover:border-teal-400 transition-colors">
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => handleFileUpload(e, setter)} />
                    <Upload size={16} className="text-slate-400" />
                    <span className="text-xs text-slate-600 font-medium">Anexar</span>
                </label>
            ) : (
                <div className="flex items-center justify-between bg-teal-50 border border-teal-100 rounded p-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <Paperclip size={14} className="text-teal-600 flex-shrink-0" />
                        <span className="text-xs text-teal-800 truncate">{JSON.parse(value).name}</span>
                    </div>
                    <div className="flex gap-1">
                        <button onClick={() => downloadDoc(value)} className="p-1 hover:bg-teal-100 rounded text-teal-700" title="Baixar/Ver"><Eye size={14} /></button>
                        <button onClick={() => setter('')} className="p-1 hover:bg-red-100 rounded text-red-500" title="Remover"><Trash2 size={14} /></button>
                    </div>
                </div>
            )}
        </div>
    );

    // Calculate Total: (Meal + Companion) * Qty
    const totalValue = (Number(mealValue) + (hasCompanion ? Number(companionValue) : 0)) * Number(tripQty);

    const handleSave = () => {
        if (!patientId) return alert("Selecione um paciente");
        const p = db.patients.find(pt => pt.id === patientId);

        const paymentData: PatientPayment = {
            id: initialPayment?.id || Date.now().toString(),
            patientId,
            patientName: p?.name || 'Desconhecido',
            cpf: p?.cpf || '',
            
            date,
            hospital,
            specialty,
            
            accountHolder,
            holderCPF,
            bankName,
            agency,
            accountNumber,
            
            hasCompanion,
            mealValue: Number(mealValue),
            companionValue: hasCompanion ? Number(companionValue) : 0,
            tripQty: Number(tripQty),
            totalValue,
            
            referenceMonth: new Date(date).getMonth().toString(), // simplified
            referenceYear: new Date(date).getFullYear().toString(),
            status,

            attachments: {
                identity: docIdentity,
                address: docAddress,
                medical: docMedical,
                proxy: docProxy
            }
        };

        if (initialPayment) {
            db.updatePatientPayment(initialPayment.id, paymentData);
        } else {
            db.addPatientPayment(paymentData);
        }
        onSave();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col text-slate-900">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h2 className="text-xl font-bold text-slate-800">
                        {initialPayment ? 'Editar Pagamento TFD' : 'Novo Lançamento TFD'}
                    </h2>
                    <button onClick={onClose}><X className="text-slate-400 hover:text-slate-600" /></button>
                </div>

                <div className="p-6 space-y-6">
                    {/* 1. Patient & Trip Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Paciente</label>
                            <PatientAutocomplete patients={db.patients} selectedId={patientId} onChange={handlePatientSelect} disabled={!!initialPayment} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hospital / Destino</label>
                            <input 
                                type="text" 
                                className="w-full border p-2 rounded bg-slate-50" 
                                value={hospital} 
                                onChange={e => setHospital(formatInputText(e.target.value))} 
                                placeholder="Ex: H. Carlos Macieira" 
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Consulta</label>
                                <input type="date" className="w-full border p-2 rounded bg-slate-50" value={date} onChange={e => setDate(e.target.value)} />
                            </div>
                             <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Especialidade</label>
                                <input 
                                    type="text" 
                                    className="w-full border p-2 rounded bg-slate-50" 
                                    value={specialty} 
                                    onChange={e => setSpecialty(formatInputText(e.target.value))} 
                                    placeholder="Ex: Consulta, Oncologia" 
                                />
                            </div>
                        </div>
                        <div className="flex items-end pb-2">
                             <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" className="w-5 h-5 rounded text-teal-600" checked={hasCompanion} onChange={e => setHasCompanion(e.target.checked)} />
                                <span className="font-bold text-slate-700">Com Acompanhante?</span>
                             </label>
                        </div>
                    </div>

                    {/* 2. Values Calculation */}
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <h3 className="font-bold text-blue-800 flex items-center gap-2 mb-4"><Banknote size={18}/> Valores (Ajuda de Custo)</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-blue-700 uppercase mb-1">Valor Refeição (R$)</label>
                                <input type="number" className="w-full border p-2 rounded bg-white font-mono" value={mealValue} onChange={e => setMealValue(Number(e.target.value))} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-blue-700 uppercase mb-1">Valor Acomp. (R$)</label>
                                <input type="number" disabled={!hasCompanion} className="w-full border p-2 rounded bg-white font-mono disabled:opacity-50" value={companionValue} onChange={e => setCompanionValue(Number(e.target.value))} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-blue-700 uppercase mb-1">Qtd. Viagem</label>
                                <input type="number" className="w-full border p-2 rounded bg-white font-mono" value={tripQty} onChange={e => setTripQty(Number(e.target.value))} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-blue-700 uppercase mb-1">Total (Calculado)</label>
                                <div className="w-full border p-2 rounded bg-blue-100 font-mono font-bold text-blue-900 text-lg">
                                    R$ {totalValue.toFixed(2)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. Banking Data */}
                    <div className="bg-slate-100 p-4 rounded-xl border border-slate-200">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-4"><Users size={18}/> Dados Bancários (Titular)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome do Titular da Conta</label>
                                <input 
                                    type="text" 
                                    className="w-full border p-2 rounded bg-white" 
                                    value={accountHolder} 
                                    onChange={e => setAccountHolder(formatInputText(e.target.value))} 
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">CPF do Titular</label>
                                <input 
                                    type="text" 
                                    maxLength={14}
                                    className="w-full border p-2 rounded bg-white" 
                                    value={holderCPF} 
                                    onChange={e => setHolderCPF(maskCPF(e.target.value))} 
                                    placeholder="000.000.000-00"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Banco</label>
                                <input 
                                    type="text" 
                                    className="w-full border p-2 rounded bg-white" 
                                    value={bankName} 
                                    onChange={e => setBankName(formatInputText(e.target.value))} 
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Agência</label>
                                <input type="text" className="w-full border p-2 rounded bg-white" value={agency} onChange={e => setAgency(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Conta (C/P)</label>
                                <input type="text" className="w-full border p-2 rounded bg-white" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
                            </div>
                        </div>
                    </div>

                    {/* 4. Documents Attachments */}
                    <div className="border-t border-slate-100 pt-4">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-4">
                            <FileText size={18}/> Documentação Comprobatória
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <AttachmentField label="RG / Documento" value={docIdentity} setter={setDocIdentity} />
                            <AttachmentField label="Comp. Residência" value={docAddress} setter={setDocAddress} />
                            <AttachmentField label="Atestado Médico / TFD" value={docMedical} setter={setDocMedical} />
                            <AttachmentField label="Procuração (Se houver)" value={docProxy} setter={setDocProxy} />
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-bold text-slate-700">Status:</label>
                            <select value={status} onChange={e => setStatus(e.target.value as any)} className="border p-1 rounded text-sm bg-slate-50">
                                <option value="pending">Pendente</option>
                                <option value="paid">Pago</option>
                                <option value="cancelled">Cancelado</option>
                            </select>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-slate-50">Cancelar</button>
                            <button onClick={handleSave} className="px-6 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 font-medium flex items-center gap-2">
                                <Save size={18} /> Salvar Lançamento
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MAIN FINANCIAL MANAGER ---
export const FinancialManager: React.FC = () => {
    const [payments, setPayments] = useState<PatientPayment[]>(db.patientPayments);
    const [showModal, setShowModal] = useState(false);
    const [editingPayment, setEditingPayment] = useState<PatientPayment | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDate, setFilterDate] = useState('');

    const { notify } = useNotification();

    const refresh = () => setPayments([...db.patientPayments]);

    const handleDelete = (id: string) => {
        if (confirm("Excluir lançamento financeiro?")) {
            db.deletePatientPayment(id);
            refresh();
            notify("Lançamento excluído com sucesso.", "success");
        }
    };

    const handleSave = () => {
        setShowModal(false);
        setEditingPayment(undefined);
        refresh();
        notify("Lançamento financeiro salvo com sucesso!", "success");
    };

    // Export PDF to match the screenshot provided
    const generatePDF = () => {
        const doc = new jsPDF('landscape');
        const institution = db.institution;
        
        // Header
        if (institution.logo) {
             try {
                 doc.addImage(institution.logo, 'PNG', 14, 8, 20, 20); 
             } catch (e) {
                 console.warn("Logo error", e);
             }
        }

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(institution.name || "ESTADO DO MARANHÃO", 148.5, 10, { align: 'center' });
        doc.text(institution.subtitle || "SECRETARIA MUNICIPAL DE SAÚDE", 148.5, 15, { align: 'center' });
        
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        // doc.text("CNPJ: ...", 14, 25);
        
        const monthYear = filterDate ? new Date(filterDate).toLocaleDateString('pt-BR', {month: 'long', year: 'numeric'}).toUpperCase() : "GERAL";
        doc.text(`COMPETÊNCIA: ${monthYear}`, 148.5, 25, { align: 'center' });

        // Table
        const tableColumn = [
            "NOME PACIENTE", "ACOMP.", "HOSPITAL", "DATA DA\nCONSULTA", "ESPEC.", 
            "TITULAR DA CONTA", "CPF", "BANCO", "AG", "C/P", 
            "VALOR DA\nREFEIÇÃO", "ACOMPANHANT", "QND. DE\nVIAGEM", "AJUDA DE\nCUSTO"
        ];

        const tableRows = filteredPayments.map(p => [
            p.patientName,
            p.hasCompanion ? 'SIM' : 'NÃO',
            p.hospital,
            formatDate(p.date),
            p.specialty,
            p.accountHolder,
            maskCPF(p.holderCPF),
            p.bankName,
            p.agency,
            p.accountNumber,
            `R$ ${p.mealValue.toFixed(2)}`,
            `R$ ${p.companionValue.toFixed(2)}`,
            p.tripQty,
            `R$ ${p.totalValue.toFixed(2)}`
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 35,
            styles: { fontSize: 7, cellPadding: 1, valign: 'middle', overflow: 'linebreak' },
            headStyles: { fillColor: [220, 220, 220], textColor: 20, fontStyle: 'bold', halign: 'center' },
            columnStyles: {
                0: { cellWidth: 35 }, // Paciente
                1: { cellWidth: 12, halign: 'center' }, // Acomp
                2: { cellWidth: 25 }, // Hospital
                3: { cellWidth: 18, halign: 'center' }, // Data
                5: { cellWidth: 30 }, // Titular
                6: { cellWidth: 22 }, // CPF
                10: { halign: 'right' },
                11: { halign: 'right' },
                12: { halign: 'center' },
                13: { halign: 'right', fontStyle: 'bold' }
            },
            theme: 'grid'
        });

        // Totals Footer
        const grandTotal = filteredPayments.reduce((acc, curr) => acc + curr.totalValue, 0);
        const finalY = (doc as any).lastAutoTable.finalY + 10;
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("TOTAL GERAL: R$ " + grandTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2}), 250, finalY, { align: 'right' });

        doc.save("Relatorio_Financeiro_TFD.pdf");
    };

    const filteredPayments = payments.filter(p => 
        (p.patientName.toLowerCase().includes(searchTerm.toLowerCase()) || p.hospital.toLowerCase().includes(searchTerm.toLowerCase())) &&
        (!filterDate || p.date.startsWith(filterDate.substring(0, 7))) // Filter by YYYY-MM
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // CALCULATE TOTALS FOR FOOTER
    const totalQty = filteredPayments.reduce((acc, curr) => acc + curr.tripQty, 0);
    const totalAmount = filteredPayments.reduce((acc, curr) => acc + curr.totalValue, 0);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <DollarSign className="text-teal-600" /> Controle Financeiro TFD
                    </h1>
                    <p className="text-slate-500 text-sm">Relatório de Ajuda de Custo (Passagens e Diárias)</p>
                </div>
                <button 
                    onClick={() => { setEditingPayment(undefined); setShowModal(true); }}
                    className="bg-teal-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-teal-700 shadow-sm"
                >
                    <Plus size={18} /> <span>Novo Lançamento</span>
                </button>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex-1 min-w-[200px]">
                    <Search className="text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar paciente, hospital..." 
                        className="bg-transparent outline-none text-slate-700 w-full text-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase">Competência:</span>
                    <input 
                        type="month" 
                        className="border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 text-slate-700 text-sm"
                        value={filterDate}
                        onChange={e => setFilterDate(e.target.value)}
                    />
                </div>
                <button onClick={generatePDF} className="bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-900 shadow-sm text-sm font-medium ml-auto">
                    <FileText size={16} /> Exportar PDF
                </button>
            </div>

            {/* Main Table - Mimicking the PDF Structure */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
                <table className="w-full text-xs text-left whitespace-nowrap">
                    <thead className="bg-slate-100 text-slate-800 font-bold uppercase border-b border-slate-200">
                        <tr>
                            <th className="p-3 border-r border-slate-200 min-w-[200px]">Nome Paciente</th>
                            <th className="p-3 border-r border-slate-200 text-center">Acomp.</th>
                            <th className="p-3 border-r border-slate-200">Hospital</th>
                            <th className="p-3 border-r border-slate-200 text-center">Data Consulta</th>
                            <th className="p-3 border-r border-slate-200">Espec.</th>
                            <th className="p-3 border-r border-slate-200">Titular Conta</th>
                            <th className="p-3 border-r border-slate-200">Banco / Ag / Conta</th>
                            <th className="p-3 border-r border-slate-200 text-right">Val. Refeição</th>
                            <th className="p-3 border-r border-slate-200 text-right">Acompanhante</th>
                            <th className="p-3 border-r border-slate-200 text-center">Qtd.</th>
                            <th className="p-3 border-r border-slate-200 text-right bg-blue-50">Ajuda Custo</th>
                            <th className="p-3 border-r border-slate-200 text-center">Status</th>
                            <th className="p-3 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                        {filteredPayments.length === 0 && (
                            <tr><td colSpan={13} className="p-8 text-center text-slate-500 text-sm">Nenhum registro encontrado.</td></tr>
                        )}
                        {filteredPayments.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50">
                                <td className="p-3 border-r border-slate-100 font-bold text-slate-900 truncate max-w-[200px]" title={p.patientName}>{p.patientName}</td>
                                <td className="p-3 border-r border-slate-100 text-center">
                                    {p.hasCompanion ? <span className="text-teal-600 font-bold">SIM</span> : <span className="text-slate-400">NÃO</span>}
                                </td>
                                <td className="p-3 border-r border-slate-100 truncate max-w-[150px]" title={p.hospital}>{p.hospital}</td>
                                <td className="p-3 border-r border-slate-100 text-center font-mono">{formatDate(p.date)}</td>
                                <td className="p-3 border-r border-slate-100 truncate max-w-[100px]">{p.specialty}</td>
                                <td className="p-3 border-r border-slate-100 truncate max-w-[150px]" title={p.accountHolder}>{p.accountHolder}</td>
                                <td className="p-3 border-r border-slate-100 text-[10px]">
                                    <div>{p.bankName}</div>
                                    <div className="font-mono text-slate-500">Ag: {p.agency} CC: {p.accountNumber}</div>
                                </td>
                                <td className="p-3 border-r border-slate-100 text-right font-mono">R$ {p.mealValue.toFixed(2)}</td>
                                <td className="p-3 border-r border-slate-100 text-right font-mono">R$ {p.companionValue.toFixed(2)}</td>
                                <td className="p-3 border-r border-slate-100 text-center font-bold">{p.tripQty}</td>
                                <td className="p-3 border-r border-slate-100 text-right font-bold text-slate-900 bg-blue-50/50">R$ {p.totalValue.toFixed(2)}</td>
                                <td className="p-3 border-r border-slate-100 text-center">
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${
                                        p.status === 'paid' ? 'bg-green-100 text-green-800' :
                                        p.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                        'bg-amber-100 text-amber-800'
                                    }`}>
                                        {p.status === 'paid' ? 'PAGO' : p.status === 'cancelled' ? 'CANC.' : 'PENDENTE'}
                                    </span>
                                </td>
                                <td className="p-3 flex justify-center gap-2">
                                    <button onClick={() => { setEditingPayment(p); setShowModal(true); }} className="text-blue-600 hover:bg-blue-100 p-1.5 rounded"><Edit size={16}/></button>
                                    <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:bg-red-100 p-1.5 rounded"><Trash2 size={16}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold text-slate-900 border-t border-slate-300 text-xs">
                        <tr>
                            <td colSpan={9} className="p-3 text-right uppercase">Totais:</td>
                            <td className="p-3 text-center bg-slate-100">{totalQty}</td>
                            <td className="p-3 text-right text-sm bg-blue-50">R$ {totalAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                            <td colSpan={2}></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Modals */}
            {showModal && (
                <PaymentModal 
                    onClose={() => setShowModal(false)} 
                    onSave={handleSave} 
                    initialPayment={editingPayment} 
                />
            )}
        </div>
    );
};