import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

try {
  console.log('\n\x1b[36m=== 🧪 Testando Instalação em Projeto Fictício ===\x1b[0m\n');

  // 1. Garantir que o build está pronto
  execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

  // 2. Criar diretório sandbox de teste
  const sandboxDir = path.join(rootDir, 'tmp-sandbox-test');
  if (fs.existsSync(sandboxDir)) {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  }
  fs.mkdirSync(sandboxDir, { recursive: true });

  // 3. Executar instalador simulando projeto de usuário
  const installerPath = path.join(rootDir, 'dist', 'installer.js');
  const installerUrl = pathToFileURL(installerPath).href;
  const code = `import('${installerUrl}').then(m => m.installToProject('${sandboxDir.replace(/\\/g, '/')}'))`;
  
  execSync(`node -e "${code}"`, { cwd: rootDir, stdio: 'inherit' });

  // 4. Verificar se a pasta .agents foi gerada com sucesso
  const agentsFolder = path.join(sandboxDir, '.agents');
  if (fs.existsSync(agentsFolder)) {
    const items = fs.readdirSync(agentsFolder);
    console.log(`\n\x1b[32m✔ Sucesso! A pasta .agents foi criada no projeto simulado com ${items.length} itens.\x1b[0m`);
  } else {
    throw new Error('A pasta .agents não foi criada.');
  }

  // 5. Limpeza do sandbox
  try {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
    console.log('🧹 Diretório sandbox de teste limpo com sucesso.\n');
  } catch {
    console.log('⚠️  Não foi possível limpar o sandbox (pode ignorar).\n');
  }
} catch (err: any) {
  console.error('\n\x1b[31m[Erro na verificação do build]:\x1b[0m', err?.message || err);
  process.exit(1);
}
