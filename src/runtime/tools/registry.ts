/**
 * Tool Registry — tools como primitives de primeira classe.
 *
 * Fluxo: discover → check permission → check compatibility → select →
 * execute → validate result. Cada tool declara permissões explícitas
 * (princípio do menor privilégio: nada é concedido por default).
 */

import fs from 'fs';
import path from 'path';

export type ToolPermission = 'fs:read' | 'fs:write' | 'net:http' | 'shell';

export interface ToolContext {
  /** Permissões concedidas ao caller. */
  permissions: ToolPermission[];
  /** Diretório base do projeto (sandbox para fs tools). */
  baseDir: string;
  /** Diretórios permitidos para leitura/escrita fora do baseDir. */
  allowedDirs?: string[];
}

export interface ToolDefinition {
  id: string;
  description: string;
  requiredPermission: ToolPermission;
  /** Versão mínima de compatibilidade do framework. */
  compatibility?: string;
  /** Valida o payload antes da execução. */
  validateInput(input: unknown): string[];
  execute(input: unknown, ctx: ToolContext): unknown;
}

export interface ToolResult {
  ok: boolean;
  result?: unknown;
  error?: string;
  durationMs: number;
}

function ensureInside(baseDir: string, target: string, allowedDirs?: string[]): string {
  const abs = path.resolve(target);
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
      fs.writeFileSync(abs, content, 'utf-8');
      return { written: abs };
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

  constructor() {
    for (const [id, def] of Object.entries(BUILTIN_TOOLS)) this.tools.set(id, def);
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
  execute(toolId: string, input: unknown, ctx: ToolContext): ToolResult {
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
      const inputIssues = tool.validateInput(input);
      if (inputIssues.length > 0) {
        return { ok: false, error: `input inválido: ${inputIssues.join('; ')}`, durationMs: Date.now() - start };
      }
      const result = tool.execute(input, ctx);
      return { ok: true, result, durationMs: Date.now() - start };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e), durationMs: Date.now() - start };
    }
  }
}
