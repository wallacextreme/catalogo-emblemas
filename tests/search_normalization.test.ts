import { describe, expect, test } from 'bun:test';
import masterSeedData from '../src/data/catalog-master-seed.json';
import { EmblemProduct } from '../src/types/catalog';

describe('Normalização de Busca — Suporte a Códigos com e sem Espaço (CAL 05 vs CAL05)', () => {
  const products = masterSeedData as unknown as EmblemProduct[];

  function search(query: string): EmblemProduct[] {
    const q = query.trim().toLowerCase();
    const qTokens = q.split(/\s+/).filter(Boolean);
    if (qTokens.length === 0) return products;

    // Decompõe e normaliza tokens para suportar formas unidas ou espaçadas (ex: 'CAL05' <-> 'CAL 05')
    const tokenMatchers = qTokens.map((t) => {
      const clean = t.replace(/[^a-z0-9]/g, '');
      const letterDigit = clean.match(/^([a-z]+)(\d+.*)$/);
      const digitLetter = clean.match(/^(\d+)([a-z]+.*)$/);

      const subParts: string[] = [];
      if (letterDigit) {
        subParts.push(letterDigit[1], letterDigit[2]);
      } else if (digitLetter) {
        subParts.push(digitLetter[1], digitLetter[2]);
      }

      return {
        raw: t,
        clean,
        subParts,
      };
    });

    return products.filter((p) => {
      // 1. Textos da variante
      const variantMatches = (p.variants || []).some((v) => {
        const vText = `${v.diameterMm} ${v.commercialCode} ${v.boxNumber} cx${v.boxNumber} caixa${v.boxNumber}`.toLowerCase();
        const codeCompact = (v.commercialCode || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const diaCompact = (v.diameterMm || '').toLowerCase().replace(/[^a-z0-9]/g, '');

        return tokenMatchers.every((m) => {
          // Match direto
          if (vText.includes(m.raw)) return true;

          // Match no código compacto (ex: 'cal05' bate com 'cal 05' cuja versão compacta é 'cal05')
          if (m.clean && (codeCompact.includes(m.clean) || diaCompact.includes(m.clean))) return true;

          // Match decomposto (ex: se o usuário digitou 'cal05', 'cal' e '05' estão presentes na variante)
          if (m.subParts.length > 1 && m.subParts.every((sp) => vText.includes(sp))) return true;

          return false;
        });
      });

      if (variantMatches) return true;

      // 2. Produto principal
      const pSearch = (
        `${p.name} ${p.boxNumber} cx${p.boxNumber} caixa${p.boxNumber} ${p.commercialCode} ${p.referenceCode} ${p.marconCode || ''} ${p.julijacCode || ''} ${p.diameterMm} ${p.position} ${p.vehicleApplication} ${p.description} ${p.brand}`
      ).toLowerCase();

      // Códigos compactos específicos do produto (sem concatenar números entre campos distintos)
      const pCodeCompacts = [
        p.commercialCode,
        p.referenceCode,
        p.marconCode,
        p.julijacCode,
        p.diameterMm,
      ]
        .filter(Boolean)
        .map((c) => (c || '').toLowerCase().replace(/[^a-z0-9]/g, ''));

      const allTokensMatch = tokenMatchers.every((m) => {
        // Suporte a 'cx93', 'cx 93', 'caixa93', 'caixa 93'
        if (m.clean.startsWith('cx') && m.clean.length > 2) {
          const numPart = m.clean.slice(2);
          if (p.boxNumber.toLowerCase() === numPart) return true;
          if ((p.variants || []).some((v) => v.boxNumber.toLowerCase() === numPart)) return true;
        }
        if (m.clean.startsWith('caixa') && m.clean.length > 5) {
          const numPart = m.clean.slice(5);
          if (p.boxNumber.toLowerCase() === numPart) return true;
          if ((p.variants || []).some((v) => v.boxNumber.toLowerCase() === numPart)) return true;
        }

        // Match direto no texto
        if (pSearch.includes(m.raw)) return true;

        // Match nos códigos compactos do produto (ex: 'marcon10442')
        if (m.clean && pCodeCompacts.some((c) => c.includes(m.clean))) return true;

        // Match decomposto (ex: 'cal05' bate se pSearch contiver 'cal' e '05')
        if (m.subParts.length > 1 && m.subParts.every((sp) => pSearch.includes(sp))) return true;

        return false;
      });

      return allTokensMatch;
    });
  }

  test('Busca por "CAL 05" e "CAL05" encontram exatamente os mesmos produtos (4 itens)', () => {
    const resSpaced = search('CAL 05');
    const resTogether = search('CAL05');
    const resDashed = search('CAL-05');

    expect(resSpaced.length).toBe(4);
    expect(resTogether.length).toBe(4);
    expect(resDashed.length).toBe(4);

    const idsSpaced = resSpaced.map((p) => p.id).sort();
    const idsTogether = resTogether.map((p) => p.id).sort();
    expect(idsTogether).toEqual(idsSpaced);

    // Deve conter os produtos das calotas com CAL 05 e CAL 05C
    expect(idsTogether).toContain('calota_r01_esq_001');
    expect(idsTogether).toContain('calota_r01_dir_002');
  });

  test('Busca por "CAL 04" e "CAL04" encontram produtos com CAL 04', () => {
    const resSpaced = search('CAL 04');
    const resTogether = search('CAL04');

    expect(resSpaced.length).toBeGreaterThan(0);
    expect(resTogether.length).toBe(resSpaced.length);
  });

  test('Busca por "MARCON 10442" e "MARCON10442" encontram os mesmos itens', () => {
    const resSpaced = search('MARCON 10442');
    const resTogether = search('MARCON10442');

    expect(resSpaced.length).toBeGreaterThan(0);
    expect(resTogether.length).toBe(resSpaced.length);
  });

  test('Busca por "CX 93" e "CX93" e "CAIXA 93" e "CAIXA93" retornam itens da Caixa 93', () => {
    const resCxSpace = search('CX 93');
    const resCxTogether = search('CX93');
    const resCaixaSpace = search('CAIXA 93');
    const resCaixaTogether = search('CAIXA93');

    expect(resCxSpace.length).toBeGreaterThan(0);
    expect(resCxTogether.length).toBe(resCxSpace.length);
    expect(resCaixaSpace.length).toBe(resCxSpace.length);
    expect(resCaixaTogether.length).toBe(resCxSpace.length);
  });

  test('Busca por "48MM" e "48 MM" retornam a mesma quantidade de emblemas', () => {
    const resJoined = search('48MM');
    const resSpaced = search('48 MM');

    expect(resJoined.length).toBeGreaterThan(0);
    expect(resJoined.length).toBe(resSpaced.length);
  });
});
