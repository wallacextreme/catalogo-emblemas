import React from 'react';
import { EmblemProduct } from '../../types/catalog';
import { RulerIcon, EditIcon } from '../icons/Icons';

interface MuralGridProps {
  products: EmblemProduct[];
  onOpenEdit: (product: EmblemProduct) => void;
  onOpenLightbox: (imageUrl: string, title: string) => void;
}

export const MuralGrid: React.FC<MuralGridProps> = ({
  products,
  onOpenEdit,
  onOpenLightbox,
}) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
      {products.map((product) => {
        const allImages = [
          ...(product.images || []),
          ...(product.customPastedImages || []),
        ];
        const primaryImage = allImages[0] || '/icons/icon-512.png';
        const box = product.boxNumber || 'S/ CX';

        return (
          <div
            key={product.id}
            className="group relative bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-blue-500 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all flex flex-col"
          >
            {/* Foto Grande Centralizada com Aspecto Quadrado */}
            <div
              onClick={() => onOpenLightbox(primaryImage, product.name)}
              className="relative w-full aspect-square bg-[#FFFFFF] p-2 flex items-center justify-center cursor-zoom-in"
            >
              <img
                src={primaryImage}
                alt={product.name}
                loading="lazy"
                className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/icons/icon-512.png';
                }}
              />

              {/* BADGE GIGANTE DA CAIXA SOBREPOSTO NO TOPO */}
              <div className="absolute top-2 left-2 pointer-events-none">
                <div className="inline-flex items-center gap-1 bg-blue-700/95 text-white border-2 border-white dark:border-slate-900 px-2.5 py-1 rounded-xl shadow-md">
                  <span className="text-[10px] font-bold text-blue-200">CX</span>
                  <span className="font-mono text-lg sm:text-xl font-black">{box}</span>
                </div>
              </div>

              {/* BADGE DE MEDIDA SOBREPOSTO */}
              {product.diameterMm && (
                <div className="absolute top-2 right-2 pointer-events-none">
                  <div className="inline-flex items-center gap-1 bg-amber-500/95 text-white text-xs font-mono font-bold px-2 py-0.5 rounded-lg shadow-md">
                    <RulerIcon size={12} />
                    <span>{product.diameterMm}</span>
                  </div>
                </div>
              )}

              {/* Overlay hover com botão de edição rápida */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenEdit(product);
                }}
                title="Editar informações ou colar fotos"
                className="absolute bottom-2 right-2 p-1.5 bg-black/70 hover:bg-black text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <EditIcon size={16} />
              </button>
            </div>

            {/* Legenda Concisa no Rodapé */}
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex-1 flex flex-col justify-between">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm line-clamp-2 leading-tight">
                {product.name}
              </h4>
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {product.brand}
                </span>
                <span className="truncate max-w-[50%]">{product.position}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

