import React from 'react';
import { FilterState, ViewMode } from '../../types/catalog';
import { GridIcon, MuralIcon, EyeIcon, EyeOffIcon } from '../icons/Icons';

interface QuickFiltersProps {
  filters: FilterState;
  onFilterChange: (updates: Partial<FilterState>) => void;
  brandCounts: Record<string, number>;
}

const CATEGORY_TABS = [
  { id: 'todos', label: 'Todos' },
  { id: 'calotas', label: 'Emblemas de Calota' },
  { id: 'fiat', label: 'Fiat' },
  { id: 'ford', label: 'Ford' },
  { id: 'gm', label: 'GM / Chevrolet' },
  { id: 'vw', label: 'Volkswagen' },
  { id: 'importados', label: 'Importados' },
];

const POSITION_PILLS = [
  { id: 'todas', label: 'Todas as Posições' },
  { id: 'calota', label: 'Calota de Roda' },
  { id: 'grade', label: 'Grade Dianteira' },
  { id: 'mala', label: 'Mala / Traseira' },
  { id: 'capô', label: 'Capô' },
  { id: 'lateral', label: 'Lateral / Paralama' },
];

const POPULAR_DIAMETERS = [
  '44,5mm',
  '48mm',
  '51mm',
  '55mm',
  '58mm',
  '60mm',
  '65mm',
  '69mm',
  '70mm',
  '75mm',
  '80mm',
  '85mm',
  '88mm',
  '90mm',
  '95mm',
  '150x120mm',
];

export const QuickFilters: React.FC<QuickFiltersProps> = ({
  filters,
  onFilterChange,
  brandCounts,
}) => {
  return (
    <div className="space-y-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 shadow-sm">
      {/* Linha 1: Abas Principais por Montadora / Categoria + Alternadores de Modo */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        {/* Abas de Montadoras */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-thin">
          {CATEGORY_TABS.map((tab) => {
            const isActive = filters.selectedCategory === tab.id;
            const count = tab.id === 'todos' ? brandCounts['all'] : brandCounts[tab.id] || 0;

            return (
              <button
                key={tab.id}
                onClick={() => onFilterChange({ selectedCategory: tab.id })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{tab.label}</span>
                {count > 0 && (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${
                      isActive
                        ? 'bg-blue-700 text-blue-100'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Alternador de Layout e Modo Privacidade de Preço */}
        <div className="flex items-center gap-2">
          {/* Toggle Preço Balcão */}
          <button
            onClick={() => onFilterChange({ hidePrices: !filters.hidePrices })}
            title={filters.hidePrices ? 'Mostrar preços' : 'Ocultar preços (Modo Cliente)'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              filters.hidePrices
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            {filters.hidePrices ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
            <span className="hidden sm:inline">
              {filters.hidePrices ? 'Preços Ocultos' : 'Preços Visíveis'}
            </span>
          </button>

          {/* Toggle Layout (Grade vs Mural de Fotos Grandes) */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => onFilterChange({ viewMode: 'grid' as ViewMode })}
              title="Grade Detalhada de Balcão"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                filters.viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <GridIcon size={16} />
              <span className="hidden sm:inline">Grade Detalhada</span>
            </button>
            <button
              onClick={() => onFilterChange({ viewMode: 'mural' as ViewMode })}
              title="Mural Comparador Visual (Fotos Grandes para Amostra de Balcão)"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                filters.viewMode === 'mural'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <MuralIcon size={16} />
              <span className="hidden sm:inline">Mural Comparador</span>
            </button>
          </div>
        </div>
      </div>

      {/* Linha 2: Posição do Emblema + Filtro por Status */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Posições */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">
            Posição:
          </span>
          {POSITION_PILLS.map((pill) => {
            const isSel = filters.selectedPosition === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => onFilterChange({ selectedPosition: pill.id })}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  isSel
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        {/* Status */}
        <div className="flex items-center gap-1 text-xs">
          <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mr-1">
            Status:
          </span>
          <select
            value={filters.statusFilter}
            onChange={(e) =>
              onFilterChange({
                statusFilter: e.target.value as FilterState['statusFilter'],
              })
            }
            className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">Todos os Itens</option>
            <option value="has_description">Com Descrição Completa</option>
            <option value="needs_review">Identificação Visual (Foto + Caixa)</option>
            <option value="with_variants">Com Múltiplas Medidas</option>
          </select>
        </div>
      </div>

      {/* Linha 3: Barra Rápida de Medidas / Diâmetros em Milímetros (mm) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-1 scrollbar-thin border-t border-slate-100 dark:border-slate-800/60">
        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider whitespace-nowrap mr-1 flex items-center gap-1">
          Diâmetro (mm):
        </span>
        <button
          onClick={() => onFilterChange({ selectedDiameter: '' })}
          className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition-all ${
            !filters.selectedDiameter
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
          }`}
        >
          Todos
        </button>
        {POPULAR_DIAMETERS.map((dia) => {
          const isSelected = filters.selectedDiameter.toLowerCase() === dia.toLowerCase();
          return (
            <button
              key={dia}
              onClick={() =>
                onFilterChange({
                  selectedDiameter: isSelected ? '' : dia,
                })
              }
              className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition-all whitespace-nowrap ${
                isSelected
                  ? 'bg-blue-600 text-white ring-2 ring-blue-400 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {dia}
            </button>
          );
        })}
      </div>
    </div>
  );
};

