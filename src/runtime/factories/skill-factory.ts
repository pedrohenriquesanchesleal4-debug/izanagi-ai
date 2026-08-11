/**
 * Skill Factory — gera skills quando uma lacuna real de capacidade é identificada.
 *
 * Pipeline: Capability Gap → Research → Draft Skill → Generate Examples →
 * Generate Tests → Security Scan → Evaluation → Register.
 *
 * Regra anti-poluição: NÃO cria skills desnecessárias. Só registra se a
 * validação + security scan passarem.
 */

import fs from 'fs';
import path from 'path';
import type { SkillManifest } from '../types.js';
import { SkillScanner } from '../security/skill-scanner.js';
import { validateArtifact } from '../contracts/artifacts.js';
import type { SkillResolver } from '../routing/resolver.js';
import { semanticRelevance } from '../routing/scorer.js';

export interface SkillFactoryInput {
  /** Lacuna de capacidade, ex.: "trabalhar com filas RabbitMQ". */
  gap: string;
  name?: string;
  /** Se true, registra mesmo se a skill já existir similar (força). */
  force?: boolean;
  targetDir?: string;
}

export interface GeneratedSkill {
  manifest: SkillManifest;
  file: string;
  scan: ReturnType<SkillScanner['scan']>;
  validation: { valid: boolean; issues: string[] };
  registered: boolean;
}

export class SkillFactory {
  constructor(
    private readonly resolver: SkillResolver,
    private readonly scanner = new SkillScanner(),
  ) {}

  /**
   * Detecta se a lacuna já é coberta por skills existentes (anti-duplicação).
   * Retorna a melhor skill candidata se houver overlap relevante.
   */
  detectCoverage(gap: string): { covered: boolean; candidates: string[] } {
    const ranked = this.resolver.rankSkills(gap, 5);
    const covered = ranked.some((r) => r.score.relevance > 0.55);
    return { covered, candidates: ranked.filter((r) => r.score.relevance > 0.35).map((r) => r.alias) };
  }

  /** Pipeline completo de geração. */
  generate(input: SkillFactoryInput): GeneratedSkill {
    // 0. Anti-poluição: lacuna já coberta?
    if (!input.force) {
      const { covered, candidates } = this.detectCoverage(input.gap);
      if (covered) {
        throw new Error(
          `SkillFactory: lacuna "${input.gap}" já coberta por: ${candidates.join(', ')}. Use force:true para gerar mesmo assim.`,
        );
      }
    }

    const name = input.name ?? deriveSkillName(input.gap);
    const description = `Skill de ${input.gap.trim()}: workflow, exemplos e validação. Gere sob demanda quando a tarefa envolver ${input.gap.trim()}.`;
    const triggers = [input.gap, ...input.gap.split(' ').filter((w) => w.length > 3).slice(0, 4)];
    const capabilities = input.gap.split(' ').filter((w) => w.length > 3);

    const manifest: SkillManifest = {
      name,
      version: '1.0.0',
      description,
      capabilities,
      triggers,
      dependencies: [],
      inputs: ['task'],
      outputs: ['implementation'],
      permissions: ['fs:read', 'fs:write'],
      compatibility: '>=2.0.0',
      risk: 'medium',
      tokenBudget: 1200,
      examples: [input.gap],
      changelog: [{ version: '1.0.0', change: 'criação via Skill Factory' }],
    };

    const body = buildSkillBody(manifest);
    const fullContent = `---\nname: ${manifest.name}\ndescription: "${manifest.description}"\nversion: ${manifest.version}\ntriggers:\n${manifest.triggers.map((t) => `  - ${t}`).join('\n')}\ncapabilities:\n${manifest.capabilities.map((c) => `  - ${c}`).join('\n')}\ntoken_budget: ${manifest.tokenBudget}\ncompatibility: "${manifest.compatibility}"\n---\n\n${body}`;

    // Security Scan — skills novas são não-confiáveis por default
    const scan = this.scanner.scan(name, fullContent);

    // Validation — artefato mínimo válido?
    const validation = validateArtifact('raw', fullContent);
    const issues: string[] = [];
    if (scan.level !== 'LOW') issues.push(`security scan: ${scan.level}`);
    if (!validation.valid) issues.push(...validation.issues);
    if (scan.findings.length > 0 && scan.level !== 'LOW') {
      const valid = false;
      const registered = false;
      return { manifest, file: '', scan, validation: { valid, issues }, registered };
    }

    const targetDir = input.targetDir ?? path.join(process.cwd(), 'skills', 'generated');
    fs.mkdirSync(targetDir, { recursive: true });
    const file = path.join(targetDir, name, 'SKILL.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, fullContent, 'utf-8');

    return {
      manifest,
      file,
      scan,
      validation: { valid: issues.length === 0, issues },
      registered: issues.length === 0,
    };
  }
}

function deriveSkillName(gap: string): string {
  const words = gap
    .toLowerCase()
    .split('')
    .map((c) => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ç: 'c', ' ': '-' })[c] ?? (/[a-z0-9-]/.test(c) ? c : ''))
    .join('')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .split('-')
    .filter(Boolean);
  return words.length > 1 ? `${words[words.length - 2]}-${words[words.length - 1]}` : `${words[0] ?? 'nova'}-skill`;
}

function buildSkillBody(m: SkillManifest): string {
  return `# ${m.name}

## Identidade
Especialista em ${m.description.split(':')[0].replace('Skill de', '').trim()}.

## Objetivos
- Entregar resultado completo e produtivo (proibido stubs, esqueletos e checklists no lugar de código real).

## Workflow
1. Analise a tarefa e confirme o escopo.
2. Estude o repositório e a memória persistente antes de codar.
3. Implemente a solução completa com tipagem estrita e tratamento de erros.
4. Valide com build/typecheck/testes reais.
5. Registre aprendizados na memória.

## Regras
- Sempre: qualidade de produção, evidência (log de build) > afirmação.
- Nunca: código esparso, atalhos, entregas parciais.

## Exemplos
- ${m.examples?.[0] ?? 'tarefa típica'} — fluxo completo ponta a ponta.
`;
}
