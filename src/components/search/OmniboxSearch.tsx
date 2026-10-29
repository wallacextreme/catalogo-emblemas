import React, { useRef, useEffect } from 'react';
import { SearchIcon, CloseIcon } from '../icons/Icons';

interface OmniboxSearchProps {
  query: string;
  onQueryChange: (q: string) => void;
  totalFiltered: number;
  totalAll: number;
}

export const OmniboxSearch: React.FC<OmniboxSearchProps> = ({
  query,
  onQueryChange,
  totalFiltered,
  totalAll,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Tecla de atalho '/' ou 'Ctrl+K' para focar a busca instantaneamente
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === '/' && document.activeElement !== inputRef.current) ||
          ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="relative w-full">
      <div className="relative flex items-center">
        <div className="absolute left-4 pointer-events-none text-slate-400 dark:text-slate-500">
          <SearchIcon size={22} />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Busque por Caixa (ex: 93, 129, 48GRADE), Medida (ex: 48mm, 85mm), Código (ex: CAL 04, 10442) ou Carro..."
          className="w-full pl-12 pr-28 py-3.5 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 font-medium text-base sm:text-lg focus:outline-none focus:border-blue-600 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-sm transition-all"
        />

        <div className="absolute right-3 flex items-center gap-2">
          {query ? (
            <button
              onClick={() => onQueryChange('')}
              title="Limpar busca"
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
            >
              <CloseIcon size={18} />
            </button>
          ) : (
            <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-mono font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md">
              /
            </kbd>
          )}

          <span className="hidden md:inline-flex items-center px-2.5 py-1 text-xs font-bold font-mono text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-lg">
            {totalFiltered} / {totalAll}
          </span>
        </div>
      </div>
    </div>
  );
};

