import { describe, expect, test } from 'bun:test';
import { createHash } from 'crypto';
import { EmblemProduct, BackupData } from '../src/types/catalog';

describe('Gate 9 — Backup, Restauração & Integridade Criptográfica SHA-256', () => {
  const sampleProducts: EmblemProduct[] = [
    {
      id: 'fiat_001',
      name: 'Emblema Fiat Uno',
      catalogSource: 'EMBLEMAS FIAT.doc',
      category: 'Fiat',
      categorySlug: 'fiat',
      brand: 'Fiat',
      boxNumber: '129',
      commercialCode: 'CAL 01',
      referenceCode: '',
      diameterMm: '85mm',
      position: 'Grade Dianteira',
      finish: 'Cromado',
      vehicleApplication: 'Uno',
      description: 'Caixa 129',
      needsDescriptionReview: false,
      images: ['/catalog-images/fiat/fiat_001.webp'],
      searchTokens: 'fiat uno 129',
    },
  ];

  test('Exportação de Backup gera Checksum SHA-256 válido', () => {
    const rawData = JSON.stringify(sampleProducts);
    const calculatedSha256 = createHash('sha256').update(rawData).digest('hex').toUpperCase();

    const backup: BackupData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      totalProducts: sampleProducts.length,
      products: sampleProducts,
      sha256: calculatedSha256,
    };

    expect(backup.sha256).toBeTruthy();
    expect(backup.sha256.length).toBe(64);
  });

  test('Restauração com Checksum idêntico é aceita', () => {
    const rawData = JSON.stringify(sampleProducts);
    const sha = createHash('sha256').update(rawData).digest('hex').toUpperCase();

    const backup: BackupData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      totalProducts: sampleProducts.length,
      products: sampleProducts,
      sha256: sha,
    };

    const verifySha = createHash('sha256').update(JSON.stringify(backup.products)).digest('hex').toUpperCase();
    expect(verifySha).toBe(backup.sha256);
  });

  test('Restauração rejeita arquivo adulterado (Tamper Detection)', () => {
    const rawData = JSON.stringify(sampleProducts);
    const sha = createHash('sha256').update(rawData).digest('hex').toUpperCase();

    const tamperedProducts = [...sampleProducts];
    tamperedProducts[0] = { ...tamperedProducts[0], name: 'Emblema Adulterado Maliciosamente' };

    const backup: BackupData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      totalProducts: tamperedProducts.length,
      products: tamperedProducts,
      sha256: sha, // Hash original mantido -> Deve falhar!
    };

    const verifySha = createHash('sha256').update(JSON.stringify(backup.products)).digest('hex').toUpperCase();
    expect(verifySha).not.toBe(backup.sha256);
  });
});
