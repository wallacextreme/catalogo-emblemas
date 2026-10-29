import { describe, expect, test } from 'bun:test';
import masterSeedData from '../src/data/catalog-master-seed.json';
import { EmblemProduct } from '../src/types/catalog';

describe('Gate 3 & 7 — Parsing e Estruturação de Variantes de Calotas (mm -> CAL -> CAIXA)', () => {
  const products = masterSeedData as unknown as EmblemProduct[];
  const calotas = products.filter((p) => p.categorySlug === 'calotas');

  test('Todos os modelos de calota foram extraídos com suas variantes', () => {
    expect(calotas.length).toBeGreaterThanOrEqual(50);
    const totalVariants = calotas.reduce((acc, c) => acc + (c.variants?.length || 0), 0);
    expect(totalVariants).toBeGreaterThanOrEqual(100);
  });

  test('Variantes contêm diameterMm, commercialCode e boxNumber normalizados', () => {
    const multiVariant = calotas.find((c) => (c.variants?.length || 0) > 3);
    expect(multiVariant).toBeDefined();

    if (multiVariant && multiVariant.variants) {
      for (const v of multiVariant.variants) {
        expect(v.diameterMm).toMatch(/\d+([.,]\d+)?mm/i);
        expect(v.boxNumber).toBeTruthy();
        expect(v.commercialCode).toBeTruthy();
      }
    }
  });

  test('Itens de calota compartilham foto WebP de alta definição', () => {
    for (const c of calotas) {
      if (c.images.length > 0) {
        expect(c.images[0]).toEndWith('.webp');
        expect(c.images[0]).toBe(c.images[0].toLowerCase());
      }
    }
  });
});

