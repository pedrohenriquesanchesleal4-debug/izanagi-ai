import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Pastas e arquivos que devem ser copiados para a pasta .agents do usuário
 */
const ITEMS_TO_COPY = [
  'agents',
  'architecture',
  'backend',
  'core',
  'database',
  'devops',
  'frontend',
  'memory',
  'optimization',
  'security',
  'skills',
  'teaching',
  'testing',
  'SYSTEM.md',
  'RULES.md',
  'AGENTS.md',
  'CHANGELOG.md',
  'ROADMAP.md'
];

/**
 * Copia recursivamente um diretório ou arquivo de origem para destino
 */
function copyRecursiveSync(src: string, dest: string): void {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats ? stats.isDirectory() : false;

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else if (exists) {
    const parentDir = path.dirname(dest);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
  }
}

/**
 * Instala todos os recursos do NexusAI na pasta .agents do projeto do usuário
 */
export function installToProject(targetDir?: string): void {
  const destinationRoot = path.resolve(targetDir || process.env.INIT_CWD || process.cwd());
  
  // Evitar auto-cópia se a pós-instalação rodar no próprio repositório do NexusAI durante desenvolvimento local
  const packageJsonPath = path.join(destinationRoot, 'package.json');
  if (fs.existsSync(packageJsonPath) && !targetDir) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      if (pkg.name === 'nexusai' || pkg.name === 'pedrohsl1-nexusai') {
        console.log('[NexusAI] Pós-instalação ignorada no próprio repositório NexusAI.');
        return;
      }
    } catch {
      // Ignorar erros de leitura de package.json
    }
  }

  // Onde os arquivos do pacote estão localizados (raiz do pacote NexusAI no node_modules)
  const packageDir = path.resolve(__dirname, '..');
  const targetAgentsFolder = path.join(destinationRoot, '.agents');

  console.log(`\n\x1b[36m[NexusAI]\x1b[0m Instalando recursos do NexusAI em: \x1b[1m${targetAgentsFolder}\x1b[0m...`);

  let copiedCount = 0;

  for (const item of ITEMS_TO_COPY) {
    const srcPath = path.join(packageDir, item);
    const destPath = path.join(targetAgentsFolder, item);

    if (fs.existsSync(srcPath)) {
      copyRecursiveSync(srcPath, destPath);
      copiedCount++;
    }
  }

  console.log(`\x1b[32m[NexusAI] Sucesso! ${copiedCount} pastas/arquivos copiados para .agents.\x1b[0m\n`);
}
