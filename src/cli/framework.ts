import fs from 'fs';
import path from 'path';
import { resolveFrameworkRoot } from '../installer.js';

/**
 * Resolve o framework root para comandos: prioriza `.agents/` do projeto atual
 * (instalação local inicializada via `izanagi init`), senão usa o pacote instalado.
 */
export function getProjectRoot(cwd: string, packageBaseDir: string): string {
  return resolveFrameworkRoot(cwd);
}

const CORE_PROFILE_CANONICAL_AGENT: Record<string, string> = {
  commander: 'orchestrator',
  builder: 'senior-engineer',
  'frontend-designer': 'form-engineer',
  researcher: 'researcher',
  reviewer: 'qa',
  'security-reviewer': 'security',
  'educator-docs': 'docs',
};

/**
 * Localiza o arquivo JSON de um agente.
 * Procura em: `.agents/agents` do projeto, `agents/` do cwd e pacote instalado.
 * Também aceita IDs dos 7 perfis centrais consolidados.
 */
export function findAgentFile(cwd: string, packageBaseDir: string, agentIdentifier: string): string | null {
  if (!agentIdentifier || /[\\/]|\.\./.test(agentIdentifier)) return null;
  const resolvedId = CORE_PROFILE_CANONICAL_AGENT[agentIdentifier] ?? agentIdentifier;
  const candidates = [
    path.join(cwd, '.agents', 'agents'),
    path.join(cwd, 'agents'),
    path.join(packageBaseDir, 'agents')
  ];

  const names = [`${resolvedId}-agent.json`, `${resolvedId}.json`];

  for (const dir of candidates) {
    for (const name of names) {
      const file = path.join(dir, name);
      if (fs.existsSync(file)) return file;
    }
  }

  // Tenta match flexível: ex. "architect-agent" → "architect-agent.json"
  for (const dir of candidates) {
    if (!fs.existsSync(dir)) continue;
    const match = fs.readdirSync(dir).find(
      (f: string) => f.toLowerCase().replace(/\.json$/i, '') === resolvedId.toLowerCase()
    );
    if (match) return path.join(dir, match);
  }

  return null;
}

export interface SkillAlias {
  [alias: string]: string;
}

/**
 * Lê os aliases do skill-resolver (core/skill-resolver.json).
 */
export function loadSkillResolver(cwd: string, packageBaseDir: string): SkillAlias {
  const candidates = [
    path.join(cwd, '.agents', 'core', 'skill-resolver.json'),
    path.join(cwd, 'core', 'skill-resolver.json'),
    path.join(packageBaseDir, 'core', 'skill-resolver.json')
  ];

  for (const file of candidates) {
    if (fs.existsSync(file)) {
      try {
        const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
        return data.aliases || {};
      } catch {
        // segue para o próximo candidato
      }
    }
  }
  return {};
}

/**
 * Resolve o caminho real de uma skill a partir do alias registrado no resolver
 * ou por descoberta direta em `.skills/<name>/SKILL.md`, `skills/<name>/SKILL.md`
 * e `.agents/skills/<name>/SKILL.md`. Protege contra path traversal.
 */
export function resolveSkillPath(cwd: string, packageBaseDir: string, alias: string): string | null {
  if (!alias || typeof alias !== 'string') return null;
  // Proteção contra path traversal ou caminhos absolutos maliciosos
  if (alias.includes('..') || path.isAbsolute(alias) || /[:\\]/.test(alias)) {
    return null;
  }

  const aliases = loadSkillResolver(cwd, packageBaseDir);
  const rel = aliases[alias];

  const roots = [
    path.join(cwd, '.agents'),
    path.join(cwd),
    packageBaseDir
  ];

  if (rel && !rel.includes('..')) {
    for (const root of roots) {
      const candidate = path.join(root, rel);
      // 1) arquivo direto
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
      // 2) arquivo .md explícito
      if (fs.existsSync(candidate + '.md') && fs.statSync(candidate + '.md').isFile()) return candidate + '.md';
      // 3) diretório de skill com SKILL.md dentro (padrão .agents/skills/<name>/SKILL.md)
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        const skillFile = path.join(candidate, 'SKILL.md');
        if (fs.existsSync(skillFile)) return skillFile;
      }
    }
  }

  // Fallback de auto-descoberta direta (catálogo v2 `.skills/`, legado `skills/`, geradas e `.agents/skills/`)
  const cleanName = alias.replace(/\/SKILL(\.md)?$/i, '');
  if (cleanName.includes('/')) return null;

  for (const root of [cwd, packageBaseDir]) {
    const directCandidates = [
      path.join(root, '.skills', cleanName, 'SKILL.md'),
      path.join(root, 'skills', cleanName, 'SKILL.md'),
      path.join(root, 'skills', 'generated', cleanName, 'SKILL.md'),
      path.join(root, '.agents', 'skills', cleanName, 'SKILL.md'),
    ];
    for (const file of directCandidates) {
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        return file;
      }
    }
  }

  return null;
}

/**
 * Lê a configuração local do projeto (.izanagi/izanagi.config.json).
 */
export function loadProjectConfig(cwd: string): Record<string, unknown> | null {
  const file = path.join(cwd, '.izanagi', 'izanagi.config.json');
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}
