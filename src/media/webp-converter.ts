/**
 * src/media/webp-converter.ts
 * Conversor client-side de imagens para .webp sem perda visual (Studio Grade)
 * Captura prints via Ctrl+V ou Drag & Drop, comprime em alta fidelidade e calcula SHA-256.
 */

export interface ClientWebpResult {
  masterBlob: Blob;
  thumbBlob: Blob;
  sha256Hex: string;
  width: int;
  height: int;
  masterUrl: string;
  thumbUrl: string;
}

type int = number;

class ObjectUrlManagerRegistry {
  private activeUrls = new Set<string>();

  public create(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    this.activeUrls.add(url);
    return url;
  }

  public revoke(url: string): void {
    if (this.activeUrls.has(url)) {
      URL.revokeObjectURL(url);
      this.activeUrls.delete(url);
    }
  }

  public clearAll(): void {
    for (const url of this.activeUrls) {
      URL.revokeObjectURL(url);
    }
    this.activeUrls.clear();
  }
}

export const ObjectUrlManager = new ObjectUrlManagerRegistry();

/**
 * Converte um ArrayBuffer para string hexadecimal SHA-256 via Web Crypto API.
 */
export async function computeSha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Carrega um Blob ou File em um HTMLImageElement para manipulação em Canvas.
 */
function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const tempUrl = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(tempUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(tempUrl);
      reject(new Error('Falha ao carregar imagem no Canvas'));
    };
    img.src = tempUrl;
  });
}

/**
 * Redimensiona a imagem preservando 100% da proporção original e compondo sobre fundo branco #FFFFFF.
 */
function renderToCanvas(
  img: HTMLImageElement,
  maxDimension: int,
  padding = 16
): HTMLCanvasElement {
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;

  // Redimensiona mantendo proporção apenas se ultrapassar maxDimension
  if (Math.max(w, h) > maxDimension) {
    const scale = maxDimension / Math.max(w, h);
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
  }

  const canvas = document.createElement('canvas');
  canvas.width = w + padding * 2;
  canvas.height = h + padding * 2;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Não foi possível obter contexto 2D do Canvas');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Fundo branco puro (#FFFFFF) para eliminar transparências pretas
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Desenha a imagem centralizada com o padding protetor
  ctx.drawImage(img, padding, padding, w, h);

  return canvas;
}

/**
 * Converte um Canvas para Blob no formato image/webp com qualidade especificada.
 */
function canvasToWebpBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Falha ao gerar Blob WebP'));
        }
      },
      'image/webp',
      quality
    );
  });
}

/**
 * Pipeline principal de conversão client-side:
 * Processa qualquer foto colada com Ctrl+V ou arrastada para WebP Master (1600px, quality 0.96)
 * e WebP Thumbnail (320px, quality 0.90) com hash SHA-256.
 */
export async function convertClientImageToWebp(fileOrBlob: Blob): Promise<ClientWebpResult> {
  const img = await loadImageFromBlob(fileOrBlob);

  // 1. Gera Master Canvas (até 1600px, padding 16px)
  const masterCanvas = renderToCanvas(img, 1600, 16);
  const masterBlob = await canvasToWebpBlob(masterCanvas, 0.96);

  // 2. Gera Thumbnail Canvas (320px, padding 8px)
  const thumbCanvas = renderToCanvas(img, 320, 8);
  const thumbBlob = await canvasToWebpBlob(thumbCanvas, 0.90);

  // 3. Calcula Hash SHA-256 do Master para deduplicação
  const masterBuffer = await masterBlob.arrayBuffer();
  const sha256Hex = await computeSha256Hex(masterBuffer);

  const masterUrl = ObjectUrlManager.create(masterBlob);
  const thumbUrl = ObjectUrlManager.create(thumbBlob);

  return {
    masterBlob,
    thumbBlob,
    sha256Hex,
    width: masterCanvas.width,
    height: masterCanvas.height,
    masterUrl,
    thumbUrl,
  };
}

/**
 * Utilitário para extrair Blob de imagem de evento Clipboard (Ctrl+V) ou Drag & Drop.
 */
export function extractImageBlobFromEvent(
  event: { clipboardData?: DataTransfer | null; dataTransfer?: DataTransfer | null }
): Blob | null {
  if (event.clipboardData) {
    const items = event.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        return item.getAsFile();
      }
    }
  }

  if (event.dataTransfer) {
    const files = event.dataTransfer.files;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        return file;
      }
    }
  }

  return null;
}
