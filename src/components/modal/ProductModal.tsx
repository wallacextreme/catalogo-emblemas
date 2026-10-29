import React, { useState, useEffect } from 'react';
import { EmblemProduct } from '../../types/catalog';
import {
  convertClientImageToWebp,
  extractImageBlobFromEvent,
} from '../../media/webp-converter';
import { saveCustomImage } from '../../db/indexed-db';
import {
  CloseIcon,
  TrashIcon,
  CameraIcon,
  PlusIcon,
} from '../icons/Icons';

interface ProductModalProps {
  isOpen: boolean;
  product: EmblemProduct | null;
  onClose: () => void;
  onSave: (saved: EmblemProduct) => void;
  onDelete?: (id: string) => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  product,
  onClose,
  onSave,
  onDelete,
}) => {
  const [formData, setFormData] = useState<Partial<EmblemProduct>>({});
  const [priceBrlStr, setPriceBrlStr] = useState('');
  const [isConvertingImage, setIsConvertingImage] = useState(false);

  useEffect(() => {
    if (product) {
      setFormData({ ...product });
      setPriceBrlStr(
        product.priceCents !== undefined
          ? (product.priceCents / 100).toFixed(2).replace('.', ',')
          : ''
      );
    } else {
      setFormData({
        id: `manual_${Date.now()}`,
        name: '',
        catalogSource: 'Manual / Balcão',
        category: 'Fiat',
        categorySlug: 'fiat',
        brand: 'Fiat',
        boxNumber: '',
        commercialCode: '',
        referenceCode: '',
        diameterMm: '',
        position: 'Grade Dianteira',
        finish: 'Cromado',
        vehicleApplication: '',
        description: '',
        needsDescriptionReview: false,
        images: [],
        customPastedImages: [],
        searchTokens: '',
      });
      setPriceBrlStr('');
    }
  }, [product, isOpen]);

  // Intercepta Ctrl+V para colar prints de tela e fotos diretamente
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const blob = extractImageBlobFromEvent(e);
      if (blob) {
        e.preventDefault();
        await handleAddImageBlob(blob);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, formData]);

  if (!isOpen) return null;

  const handleAddImageBlob = async (blob: Blob) => {
    try {
      setIsConvertingImage(true);
      const result = await convertClientImageToWebp(blob);
      await saveCustomImage(result.sha256Hex, result.masterBlob);

      const currentPasted = formData.customPastedImages || [];
      const updatedPasted = [...currentPasted, result.masterUrl];

      setFormData((prev) => ({
        ...prev,
        customPastedImages: updatedPasted,
      }));
    } catch (err) {
      alert(`Falha ao converter imagem: ${err}`);
    } finally {
      setIsConvertingImage(false);
    }
  };

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const blob = extractImageBlobFromEvent(e);
    if (blob) {
      await handleAddImageBlob(blob);
    }
  };

  const handleRemoveImage = (index: number, isPasted: boolean) => {
    if (isPasted) {
      const updated = [...(formData.customPastedImages || [])];
      updated.splice(index, 1);
      setFormData({ ...formData, customPastedImages: updated });
    } else {
      const updated = [...(formData.images || [])];
      updated.splice(index, 1);
      setFormData({ ...formData, images: updated });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Converte preço digitado em centavos (inteiro seguro)
    let cents: number | undefined;
    if (priceBrlStr.trim()) {
      const normalized = priceBrlStr.replace(/\./g, '').replace(',', '.');
      const parsed = parseFloat(normalized);
      if (!isNaN(parsed)) {
        cents = Math.round(parsed * 100);
      }
    }

    const brand = formData.brand || 'Universal';
    const box = formData.boxNumber || '';
    const name = formData.name || `Emblema ${brand} — Caixa ${box}`;

    const completeProduct: EmblemProduct = {
      id: formData.id || `manual_${Date.now()}`,
      name,
      catalogSource: formData.catalogSource || 'Manual / Balcão',
      category: formData.category || 'Emblemas',
      categorySlug: formData.categorySlug || 'geral',
      brand,
      boxNumber: box,
      commercialCode: formData.commercialCode || '',
      referenceCode: formData.referenceCode || formData.commercialCode || '',
      marconCode: formData.marconCode,
      julijacCode: formData.julijacCode,
      diameterMm: formData.diameterMm || '',
      position: formData.position || 'Emblema',
      finish: formData.finish || 'Cromado',
      vehicleApplication: formData.vehicleApplication || '',
      description: formData.description || '',
      needsDescriptionReview: false,
      images: formData.images || [],
      customPastedImages: formData.customPastedImages || [],
      variants: formData.variants || [],
      priceCents: cents,
      notes: formData.notes,
      searchTokens: `${name} ${box} ${formData.commercialCode || ''} ${formData.diameterMm || ''} ${formData.vehicleApplication || ''} ${formData.description || ''}`.toLowerCase(),
      lastModified: Date.now(),
    };

    onSave(completeProduct);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Topo do Modal */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
              {product ? 'Editar Emblema de Balcão' : 'Cadastrar Novo Emblema'}
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              ID: {formData.id}
            </span>
          </div>

          <button
            onClick={onClose}
            title="Fechar"
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Formulário com Scroll Interno */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Linha 1: Nome Principal */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Nome / Descrição Principal do Emblema *
            </label>
            <input
              type="text"
              required
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Emblema Grade Dianteira Fiat Palio / Siena Vermelho 85mm"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-blue-600"
            />
          </div>

          {/* Linha 2: Localização Física da Caixa + Medida em mm (Destaques de Balcão) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-200 dark:border-blue-900/40">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 mb-1">
                Nº da Caixa Física (Ex: 129, 93, 48GRADE) *
              </label>
              <input
                type="text"
                required
                value={formData.boxNumber || ''}
                onChange={(e) => setFormData({ ...formData, boxNumber: e.target.value })}
                placeholder="Ex: 129"
                className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border-2 border-blue-400 dark:border-blue-700 rounded-xl font-mono text-xl font-black text-blue-800 dark:text-blue-300 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">
                Diâmetro / Medida em mm (Ex: 85mm, 150x120x5mm)
              </label>
              <input
                type="text"
                value={formData.diameterMm || ''}
                onChange={(e) => setFormData({ ...formData, diameterMm: e.target.value })}
                placeholder="Ex: 85mm"
                className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border-2 border-amber-300 dark:border-amber-700 rounded-xl font-mono text-xl font-black text-amber-800 dark:text-amber-300 focus:outline-none"
              />
            </div>
          </div>

          {/* Linha 3: Códigos Comerciais e Referências */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                Código Comercial / Referência
              </label>
              <input
                type="text"
                value={formData.commercialCode || ''}
                onChange={(e) => setFormData({ ...formData, commercialCode: e.target.value })}
                placeholder="Ex: CAL 04, 356"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                Código Marçon
              </label>
              <input
                type="text"
                value={formData.marconCode || ''}
                onChange={(e) => setFormData({ ...formData, marconCode: e.target.value })}
                placeholder="Ex: MARCON 10442"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                Preço Balcão (R$)
              </label>
              <input
                type="text"
                value={priceBrlStr}
                onChange={(e) => setPriceBrlStr(e.target.value)}
                placeholder="Ex: 35,00"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-mono font-bold text-emerald-600"
              />
            </div>
          </div>

          {/* Linha 4: Montadora, Posição e Acabamento */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                Montadora / Marca
              </label>
              <input
                type="text"
                value={formData.brand || ''}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                placeholder="Fiat, Ford, GM..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                Posição no Veículo
              </label>
              <select
                value={formData.position || 'Grade Dianteira'}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
              >
                <option value="Grade Dianteira">Grade Dianteira</option>
                <option value="Mala / Traseira">Mala / Traseira</option>
                <option value="Capô">Capô</option>
                <option value="Lateral / Paralama">Lateral / Paralama</option>
                <option value="Calota de Roda">Calota de Roda</option>
                <option value="Resinado / Adesivo">Resinado / Adesivo</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                Acabamento
              </label>
              <input
                type="text"
                value={formData.finish || ''}
                onChange={(e) => setFormData({ ...formData, finish: e.target.value })}
                placeholder="Cromado, Preto, Azul..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Linha 5: Aplicação Veicular Detalhada */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
              Veículos e Anos de Aplicação
            </label>
            <input
              type="text"
              value={formData.vehicleApplication || ''}
              onChange={(e) => setFormData({ ...formData, vehicleApplication: e.target.value })}
              placeholder="Ex: Palio 04/12, Siena 05/11, Uno 10/16, Strada 08/20..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
            />
          </div>

          {/* Linha 6: Galeria de Fotos Multi-Ângulos com Suporte a Ctrl+V */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Fotos do Emblema (Múltiplos Ângulos — Cole com Ctrl+V)
              </label>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                Dica: Dê print na tela e aperte Ctrl+V aqui dentro!
              </span>
            </div>

            {/* Drop Zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-xl p-4 text-center cursor-pointer bg-slate-50 dark:bg-slate-800/40 transition-colors"
            >
              <div className="flex flex-col items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <CameraIcon size={28} className="text-blue-600" />
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  Arraste arquivos aqui ou aperte Ctrl+V para colar foto
                </span>
                <span className="text-xs">
                  Converte automaticamente para WebP Studio sem perda de qualidade
                </span>
              </div>
              {isConvertingImage && (
                <div className="text-xs text-blue-600 font-bold mt-2 animate-pulse">
                  Convertendo imagem em WebP Near-Lossless...
                </div>
              )}
            </div>

            {/* Miniaturas de Fotos Atuais */}
            <div className="flex flex-wrap gap-2.5 mt-3">
              {/* Fotos estáticas extraídas dos catálogos */}
              {(formData.images || []).map((imgUrl, idx) => (
                <div
                  key={`static_${idx}`}
                  className="relative w-20 h-20 rounded-lg border border-slate-200 dark:border-slate-700 bg-white p-1 overflow-hidden group"
                >
                  <img src={imgUrl} alt="" className="w-full h-full object-contain" />
                  <span className="absolute bottom-0.5 left-0.5 bg-black/60 text-white text-[9px] px-1 rounded">
                    Catálogo
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx, false)}
                    className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <TrashIcon size={12} />
                  </button>
                </div>
              ))}

              {/* Fotos customizadas coladas com Ctrl+V */}
              {(formData.customPastedImages || []).map((imgUrl, idx) => (
                <div
                  key={`pasted_${idx}`}
                  className="relative w-20 h-20 rounded-lg border-2 border-emerald-500 bg-white p-1 overflow-hidden group"
                >
                  <img src={imgUrl} alt="" className="w-full h-full object-contain" />
                  <span className="absolute bottom-0.5 left-0.5 bg-emerald-700 text-white text-[9px] px-1 rounded font-bold">
                    Ctrl+V
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx, true)}
                    className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <TrashIcon size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </form>

        {/* Rodapé com Ações */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            {product && onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Deseja realmente excluir este emblema (ID: ${product.id})?`)) {
                    onDelete(product.id);
                    onClose();
                  }
                }}
                className="px-3.5 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <TrashIcon size={16} />
                <span>Excluir Peça</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-colors flex items-center gap-1.5"
            >
              <PlusIcon size={16} />
              <span>Salvar Alterações</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

