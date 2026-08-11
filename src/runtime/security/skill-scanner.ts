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
    regex: /\brm\s+(-rf\s+)?\/\s*;|\bmkfs\.|\bdd\s+if=.*of=\/dev/i,
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
];

const SUSPICIOUS_SCRIPTS = /(powershell|pwsh|cmd\.exe|bash\s+-c|sh\s+-c)\s+[^\n]{20,}/i;

export class SkillScanner {
  /**
   * Escaneia o conteúdo de uma skill (SKILL.md) e retorna resultado.
   * `allowlist` são regras ignoradas (ex.: skills internas curadas).
   */
  scan(skillName: string, content: string, opts: { path?: string; allowlist?: string[] } = {}): SkillScanResult {
    const findings: ScanFinding[] = [];

    for (const rule of RULES) {
      if (opts.allowlist?.includes(rule.id)) continue;
      const m = rule.regex.exec(content);
      if (m) {
        const line = content.slice(0, m.index).split(/\r?\n/).length;
        findings.push({ severity: rule.severity, rule: rule.id, message: rule.message, line, match: m[0].slice(0, 80) });
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
    if (permissions.includes('*') || permissions.some((p) => p.startsWith('fs:') && p.includes('delete'))) {
      findings.push({
        severity: 'MEDIUM',
        rule: 'PER-001',
        message: 'permissões excessivas declaradas (fs:* / delete / wildcard)',
      });
    }

    return {
      skill: skillName,
      path: opts.path ?? '',
      score: scoreFrom(findings),
      level: levelFrom(findings),
      findings,
      scannedAt: new Date().toISOString(),
    };
  }

  /** Escaneia uma skill no disco. */
  scanFile(skillName: string, file: string, allowlist?: string[]): SkillScanResult {
    const content = fs.readFileSync(file, 'utf-8');
    return this.scan(skillName, content, { path: file, allowlist });
  }

  /** Escaneia todas as skills resolvíveis do diretório base. */
  scanDirectory(baseDir: string, allowlist?: string[]): SkillScanResult[] {
    const dirs = [
      path.join(baseDir, 'skills'),
      path.join(baseDir, '.agents', 'skills'),
    ];
    const results: SkillScanResult[] = [];
    const seen = new Set<string>();
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory() || seen.has(entry.name)) continue;
        seen.add(entry.name);
        const skillFile = path.join(dir, entry.name, 'SKILL.md');
        if (fs.existsSync(skillFile)) {
          results.push(this.scanFile(entry.name, skillFile, allowlist));
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
  return findings.length > 0 ? 'LOW' : 'LOW';
}
