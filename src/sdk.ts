/**
 * SDK programático do Izanagi: `izanagi.run({ objective })`.
 *
 * Mesma engine da CLI (`runtime/execute.ts`), sem nada impresso no terminal.
 * Quem integra o Izanagi num serviço, num job ou noutro agente usa esta
 * superfície; a CLI é apenas a versão interativa dela.
 *
 * Observabilidade: o handle devolvido é uma Promise que também aceita
 * assinatura de eventos do run em tempo real.
 *
 *   const run = izanagi.run({ objective: 'auditar a API de login' });
 *   run.on('task:start', (e) => console.log(e.data));
 *   const result = await run;
 */

import path from 'path';
import { Orchestrator, type ExecuteCtx } from './runtime/orchestrator.js';
import { LLMClient } from './runtime/llm/client.js';
import { ContextResolver } from './runtime/orchestration/context-resolver.js';
import { MemoryStore } from './runtime/memory/store.js';
import { DELIVER_NODE_ID, deliverableRelPath, validateOutputDir } from './runtime/orchestration/delivery.js';
import { looksLikeProject } from './runtime/tools/project-survey.js';
import { ResponseCache } from './runtime/cache/response-cache.js';
import {
  buildExecutionPlan,
  createHeadlessProducer,
  createLLMProducer,
  createSemanticJudge,
  LOCAL_PROVIDERS,
  type ProducerLLMClient,
} from './runtime/execute.js';
import { buildNodePrompt, classifyTask } from './cli/commands/run.js';
import type { ExecutionMode } from './runtime/contracts/task-contract.js';
import type { IzanagiEvent, IzanagiEventName } from './runtime/observability/events.js';
import type { CommanderPlan } from './runtime/orchestration/commander.js';
import type { TokenTelemetry } from './runtime/token/execution-budget.js';
import type { EvaluationReport, GraphNode, HealingAction, RunTrace } from './runtime/types.js';
import type { VerificationResult } from './runtime/verification/engine.js';

export interface IzanagiRunOptions {
  /** O que precisa ser resolvido. */
  objective: string;
  /** Raiz de onde os ASSETS do framework são lidos: agentes e skills (default: diretório atual). */
  baseDir?: string;
  /**
   * Projeto de TRABALHO: o que o survey lê, onde a entrega grava, e a raiz
   * contra a qual `output` é validado. Default: `baseDir`.
   *
   * Separado porque `baseDir` responde outra pergunta ("de onde leio agentes e
   * skills?"). Rodando de dentro do projeto as duas coincidem, que é o caso
   * comum e o motivo de terem sido a mesma coisa até aqui; um chamador que lê
   * assets de uma instalação do framework e trabalha em outro diretório
   * gravaria a entrega dentro da instalação.
   */
  workspaceDir?: string;
  mode?: ExecutionMode;
  budget?: { maxTokens?: number; maxCost?: number; maxTimeMs?: number; maxToolCalls?: number; maxAgents?: number; maxRetries?: number };
  /** Fixa o mesmo modelo em todos os papéis. */
  model?: string;
  /**
   * Allowlist de ids de tool para o run inteiro. Ausente: vale o que o contrato
   * de cada tarefa autoriza. Lista vazia proíbe toda tool (é declaração, não
   * ausência).
   */
  allowedTools?: string[];
  /**
   * Critérios de aceite do OBJETIVO, em texto. Cada linha vira um critério do
   * contrato das tarefas terminais de produto:
   *
   * - prosa (`"o endpoint aceita ?page e ?limit"`) vira critério SEMÂNTICO, que
   *   precisa de juiz e sem juiz fica `UNVERIFIED` (não medido, não reprovado);
   * - com prefixo conhecido (`"contains: paginação"`, `"file-exists: docs/api.md"`,
   *   `"matches: limit=\\d+"`, `"not-contains: TODO"`, `"min-size: 500"`,
   *   `"json-field: total"`, `"references-exist"`) vira critério
   *   DETERMINÍSTICO, decidido sem modelo.
   *
   * Sem isto, todo critério do run era derivado do SCHEMA do artefato: o plano
   * verificava a forma da entrega, nunca o que foi pedido.
   */
  acceptance?: string[];
  /**
   * Roda o comando de teste do projeto no fim do grafo, como um nó de tool com
   * permissão `shell`, e a métrica `testResults` da avaliação passa a vir do
   * EXIT CODE em vez de um artefato que um agente escreveu.
   *
   * Opt-in: executa um processo do projeto (o `scripts.test` do manifesto, ou
   * o runner da linguagem detectada) com o ambiente herdado. Nenhum campo de
   * entrada carrega um comando — o binário sai de uma allowlist do runtime e o
   * que ele roda é o que o dono do projeto configurou.
   */
  verifyTests?: boolean;
  /**
   * Piso de força de VERIFICAÇÃO do plano, em [0,1].
   *
   * Declarado, o Commander compara os modos possíveis e escolhe o mais barato
   * que ainda atinge o piso, registrando a comparação no plano
   * (`plan.candidates`) e nas decisões. Ausente, nada muda.
   *
   * O piso é sobre EVIDÊNCIA (quantos critérios obrigatórios por tarefa,
   * política estrita, revisão independente), não sobre a qualidade da entrega:
   * um plano com mais critérios não produz trabalho melhor, produz mais prova
   * sobre o trabalho.
   */
  minQuality?: number;
  /**
   * Cancelamento cooperativo do run. Abortar interrompe o grafo no próximo
   * batch e cancela a requisição em voo; o checkpoint do último batch
   * concluído fica em disco, e `izanagi resume <run-id>` retoma dali.
   *
   * Cancelar não é falhar por bug: o run termina `FAIL` com a falha declarando
   * o cancelamento, e o `Healer` a trata como não-recuperável (curar seria
   * desobedecer quem cancelou).
   */
  signal?: AbortSignal;
  /** Só providers locais (Ollama / LM Studio / endpoint próprio). */
  local?: boolean;
  /** Cache local de respostas. */
  cache?: boolean;
  /**
   * Reaproveita artefato de run ANTERIOR quando a pergunta foi exatamente a
   * mesma: mesmo contrato, mesmos insumos a montante (por checksum), mesmo
   * estado de projeto declarado, dentro do prazo.
   *
   * Opt-in, como o cache de resposta, e pelo mesmo motivo: reuso é a
   * otimização que, quando erra, erra em silêncio. O artefato reaproveitado
   * passa pela verificação inteira — o que se economiza é a chamada, não a
   * prova. Nó de tool nunca é reaproveitado: reusar um "escreveu" significa
   * não escrever.
   */
  reuseArtifacts?: boolean;
  /** Agente explícito; sem isso o Capability Registry escolhe. */
  agent?: string;
  skillChain?: string[];
  /** Planejamento legado por categoria, sem Commander. */
  noCommander?: boolean;
  /**
   * Desliga o juiz semântico (default: ligado quando há provider). Sem juiz,
   * critério de aceite semântico fica UNVERIFIED em vez de aprovado.
   */
  noJudge?: boolean;
  /** Client LLM alternativo (testes, proxy, gateway próprio). */
  client?: ProducerLLMClient & { configuredProviders(): string[] };
  /**
   * Diretório onde o run grava a entrega, relativo a `baseDir`. Presente, o
   * plano ganha um nó de tool que escreve o resultado e verifica o arquivo
   * escrito — a única permissão de escrita concedida no grafo inteiro. Fora da
   * raiz do projeto, `run()` rejeita antes de planejar.
   */
  output?: string;
  /**
   * Lê o projeto antes de decidir: um nó de tool determinístico na cabeça do
   * grafo levanta stack, manifestos e árvore, e o resultado entra no contexto
   * mínimo das tarefas raiz. Default: ligado quando `baseDir` tem manifesto
   * reconhecido. `false` desliga.
   */
  survey?: boolean;
  /**
   * Raiz do estado (`.izanagi/state`: trace, artefatos, memória, checkpoints).
   * Default: `baseDir`. Separado porque `baseDir` também é a raiz de onde os
   * assets do framework são lidos, e as duas respostas divergem num projeto
   * sem `.agents/` — ver `resolveStateRoot` no installer.
   */
  stateDir?: string;
}

export interface IzanagiRunResult {
  runId: string;
  /** Caminho absoluto do arquivo entregue, quando `output` foi pedido e a gravação passou. */
  deliveredTo?: string;
  /**
   * `HUMAN_REQUIRED`: o run esgotou um teto DECLARADO (tentativas, tempo,
   * tokens ou custo) e parou por isso. Não é `FAIL` por bug e não é `BLOCKED`
   * (que é retomável por aprovação): a decisão seguinte é sobre o teto.
   */
  status: 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL' | 'BLOCKED' | 'HUMAN_REQUIRED' | 'UNKNOWN';
  score: number;
  mode?: ExecutionMode;
  /** Plano do Commander (ausente com `noCommander`). */
  plan?: CommanderPlan;
  /** Artefatos produzidos, por id de tarefa. */
  artifacts: Record<string, { kind: string; content: unknown; valid: boolean }>;
  telemetry?: TokenTelemetry;
  verification?: Array<{ nodeId: string; result: VerificationResult }>;
  evaluation?: EvaluationReport;
  healing: HealingAction[];
  trace: RunTrace;
  traceFile: string;
  /** Execução pausada aguardando decisão humana. */
  pendingApproval?: { nodeId: string; context?: string };
  /** true quando nenhum provider estava configurado (artefatos simulados). */
  headless: boolean;
}

/** Aliases amigáveis para os eventos internos do runtime. */
const EVENT_ALIASES: Record<string, IzanagiEventName> = {
  'task:start': 'node.started',
  'task:complete': 'node.completed',
  'run:start': 'run.started',
  'run:complete': 'run.completed',
  // Do RUN: veredito final agregado, emitido uma vez.
  'verification:failed': 'quality_gate.failed',
  'verification:passed': 'quality_gate.passed',
  // De uma TAREFA: emitido por no' verificado, com nodeId e criterios nao
  // comprovados no payload.
  'task:verification:failed': 'task.verification.failed',
  'task:verification:passed': 'task.verification.passed',
  'healing:start': 'healing.started',
  'healing:complete': 'healing.completed',
};

export type IzanagiEventSelector = IzanagiEventName | keyof typeof EVENT_ALIASES | '*';

export interface IzanagiRunHandle extends Promise<IzanagiRunResult> {
  /** Assina um evento do run. Devolve a função de cancelamento. */
  on(event: IzanagiEventSelector, handler: (event: IzanagiEvent) => void): () => void;
}

function resolveEventName(selector: IzanagiEventSelector): string {
  return EVENT_ALIASES[selector as keyof typeof EVENT_ALIASES] ?? selector;
}

/**
 * Executa um objetivo de ponta a ponta: Commander decide o modo, o grafo roda
 * com roteamento por papel, os artefatos são verificados contra os critérios
 * de aceite e a telemetria de custo volta junto do resultado.
 */
export function run(options: IzanagiRunOptions): IzanagiRunHandle {
  const baseDir = options.baseDir ?? process.cwd();
  const workspaceDir = options.workspaceDir ?? baseDir;
  const client = options.client ?? new LLMClient();
  const allProviders = client.configuredProviders();
  const providers = options.local ? allProviders.filter((p) => LOCAL_PROVIDERS.includes(p)) : allProviders;

  // Destino inválido é erro de programação do chamador: falha imediata, com o
  // motivo, em vez de um run inteiro que termina sem gravar nada.
  let outputDir: string | undefined;
  if (options.output) {
    const check = validateOutputDir(workspaceDir, options.output);
    if (!check.ok) throw new Error(`izanagi.run: output inválido — ${check.error}`);
    outputDir = check.rel;
  }

  const classified = classifyTask(options.objective);
  const planning = buildExecutionPlan(baseDir, {
    objective: options.objective,
    ...(options.mode ? { mode: options.mode } : {}),
    ...(options.agent ? { agent: options.agent, explicitAgent: true } : {}),
    ...(options.skillChain ? { skillChain: options.skillChain } : {}),
    ...(options.budget?.maxTokens !== undefined ? { maxTokens: options.budget.maxTokens } : {}),
    ...(options.budget?.maxCost !== undefined ? { maxCostUsd: options.budget.maxCost } : {}),
    ...(options.model ? { model: options.model } : {}),
    availableProviders: providers,
    ...(outputDir ? { output: outputDir } : {}),
    ...(options.survey ?? looksLikeProject(workspaceDir) ? { survey: true } : {}),
    ...(options.acceptance ? { acceptance: options.acceptance } : {}),
    ...(options.verifyTests ? { verifyTests: true } : {}),
    ...(options.minQuality !== undefined ? { minQuality: options.minQuality } : {}),
    ...(options.stateDir ? { stateDir: options.stateDir } : {}),
    ...(options.noCommander ? { noCommander: true } : {}),
  });
  // Critério que o runtime NÃO vai cobrar não desaparece: quem chama o SDK
  // programaticamente precisa poder recusar o run em vez de receber um
  // `VERIFIED` que não mediu o que foi pedido.
  if (planning.acceptanceIssues) {
    throw new Error(`izanagi.run: critério de aceite inválido — ${planning.acceptanceIssues.join(' | ')}`);
  }

  // Cache de resposta é estado: segue `stateDir` como trace, artefato e memória.
  const cache = new ResponseCache({
    baseDir: options.stateDir ?? baseDir,
    enabled: Boolean(options.cache) || ResponseCache.enabledFromEnv(),
  });
  // Memória do projeto no contexto MÍNIMO de cada tarefa. A busca existia e,
  // dentro de um run, ninguém a chamava: só a CLI e o benchmark. A única
  // recuperação durante a execução era padrão de falha, então o agente
  // trabalhava sem nada do que o projeto já tinha aprendido. Entra por tarefa,
  // com teto próprio, e o `stateDir` é o mesmo do resto do estado.
  // Um store por RUN, não por nó: `MemoryStore` carrega o estado do disco no
  // construtor, e instanciá-lo dentro do callback pagaria essa leitura em cada
  // tarefa do grafo para responder a mesma pergunta.
  const knowledgeStore = new MemoryStore({ baseDir: options.stateDir ?? baseDir });
  const contextResolver = new ContextResolver({
    knowledge: (query, limit) => knowledgeStore.search(query, limit).map((e) => ({ title: e.title, content: e.content })),
  });
  const agentId = options.agent ?? planning.plan?.contracts[0]?.agent ?? classified.agent;

  const producer = providers.length === 0
    ? createHeadlessProducer(options.objective)
    : createLLMProducer({
        objective: options.objective,
        client,
        cache,
        contextResolver,
        buildSystemPrompt: (node: GraphNode, _ctx: ExecuteCtx, minimalContext?: string) =>
          buildNodePrompt(node, { task: options.objective, agent: { name: agentId }, skillChain: options.skillChain ?? [] }, baseDir, {
            ...(minimalContext ? { context: minimalContext } : {}),
          }),
      });

  // Mesmo juiz semântico da CLI: as duas superfícies verificam igual.
  const judge = options.noJudge || providers.length === 0
    ? undefined
    : createSemanticJudge({ client, routeRole: planning.routeRole });

  const handlers: Array<{ name: string; handler: (event: IzanagiEvent) => void }> = [];
  const artifacts: Record<string, { kind: string; content: unknown; valid: boolean }> = {};

  const orchestrator = new Orchestrator({
    baseDir,
    // Declarado sempre: sem isso a sandbox de tool cairia no cwd do processo
    // hospedeiro, que pode ser outro. Default `baseDir`, que é o caso comum de
    // quem chama o SDK de dentro do próprio projeto.
    workspaceDir,
    ...(options.stateDir ? { stateDir: options.stateDir } : {}),
    command: 'sdk',
    task: options.objective,
    category: planning.plan?.classification.category ?? classified.category,
    primaryAgent: agentId,
    skillChain: options.skillChain ?? [],
    availableProviders: providers,
    ...(planning.plan ? { plan: planning.plan } : {}),
    ...(options.allowedTools ? { allowedTools: options.allowedTools } : {}),
    ...(options.reuseArtifacts ? { reuseArtifacts: true } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
    budgetLimits: {
      ...(options.budget?.maxCost !== undefined ? { maxCostUsd: options.budget.maxCost } : {}),
      ...(options.budget?.maxTimeMs !== undefined ? { maxTimeMs: options.budget.maxTimeMs } : {}),
      ...(options.budget?.maxToolCalls !== undefined ? { maxToolCalls: options.budget.maxToolCalls } : {}),
      ...(options.budget?.maxAgents !== undefined ? { maxAgents: options.budget.maxAgents } : {}),
      ...(options.budget?.maxRetries !== undefined ? { maxRetries: options.budget.maxRetries } : {}),
    },
    ...(judge ? { judge } : {}),
    routeRole: planning.routeRole,
    costOf: planning.costOf,
    // Replanejamento passa pelo Commander: falha reincidente produz um grafo
    // diferente, nao o mesmo grafo com um no reaberto.
    replan: planning.replan,
    // No de tool passa por ToolRegistry + PolicyEngine: o trust tier vem da
    // origem do arquivo do agente, nunca do que ele declara sobre si.
    trustTierOf: planning.trustTierOf,
    produce: producer,
    consume: (node, artifact) => {
      artifacts[node.id] = { kind: artifact.kind, content: artifact.content, valid: artifact.valid };
    },
    onEvent: (event) => {
      for (const h of handlers) {
        if (h.name === '*' || h.name === event.name) h.handler(event);
      }
    },
  });

  // Início adiado por uma microtask: `run()` devolve o handle ANTES de o
  // runtime emitir o primeiro evento, senão `handle.on(...)` registrado logo
  // depois perderia `run.started` e o primeiro `node.started`.
  const promise = Promise.resolve()
    .then(() => orchestrator.run())
    .then((result): IzanagiRunResult => ({
      runId: result.trace.runId,
      status: result.status,
      score: result.score,
      ...(result.mode ? { mode: result.mode } : {}),
      ...(planning.plan ? { plan: planning.plan } : {}),
      artifacts,
      ...(result.telemetry ? { telemetry: result.telemetry } : {}),
      ...(result.verification ? { verification: result.verification } : {}),
      ...(result.evaluation ? { evaluation: result.evaluation } : {}),
      healing: result.healing,
      trace: result.trace,
      traceFile: result.traceFile,
      ...(result.pendingApproval ? { pendingApproval: result.pendingApproval } : {}),
      // Só aparece quando a gravação REALMENTE aconteceu. Devolver o caminho
      // planejado de um nó que falhou entregaria uma promessa por um arquivo.
      ...(outputDir && result.graph.nodes.find((n) => n.id === DELIVER_NODE_ID)?.status === 'succeeded'
        ? { deliveredTo: path.resolve(baseDir, deliverableRelPath(outputDir, options.objective)) }
        : {}),
      headless: providers.length === 0,
    }));

  const handle = promise as IzanagiRunHandle;
  handle.on = (event, handler) => {
    const entry = { name: resolveEventName(event), handler };
    handlers.push(entry);
    return () => {
      const i = handlers.indexOf(entry);
      if (i >= 0) handlers.splice(i, 1);
    };
  };
  return handle;
}

/**
 * Só planeja: devolve modo, contratos e estimativa de custo sem executar nada
 * nem gastar token. Útil para mostrar ao usuário o que vai acontecer (e quanto
 * vai custar) antes de autorizar.
 */
export function plan(options: Pick<IzanagiRunOptions, 'objective' | 'baseDir' | 'mode' | 'model' | 'agent' | 'skillChain' | 'budget' | 'local' | 'client' | 'acceptance'>): CommanderPlan | undefined {
  const baseDir = options.baseDir ?? process.cwd();
  const client = options.client ?? new LLMClient();
  const all = client.configuredProviders();
  const providers = options.local ? all.filter((p) => LOCAL_PROVIDERS.includes(p)) : all;
  return buildExecutionPlan(baseDir, {
    objective: options.objective,
    ...(options.mode ? { mode: options.mode } : {}),
    ...(options.agent ? { agent: options.agent, explicitAgent: true } : {}),
    ...(options.skillChain ? { skillChain: options.skillChain } : {}),
    ...(options.budget?.maxTokens !== undefined ? { maxTokens: options.budget.maxTokens } : {}),
    ...(options.budget?.maxCost !== undefined ? { maxCostUsd: options.budget.maxCost } : {}),
    ...(options.model ? { model: options.model } : {}),
    ...(options.acceptance ? { acceptance: options.acceptance } : {}),
    availableProviders: providers,
  }).plan;
}

export const izanagi = { run, plan };
export default izanagi;
