import React, { useState, useEffect, useMemo } from 'react';
import masterSeedData from './data/catalog-master-seed.json';
import {
  EmblemProduct,
  FilterState,
  ThemeMode,
} from './types/catalog';
import {
  getAllProducts,
  saveProduct,
  deleteProduct,
  syncStaticCatalogUpdates,
} from './db/indexed-db';
import { OmniboxSearch } from './components/search/OmniboxSearch';
import { QuickFilters } from './components/filters/QuickFilters';
import { EmblemCard } from './components/card/EmblemCard';
import { MuralGrid } from './components/mural/MuralGrid';
import { ImageLightbox } from './components/lightbox/ImageLightbox';
import { ProductModal } from './components/modal/ProductModal';
import { BackupModal } from './components/modal/BackupModal';
import {
  SunIcon,
  MoonIcon,
  PlusIcon,
  DownloadIcon,
  CarIcon,
} from './components/icons/Icons';

export const App: React.FC = () => {
  const [products, setProducts] = useState<EmblemProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState<ThemeMode>('light');

  // Filtros Globais
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    selectedCategory: 'todos',
    selectedBrand: '',
    selectedPosition: 'todas',
    selectedDiameter: '',
    statusFilter: 'all',
    hidePrices: false,
    viewMode: 'grid',
  });

  // Modais
  const [selectedProductForEdit, setSelectedProductForEdit] =
    useState<EmblemProduct | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  // Lightbox
  const [lightboxState, setLightboxState] = useState<{
    isOpen: boolean;
    imageUrl: string;
    title: string;
  }>({
    isOpen: false,
    imageUrl: '',
    title: '',
  });

  // Inicialização e Sincronização Não-Destrutiva com IndexedDB
  useEffect(() => {
    async function loadCatalog() {
      try {
        setIsLoading(true);
        // Sincroniza catálogo estático preservando modificações manuais da loja
        const synced = await syncStaticCatalogUpdates(
          masterSeedData as unknown as EmblemProduct[]
        );
        setProducts(synced);
      } catch (err) {
        console.error('Erro ao sincronizar com IndexedDB:', err);
        // Fallback para os dados estáticos em memória
        setProducts(masterSeedData as unknown as EmblemProduct[]);
      } finally {
        setIsLoading(false);
      }
    }
    loadCatalog();
  }, []);

  // Alternador de Tema Claro / Escuro
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleUpdateFilters = (updates: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  };

  // Recarrega todos os produtos do banco
  const refreshProducts = async () => {
    const list = await getAllProducts();
    setProducts(list);
  };

  // Salvar ou Atualizar Produto (IndexedDB + State)
  const handleSaveProduct = async (saved: EmblemProduct) => {
    await saveProduct(saved);
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = saved;
        return copy;
      }
      return [saved, ...prev];
    });
  };

  // Excluir Produto (IndexedDB + State)
  const handleDeleteProduct = async (id: string) => {
    await deleteProduct(id);
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  // Contadores por Categoria para as Abas
  const brandCounts = useMemo(() => {
    const counts: Record<string, number> = { all: products.length };
    for (const p of products) {
      const slug = p.categorySlug || 'geral';
      counts[slug] = (counts[slug] || 0) + 1;
    }
    return counts;
  }, [products]);

  // MOTOR DE BUSCA SUB-50MS MULTI-CRITÉRIOS
  const filteredProducts = useMemo(() => {
    const q = filters.searchQuery.trim().toLowerCase();
    const qTokens = q.split(/\s+/).filter(Boolean);

    return products.filter((p) => {
      // 1. Filtro por Categoria / Montadora
      if (
        filters.selectedCategory !== 'todos' &&
        p.categorySlug !== filters.selectedCategory
      ) {
        return false;
      }

      // 2. Filtro por Posição
      if (filters.selectedPosition !== 'todas') {
        const posLower = (p.position || '').toLowerCase();
        if (!posLower.includes(filters.selectedPosition.toLowerCase())) {
          return false;
        }
      }

      // 3. Filtro por Diâmetro / Medida
      if (filters.selectedDiameter) {
        const targetDia = filters.selectedDiameter.toLowerCase().replace(/\s+/g, '');
        const prodDia = (p.diameterMm || '').toLowerCase().replace(/\s+/g, '');
        const hasVariantDia = (p.variants || []).some((v) =>
          (v.diameterMm || '').toLowerCase().replace(/\s+/g, '') === targetDia
        );
        if (prodDia !== targetDia && !hasVariantDia) {
          return false;
        }
      }

      // 4. Filtro por Status
      if (filters.statusFilter === 'needs_review' && !p.needsDescriptionReview) {
        return false;
      }
      if (filters.statusFilter === 'has_description' && p.needsDescriptionReview) {
        return false;
      }
      if (
        filters.statusFilter === 'with_variants' &&
        (!p.variants || p.variants.length <= 1)
      ) {
        return false;
      }

      // 5. Omnibox Tokens Search (Sub-50ms)
      if (qTokens.length > 0) {
        const pSearch = (
          `${p.name} ${p.boxNumber} ${p.commercialCode} ${p.referenceCode} ${p.marconCode || ''} ${p.julijacCode || ''} ${p.diameterMm} ${p.position} ${p.vehicleApplication} ${p.description} ${p.brand}`
        ).toLowerCase();

        // Verifica também nas variantes de calota se há match de caixa, código ou medida
        const variantMatches = (p.variants || []).some((v) => {
          const vText = `${v.diameterMm} ${v.commercialCode} ${v.boxNumber}`.toLowerCase();
          return qTokens.every((token) => vText.includes(token));
        });

        if (!variantMatches) {
          const allTokensMatch = qTokens.every((token) => {
            // Suporta buscar 'cx 93' ou 'cx93' ou apenas '93'
            if (token.startsWith('cx') && token.length > 2) {
              const numPart = token.slice(2);
              return p.boxNumber.toLowerCase() === numPart;
            }
            return pSearch.includes(token);
          });
          if (!allTokensMatch) return false;
        }
      }

      return true;
    });
  }, [products, filters]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] text-[#0F172A] dark:text-[#F8FAFC] flex flex-col font-sans transition-colors duration-200">
      {/* HEADER PRINCIPAL DE BALCÃO INDUSTRIAL */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b-2 border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-3.5 flex items-center justify-between gap-4">
          {/* Logo e Identificação */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-700 text-white flex items-center justify-center shadow-md">
              <CarIcon size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-lg sm:text-xl tracking-tight text-slate-900 dark:text-white leading-none">
                  CATÁLOGO DE EMBLEMAS
                </h1>
                <span className="bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 text-[10px] font-mono font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Balcão Pro
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:block mt-0.5">
                Localizador Rápido de Caixas, Diâmetros em mm e Códigos de Calotas
              </p>
            </div>
          </div>

          {/* Botões de Ação do Topo */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Botão Novo Emblema */}
            <button
              onClick={() => {
                setSelectedProductForEdit(null);
                setIsProductModalOpen(true);
              }}
              title="Cadastrar novo emblema ou colar foto com Ctrl+V"
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <PlusIcon size={18} />
              <span className="hidden sm:inline">Novo Emblema</span>
            </button>

            {/* Botão Backup / Restore */}
            <button
              onClick={() => setIsBackupModalOpen(true)}
              title="Backup, Restauração e Mapa de Caixas"
              className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
            >
              <DownloadIcon size={18} />
            </button>

            {/* Alternador de Tema (Daylight Counter <-> Calibrated Dark) */}
            <button
              onClick={toggleTheme}
              title={
                theme === 'light'
                  ? 'Alternar para Dark Mode Calibrado'
                  : 'Alternar para Daylight Counter Mode'
              }
              className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
            >
              {theme === 'light' ? <MoonIcon size={18} /> : <SunIcon size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* ÁREA PRINCIPAL */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-4 sm:py-6 space-y-4 sm:space-y-5">
        {/* Barra de Busca Omnibox Sub-50ms */}
        <OmniboxSearch
          query={filters.searchQuery}
          onQueryChange={(q) => handleUpdateFilters({ searchQuery: q })}
          totalFiltered={filteredProducts.length}
          totalAll={products.length}
        />

        {/* Painel de Filtros Rápidos de 1 Clique */}
        <QuickFilters
          filters={filters}
          onFilterChange={handleUpdateFilters}
          brandCounts={brandCounts}
        />

        {/* Resultados: Grade Detalhada vs Mural Comparador Visual */}
        {isLoading ? (
          <div className="py-20 text-center text-slate-500 animate-pulse font-medium">
            Carregando banco de emblemas de alta velocidade...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
              Nenhum emblema encontrado para os filtros selecionados
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Tente buscar apenas pelo número da caixa (ex: 93 ou 129), diâmetro (ex: 85mm) ou limpe a busca.
            </p>
            <button
              onClick={() =>
                setFilters({
                  searchQuery: '',
                  selectedCategory: 'todos',
                  selectedBrand: '',
                  selectedPosition: 'todas',
                  selectedDiameter: '',
                  statusFilter: 'all',
                  hidePrices: false,
                  viewMode: 'grid',
                })
              }
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold"
            >
              Limpar Todos os Filtros
            </button>
          </div>
        ) : filters.viewMode === 'mural' ? (
          /* MODO MURAL COMPARADOR VISUAL (FOTOS GRANDES) */
          <MuralGrid
            products={filteredProducts}
            onOpenEdit={(p) => {
              setSelectedProductForEdit(p);
              setIsProductModalOpen(true);
            }}
            onOpenLightbox={(img, title) =>
              setLightboxState({ isOpen: true, imageUrl: img, title })
            }
          />
        ) : (
          /* MODO GRADE DETALHADA DE BALCÃO */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map((product) => (
              <EmblemCard
                key={product.id}
                product={product}
                hidePrices={filters.hidePrices}
                onOpenEdit={(p) => {
                  setSelectedProductForEdit(p);
                  setIsProductModalOpen(true);
                }}
                onQuickSave={handleSaveProduct}
                onOpenLightbox={(img, title) =>
                  setLightboxState({ isOpen: true, imageUrl: img, title })
                }
              />
            ))}
          </div>
        )}
      </main>

      {/* RODAPÉ INFORMATIVO */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-3 text-center text-xs text-slate-500 dark:text-slate-400">
        <p>
          Catálogo Inteligente de Balcão • 100% Offline-First (PWA & Desktop Windows via Tauri v2) •{' '}
          {products.length} Emblemas Catalogados
        </p>
      </footer>

      {/* MODAL DE CRIAÇÃO / EDIÇÃO */}
      <ProductModal
        isOpen={isProductModalOpen}
        product={selectedProductForEdit}
        onClose={() => {
          setIsProductModalOpen(false);
          setSelectedProductForEdit(null);
        }}
        onSave={handleSaveProduct}
        onDelete={handleDeleteProduct}
      />

      {/* MODAL DE BACKUP / RESTORE */}
      <BackupModal
        isOpen={isBackupModalOpen}
        products={products}
        onClose={() => setIsBackupModalOpen(false)}
        onRefreshData={refreshProducts}
      />

      {/* LIGHTBOX HD COM ZOOM 50%-400% E ROTAÇÃO */}
      <ImageLightbox
        isOpen={lightboxState.isOpen}
        imageUrl={lightboxState.imageUrl}
        title={lightboxState.title}
        onClose={() =>
          setLightboxState({ isOpen: false, imageUrl: '', title: '' })
        }
      />
    </div>
  );
};
export default App;
