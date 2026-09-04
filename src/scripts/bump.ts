import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { docVersionWarning } from './doc-version.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

const bumpType = process.argv[2] || 'patch';

if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error('\x1b[31m[Erro]:\x1b[0m Tipo inválido. Use: patch, minor ou major.');
  process.exit(1);
}

try {
  const newVersion = execSync(`npm version ${bumpType} --no-git-tag-version`, { cwd: rootDir, encoding: 'utf-8' }).trim();
  console.log(`\x1b[32m✔ Versão bumpada para ${newVersion}\x1b[0m`);

  // O banner dos documentos de raiz não é estampado aqui de propósito: ver
  // `doc-version.ts`. O que sai é a lista do que precisa de revisão humana, e
  // `doc-version-freshness.test.ts` é quem transforma isso em gate.
  const warning = docVersionWarning(rootDir, newVersion.replace(/^v/, ''));
  if (warning) console.log(`\n\x1b[33m${warning}\x1b[0m`);
} catch (err: any) {
  console.error('\x1b[31m[Erro]:\x1b[0m', err?.message || err);
  process.exit(1);
}
