/**
 * Tool Registry — tools como primitives de primeira classe.
 *
 * Fluxo: discover → check permission → check compatibility → select →
 * execute → validate result. Cada tool declara permissões explícitas
 * (princípio do menor privilégio: nada é concedido por default).
 */

import fs from 'fs';
import path from 'path';
import { PolicyEngine, type PolicyEnvironment, type TrustTier } from '../security/policy.js';
import { sanitizeText } from '../text/unicode-hygiene.js';
import { runInSandbox, sandboxAvailability, DEFAULT_TIMEOUT_MS } from './code-sandbox.js';
import { surveyProject } from './project-survey.js';

export type ToolPermission = 'fs:read' | 'fs:write' | 'net:http' | 'shell';

export interface ToolContext {
  /** Permissões concedidas ao caller. */
  permissions: ToolPermission[];
  /** Diretório base do projeto (sandbox para fs tools). */
  baseDir: string;
  /** Diretórios permitidos para leitura/escrita fora do baseDir. */
  allowedDirs?: string[];
  /** Contexto de execução para o Policy Engine (default: 'development'). */
  environment?: PolicyEnvironment;
  /** Trust tier de quem está solicitando a tool (skill/agent builtin/generated/community). */
  trustTier?: TrustTier;
}

export interface ToolDefinition {
  id: string;
  description: string;
  requiredPermission: ToolPermission;
  /** Versão mínima de compatibilidade do framework. */
  compatibility?: string;
  /** Valida o payload antes da execução. */
  validateInput(input: unknown): string[];
  /**
   * Executa. Pode ser assíncrona: `code.execute` roda um processo isolado, e
   * fazer isso de forma síncrona travaria o event loop — o que na prática
   * mataria o paralelismo dos outros nós do mesmo batch.
   */
  execute(input: unknown, ctx: ToolContext): unknown | Promise<unknown>;
}

export interface ToolResult {
  ok: boolean;
  result?: unknown;
  error?: string;
  durationMs: number;
}

function ensureInside(baseDir: string, target: string, allowedDirs?: string[]): string {
  // Caminho relativo resolve contra a SANDBOX, não contra o cwd do processo.
  // `path.resolve(target)` sozinho fazia "saida.txt" virar um arquivo no
  // diretório de onde o izanagi foi invocado — fora da zona declarada, e sem
  // que a checagem abaixo tivesse como perceber que a intenção era outra.
  const abs = path.isAbsolute(target) ? path.resolve(target) : path.resolve(baseDir, target);
  const safeZones = [path.resolve(baseDir), ...(allowedDirs ?? []).map((d) => path.resolve(d))];
  for (const zone of safeZones) {
    if (abs === zone || abs.startsWith(zone + path.sep)) return abs;
  }
  throw new Error(`ToolRegistry: acesso fora da zona permitida: ${abs}`);
}

function checkPermissions(ctx: ToolContext, perm: ToolPermission): string[] {
  return ctx.permissions.includes(perm) ? [] : [`permissão negada: ${perm} não concedida`];
}

const BUILTIN_TOOLS: Record<string, ToolDefinition> = {
  'fs.read': {
    id: 'fs.read',
    description: 'Lê arquivo de texto dentro da zona permitida',
    requiredPermission: 'fs:read',
    validateInput: (input) => {
      const i = input as { file?: unknown };
      const issues: string[] = [];
      if (typeof i?.file !== 'string' || i.file.length === 0) issues.push('campo "file" (string) obrigatório');
      return issues;
    },
    execute: (input, ctx) => {
      const file = ensureInside(ctx.baseDir, (input as { file: string }).file, ctx.allowedDirs);
      if (!fs.existsSync(file)) throw new Error(`ToolRegistry: arquivo não existe: ${file}`);
      return { content: fs.readFileSync(file, 'utf-8') };
    },
  },
  'fs.write': {
    id: 'fs.write',
    description: 'Escreve arquivo de texto dentro da zona permitida (cria diretórios)',
    requiredPermission: 'fs:write',
    validateInput: (input) => {
      const i = input as { file?: unknown; content?: unknown };
      const issues: string[] = [];
      if (typeof i?.file !== 'string' || i.file.length === 0) issues.push('campo "file" (string) obrigatório');
      if (typeof i?.content !== 'string') issues.push('campo "content" (string) obrigatório');
      return issues;
    },
    execute: (input, ctx) => {
      const { file, content } = input as { file: string; content: string };
      const abs = ensureInside(ctx.baseDir, file, ctx.allowedDirs);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      // Unicode Hygiene (sempre ativa, zero custo de token): remove caracteres
      // invisíveis e normaliza espaços homóglifos antes de gravar — ver
      // runtime/text/unicode-hygiene.ts para o porquê do escopo limitado.
      const { text: clean } = sanitizeText(content);
      fs.writeFileSync(abs, clean, 'utf-8');
      return { written: abs };
    },
  },
  'code.execute': {
    id: 'code.execute',
    description: 'Executa um script Node ESM em processo isolado (Permission Model), colapsando uma sequência de tool calls em uma só',
    // `shell` de propósito: a PolicyEngine já nega essa permissão a trust tier
    // `generated` e `community`, então código gerado por Factory ou vindo de
    // terceiro não executa por default. É a mitigação do limite de rede.
    requiredPermission: 'shell',
    validateInput: (input) => {
      const i = input as { code?: unknown; timeoutMs?: unknown };
      const issues: string[] = [];
      if (typeof i?.code !== 'string' || i.code.trim().length === 0) issues.push('campo "code" (string não vazia) obrigatório');
      if (i?.timeoutMs !== undefined && (typeof i.timeoutMs !== 'number' || i.timeoutMs <= 0)) {
        issues.push('campo "timeoutMs" deve ser um número positivo');
      }
      const availability = sandboxAvailability();
      if (!availability.available) issues.push(`sandbox indisponível: ${availability.reason}`);
      return issues;
    },
    execute: async (input, ctx) => {
      const i = input as { code: string; timeoutMs?: number; allowProjectRead?: boolean };
      const result = await runInSandbox({
        code: i.code,
        baseDir: ctx.baseDir,
        timeoutMs: Math.min(i.timeoutMs ?? DEFAULT_TIMEOUT_MS, 60_000),
        // Leitura do projeto é opt-in e nunca vem de graça junto com escrita.
        ...(i.allowProjectRead ? { allowProjectRead: true } : {}),
      });
      if (!result.ok) {
        throw new Error(
          result.timedOut
            ? `code.execute: ${result.error}`
            : `code.execute falhou (exit ${result.exitCode}): ${result.stderr.slice(0, 500) || result.error || 'sem saída de erro'}`,
        );
      }
      return { stdout: result.stdout, stderr: result.stderr, durationMs: result.durationMs, truncated: result.truncated };
    },
  },
  'project.survey': {
    id: 'project.survey',
    description: 'Levanta a forma do projeto (stack, manifestos, árvore por extensão, entrypoints, README) sem despejar código',
    // Leitura, e só leitura. O survey conta e lista; não abre arquivo de
    // código. Quem precisa do conteúdo de um arquivo pede `fs.read`, que passa
    // pela mesma política e deixa rastro do que foi lido.
    requiredPermission: 'fs:read',
    validateInput: (input) => {
      const i = (input ?? {}) as { dir?: unknown; maxEntries?: unknown };
      const issues: string[] = [];
      if (i.dir !== undefined && typeof i.dir !== 'string') issues.push('campo "dir" deve ser string quando presente');
      if (i.maxEntries !== undefined && (typeof i.maxEntries !== 'number' || i.maxEntries <= 0)) {
        issues.push('campo "maxEntries" deve ser um número positivo');
      }
      return issues;
    },
    execute: (input, ctx) => {
      const i = (input ?? {}) as { dir?: string; maxEntries?: number };
      // A raiz do survey passa pela MESMA checagem de zona das outras tools:
      // "levantar o projeto" não pode virar a porta de leitura de qualquer
      // diretório da máquina.
      const root = ensureInside(ctx.baseDir, i.dir ?? '.', ctx.allowedDirs);
      return surveyProject(root, { ...(i.maxEntries ? { maxEntries: i.maxEntries } : {}) });
    },
  },
  'fs.ls': {
    id: 'fs.ls',
    description: 'Lista diretório dentro da zona permitida',
    requiredPermission: 'fs:read',
    validateInput: (input) => {
      const i = input as { dir?: unknown };
      const issues: string[] = [];
      if (typeof i?.dir !== 'string' || i.dir.length === 0) issues.push('campo "dir" (string) obrigatório');
      return issues;
    },
    execute: (input, ctx) => {
      const dir = ensureInside(ctx.baseDir, (input as { dir: string }).dir, ctx.allowedDirs);
      if (!fs.existsSync(dir)) return { entries: [] };
      return { entries: fs.readdirSync(dir) };
    },
  },
};

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();
  private readonly policy: PolicyEngine;

  constructor(policy: PolicyEngine = new PolicyEngine()) {
    for (const [id, def] of Object.entries(BUILTIN_TOOLS)) this.tools.set(id, def);
    this.policy = policy;
  }

  /** Registra uma tool externa (MCP/plugin). */
  register(def: ToolDefinition): void {
    if (!def.id || !def.requiredPermission) throw new Error('ToolRegistry: tool com id/permissão inválidos');
    this.tools.set(def.id, def);
  }

  /** Discover: lista tools compatíveis com as permissões concedidas. */
  discover(ctx: ToolContext): Array<{ id: string; description: string; permission: ToolPermission }> {
    const out: Array<{ id: string; description: string; permission: ToolPermission }> = [];
    for (const t of this.tools.values()) {
      if (ctx.permissions.includes(t.requiredPermission)) {
        out.push({ id: t.id, description: t.description, permission: t.requiredPermission });
      }
    }
    return out;
  }

  /** Seleciona + verifica permissão + executa + valida resultado. */
  async execute(toolId: string, input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const start = Date.now();
    try {
      const tool = this.tools.get(toolId);
      if (!tool) {
        return { ok: false, error: `tool desconhecida: ${toolId}`, durationMs: 0 };
      }
      const permIssues = checkPermissions(ctx, tool.requiredPermission);
      if (permIssues.length > 0) {
        return { ok: false, error: permIssues.join('; '), durationMs: Date.now() - start };
      }
      const decision = this.policy.evaluate({
        kind: 'tool',
        environment: ctx.environment ?? 'development',
        permission: tool.requiredPermission,
        trustTier: ctx.trustTier,
        target: toolId,
      });
      if (!decision.allowed) {
        return {
          ok: false,
          error: `policy negou "${toolId}" (${decision.ruleId}): ${decision.reason}`,
          durationMs: Date.now() - start,
        };
      }
      const inputIssues = tool.validateInput(input);
      if (inputIssues.length > 0) {
        return { ok: false, error: `input inválido: ${inputIssues.join('; ')}`, durationMs: Date.now() - start };
      }
      const result = await tool.execute(input, ctx);
      return { ok: true, result, durationMs: Date.now() - start };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e), durationMs: Date.now() - start };
    }
  }
}
