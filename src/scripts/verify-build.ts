import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

/** Preenchido dentro do try; o catch precisa dele para limpar. */
let sandbox: string | undefined;

try {
  console.log('\n\x1b[36m=== 🧪 Testando Instalação em Projeto Fictício ===\x1b[0m\n');

  // 1. Garantir que o build está pronto
  execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

  // 2. Criar diretório sandbox de teste FORA da árvore do repositório.
  //
  // Antes ficava em `<repo>/tmp-sandbox-test`, e a limpeza era a última linha
  // do try: qualquer erro antes dela (ou um `rmSync` que falhasse no Windows
  // com arquivo em uso) deixava ~700 arquivos não rastreados na raiz do
  // projeto, que apareciam como "800 arquivos alterados" no `git status`
  // seguinte. Verificação de build não escreve na árvore que ela verifica.
  const sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-verify-'));
  sandbox = sandboxDir;

  // 3. Executar instalador simulando projeto de usuário (instala todos os packs)
  const installerPath = path.join(rootDir, 'dist', 'installer.js');
  const installerUrl = pathToFileURL(installerPath).href;
  const packIds = `['core','agents','skills','architecture','coding','database','devops','security','testing','memory','optimization','teaching']`;
  const code = `import('${installerUrl}').then(m => m.installToProject('${sandboxDir.replace(/\\/g, '/')}', ${packIds}))`;
  
  execSync(`node -e "${code}"`, { cwd: rootDir, stdio: 'inherit' });

  // 4. Verificar se a pasta .agents foi gerada com sucesso
  const agentsFolder = path.join(sandboxDir, '.agents');
  if (fs.existsSync(agentsFolder)) {
    const items = fs.readdirSync(agentsFolder);
    console.log(`\n\x1b[32m✔ Sucesso! A pasta .agents foi criada no projeto simulado com ${items.length} itens.\x1b[0m`);
  } else {
    throw new Error('A pasta .agents não foi criada.');
  }

  cleanupSandbox(sandboxDir);
} catch (err: any) {
  // A limpeza roda nos DOIS caminhos: estava só no de sucesso, e por isso um
  // erro de verificação deixava o sandbox para trás justamente quando alguém
  // ia investigar o repositório.
  cleanupSandbox(sandbox);
  console.error('\n\x1b[31m[Erro na verificação do build]:\x1b[0m', err?.message || err);
  process.exit(1);
}

function cleanupSandbox(dir: string | undefined): void {
  if (!dir) return;
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log('🧹 Diretório sandbox de teste limpo com sucesso.\n');
  } catch {
    console.log(`⚠️  Não foi possível limpar o sandbox (${dir}).\n`);
  }
}
