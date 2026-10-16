import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cabecalhosPermitem } from '../src/cenaNova';

/** O quarto novo e o salão isométrico só aparecem se a página deles pode ser embutida no próprio site (cenaNova.ts). */
const com = (h: Record<string, string>) => ({ get: (n: string) => h[n.toLowerCase()] ?? null });
const ANTES = "default-src 'self'; script-src 'self'; frame-src https://challenges.cloudflare.com https://term.ooo; frame-ancestors 'none'";
const DEPOIS = "default-src 'self'; script-src 'self'; frame-src 'self' https://challenges.cloudflare.com https://term.ooo; frame-ancestors 'self'";

test('com a política de antes do lançamento (16/10/2026), a cena antiga', () => {
  assert.equal(cabecalhosPermitem(com({ 'content-security-policy': ANTES, 'x-frame-options': 'DENY' })), false);
  assert.equal(cabecalhosPermitem(com({ 'content-security-policy': DEPOIS, 'x-frame-options': 'DENY' })), false, 'o X-Frame-Options sozinho já barra');
  assert.equal(cabecalhosPermitem(com({ 'content-security-policy': ANTES, 'x-frame-options': 'SAMEORIGIN' })), false, 'o frame-src sem self barra');
});

test('com a política ajustada, a cena nova', () => {
  assert.equal(cabecalhosPermitem(com({ 'content-security-policy': DEPOIS, 'x-frame-options': 'SAMEORIGIN' })), true);
  assert.equal(cabecalhosPermitem(com({})), true, 'sem cabeçalho nenhum (o desenvolvimento)');
  assert.equal(cabecalhosPermitem(com({ 'content-security-policy': "default-src 'self'" })), true, 'sem frame-src, vale o default-src');
});
