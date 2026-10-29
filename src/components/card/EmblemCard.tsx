import React, { useState } from 'react';
import { EmblemProduct, CalotaVariant } from '../../types/catalog';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  WhatsAppIcon,
  EditIcon,
  CheckIcon,
  RulerIcon,
  TagIcon,
  CarIcon,
} from '../icons/Icons';

interface EmblemCardProps {
  product: EmblemProduct;
  hidePrices: boolean;
  onOpenEdit: (product: EmblemProduct) => void;
  onQuickSave: (updated: EmblemProduct) => void;
  onOpenLightbox: (imageUrl: string, title: string) => void;
}

export const EmblemCard: React.FC<EmblemCardProps> = ({
  product,
  hidePrices,
  onOpenEdit,
  onQuickSave,
  onOpenLightbox,
}) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [copiedWhatsapp, setCopiedWhatsapp] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<CalotaVariant | null>(
    product.variants && product.variants.length > 0 ? product.variants[0] : null
  );

  // Estados de edição inline rápida
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [inlineBox, setInlineBox] = useState(product.boxNumber);
  const [inlineName, setInlineName] = useState(product.name);

  // Todas as imagens disponíveis (estáticas + customizadas Ctrl+V)
  const allImages = [
    ...(product.images || []),
    ...(product.customPastedImages || []),
  ];
  const currentImage = allImages[activeImageIndex] || '/icons/icon-512.png';

  // Caixa ativa: se selecionou uma variante, mostra a caixa da variante
  const currentBox = selectedVariant ? selectedVariant.boxNumber : (inlineBox || product.boxNumber || 'S/ CX');
  const currentDiameter = selectedVariant ? selectedVariant.diameterMm : (product.diameterMm || '');
  const currentCode = selectedVariant ? selectedVariant.commercialCode : (product.commercialCode || product.referenceCode || '');

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveImageIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0));
  };

  const handleCopyWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    const priceText = product.priceCents && !hidePrices
      ? `\nValor: R$ ${(product.priceCents / 100).toFixed(2).replace('.', ',')}`
      : '';
    const text = `*${product.name}*` +
      `\n*CAIXA:* ${currentBox}` +
      (currentDiameter ? `\n*Medida:* ${currentDiameter}` : '') +
      (currentCode ? `\n*Código:* ${currentCode}` : '') +
      (product.vehicleApplication ? `\n*Aplicação:* ${product.vehicleApplication}` : '') +
      priceText;

    navigator.clipboard.writeText(text);
    setCopiedWhatsapp(true);
    setTimeout(() => setCopiedWhatsapp(false), 2000);
  };

  const handleSaveInline = () => {
    setIsEditingInline(false);
    onQuickSave({
      ...product,
      boxNumber: inlineBox,
      name: inlineName,
      needsDescriptionReview: false,
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
      {/* Topo do Card: Badge Gigante da Caixa + Medida em mm */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          {/* BADGE GIGANTE DA CAIXA (LEITURA A 1 METRO) */}
          <div className="flex-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-0.5">
              Localização Física
            </span>
            {isEditingInline ? (
              <input
                type="text"
                value={inlineBox}
                onChange={(e) => setInlineBox(e.target.value)}
                placeholder="Nº da Caixa"
                className="w-full font-mono text-xl font-black bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-300 border-2 border-blue-500 rounded-lg px-2 py-0.5 focus:outline-none"
              />
            ) : (
              <div
                onClick={() => setIsEditingInline(true)}
                title="Clique para editar número da caixa rapidamente"
                className="cursor-pointer inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/70 border-2 border-blue-600/30 dark:border-blue-500/40 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-xl shadow-xs"
              >
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">CX</span>
                <span className="font-mono text-2xl font-black tracking-tight">{currentBox}</span>
              </div>
            )}
          </div>

          {/* BADGE DE MEDIDA / DIÂMETRO (MM) */}
          {currentDiameter && (
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-0.5">
                Diâmetro / Medida
              </span>
              <div className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 px-2.5 py-1 rounded-lg">
                <RulerIcon size={14} className="text-amber-600 dark:text-amber-400" />
                <span className="font-mono text-sm font-black">{currentDiameter}</span>
              </div>
            </div>
          )}
        </div>

        {/* Foto WebP de Estúdio com Navegação Multi-Ângulos */}
        <div className="relative w-full aspect-square bg-[#FFFFFF] rounded-xl border border-slate-100 dark:border-slate-800 p-2 mb-3 flex items-center justify-center overflow-hidden group/img">
          <img
            src={currentImage}
            alt={product.name}
            loading="lazy"
            onClick={() => onOpenLightbox(currentImage, product.name)}
            className="w-full h-full object-contain cursor-zoom-in transition-transform duration-200 group-hover/img:scale-105"
            onError={(e) => {
              // Fallback gracioso se não carregar
              (e.target as HTMLImageElement).src = '/icons/icon-512.png';
            }}
          />

          {/* Setas de navegação multi-ângulo */}
          {allImages.length > 1 && (
            <>
              <button
                onClick={handlePrevImage}
                title="Ângulo anterior"
                className="absolute left-1.5 top-1/2 -translate-y-1/2 p-1.5 bg-black/40 hover:bg-black/70 text-white rounded-full transition-all opacity-0 group-hover/img:opacity-100"
              >
                <ChevronLeftIcon size={16} />
              </button>
              <button
                onClick={handleNextImage}
                title="Próximo ângulo"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 bg-black/40 hover:bg-black/70 text-white rounded-full transition-all opacity-0 group-hover/img:opacity-100"
              >
                <ChevronRightIcon size={16} />
              </button>
              <div className="absolute bottom-1.5 left-1/2 -translate-y-0 -translate-x-1/2 bg-black/60 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                {activeImageIndex + 1} / {allImages.length}
              </div>
            </>
          )}

          {/* Flag de item precisando de revisão visual de nome */}
          {product.needsDescriptionReview && (
            <div className="absolute top-1.5 left-1.5 bg-amber-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs">
              Foto + Caixa
            </div>
          )}
        </div>

        {/* Título e Descrição */}
        <div className="mb-2">
          {isEditingInline ? (
            <div className="flex gap-1.5 mb-2">
              <input
                type="text"
                value={inlineName}
                onChange={(e) => setInlineName(e.target.value)}
                className="w-full text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-blue-500 rounded px-2 py-1"
              />
              <button
                onClick={handleSaveInline}
                className="px-2 py-1 bg-green-600 text-white rounded text-xs font-bold"
              >
                Salvar
              </button>
            </div>
          ) : (
            <h3
              onClick={() => setIsEditingInline(true)}
              title="Clique para editar nome rapidamente"
              className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base leading-snug line-clamp-2 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
            >
              {inlineName}
            </h3>
          )}

          {/* Aplicação do Veículo e Posição */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <CarIcon size={14} className="shrink-0 text-slate-400" />
            <span className="line-clamp-1">{product.vehicleApplication || product.brand}</span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span className="shrink-0 font-medium text-slate-600 dark:text-slate-300">
              {product.position}
            </span>
          </div>
        </div>

        {/* Chips de Códigos de Fabricante */}
        {(currentCode || product.marconCode || product.julijacCode) && (
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            {currentCode && (
              <span className="inline-flex items-center gap-1 text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md">
                <TagIcon size={12} className="text-slate-400" />
                {currentCode}
              </span>
            )}
            {product.finish && (
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-1.5 py-0.5 rounded">
                {product.finish}
              </span>
            )}
          </div>
        )}

        {/* SELETOR INTERATIVO DE MEDIDAS (FAMÍLIAS DE CALOTA) */}
        {product.variants && product.variants.length > 0 && (
          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
              Medidas Disponíveis (Clique p/ ver Caixa):
            </span>
            <div className="flex flex-wrap gap-1">
              {product.variants.map((v, idx) => {
                const isSelected = selectedVariant === v;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedVariant(v)}
                    className={`text-xs font-mono font-bold px-2 py-1 rounded-md border transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                    }`}
                  >
                    <span>{v.diameterMm}</span>
                    <span className="mx-1 text-[10px] opacity-70">→</span>
                    <span className="text-amber-500 dark:text-amber-400">Cx {v.boxNumber}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Rodapé do Card: Preço (se visível) + Ações de Balcão */}
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        {/* Preço de Balcão */}
        <div>
          {!hidePrices && product.priceCents ? (
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                Preço Balcão
              </span>
              <span className="font-mono text-base font-black text-emerald-600 dark:text-emerald-400">
                R$ {(product.priceCents / 100).toFixed(2).replace('.', ',')}
              </span>
            </div>
          ) : (
            <span className="text-xs text-slate-400 italic">
              {hidePrices ? 'Preço oculto' : 'Consulte o balcão'}
            </span>
          )}
        </div>

        {/* Botões WhatsApp + Edição Completa */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopyWhatsApp}
            title="Copiar dados para enviar ao cliente no WhatsApp"
            className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              copiedWhatsapp
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800'
            }`}
          >
            {copiedWhatsapp ? <CheckIcon size={16} /> : <WhatsAppIcon size={16} />}
            <span className="hidden sm:inline">{copiedWhatsapp ? 'Copiado!' : 'WhatsApp'}</span>
          </button>

          <button
            onClick={() => onOpenEdit(product)}
            title="Editar peça e colar fotos com Ctrl+V"
            className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-all"
          >
            <EditIcon size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
