import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

try {
  console.log('\n\x1b[36m=== 🛠️ Limpando e Reconstruindo Build ===\x1b[0m\n');

  const distDir = path.join(rootDir, 'dist');
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
    console.log('🧹 Pasta dist/ removida.');
  }

  console.log('📦 Compilando TypeScript com tsc...');
  execSync('npx tsc', { cwd: rootDir, stdio: 'inherit' });

  console.log('\n\x1b[32m✔ Build limpo e concluído em dist/!\x1b[0m\n');
} catch (err: any) {
  console.error('\n\x1b[31m[Erro no build]:\x1b[0m', err?.message || err);
  process.exit(1);
}
