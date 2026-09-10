/**
 * Agent Capability Registry: responde "quem sabe fazer isso?" sem que o
 * Commander precise conhecer agente por agente num prompt gigante.
 *
 * Antes deste módulo a lista de agentes era um array literal dentro do
 * orchestrator (`agentIds()`), que ficava desatualizado a cada agente novo e
 * ignorava agentes do projeto do usuário. Aqui a lista vem do disco: cada
 * `agents/<slug>-agent.json` declara capacidades, skills, custo e modelo.
 *
 * Determinístico por construção: descoberta = leitura de diretório, seleção =
 * scoring do CandidateScorer já existente. Nenhuma chamada de modelo.
 */

import fs from 'fs';
import path from 'path';
import type { AgentRole } from '../contracts/task-contract.js';
import type { TrustTier } from '../security/policy.js';
import { capabilityCoverage } from '../routing/scorer.js';
import { DOMAINS, detectDomains, domainOverlap, type Domain } from '../orchestration/domains.js';

export interface AgentCapability {
  id: string;
  name: string;
  purpose: string;
  capabilities: string[];
  skills: string[];
  chains: Record<string, string[]>;
  /** Teto declarado de tokens do agente (proxy de custo). */
  tokenBudget: number;
  /** Classe de custo derivada do tokenBudget: agentes caros só entram quando o papel justifica. */
  costClass: 'low' | 'medium' | 'high';
  /** Papel natural do agente na hierarquia. */
  role: AgentRole;
  /** Kinds de artefato que o agente costuma produzir (derivado das chains/capacidades). */
  outputs: string[];
  /**
   * Domínios técnicos cobertos pelo agente, detectados sobre a mesma tabela
   * bilíngue usada pelo Commander para classificar o objetivo. É o que faz um
   * agente descrito em inglês ("Clean Architecture") casar com um objetivo
   * escrito em português ("arquitetura limpa").
   */
  domains: Domain[];
  /**
   * Confiança de origem, derivada do diretório de onde o agente foi lido.
   * É o que a `PolicyEngine` usa para negar permissão destrutiva a agente que
   * não veio do framework. Derivar do caminho é deliberado: um agente não pode
   * declarar o próprio trust tier no JSON dele.
   */
  trustTier: TrustTier;
  /**
   * Tier de modelo declarado pelo agente (`"sonnet"` / `"opus"` nos 22 core).
   *
   * É uma PREFERÊNCIA, não um id de catálogo, e não é o que roteia: o modelo
   * sai do papel via `ModelRouter.routeForRole`. Existe aqui para que o
   * Commander possa perguntar "este agente pede modelo forte?" sem abrir o
   * arquivo — o campo estava no disco em 22/22 agentes e era descartado no
   * parse.
   */
  modelHint?: string;
  /**
   * Permissões que o agente DECLARA precisar, em prosa
   * (`"ler agents/"`, `"escrever skills/ (draft em staging...)"`).
   *
   * Nome explícito porque a distinção é de segurança: isto NÃO é a concessão
   * de permissão do runtime. O que autoriza uma tool é
   * `TaskContract.permissions` no formato `fs:read`/`fs:write`/`shell`,
   * conferido pela `PolicyEngine` contra o trust tier da ORIGEM do arquivo.
   * Um agente não se autoriza declarando o que quer.
   */
  declaredPermissions: string[];
  /**
   * Métodos de verificação declarados pelo agente: quais métricas da
   * Evaluation Engine se aplicam ao que ele produz e a nota mínima que ele
   * mesmo estabelece.
   */
  evaluation?: { metrics: string[]; minScore?: number };
  file: string;
}

export interface CapabilityMatch {
  agent: AgentCapability;
  score: number;
  reasons: string[];
}

/** Agentes que raciocinam sobre o problema inteiro em vez de executar uma fatia. */
const COMMANDER_AGENTS = new Set(['discovery', 'architect', 'product-reasoner', 'pm', 'techlead', 'agent-architect']);
/** Agentes de tarefa curta e barata (extração, formatação, avaliação objetiva). */
const WORKER_AGENTS = new Set(['evaluator', 'docs', 'professor']);

/**
 * Lê `evaluation` do JSON do agente. Bloco ausente ou sem métrica devolve
 * objeto vazio, e o campo fica ausente no `AgentCapability`: métrica sem
 * declaração é ausência de critério, nunca `minScore: 0` (que afirmaria que
 * qualquer nota serve).
 */
function parseEvaluation(raw: unknown): { evaluation?: { metrics: string[]; minScore?: number } } {
  if (!raw || typeof raw !== 'object') return {};
  const block = raw as { metrics?: unknown; minScore?: unknown };
  const metrics = Array.isArray(block.metrics) ? (block.metrics as string[]).filter((m) => typeof m === 'string') : [];
  if (metrics.length === 0) return {};
  return {
    evaluation: {
      metrics,
      ...(typeof block.minScore === 'number' ? { minScore: block.minScore } : {}),
    },
  };
}

function roleFor(id: string): AgentRole {
  if (COMMANDER_AGENTS.has(id)) return 'commander';
  if (WORKER_AGENTS.has(id)) return 'worker';
  return 'specialist';
}

/**
 * Trust tier pela ORIGEM do arquivo, nunca pelo que o arquivo declara:
 *   - `agents/generated/` : produzido pela Agent Factory desta instalação;
 *   - `.agents/`          : trazido pelo projeto do usuário (terceiro);
 *   - resto               : o catálogo do próprio framework.
 */
function trustTierFor(file: string): TrustTier {
  const normalized = file.replace(/\\/g, '/');
  if (/\/agents\/generated\//.test(normalized)) return 'generated';
  if (/\/\.agents\//.test(normalized)) return 'community';
  return 'builtin';
}

/**
 * Domínios que um agente cobre.
 *
 * A fonte é o que o agente É (`role`/`description`, `name`) mais o que ele
 * DECLARA saber fazer (`capabilities`). Antes entravam também `skills` e os
 * nomes das `chains`, e isso inflava o alcance de todo mundo: uma skill de
 * apoio na lista bastava para o agente "cobrir" o domínio dela. Medido no
 * catálogo real: o agente `database` cobria `[database, security, debugging,
 * architecture]` porque carrega `security-privacy`, `error-recovery` e
 * `architecture-patterns` na chain; o `security` cobria cinco domínios; o
 * `automation-engineer`, sete. Com quase todo agente cobrindo quase todo
 * domínio, casar domínio deixava de separar candidato nenhum.
 *
 * Uma skill na chain diz o que o agente USA no caminho, não o problema que ele
 * resolve. É por isso que ela informa a relevância léxica (com peso baixo) e
 * não o domínio.
 *
 * `domains` explícito no JSON vence a inferência, INCLUSIVE quando é uma lista
 * vazia: declarar o campo é optar por não ser inferido. Isso é o que dá endereço
 * aos agentes transversais — `adversarial-critic`, `evaluator`, `techlead`,
 * `professor`, `agent-architect`, `skill-architect` não são donos de domínio
 * nenhum, e a inferência os fazia disputar (e ganhar) domínios só porque a
 * descrição deles CITA o domínio que eles criticam, avaliam ou ensinam. Um
 * crítico que menciona "problemas de arquitetura" não é um arquiteto.
 *
 * Valor fora da lista canônica é descartado em silêncio; o resultado sai sempre
 * na ordem canônica de `DOMAINS`, para a nota não depender da ordem em que
 * alguém escreveu o array.
 */
function domainsFor(raw: Record<string, unknown>, capabilities: string[]): Domain[] {
  if (Array.isArray(raw.domains)) {
    const declared = (raw.domains as unknown[]).filter((d): d is Domain => typeof d === 'string' && (DOMAINS as string[]).includes(d));
    return DOMAINS.filter((d) => declared.includes(d));
  }
  return detectDomains([raw.role ?? raw.description, raw.name, ...capabilities].filter(Boolean).join(' '));
}

/**
 * Piso de evidência para um agente ser considerado candidato.
 *
 * Abaixo disto o que casou foi um termo de apoio solto, e devolver esse agente é
 * pior que não devolver nenhum: quem chama tem um default declarado
 * (`senior-engineer`), e um default explícito é melhor que um sorteio. Medido:
 * "Revisar este PR antes do merge" não tem specialist nenhum com evidência, e
 * sem o piso a busca por papel devolvia `database`.
 */
const MIN_EVIDENCE = 0.05;

function costClassFor(tokenBudget: number): AgentCapability['costClass'] {
  if (tokenBudget >= 8000) return 'high';
  if (tokenBudget >= 4000) return 'medium';
  return 'low';
}

export class AgentCapabilityRegistry {
  private cache: AgentCapability[] | null = null;

  constructor(private readonly opts: { baseDir: string; extraDirs?: string[] }) {}

  /** Diretórios varridos, em ordem de precedência (projeto do usuário primeiro). */
  private dirs(): string[] {
    return [
      ...(this.opts.extraDirs ?? []),
      path.join(this.opts.baseDir, '.agents', 'agents'),
      path.join(this.opts.baseDir, 'agents'),
      path.join(this.opts.baseDir, 'agents', 'generated'),
    ];
  }

  /** Todos os agentes descobertos. Primeira declaração de um id vence. */
  list(): AgentCapability[] {
    if (this.cache) return this.cache;
    const byId = new Map<string, AgentCapability>();
    for (const dir of this.dirs()) {
      if (!fs.existsSync(dir)) continue;
      let entries: string[];
      try {
        entries = fs.readdirSync(dir);
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!entry.endsWith('.json')) continue;
        const id = entry.replace(/-agent\.json$/, '').replace(/\.json$/, '');
        if (byId.has(id)) continue;
        const parsed = this.parse(path.join(dir, entry), id);
        if (parsed) byId.set(id, parsed);
      }
    }
    this.cache = Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
    return this.cache;
  }

  private parse(file: string, id: string): AgentCapability | null {
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
    } catch {
      return null;
    }
    const skills = Array.isArray(raw.skills) ? (raw.skills as string[]) : [];
    const chains = (raw.chains && typeof raw.chains === 'object' ? raw.chains : {}) as Record<string, string[]>;
    const tokenBudget = Number(raw.token_budget ?? raw.tokenBudget ?? 4096);
    const capabilities = Array.isArray(raw.capabilities) ? (raw.capabilities as string[]) : skills;
    return {
      id,
      name: (raw.name as string) ?? id,
      purpose: (raw.role as string) ?? (raw.description as string) ?? '',
      capabilities,
      skills,
      chains,
      tokenBudget,
      costClass: costClassFor(tokenBudget),
      role: roleFor(id),
      outputs: Array.isArray(raw.outputs) ? (raw.outputs as string[]) : [],
      domains: domainsFor(raw, capabilities),
      trustTier: trustTierFor(file),
      ...(typeof raw.model === 'string' && raw.model ? { modelHint: raw.model } : {}),
      declaredPermissions: Array.isArray(raw.permissions) ? (raw.permissions as string[]) : [],
      ...parseEvaluation(raw.evaluation),
      file,
    };
  }

  get(id: string): AgentCapability | undefined {
    return this.list().find((a) => a.id === id);
  }

  ids(): string[] {
    return this.list().map((a) => a.id);
  }

  /**
   * Capability matching: ranqueia agentes capazes de atender a um objetivo.
   * `role` restringe ao nível hierárquico (não gasta um commander numa
   * extração); `exclude` remove agentes já descartados por falha.
   */
  findCapable(objective: string, opts: { role?: AgentRole; limit?: number; exclude?: string[] } = {}): CapabilityMatch[] {
    const exclude = new Set(opts.exclude ?? []);
    const objectiveDomains = detectDomains(objective);
    const matches: CapabilityMatch[] = [];
    for (const agent of this.list()) {
      if (exclude.has(agent.id)) continue;
      if (opts.role && agent.role !== opts.role) continue;
      // Três evidências separadas, porque valem coisas diferentes. Antes eram
      // um só bloco de texto concatenado, e nele o nome de uma skill de apoio
      // pesava igual ao que o agente É.
      const identity = capabilityCoverage(objective, [agent.id, agent.name].join(' '));
      const purpose = capabilityCoverage(objective, [agent.purpose, ...agent.capabilities].join(' '));
      const support = capabilityCoverage(objective, [...agent.skills, ...Object.keys(agent.chains)].join(' '));
      const domainFit = domainOverlap(objectiveDomains, agent.domains);
      if (identity <= 0 && purpose <= 0 && support <= 0 && domainFit <= 0) continue;
      const reasons: string[] = [];
      if (identity > 0) reasons.push(`identidade ${identity.toFixed(2)}`);
      if (purpose > 0) reasons.push(`propósito ${purpose.toFixed(2)}`);
      if (support > 0) reasons.push(`skills ${support.toFixed(2)}`);
      if (domainFit > 0) {
        const shared = objectiveDomains.filter((d) => agent.domains.includes(d));
        reasons.push(`domínios em comum: ${shared.join(', ')}`);
      }
      // As duas penalidades são MULTIPLICATIVAS, não subtrativas.
      //
      // Subtrair um valor fixo só funciona enquanto a escala das notas é
      // conhecida, e ela mudou: `semanticRelevance` saturava perto de 0.8 e um
      // desconto de 0.08 valia ~10%; sobre cobertura real, a mesma constante
      // vale 27% e passou a DECIDIR o ranking em vez de desempatá-lo, chegando
      // a zerar candidatos com evidência positiva (dois agentes empatados em
      // 0.000 e a ordem caindo no desempate). Como fator, o desconto vale a
      // mesma fração em qualquer escala e nunca aniquila a evidência.
      const costFactor = agent.costClass === 'high' ? 0.1 : agent.costClass === 'medium' ? 0.04 : 0;
      if (costFactor > 0) reasons.push(`custo ${agent.costClass}`);
      // Amplitude: entre dois agentes que casam o mesmo domínio, o mais estreito
      // é o mais específico para ele. Sem isto, um agente que cobre quatro
      // domínios ganha do dono do domínio por casar um termo genérico a mais.
      const breadthFactor = Math.min(0.12, 0.04 * Math.max(0, agent.domains.length - 1));
      if (breadthFactor > 0) reasons.push(`${agent.domains.length} domínios`);
      const evidence = identity * 0.3 + purpose * 0.3 + support * 0.1 + domainFit * 0.3;
      const score = evidence * (1 - costFactor) * (1 - breadthFactor);
      if (score < MIN_EVIDENCE) continue;
      matches.push({ agent, score, reasons });
    }
    // Empate cai em critério com significado antes de cair no alfabeto: primeiro
    // o agente mais estreito (mais específico), depois o mais barato. O id só
    // decide quando tudo mais empatou, e aí é só para a ordem ser determinística.
    const COST_ORDER = { low: 0, medium: 1, high: 2 } as const;
    matches.sort(
      (a, b) =>
        b.score - a.score ||
        a.agent.domains.length - b.agent.domains.length ||
        COST_ORDER[a.agent.costClass] - COST_ORDER[b.agent.costClass] ||
        a.agent.id.localeCompare(b.agent.id),
    );
    return matches.slice(0, opts.limit ?? 3);
  }

  /** Melhor agente para um objetivo, ou null quando nada casa. */
  bestFor(objective: string, opts: { role?: AgentRole; exclude?: string[] } = {}): AgentCapability | null {
    const found = this.findCapable(objective, { ...opts, limit: 1 });
    return found[0]?.agent ?? null;
  }

  /** Chain de skills declarada pelo agente para uma categoria, com fallback estável. */
  chainFor(agentId: string, category: string): string[] {
    const agent = this.get(agentId);
    if (!agent) return [];
    if (Array.isArray(agent.chains[category])) return agent.chains[category];
    const first = Object.values(agent.chains)[0];
    if (Array.isArray(first)) return first;
    return agent.skills.slice(0, 5);
  }

  /** Invalida o cache (útil depois que a Agent Factory gera um agente novo). */
  refresh(): void {
    this.cache = null;
  }
}
