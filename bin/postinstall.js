#!/usr/bin/env node
/**
 * Bootstrap COMMITADO do hook postinstall (fix do bug de CI, 2026-08-23).
 *
 * Problema: o hook era `node dist/scripts/postinstall.js` direto. Em checkout
 * fresco do repo-fonte, `dist/` é gitignored e o npm ci/install executa este
 * hook ANTES de qualquer build → MODULE_NOT_FOUND (o arquivo nem chega a
 * carregar, então nenhum try/catch dentro dele pode salvar). No pacote
 * PUBLICADO funcionava porque o tarball inclui dist/ — usuários finais nunca
 * foram afetados; o alvo aqui é dev/CI do repo-fonte.
 *
 * Contrato:
 * - `dist/scripts/postinstall.js` EXISTE → delega integralmente (mesmo módulo,
 *   mesmo comportamento byte-a-byte do caminho feliz de auto-ativação) e NÃO
 *   engole erros reais: falha de carga ou exit code não-zero do script delega
 *   se propaga (unhandled rejection / exitCode).
 * - `dist/` AUSENTE (dev/CI em checkout fresco) → exit 0 com orientação clara:
 *   rode `npm run build`. Nunca quebra `npm install`.
 *
 * Este arquivo é intencionalmente JS puro commitado (não passa pelo build):
 * é justamente o guardião que roda quando o build ainda não existe.
 */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const target = new URL('../dist/scripts/postinstall.js', import.meta.url);

if (!existsSync(target)) {
  console.log(
    '[Izanagi AI] dist ausente — rode npm run build antes de usar o CLI/pacote. ' +
      'Postinstall ignorado (esperado em checkout fresco do repo; instalação via npm traz dist/ no tarball).',
  );
  process.exitCode = 0;
} else {
  await import(target);
}
