/**
 * Skill Manager — Gerenciamento seguro de ciclo de vida de skills externas.
 *
 * Inspirado nas melhores práticas do Vercel Skills e Hermes Agent:
 *  - Descoberta por fontes locais ou remotas (GitHub, URLs)
 *  - Verificação estática de segurança ANTES de instalar (SkillScanner)
 *  - Registro determinístico em lockfile (.izanagi/skills-lock.json)
 *  - Instalação isolada em .agents/skills/<name> sem misturar código inseguro
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { SkillScanner, decideByTrustTier } from '../security/skill-scanner.js';
import { parseFrontmatter } from '../routing/resolver.js';
import type { SkillScanResult } from '../types.js';

export interface InstalledSkillRecord {
  name: string;
  source: string;
  version: string;
  installedAt: string;
  updatedAt: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  sha256: string;
  destination: string;
  files: string[];
}

export interface SkillsLockfile {
  version: number;
  skills: Record<string, InstalledSkillRecord>;
}

export interface InstallSkillOptions {
  force?: boolean;
  global?: boolean;
  asName?: string;
  baseDir?: string;
}

export class SkillManager {
  private readonly baseDir: string;
  private readonly scanner: SkillScanner;

  constructor(opts?: { baseDir?: string; scanner?: SkillScanner }) {
    this.baseDir = opts?.baseDir ?? process.cwd();
    this.scanner = opts?.scanner ?? new SkillScanner();
  }

  private lockfilePath(global = false): string {
    const root = global ? path.join(os.homedir(), '.agents') : path.join(this.baseDir, '.izanagi');
    return path.join(root, 'skills-lock.json');
  }

  loadLockfile(global = false): SkillsLockfile {
    const file = this.lockfilePath(global);
    if (!fs.existsSync(file)) {
      return { version: 1, skills: {} };
    }
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch {
      return { version: 1, skills: {} };
    }
  }

  saveLockfile(lock: SkillsLockfile, global = false): void {
    const file = this.lockfilePath(global);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(lock, null, 2), 'utf-8');
  }

  /**
   * Resolve o conteúdo de uma skill a partir de fonte local ou remota (GitHub shorthand / HTTP).
   */
  async resolveSource(source: string): Promise<{ skillName: string; files: Record<string, string> }> {
    // 1. Fonte local no filesystem
    const localPath = path.isAbsolute(source) ? source : path.resolve(this.baseDir, source);
    if (fs.existsSync(localPath)) {
      const stats = fs.statSync(localPath);
      const files: Record<string, string> = {};
      let skillName = path.basename(localPath);

      if (stats.isFile()) {
        const content = fs.readFileSync(localPath, 'utf-8');
        files['SKILL.md'] = content;
        skillName = path.basename(path.dirname(localPath));
      } else {
        const skillMdPath = path.join(localPath, 'SKILL.md');
        if (!fs.existsSync(skillMdPath)) {
          throw new Error(`Fonte local ${source} não contém um arquivo SKILL.md`);
        }
        files['SKILL.md'] = fs.readFileSync(skillMdPath, 'utf-8');

        // Lê arquivos adicionais opcionais (references, scripts) se existirem
        const scanDir = (dir: string, relPrefix = '') => {
          for (const item of fs.readdirSync(dir)) {
            const full = path.join(dir, item);
            const rel = relPrefix ? `${relPrefix}/${item}` : item;
            const itemStat = fs.statSync(full);
            if (itemStat.isDirectory()) {
              scanDir(full, rel);
            } else if (itemStat.isFile() && item !== 'SKILL.md') {
              files[rel] = fs.readFileSync(full, 'utf-8');
            }
          }
        };
        scanDir(localPath);
      }

      return { skillName, files };
    }

    // 2. Fonte GitHub shorthand (ex: "owner/repo" ou "owner/repo/skills/name")
    if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+/.test(source)) {
      return await this.fetchFromGithub(source);
    }

    // 3. URL direta de SKILL.md
    if (source.startsWith('http://') || source.startsWith('https://')) {
      const resp = await fetch(source);
      if (!resp.ok) {
        throw new Error(`Falha ao baixar skill de ${source}: HTTP ${resp.status}`);
      }
      const text = await resp.text();
      const parts = source.split('/');
      const skillName = parts[parts.length - 2] || 'custom-skill';
      return { skillName, files: { 'SKILL.md': text } };
    }

    throw new Error(`Fonte de skill não reconhecida ou inexistente: ${source}`);
  }

  private async fetchFromGithub(source: string): Promise<{ skillName: string; files: Record<string, string> }> {
    const parts = source.split('/');
    const owner = parts[0];
    const repo = parts[1];
    const subpath = parts.slice(2).join('/');

    // Tenta caminhos comuns no repositório GitHub
    const candidatePaths = subpath
      ? [
          `https://raw.githubusercontent.com/${owner}/${repo}/main/${subpath}/SKILL.md`,
          `https://raw.githubusercontent.com/${owner}/${repo}/master/${subpath}/SKILL.md`,
          `https://raw.githubusercontent.com/${owner}/${repo}/main/${subpath}`,
        ]
      : [
          `https://raw.githubusercontent.com/${owner}/${repo}/main/SKILL.md`,
          `https://raw.githubusercontent.com/${owner}/${repo}/master/SKILL.md`,
          `https://raw.githubusercontent.com/${owner}/${repo}/main/skills/${repo}/SKILL.md`,
        ];

    let content: string | null = null;
    let successfulUrl: string | null = null;

    for (const url of candidatePaths) {
      try {
        const resp = await fetch(url);
        if (resp.ok) {
          content = await resp.text();
          successfulUrl = url;
          break;
        }
      } catch {
        // Tenta próxima URL candidata
      }
    }

    if (!content) {
      throw new Error(`Não foi possível localizar SKILL.md no repositório GitHub ${source}`);
    }

    const skillName = parts[parts.length - 1] || repo;
    return { skillName, files: { 'SKILL.md': content } };
  }

  /**
   * Instala uma skill após validação de formato e scan de segurança estático.
   */
  async install(source: string, opts: InstallSkillOptions = {}): Promise<{
    name: string;
    destination: string;
    scan: SkillScanResult;
    warning?: string;
  }> {
    const resolved = await this.resolveSource(source);
    const skillContent = resolved.files['SKILL.md'];

    if (!skillContent) {
      throw new Error(`A fonte da skill ${source} não forneceu conteúdo SKILL.md válido.`);
    }

    // 1. Validação de formato (YAML frontmatter obrigatório)
    const fm = parseFrontmatter(skillContent);
    const resolvedName = opts.asName || (fm.name as string) || resolved.skillName;
    const version = (fm.version as string) || '1.0.0';

    if (!fm.name && !opts.asName) {
      fm.name = resolvedName;
    }

    // 2. Scan de Segurança Estático Obrigatório
    const scanResult = this.scanner.scan(resolvedName, skillContent, { trustTier: 'community' });
    const decision = decideByTrustTier(scanResult, 'community');

    if (decision.verdict === 'block' && !opts.force) {
      const issues = scanResult.findings.map((f) => `[${f.severity}] ${f.rule}: ${f.message}`).join('\n  - ');
      throw new Error(
        `[SECURITY BLOCK] A skill "${resolvedName}" foi bloqueada por conter padrões de risco:\n  - ${issues}\nPara forçar a instalação consciente do risco, utilize --force.`
      );
    }

    // 3. Determina diretório de destino
    const destinationRoot = opts.global
      ? path.join(os.homedir(), '.agents', 'skills', resolvedName)
      : path.join(this.baseDir, '.agents', 'skills', resolvedName);

    fs.mkdirSync(destinationRoot, { recursive: true });

    // 4. Grava os arquivos da skill
    const installedFiles: string[] = [];
    for (const [relPath, fileContent] of Object.entries(resolved.files)) {
      const fullDest = path.join(destinationRoot, relPath);
      fs.mkdirSync(path.dirname(fullDest), { recursive: true });
      fs.writeFileSync(fullDest, fileContent, 'utf-8');
      installedFiles.push(relPath);
    }

    // 5. Calcula hash e atualiza lockfile
    const sha256 = crypto.createHash('sha256').update(skillContent).digest('hex');
    const lock = this.loadLockfile(opts.global);
    const now = new Date().toISOString();

    lock.skills[resolvedName] = {
      name: resolvedName,
      source,
      version,
      installedAt: lock.skills[resolvedName]?.installedAt || now,
      updatedAt: now,
      riskLevel: scanResult.level,
      sha256,
      destination: destinationRoot,
      files: installedFiles,
    };

    this.saveLockfile(lock, opts.global);

    return {
      name: resolvedName,
      destination: destinationRoot,
      scan: scanResult,
      warning: decision.verdict === 'warn' ? decision.reason : undefined,
    };
  }

  /**
   * Remove uma skill instalada.
   */
  remove(name: string, opts: { global?: boolean } = {}): boolean {
    const lock = this.loadLockfile(opts.global);
    const record = lock.skills[name];
    const destination =
      record?.destination ||
      (opts.global
        ? path.join(os.homedir(), '.agents', 'skills', name)
        : path.join(this.baseDir, '.agents', 'skills', name));

    if (fs.existsSync(destination)) {
      fs.rmSync(destination, { recursive: true, force: true });
    }

    if (record) {
      delete lock.skills[name];
      this.saveLockfile(lock, opts.global);
      return true;
    }

    return fs.existsSync(destination);
  }

  /**
   * Lista as skills instaladas gerenciadas.
   */
  listInstalled(opts: { global?: boolean } = {}): InstalledSkillRecord[] {
    const lock = this.loadLockfile(opts.global);
    return Object.values(lock.skills);
  }

  /**
   * Atualiza uma ou todas as skills instaladas a partir de suas fontes registradas no lockfile.
   */
  async update(
    name?: string,
    opts: { force?: boolean; global?: boolean } = {}
  ): Promise<Array<{ name: string; destination: string; scan: SkillScanResult; warning?: string }>> {
    const lock = this.loadLockfile(opts.global);
    const results: Array<{ name: string; destination: string; scan: SkillScanResult; warning?: string }> = [];

    if (name) {
      const record = lock.skills[name];
      if (!record) {
        throw new Error(`Skill "${name}" não encontrada no lockfile de skills instaladas.`);
      }
      const res = await this.install(record.source, {
        force: opts.force,
        global: opts.global,
        asName: record.name,
      });
      results.push(res);
      return results;
    }

    const records = Object.values(lock.skills);
    for (const rec of records) {
      const res = await this.install(rec.source, {
        force: opts.force,
        global: opts.global,
        asName: rec.name,
      });
      results.push(res);
    }

    return results;
  }
}

