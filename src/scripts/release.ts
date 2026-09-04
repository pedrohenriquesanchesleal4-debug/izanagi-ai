import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { docVersionWarning } from './doc-version.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

const releaseType = process.argv[2] || 'patch'; // patch | minor | major

if (!['patch', 'minor', 'major'].includes(releaseType)) {
  console.error('\x1b[31m[Erro]:\x1b[0m Tipo de versão inválido. Use: patch, minor ou major.');
  process.exit(1);
}

try {
  console.log(`\n\x1b[36m=== 🚀 Iniciando Release (${releaseType.toUpperCase()}) ===\x1b[0m\n`);

  // 1. Build TypeScript
  console.log('📦 1/3 Compilando TypeScript...');
  execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

  // 2. Incrementar versão via npm version
  console.log(`\n🏷️ 2/3 Incrementando versão (${releaseType})...`);
  const newVersion = execSync(`npm version ${releaseType} --no-git-tag-version`, { cwd: rootDir, encoding: 'utf-8' }).trim();

  // Gate de banner de versão dos documentos. `release` não roda os testes, e é
  // por esse caminho que uma versão publicada pode afirmar uma arquitetura que
  // o código já passou: foi assim que ROADMAP/ARCHITECTURE/SYSTEM/RULES ficaram
  // 8 minors atrás. Interrompe ANTES do publish, porque desfazer um publish é
  // outra ordem de problema. A saída é declarada, não silenciosa.
  const warning = docVersionWarning(rootDir, newVersion.replace(/^v/, ''));
  if (warning && !process.env.IZANAGI_ALLOW_DOC_DRIFT) {
    console.error(`\n\x1b[31m[Release interrompido]\x1b[0m\n${warning}`);
    console.error('\nA versão do package.json já foi incrementada: revise os documentos e rode `npm publish --access public`,');
    console.error('ou repita com IZANAGI_ALLOW_DOC_DRIFT=1 para publicar com a drift registrada.');
    process.exit(1);
  }

  // 3. Publicar no npm
  console.log(`\n☁️ 3/3 Publicando ${newVersion} no npm...`);
  execSync('npm publish --access public', { cwd: rootDir, stdio: 'inherit' });

  console.log(`\n\x1b[32m✔ Versão ${newVersion} publicada com sucesso no npm!\x1b[0m\n`);
} catch (err: any) {
  console.error('\n\x1b[31m[Erro durante o release]:\x1b[0m', err?.message || err);
  process.exit(1);
}
