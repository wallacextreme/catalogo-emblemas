import { describe, expect, test } from 'bun:test';
import { createHash } from 'crypto';
import { computeSha256Hex, sha256Fallback } from '../src/utils/sha256';

describe('Cálculo Universal SHA-256 (Secure Context & Insecure HTTP LAN Fallback)', () => {
  test('Gera hash idêntico ao crypto nativo para string vazia', async () => {
    const data = new Uint8Array(0);
    const expected = createHash('sha256').update(data).digest('hex').toUpperCase();
    const result = await computeSha256Hex(data);
    expect(result).toBe(expected);
  });

  test('Gera hash idêntico ao crypto nativo para texto curto', async () => {
    const text = 'hello world';
    const data = new TextEncoder().encode(text);
    const expected = createHash('sha256').update(data).digest('hex').toUpperCase();
    const result = await computeSha256Hex(data);
    expect(result).toBe(expected);
  });

  test('Gera hash idêntico para payload JSON real de backup', async () => {
    const mockBackup = JSON.stringify({
      version: '1.0.0',
      totalProducts: 684,
      timestamp: Date.now(),
      sample: 'Emblema Fiat Caixa 129 85mm',
    });
    const data = new TextEncoder().encode(mockBackup);
    const expected = createHash('sha256').update(data).digest('hex').toUpperCase();
    const result = await computeSha256Hex(data);
    expect(result).toBe(expected);
  });

  test('Fallback determinístico produz hash exato para contexto HTTP inseguro (192.168.x.x)', () => {
    const testCases = [
      '',
      'abc',
      'Emblema Uno Caixa 129',
      JSON.stringify({ id: 'fiat_129', box: '129', diameter: '85mm' }),
    ];

    for (const tc of testCases) {
      const data = new TextEncoder().encode(tc);
      const expected = createHash('sha256').update(data).digest('hex').toUpperCase();
      const fallbackResult = sha256Fallback(data);
      expect(fallbackResult).toBe(expected);
    }
  });
});
