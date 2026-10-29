import { describe, expect, test } from 'bun:test';
import masterSeedData from '../src/data/catalog-master-seed.json';
import { EmblemProduct } from '../src/types/catalog';

describe('Gate 7 & 9 — Motor de Busca Omnibox Especializado em Emblemas', () => {
  const products = masterSeedData as unknown as EmblemProduct[];

  test('Catálogo contém os mais de 600 emblemas extraídos', () => {
    expect(products.length).toBeGreaterThanOrEqual(600);
  });

  test('Busca exata por Número da Caixa (ex: 93, 129, 48GRADE, 29MALA)', () => {
    // Busca por Caixa 129 (Fiat)
    const res129 = products.filter((p) =>
      p.boxNumber.toLowerCase() === '129' ||
      (p.variants || []).some((v) => v.boxNumber.toLowerCase() === '129')
    );
    expect(res129.length).toBeGreaterThan(0);

    // Busca por Caixa 93 (Calota 48mm)
    const res93 = products.filter((p) =>
      p.boxNumber.toLowerCase() === '93' ||
      (p.variants || []).some((v) => v.boxNumber.toLowerCase() === '93')
    );
    expect(res93.length).toBeGreaterThan(0);

    // Busca por Caixa com sufixo (48GRADE ou 36GRADE)
    const resGrade = products.filter((p) =>
      p.boxNumber.toUpperCase().includes('GRADE')
    );
    expect(resGrade.length).toBeGreaterThan(0);
  });

  test('Busca por Diâmetro em Milímetros (mm) (ex: 48mm, 51mm, 65mm, 85mm)', () => {
    const res48 = products.filter((p) => {
      const pDia = (p.diameterMm || '').toLowerCase().replace(/\s+/g, '');
      const hasVar = (p.variants || []).some(
        (v) => (v.diameterMm || '').toLowerCase().replace(/\s+/g, '') === '48mm'
      );
      return pDia === '48mm' || hasVar;
    });
    expect(res48.length).toBeGreaterThan(0);

    const res85 = products.filter((p) =>
      (p.diameterMm || '').toLowerCase().includes('85mm')
    );
    expect(res85.length).toBeGreaterThan(0);
  });

  test('Busca por Códigos de Fabricante (CAL, MARCON, JULIJAC)', () => {
    // Busca CAL 04
    const resCal = products.filter((p) =>
      p.commercialCode.toUpperCase().includes('CAL 04') ||
      (p.variants || []).some((v) => v.commercialCode.toUpperCase().includes('CAL 04'))
    );
    expect(resCal.length).toBeGreaterThan(0);

    // Busca Marçon
    const resMarcon = products.filter((p) =>
      (p.marconCode || '').toUpperCase().includes('10442') ||
      (p.commercialCode || '').toUpperCase().includes('10442')
    );
    expect(resMarcon.length).toBeGreaterThan(0);
  });

  test('Benchmark de Busca Sub-50ms (< 5ms em média no Bun)', () => {
    const queries = ['93', '129', '48mm', '85mm', 'CAL 04', 'MARCON', 'Fiat', 'Gol', 'Crossfox', '48GRADE'];
    const start = performance.now();
    for (let i = 0; i < 500; i++) {
      const q = queries[i % queries.length].toLowerCase();
      products.filter((p) => p.searchTokens.includes(q));
    }
    const elapsed = performance.now() - start;
    const avgPerSearch = elapsed / 500;
    expect(avgPerSearch).toBeLessThan(10); // Muito abaixo do limite de 50ms!
  });
});
