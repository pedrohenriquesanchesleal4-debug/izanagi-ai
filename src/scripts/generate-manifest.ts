import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Gera o catálogo `.manifest` do framework a partir do estado real do repositório:
 * - versão vinda do package.json (nunca mais desatualizada)
 * - agentes lidos de agents/*.json (id, nome, role, skills, chains)
 * - skills resolvidas via core/skill-resolver.json com paths VALIDADOS
 *   (existe no disco: arquivo direto, .md ou SKILL.md)
 *
 * Uso: node dist/scripts/generate-manifest.js (roda no build/prepublishOnly)
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

function readJson(rel: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(rootDir, rel), 'utf-8'));
}

/** Extrai o nome legível de uma skill a partir do frontmatter/heading do arquivo. */
function extractSkillName(filePath: string, fallback: string): string {
  try {
    const head = fs.readFileSync(filePath, 'utf-8').slice(0, 400);
    const m = head.match(/^#\s+([^\n]+)/m) || head.match(/^name:\s*["']?([^"'\n]+)/m);
    if (m) return m[1].replace(/^Skill:\s*/i, '').replace(/^Architecture:\s*/i, '').trim();
  } catch {
    /* ignora */
  }
  return fallback
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Resolve o path real de um target do resolver (com fallbacks), retornando null se não existir. */
function resolveTarget(rel: string): string | null {
  const candidates = [rel, rel + '.md', path.join(rel, 'SKILL.md')];
  for (const c of candidates) {
    const full = path.join(rootDir, c);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) return c.replace(/\\/g, '/');
  }
  return null;
}

function main(): void {
  const pkg = readJson('package.json') as Record<string, string>;
  const resolver = readJson('core/skill-resolver.json') as { aliases: Record<string, string> };
  const aliases = resolver.aliases || {};

  // ---- Agents ----
  const agentsDir = path.join(rootDir, 'agents');
  const agents: Record<string, unknown>[] = [];
  if (fs.existsSync(agentsDir)) {
    for (const file of fs.readdirSync(agentsDir).filter((f) => f.endsWith('.json')).sort()) {
      try {
        const agent = JSON.parse(fs.readFileSync(path.join(agentsDir, file), 'utf-8'));
        agents.push({
          id: file.replace(/-agent\.json$/i, ''),
          name: agent.name || file,
          version: agent.version || '1.0.0',
          file: `agents/${file}`,
          role: agent.role || '',
          skills: agent.skills || [],
          chains: Object.keys(agent.chains || {}),
        });
      } catch {
        /* pula agentes quebrados */
      }
    }
  }

  // ---- Skills (agrupadas por categoria) ----
  const categoryLabels: Record<string, string> = {
    core: 'Core',
    architecture: 'Architecture',
    coding: 'Coding',
    database: 'Database',
    devops: 'DevOps',
    memory: 'Memory',
    optimization: 'Optimization',
    security: 'Security',
    skills: 'Skill Library',
    teaching: 'Teaching',
    testing: 'Testing',
  };

  const byCategory = new Map<string, Record<string, unknown>[]>();
  const seen = new Set<string>();

  for (const [alias, target] of Object.entries(aliases).sort()) {
    const resolved = resolveTarget(target);
    if (!resolved) continue; // só inclui o que existe (0 paths quebrados)

    // Dedup pelo path RESOLVIDO, não pela string bruta do alias-target: o
    // resolver tem variantes como `skills/foo` e `skills/foo/SKILL` que
    // resolvem para o mesmíssimo `skills/foo/SKILL.md` — deduplicar pelo
    // target cru deixava as duas passarem e contava a mesma skill 2x
    // (foi assim que "212 skills" nunca bateu com a contagem real do
    // diretório `skills/`).
    if (seen.has(resolved)) continue;
    seen.add(resolved);

    const category = target.split('/')[0];
    const label = categoryLabels[category] || category;
    const baseName = target.split('/').pop() || alias;
    const displayName = extractSkillName(path.join(rootDir, resolved), baseName);

    if (!byCategory.has(label)) byCategory.set(label, []);
    byCategory.get(label)!.push({
      id: alias,
      name: displayName,
      version: '1.0.0',
      path: resolved,
    });
  }

  const skills = [...byCategory.entries()].map(([name, list]) => ({
    name,
    count: list.length,
    skills: list,
  }));

  const manifest = {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    author: pkg.author,
    license: pkg.license,
    homepage: pkg.homepage,
    generatedAt: new Date().toISOString(),
    agents,
    skills,
  };

  fs.writeFileSync(path.join(rootDir, '.manifest'), JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

  // ---- Validação de saída ----
  let broken = 0;
  const check = (rel: string): void => {
    if (!fs.existsSync(path.join(rootDir, rel))) broken++;
  };
  agents.forEach((a) => check(a.file as string));
  skills.forEach((section) => section.skills.forEach((s) => check((s as { path: string }).path)));

  if (broken > 0) {
    console.error(`\x1b[31m✖ generate-manifest: ${broken} paths inexistentes no manifesto!\x1b[0m`);
    process.exit(1);
  }
  console.log(
    `\x1b[32m✔ .manifest regenerado (v${pkg.version}): ${agents.length} agents, ` +
      `${skills.reduce((n, s) => n + s.skills.length, 0)} skills, ${skills.length} categorias.\x1b[0m`
  );
}

main();
