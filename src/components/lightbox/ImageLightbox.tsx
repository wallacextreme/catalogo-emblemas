import React, { useState, useEffect } from 'react';
import {
  ZoomInIcon,
  ZoomOutIcon,
  RotateIcon,
  CloseIcon,
} from '../icons/Icons';

interface ImageLightboxProps {
  isOpen: boolean;
  imageUrl: string;
  title: string;
  onClose: () => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  isOpen,
  imageUrl,
  title,
  onClose,
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Reset ao abrir nova imagem
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, imageUrl]);

  // Fechar com tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.5, 4));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.5, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-between p-4 select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Barra Superior */}
      <div className="w-full max-w-5xl flex items-center justify-between text-white pb-3">
        <div>
          <h3 className="font-bold text-base sm:text-lg line-clamp-1">{title}</h3>
          <span className="text-xs text-slate-400 font-mono">
            Zoom: {Math.round(zoom * 100)}% | Rotação: {rotation}°
          </span>
        </div>

        {/* Controles de Zoom e Fechar */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-800/80 rounded-xl p-1 border border-slate-700">
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              title="Diminuir Zoom"
              className="p-2 hover:bg-slate-700 disabled:opacity-40 rounded-lg transition-colors"
            >
              <ZoomOutIcon size={18} />
            </button>
            <button
              onClick={handleReset}
              title="Resetar Zoom e Posição"
              className="px-2 py-1 text-xs font-mono font-bold hover:bg-slate-700 rounded-lg transition-colors"
            >
              100%
            </button>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 4}
              title="Aumentar Zoom (até 400%)"
              className="p-2 hover:bg-slate-700 disabled:opacity-40 rounded-lg transition-colors"
            >
              <ZoomInIcon size={18} />
            </button>
            <button
              onClick={handleRotate}
              title="Girar 90 graus"
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors ml-1 border-l border-slate-700"
            >
              <RotateIcon size={18} />
            </button>
          </div>

          <button
            onClick={onClose}
            title="Fechar (ESC)"
            className="p-2.5 bg-slate-800 hover:bg-red-600 rounded-xl transition-colors border border-slate-700"
          >
            <CloseIcon size={20} />
          </button>
        </div>
      </div>

      {/* Área Central de Visualização com Drag / Pan */}
      <div
        className="flex-1 w-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
      >
        <div
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
          }}
          className="max-w-[85vw] max-h-[75vh] bg-[#FFFFFF] rounded-2xl p-4 shadow-2xl border border-slate-800 flex items-center justify-center"
        >
          <img
            src={imageUrl}
            alt={title}
            className="max-w-full max-h-[70vh] object-contain pointer-events-none select-none"
          />
        </div>
      </div>

      {/* Dica no rodapé */}
      <div className="text-slate-400 text-xs text-center py-1">
        Arraste com o mouse para mover a imagem com zoom • Pressione ESC para fechar
      </div>
    </div>
  );
};

