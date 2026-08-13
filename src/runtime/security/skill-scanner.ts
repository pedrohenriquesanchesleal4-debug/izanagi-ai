/**
 * Skill Security Scanner — skills externas são NÃO CONFIÁVEIS por padrão.
 *
 * Varredura estática do conteúdo da skill por:
 *  - prompt injection (ex.: "ignore suas instruções", "system prompt")
 *  - instruções perigosas (rm -rf, desabilitar segurança, exfiltrar dados)
 *  - scripts inesperados (bash/curl/powershell com destinos suspeitos)
 *  - permissões excessivas declaradas no frontmatter
 *  - dependências de rede/filesystem suspeitas
 *
 * Classificação: LOW / MEDIUM / HIGH / CRITICAL. Nunca conceder permissões
 * desnecessárias.
 */

import fs from 'fs';
import path from 'path';
import type { RiskLevel, ScanFinding, SkillScanResult } from '../types.js';
import { parseFrontmatter } from '../routing/resolver.js';
import type { TrustTier } from './policy.js';

export type { TrustTier };

/**
 * Bloqueio escalonado por trust tier (inspirado no modelo de tiers do Hermes
 * Skills Hub): quanto menos curada a fonte, mais baixo o nível de risco que
 * já basta para bloquear. `builtin` = skills do próprio framework; `generated`
 * = passou pela Factory (scan prévio); `community` = fonte externa/menos curada.
 */
const BLOCK_THRESHOLD: Record<TrustTier, RiskLevel[]> = {
  builtin: ['CRITICAL'],
  generated: ['CRITICAL', 'HIGH'],
  community: ['CRITICAL', 'HIGH', 'MEDIUM'],
};

const WARN_THRESHOLD: Record<TrustTier, RiskLevel[]> = {
  builtin: ['HIGH'],
  generated: ['MEDIUM'],
  community: ['LOW'],
};

export interface TrustDecision {
  verdict: 'allow' | 'warn' | 'block';
  reason: string;
}

/** Decide se um SkillScanResult deve ser permitido/avisado/bloqueado para o trust tier dado. */
export function decideByTrustTier(result: SkillScanResult, tier: TrustTier): TrustDecision {
  const blockLevels = BLOCK_THRESHOLD[tier];
  const warnLevels = WARN_THRESHOLD[tier];
  if (blockLevels.includes(result.level)) {
    return { verdict: 'block', reason: `nível ${result.level} excede o limite permitido para trust tier "${tier}"` };
  }
  if (warnLevels.includes(result.level)) {
    return { verdict: 'warn', reason: `nível ${result.level} é aceito para "${tier}" mas merece revisão manual` };
  }
  return { verdict: 'allow', reason: `nível ${result.level} dentro do aceitável para trust tier "${tier}"` };
}

export interface ScannerRule {
  id: string;
  severity: RiskLevel;
  regex: RegExp;
  message: string;
}

const RULES: ScannerRule[] = [
  {
    id: 'INJ-001',
    severity: 'CRITICAL',
    regex: /ignore (all )?(previous|prior) (instructions|prompts|system)/i,
    message: 'Prompt injection: instrução para ignorar instruções anteriores',
  },
  {
    id: 'INJ-002',
    severity: 'CRITICAL',
    regex: /reveal your (system prompt|instructions)/i,
    message: 'Prompt injection: tentativa de extrair o system prompt',
  },
  {
    id: 'INJ-003',
    severity: 'HIGH',
    regex: /pretend (you|to be)|act as if you (were|are) (a |an )?(computer|terminal|admin)/i,
    message: 'Instrução de persona suspeita (jailbreak)',
  },
  {
    id: 'DNG-001',
    severity: 'CRITICAL',
    regex: /\brm\s+(-rf\s+)?\//i,
    message: 'Comando destrutivo de filesystem',
  },
  {
    id: 'DNG-002',
    severity: 'HIGH',
    regex: /\bcurl\s+.*\|?\s*(sh|bash|pwsh|powershell)\b/i,
    message: 'Execução remota: pipe de curl para shell',
  },
  {
    id: 'DNG-003',
    severity: 'HIGH',
    regex: /chmod\s+(-R\s+)?777|disable (firewall|antivirus|security)/i,
    message: 'Instrução para desabilitar segurança ou permissões excessivas',
  },
  {
    id: 'DNG-004',
    severity: 'HIGH',
    regex: /exfiltrat|send (all|the) (data|credentials|secrets|keys) to|upload .*(credentials|\.env|secrets)/i,
    message: 'Tentativa de exfiltração de dados sensíveis',
  },
  {
    id: 'NET-001',
    severity: 'MEDIUM',
    regex: /(raw\.githubusercontent|pastebin|http:\/\/)/i,
    message: 'Download de conteúdo de fonte não-oficial',
  },
  {
    id: 'SEC-001',
    severity: 'HIGH',
    regex: /(api[_-]?key|password|secret).*(hardcode|in the (code|source|file))/i,
    message: 'Instrução para hardcodar segredos',
  },
  {
    id: 'NET-002',
    severity: 'LOW',
    regex: /https?:\/\/[^\s)\]}>]+/i,
    message: 'Referência a URL externa — verificar confiabilidade da fonte',
  },
];

const SUSPICIOUS_SCRIPTS = /(powershell|pwsh|cmd\.exe|bash\s+-c|sh\s+-c)\s+[^\n]{20,}/i;

/** Contexto defensivo: o trecho ENSINA a evitar/detectar o padrão perigoso. */
const DEFENSIVE_CONTEXT =
  /\b(n[aã]o|nunca|jamais|evite|evitar|proibido|don'?t|avoid|never|instead|use\s+\.env|fora do c[oó]digo|secret manager|gestor de segredos|auditar|audit|verificar|verifique|detectar|identificar|garantir|buscar|procurar|prote[cç][aã]o|adversarial|t[ée]st[ei] adversarial|mitiga[cç][aã]o)\b/i;

/** Janela de contexto (linhas antes/depois do match) para mitigação. */
const CONTEXT_WINDOW = 2;

export class SkillScanner {
  /**
   * Escaneia o conteúdo de uma skill (SKILL.md) e retorna resultado.
   * `allowlist` são regras ignoradas (ex.: skills internas curadas).
   *
   * Match em contexto de negação (skill ENSINANDO a evitar o padrão, ex.
   * "nunca hardcode senhas") é tratado como informação, não instrução.
   */
  scan(skillName: string, content: string, opts: { path?: string; allowlist?: string[]; trustTier?: TrustTier } = {}): SkillScanResult {
    const findings: ScanFinding[] = [];
    const lines = content.split(/\r?\n/);

    for (const rule of RULES) {
      if (opts.allowlist?.includes(rule.id)) continue;
      const m = rule.regex.exec(content);
      if (m) {
        const lineIdx = content.slice(0, m.index).split(/\r?\n/).length;
        const window = lines.slice(Math.max(0, lineIdx - 1 - CONTEXT_WINDOW), lineIdx + CONTEXT_WINDOW).join('\n');
        if (DEFENSIVE_CONTEXT.test(window)) continue;
        findings.push({ severity: rule.severity, rule: rule.id, message: rule.message, line: lineIdx, match: m[0].slice(0, 80) });
      }
    }

    // Scripts inesperados fora de bloco de código são mais perigosos
    const fm = parseFrontmatter(content);
    const scripts = Array.isArray(fm.scripts) ? (fm.scripts as string[]) : [];
    if (scripts.length > 0) {
      findings.push({
        severity: 'MEDIUM',
        rule: 'SCR-001',
        message: `skill declara ${scripts.length} script(s) executável(is) no frontmatter`,
      });
    }
    if (SUSPICIOUS_SCRIPTS.test(content)) {
      findings.push({ severity: 'MEDIUM', rule: 'SCR-002', message: 'comando de shell suspeito fora de contexto de exemplo' });
    }

    // Permissões declaradas: excesso → warning
    const permissions = Array.isArray(fm.permissions) ? (fm.permissions as string[]) : [];
    if (permissions.some((p) => p.includes('*')) || permissions.some((p) => p.startsWith('fs:') && p.includes('delete'))) {
      findings.push({
        severity: 'MEDIUM',
        rule: 'PER-001',
        message: 'permissões excessivas declaradas (fs:* / delete / wildcard)',
      });
    }

    const level = levelFrom(findings);
    const tier = opts.trustTier;
    const result: SkillScanResult = {
      skill: skillName,
      path: opts.path ?? '',
      score: scoreFrom(findings),
      level,
      findings,
      scannedAt: new Date().toISOString(),
    };
    if (tier) {
      result.trustTier = tier;
      result.verdict = decideByTrustTier(result, tier).verdict;
    }
    return result;
  }

  /** Escaneia uma skill no disco. */
  scanFile(skillName: string, file: string, allowlist?: string[], trustTier?: TrustTier): SkillScanResult {
    const content = fs.readFileSync(file, 'utf-8');
    return this.scan(skillName, content, { path: file, allowlist, trustTier });
  }

  /**
   * Escaneia todas as skills resolvíveis do diretório base. Trust tier é
   * inferido pela origem: `skills/generated/` → generated, `skills/` (curada
   * pelo framework) → builtin, `.agents/skills/` (skills locais do projeto
   * consumidor, potencialmente de terceiros) → community.
   */
  scanDirectory(baseDir: string, allowlist?: string[]): SkillScanResult[] {
    const dirs: Array<{ dir: string; tier: TrustTier }> = [
      { dir: path.join(baseDir, 'skills', 'generated'), tier: 'generated' },
      { dir: path.join(baseDir, 'skills'), tier: 'builtin' },
      { dir: path.join(baseDir, '.agents', 'skills'), tier: 'community' },
    ];
    const results: SkillScanResult[] = [];
    const seen = new Set<string>();
    for (const { dir, tier } of dirs) {
      if (!fs.existsSync(dir)) continue;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory() || seen.has(entry.name)) continue;
        seen.add(entry.name);
        const skillFile = path.join(dir, entry.name, 'SKILL.md');
        if (fs.existsSync(skillFile)) {
          results.push(this.scanFile(entry.name, skillFile, allowlist, tier));
        }
      }
    }
    return results;
  }
}

function scoreFrom(findings: ScanFinding[]): number {
  const severityRank: Record<RiskLevel, number> = { CRITICAL: 100, HIGH: 60, MEDIUM: 30, LOW: 5 };
  const raw = findings.reduce((acc, f) => acc + severityRank[f.severity], 0);
  return Math.min(100, raw);
}

function levelFrom(findings: ScanFinding[]): RiskLevel {
  if (findings.some((f) => f.severity === 'CRITICAL')) return 'CRITICAL';
  if (findings.some((f) => f.severity === 'HIGH')) return 'HIGH';
  if (findings.some((f) => f.severity === 'MEDIUM')) return 'MEDIUM';
  return 'LOW';
}