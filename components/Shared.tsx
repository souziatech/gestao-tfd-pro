import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Eye, EyeOff, Search, X, ChevronDown } from 'lucide-react';
import { Patient } from '../types';

// --- MASKS & FORMATTERS ---

export const maskCPF = (value: string) => {
  if (!value) return '';
  return value
    .replace(/\D/g, '') // Substitui qualquer caracter que não seja número por nada
    .replace(/(\d{3})(\d)/, '$1.$2') // Coloca ponto entre o terceiro e o quarto dígitos
    .replace(/(\d{3})(\d)/, '$1.$2') // Coloca ponto entre o terceiro e o quarto dígitos de novo (para o segundo bloco)
    .replace(/(\d{3})(\d{1,2})/, '$1-$2') // Coloca um hífen entre o terceiro e o quarto dígitos
    .replace(/(-\d{2})\d+?$/, '$1'); // Impede entrar mais de 11 dígitos
};

export const maskPhone = (value: string) => {
  if (!value) return '';
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .replace(/(-\d{4})\d+?$/, '$1');
};

export const maskSUS = (value: string) => {
  if (!value) return '';
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1 $2')
    .replace(/(\d{4})(\d)/, '$1 $2')
    .replace(/(\d{4})(\d)/, '$1 $2')
    .replace(/(\d{4})\d+?$/, '$1'); // Limita a 15 dígitos (com espaços fica maior)
};

export const maskCEP = (value: string) => {
  if (!value) return '';
  return value
    .replace(/\D/g, '')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .replace(/(-\d{3})\d+?$/, '$1');
};

export const maskCNH = (value: string) => {
  if (!value) return '';
  return value
    .replace(/\D/g, '')
    .substring(0, 11); // CNH tem 11 dígitos
};

export const maskDateInput = (value: string) => {
    // Formata DD/MM/AAAA visualmente (apenas para campos texto livre, não date picker)
    if (!value) return '';
    return value
        .replace(/\D/g, '')
        .replace(/(\d{2})(\d)/, '$1/$2')
        .replace(/(\d{2})(\d)/, '$1/$2')
        .replace(/(\d{4})\d+?$/, '$1');
};

export const maskCurrency = (value: string) => {
    // Simples máscara para manter apenas números e ponto decimal
    // O ideal para moeda é usar bibliotecas, mas aqui faremos um controle básico
    // Permite apenas números e um ponto
    return value.replace(/[^0-9.]/g, '');
};

/**
 * Padroniza a entrada de texto para cadastros:
 * 1. Converte para Maiúsculas.
 * 2. Remove caracteres especiais (permite apenas Letras, Números, Espaços e Acentos).
 * 3. Remove espaços duplos.
 */
export const formatInputText = (value: string) => {
  if (!value) return '';
  let formatted = value.toUpperCase();
  
  // Permite Letras (A-Z), Números (0-9), Espaço (\s) e Acentos comuns (À-ÿ)
  // Remove símbolos como @, #, $, %, *, (, ), ., ,, etc. exceto hífen que pode ser usado em nomes compostos raros ou bairros
  formatted = formatted.replace(/[^A-Z0-9À-ÁÂÃÉÊÍÓÔÕÚÜÇ\s-]/g, '');
  
  // Remove espaços duplos
  formatted = formatted.replace(/\s{2,}/g, ' ');
  
  return formatted;
};

export const formatDate = (dateString: string) => {
  if (!dateString) return '';
  // Handle ISO strings (2023-01-01T00:00:00.000Z) or simple YYYY-MM-DD
  const cleanDate = dateString.split('T')[0];
  const parts = cleanDate.split('-');
  
  if (parts.length !== 3) return dateString; // Fallback if format is unexpected
  
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
};

interface SensitiveDataProps {
  text?: string;
  type?: 'cpf' | 'text' | 'notes';
  className?: string;
  maskLabel?: string; // Text to show when masked (for notes)
  blur?: boolean; // Use blur effect instead of replacement
}

export const SensitiveData: React.FC<SensitiveDataProps> = ({ 
  text, 
  type = 'text', 
  className = '', 
  maskLabel,
  blur = false
}) => {
  const [visible, setVisible] = useState(false);

  if (!text) return null;

  const getMaskedContent = () => {
    if (type === 'cpf') {
      return maskCPF(text);
    }
    if (type === 'notes') {
        if (blur) return <span className="blur-sm select-none">{text}</span>;
        return <span className="italic opacity-70">{maskLabel || 'Conteúdo Oculto'}</span>;
    }
    // Default text masking
    return '******';
  };

  return (
    <div 
      className={`inline-flex items-center gap-2 group max-w-full ${className}`} 
      onClick={(e) => e.stopPropagation()}
    >
      <span className={`${visible ? '' : 'text-slate-600'} transition-all truncate`}>
        {visible ? text : getMaskedContent()}
      </span>
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="text-slate-400 hover:text-teal-600 focus:outline-none opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0"
        title={visible ? "Ocultar" : "Mostrar"}
      >
        {visible ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
};

// --- Custom Autocomplete Component for Patients ---
export const PatientAutocomplete = ({ 
    patients, 
    selectedId, 
    onChange, 
    disabled,
    placeholder = "Digite Nome ou CPF para buscar..."
}: { 
    patients: Patient[], 
    selectedId: string, 
    onChange: (id: string) => void, 
    disabled?: boolean,
    placeholder?: string
}) => {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Sync query with selected ID
    useEffect(() => {
        if (selectedId) {
            const p = patients.find(p => p.id === selectedId);
            if (p) setQuery(p.name);
        } else {
            setQuery('');
        }
    }, [selectedId, patients]);

    // Handle clicking outside to close
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                // If closed without selecting valid ID, revert text to match ID or clear
                if (selectedId) {
                    const p = patients.find(p => p.id === selectedId);
                    if (p && query !== p.name) setQuery(p.name);
                } else {
                    setQuery('');
                }
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef, selectedId, patients, query]);

    const filteredPatients = useMemo(() => {
        // Optimization: Don't filter until at least 2 chars are typed to prevent lag on big lists
        if (!query || query.length < 2) return []; 
        
        const lowerQ = query.toLowerCase();
        return patients.filter(p => 
            p.name.toLowerCase().includes(lowerQ) || 
            p.cpf.includes(lowerQ)
        ).slice(0, 50); // Limit results for performance
    }, [patients, query]);

    if (disabled) {
        return (
             <div className="relative">
                <input 
                    type="text" 
                    value={query} 
                    disabled 
                    className="w-full border p-2 rounded text-slate-500 bg-slate-100 cursor-not-allowed"
                />
             </div>
        );
    }

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <div className="relative">
                <input
                    type="text"
                    className="w-full border p-2 pl-9 rounded text-slate-900 bg-white focus:bg-white focus:ring-2 focus:ring-teal-500 transition-colors"
                    placeholder={placeholder}
                    value={query}
                    onChange={(e) => {
                        // Aplica formatação de texto na busca também
                        setQuery(formatInputText(e.target.value));
                        setIsOpen(true);
                        // Only clear ID if user backspaces significantly, allowing correction
                        if (selectedId && e.target.value !== patients.find(p=>p.id===selectedId)?.name) {
                            onChange(''); 
                        }
                    }}
                    onFocus={() => {
                        if(query.length >= 2) setIsOpen(true);
                    }}
                />
                <Search className="absolute left-2.5 top-2.5 text-slate-400" size={16} />
                {selectedId && (
                    <button 
                        onClick={() => { onChange(''); setQuery(''); setIsOpen(true); }}
                        className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-200 rounded-full p-0.5"
                    >
                        <X size={16} />
                    </button>
                )}
                {!selectedId && (
                    <div className="absolute right-2 top-2.5 pointer-events-none text-slate-400">
                        <ChevronDown size={16} />
                    </div>
                )}
            </div>

            {isOpen && query.length >= 2 && (
                <div className="absolute z-[999] w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-100">
                    {filteredPatients.length === 0 ? (
                        <div className="p-3 text-sm text-slate-500 text-center">Nenhum paciente encontrado.</div>
                    ) : (
                        <ul>
                            {filteredPatients.map(p => (
                                <li 
                                    key={p.id}
                                    onClick={() => {
                                        onChange(p.id);
                                        setQuery(p.name);
                                        setIsOpen(false);
                                    }}
                                    className={`p-2 hover:bg-teal-50 cursor-pointer border-b last:border-0 border-slate-50 flex flex-col ${selectedId === p.id ? 'bg-teal-50' : ''}`}
                                >
                                    <span className="text-sm font-bold text-slate-800">{p.name}</span>
                                    <span className="text-xs text-slate-500 flex items-center gap-2">
                                        <span>CPF: {maskCPF(p.cpf)}</span>
                                        {p.city && <span>• {p.city}</span>}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
};