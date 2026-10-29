/**
 * src/db/indexed-db.ts
 * Camada de persistência IndexedDB com isolamento inviolável de dados da loja.
 * Garante que alterações manuais (caixas, nomes, fotos Ctrl+V, preços) nunca sejam
 * sobrescritas ao sincronizar com o catálogo estático.
 */

import { EmblemProduct, BackupData } from '../types/catalog';
import { computeSha256Hex } from '../utils/sha256';

const DB_NAME = 'emblemas_counter_db';
const DB_VERSION = 1;

const STORE_PRODUCTS = 'products';
const STORE_CUSTOM_IMAGES = 'custom_images';

let dbInstance: IDBDatabase | null = null;

export async function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_PRODUCTS)) {
        const productStore = db.createObjectStore(STORE_PRODUCTS, { keyPath: 'id' });
        productStore.createIndex('by_box', 'boxNumber', { unique: false });
        productStore.createIndex('by_category', 'categorySlug', { unique: false });
        productStore.createIndex('by_brand', 'brand', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_CUSTOM_IMAGES)) {
        db.createObjectStore(STORE_CUSTOM_IMAGES, { keyPath: 'sha256' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

/**
 * Retorna todos os produtos armazenados no IndexedDB.
 */
export async function getAllProducts(): Promise<EmblemProduct[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRODUCTS, 'readonly');
    const store = tx.objectStore(STORE_PRODUCTS);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result as EmblemProduct[]);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Salva ou atualiza um produto no IndexedDB.
 */
export async function saveProduct(product: EmblemProduct): Promise<void> {
  const db = await openDatabase();
  const toSave: EmblemProduct = {
    ...product,
    lastModified: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRODUCTS, 'readwrite');
    const store = tx.objectStore(STORE_PRODUCTS);
    const request = store.put(toSave);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Exclui um produto do IndexedDB.
 */
export async function deleteProduct(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRODUCTS, 'readwrite');
    const store = tx.objectStore(STORE_PRODUCTS);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Salva uma imagem customizada (Ctrl+V) no repositório de blobs.
 */
export async function saveCustomImage(sha256: string, blob: Blob): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CUSTOM_IMAGES, 'readwrite');
    const store = tx.objectStore(STORE_CUSTOM_IMAGES);
    const request = store.put({ sha256, blob, createdAt: Date.now() });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Recupera um blob de imagem customizada pelo hash SHA-256.
 */
export async function getCustomImage(sha256: string): Promise<Blob | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CUSTOM_IMAGES, 'readonly');
    const store = tx.objectStore(STORE_CUSTOM_IMAGES);
    const request = store.get(sha256);

    request.onsuccess = () => {
      const res = request.result;
      resolve(res ? res.blob : null);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Sincronização Não-Destrutiva dos dados estáticos:
 * Se o produto já existir no IndexedDB com edições locais (lastModified > 0),
 * NUNCA sobrescreve:
 * - boxNumber
 * - name
 * - description
 * - priceCents
 * - notes
 * - customPastedImages
 * - images adicionais
 */
export async function syncStaticCatalogUpdates(
  staticProducts: EmblemProduct[]
): Promise<EmblemProduct[]> {
  const db = await openDatabase();
  const existingMap = new Map<string, EmblemProduct>();
  const currentList = await getAllProducts();

  for (const item of currentList) {
    existingMap.set(item.id, item);
  }

  const mergedList: EmblemProduct[] = [];

  const tx = db.transaction(STORE_PRODUCTS, 'readwrite');
  const store = tx.objectStore(STORE_PRODUCTS);

  for (const staticItem of staticProducts) {
    const existing = existingMap.get(staticItem.id);

    if (!existing) {
      // Produto novo do seed: insere diretamente
      store.put(staticItem);
      mergedList.push(staticItem);
    } else {
      // Produto já existe: faz merge preservando 100% dos dados customizados da loja
      const hasUserEdits = Boolean(existing.lastModified && existing.lastModified > 0);

      const mergedImages = [
        ...new Set([...existing.images, ...staticItem.images]),
      ];

      const merged: EmblemProduct = {
        ...staticItem,
        ...existing,
        // Preserva campos customizados caso tenham sido alterados pelo atendente
        name: hasUserEdits ? existing.name : (staticItem.name || existing.name),
        boxNumber: hasUserEdits ? existing.boxNumber : (existing.boxNumber || staticItem.boxNumber),
        description: hasUserEdits ? existing.description : (existing.description || staticItem.description),
        priceCents: existing.priceCents !== undefined ? existing.priceCents : staticItem.priceCents,
        notes: existing.notes || staticItem.notes,
        images: mergedImages,
        customPastedImages: existing.customPastedImages || [],
        variants: staticItem.variants && staticItem.variants.length > 0 ? staticItem.variants : existing.variants,
        lastModified: existing.lastModified,
      };

      store.put(merged);
      mergedList.push(merged);
      existingMap.delete(staticItem.id);
    }
  }

  // Preserva também quaisquer produtos criados manualmente que não estavam no seed estático
  for (const [, manualItem] of existingMap) {
    mergedList.push(manualItem);
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return mergedList;
}

/**
 * Exporta Backup completo em JSON com validação de Checksum SHA-256.
 */
export async function exportBackupData(): Promise<BackupData> {
  const products = await getAllProducts();
  const dataToHash = JSON.stringify(products);
  const encoder = new TextEncoder();
  const sha256 = await computeSha256Hex(encoder.encode(dataToHash).buffer as ArrayBuffer);

  return {
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    totalProducts: products.length,
    products,
    sha256,
  };
}

/**
 * Restaura Backup JSON validando integridade SHA-256.
 */
export async function importBackupData(backup: BackupData): Promise<number> {
  const encoder = new TextEncoder();
  const dataToHash = JSON.stringify(backup.products);
  const calculatedSha = await computeSha256Hex(encoder.encode(dataToHash).buffer as ArrayBuffer);

  if (calculatedSha !== backup.sha256) {
    throw new Error('Falha de integridade: Checksum SHA-256 do backup não confere!');
  }

  const db = await openDatabase();
  const tx = db.transaction(STORE_PRODUCTS, 'readwrite');
  const store = tx.objectStore(STORE_PRODUCTS);

  for (const prod of backup.products) {
    store.put(prod);
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return backup.products.length;
}

/**
 * Reseta a base IndexedDB (utilizado em testes e disaster recovery).
 */
export async function resetDatabase(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

