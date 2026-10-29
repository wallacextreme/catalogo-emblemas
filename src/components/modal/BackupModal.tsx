import React, { useState } from 'react';
import { exportBackupData, importBackupData } from '../../db/indexed-db';
import { EmblemProduct } from '../../types/catalog';
import {
  CloseIcon,
  DownloadIcon,
  UploadIcon,
  PrinterIcon,
  CheckIcon,
} from '../icons/Icons';

interface BackupModalProps {
  isOpen: boolean;
  products: EmblemProduct[];
  onClose: () => void;
  onRefreshData: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  products,
  onClose,
  onRefreshData,
}) => {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleExportJson = async () => {
    try {
      const backup = await exportBackupData();
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_emblemas_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setStatusMessage(`Backup JSON exportado com sucesso! Checksum SHA-256: ${backup.sha256.slice(0, 12)}...`);
      setIsSuccess(true);
    } catch (err) {
      setStatusMessage(`Erro ao exportar backup: ${err}`);
      setIsSuccess(false);
    }
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);
        const count = await importBackupData(parsed);
        setStatusMessage(`Restauração concluída com sucesso! ${count} produtos importados e validados por SHA-256.`);
        setIsSuccess(true);
        onRefreshData();
      } catch (err) {
        setStatusMessage(`Falha na restauração: ${err}`);
        setIsSuccess(false);
      }
    };
    reader.readAsText(file);
  };

  const handleExportCsv = () => {
    try {
      const headers = ['ID', 'Nome', 'Caixa', 'Diâmetro (mm)', 'Código', 'Montadora', 'Posição', 'Preço Centavos'];
      const rows = products.map((p) => [
        `"${p.id}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.boxNumber}"`,
        `"${p.diameterMm}"`,
        `"${p.commercialCode || p.referenceCode || ''}"`,
        `"${p.brand}"`,
        `"${p.position}"`,
        `"${p.priceCents || ''}"`,
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mapa_caixas_emblemas_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      setStatusMessage('Planilha CSV do Mapa de Caixas exportada com sucesso!');
      setIsSuccess(true);
    } catch (err) {
      setStatusMessage(`Erro ao exportar CSV: ${err}`);
      setIsSuccess(false);
    }
  };

  const handlePrintMap = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
        {/* Topo */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
            Backup, Restauração & Mapa de Caixas
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Total de produtos ativos no banco local: <strong>{products.length} itens</strong>.
          </p>

          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                isSuccess
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
              }`}
            >
              {isSuccess && <CheckIcon size={16} />}
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {/* Exportar JSON */}
            <button
              onClick={handleExportJson}
              className="p-3.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs"
            >
              <DownloadIcon size={18} />
              <span>Exportar Backup (.JSON + SHA-256)</span>
            </button>

            {/* Importar JSON */}
            <label className="p-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs">
              <UploadIcon size={18} />
              <span>Restaurar Backup (.JSON)</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportJson}
                className="hidden"
              />
            </label>

            {/* Exportar CSV */}
            <button
              onClick={handleExportCsv}
              className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs"
            >
              <DownloadIcon size={18} />
              <span>Exportar Planilha de Caixas (.CSV)</span>
            </button>

            {/* Imprimir */}
            <button
              onClick={handlePrintMap}
              className="p-3.5 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs"
            >
              <PrinterIcon size={18} />
              <span>Imprimir Mapa de Caixas</span>
            </button>
          </div>
        </div>

        {/* Rodapé */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

