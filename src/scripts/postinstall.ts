import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPackageDir, installToProject, PACKS } from '../installer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Auto-ativa o framework no projeto do usuário assim que `izanagi-ai` é instalado
 * como dependência: ele exige rodar `izanagi init` manualmente antes de qualquer
 * CLI de IA descobrir os agentes/skills, e ninguém faz isso por padrão (esse era
 * exatamente o motivo de projetos ficarem com `node_modules/izanagi-ai` instalado
 * mas zero `.claude/`/`AGENTS.md` na raiz: nada delegava agente/skill nenhum).
 *
 * Guarda-corpo: só roda quando `izanagi-ai` está de fato dentro do `node_modules`
 * de outro projeto (instalação real como dependência). Dentro do próprio checkout
 * do framework (`npm install` do repo para desenvolvê-lo), `getPackageDir()` não
 * está debaixo de uma pasta `node_modules` — pula silenciosamente.
 *
 * Nunca falha o `npm install` do consumidor: qualquer erro aqui é engolido.
 */
function main(): void {
  try {
    const packageDir = getPackageDir();
    const isRealDependencyInstall = path.basename(path.dirname(packageDir)) === 'node_modules';
    if (!isRealDependencyInstall) return;

    // INIT_CWD é setado pelo npm para o diretório de onde `npm install` foi
    // chamado (o projeto do consumidor) — process.cwd() aqui já é a pasta do
    // pacote dentro de node_modules, não o projeto.
    const targetDir = process.env.INIT_CWD || process.cwd();
    if (path.resolve(targetDir) === path.resolve(packageDir)) return;

    const alreadyInitialized = fs.existsSync(path.join(targetDir, '.agents', 'core'));
    if (alreadyInitialized) return;

    // `all` (não auto-detecção por env var): postinstall roda dentro do processo
    // do npm, não de uma CLI de IA — não há CLAUDECODE/CURSOR_TRACE_ID para ler
    // aqui. Gerar todos os 6 adapters custa pouco (arquivos estáticos) e garante
    // que qualquer CLI que o usuário abrir depois já encontre o framework ativo,
    // sem precisar rodar `izanagi init`/`izanagi export` manualmente.
    installToProject(targetDir, PACKS.map((p) => p.id), 'all');
    console.log('\x1b[36m[Izanagi AI]\x1b[0m Framework ativado automaticamente neste projeto (todas as CLIs). Rode `izanagi doctor` para validar.');
  } catch {
    // Silencioso de propósito: postinstall nunca pode quebrar `npm install`.
  }
}

main();
