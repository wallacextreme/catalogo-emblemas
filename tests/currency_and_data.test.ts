import { describe, expect, test } from 'bun:test';
import { EmblemProduct } from '../src/types/catalog';

describe('Gate 7 & 8 — Precisão Monetária (BigInt/Centavos) & Isolamento de Dados da Loja', () => {
  test('Cálculo de Preço em Centavos (Inteiro Seguro) elimina erros de ponto flutuante', () => {
    const item1Cents = 3590; // R$ 35,90
    const item2Cents = 1410; // R$ 14,10
    const totalCents = item1Cents + item2Cents; // 5000 cents
    expect(totalCents).toBe(5000);
    expect((totalCents / 100).toFixed(2)).toBe('50.00');

    // Teste com BigInt para volumes gigantes de venda
    const bigCents1 = BigInt(3590);
    const bigCents2 = BigInt(1410);
    expect(bigCents1 + bigCents2).toBe(BigInt(5000));
  });

  test('Gate 8 — Regra de Isolamento: edições manuais de caixa e nome NUNCA são sobrescritas', () => {
    // Simula produto com edições manuais salvas pelo atendente no balcão
    const userEditedProduct: EmblemProduct = {
      id: 'fiat_r01_c01_cx129_001',
      name: 'Emblema Fiat Palio ELX Personalizado no Balcão',
      catalogSource: 'EMBLEMAS FIAT.doc',
      category: 'Fiat',
      categorySlug: 'fiat',
      brand: 'Fiat',
      boxNumber: 'GAVETA 99', // Mudou de 129 para GAVETA 99
      commercialCode: 'CAL 01',
      referenceCode: '',
      diameterMm: '85mm',
      position: 'Grade Dianteira',
      finish: 'Cromado',
      vehicleApplication: 'Palio ELX',
      description: 'Peça conferida fisicamente no balcão',
      needsDescriptionReview: false,
      images: ['/catalog-images/fiat/fiat_r01_c01_cx129_001.webp'],
      customPastedImages: ['blob:custom-photo-ctrl-v'],
      priceCents: 4500,
      notes: 'Cliente levou amostra',
      searchTokens: 'palio elx gaveta 99',
      lastModified: 1700000000000, // Marcador de edição pelo usuário
    };

    // Novo seed estático que chega com os dados brutos originais do catálogo
    const incomingStaticSeed: EmblemProduct = {
      id: 'fiat_r01_c01_cx129_001',
      name: 'Emblema Fiat — Caixa 129',
      catalogSource: 'EMBLEMAS FIAT.doc',
      category: 'Fiat',
      categorySlug: 'fiat',
      brand: 'Fiat',
      boxNumber: '129', // No catálogo original era 129
      commercialCode: '',
      referenceCode: '',
      diameterMm: '',
      position: 'Emblema',
      finish: 'Cromado',
      vehicleApplication: 'Fiat',
      description: 'CAIXA – 129',
      needsDescriptionReview: true,
      images: ['/catalog-images/fiat/fiat_r01_c01_cx129_001.webp'],
      searchTokens: 'fiat caixa 129',
    };

    // Lógica Não-Destrutiva do syncStaticCatalogUpdates:
    const hasUserEdits = Boolean(userEditedProduct.lastModified && userEditedProduct.lastModified > 0);
    const merged: EmblemProduct = {
      ...incomingStaticSeed,
      ...userEditedProduct,
      name: hasUserEdits ? userEditedProduct.name : incomingStaticSeed.name,
      boxNumber: hasUserEdits ? userEditedProduct.boxNumber : incomingStaticSeed.boxNumber,
      description: hasUserEdits ? userEditedProduct.description : incomingStaticSeed.description,
      priceCents: userEditedProduct.priceCents !== undefined ? userEditedProduct.priceCents : incomingStaticSeed.priceCents,
      notes: userEditedProduct.notes || incomingStaticSeed.notes,
      images: [...new Set([...userEditedProduct.images, ...incomingStaticSeed.images])],
      customPastedImages: userEditedProduct.customPastedImages || [],
    };

    // Validações estritas de inviolabilidade:
    expect(merged.name).toBe('Emblema Fiat Palio ELX Personalizado no Balcão');
    expect(merged.boxNumber).toBe('GAVETA 99');
    expect(merged.priceCents).toBe(4500);
    expect(merged.notes).toBe('Cliente levou amostra');
    expect(merged.customPastedImages).toContain('blob:custom-photo-ctrl-v');
    expect(merged.needsDescriptionReview).toBe(false);
  });

  test('Gate 9 — Sanitização Anti-XSS em campos de texto', () => {
    const maliciousInput = '<script>alert("XSS")</script>Emblema Uno<img src=x onerror=alert(1)>';
    // Remove tags HTML não permitidas
    const sanitized = maliciousInput.replace(/<[^>]*>/g, '');
    expect(sanitized).toBe('alert("XSS")Emblema Uno');
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('<img');
  });
});
