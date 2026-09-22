/**
 * Tipos da ponte Izanagi -> RunMaestro (runmaestro.ai).
 *
 * O framework para de orquestrar execução visual própria (canvas removido) e
 * vira PLANEJADOR + TRADUTOR: `Commander().plan()` gera o grafo; a ponte
 * converte o grafo em Auto Run docs do Maestro e despacha via `maestro-cli`.
 * Este módulo só declara os contratos: doc, task, eventos de stream e
 * detectores de provider. O spec integrado vive em `docs/MAESTRO-BRIDGE.md`.
 */

/** Canal de agente do Maestro: o provider que executa as tasks (`-t <type>`). */
export type ProviderChannelId =
  | 'claude-code'
  | 'codex'
  | 'opencode'
  | 'copilot-cli'
  | 'factory-droid'
  | 'hermes'
  | 'pi'
  | 'qwen3-coder'
  | 'omp';

/** Provider detectado no PATH (ou ausente), pronto para o seletor de `init`. */
export interface ProviderChannel {
  id: ProviderChannelId;
  /** Nome amigável para o seletor interativo. */
  label: string;
  /** Binário procurado no PATH. */
  executable: string;
  installed: boolean;
  /** Caminho absoluto do executável quando instalado. */
  path?: string;
}

/** Uma task Auto Run: checkbox `- [ ] texto` com markers opcionais. */
export interface MaestroTask {
  text: string;
  /** `- [x]` quando a task já está concluída (na exportação sempre pendente). */
  done: boolean;
  /** Marker MAESTRO:MODEL antes do checkbox: dica de tier por task. */
  model?: { tier: 'low' | 'medium' | 'high'; reason: string };
  /** Marker MAESTRO:HITL antes do checkbox: aprovação humana. */
  hitl?: { reason: string; artifact?: string };
}

/** Uma doc Auto Run: um documento `.md` com checkboxes, executado pelo Maestro. */
export interface MaestroDoc {
  /** Nome da fase (`Fase 1`, `Fase 1: architect`). */
  phase: string;
  /** Nome do arquivo (`01-fase-1.md`). */
  filename: string;
  /** Título da doc: `# <slug> - <fase>`. */
  title: string;
  /** Linha de contexto do cabeçalho (objetivo truncado). */
  context: string;
  tasks: MaestroTask[];
  /** Markdown completo, pronto para gravar. */
  content: string;
}

/** Resultado da conversão grafo -> docs Auto Run. */
export interface MaestroExport {
  slug: string;
  /** Diretório absoluto onde os docs foram gravados (vazio quando não há docs). */
  dir: string;
  docs: MaestroDoc[];
  /** Ids de nós pulados de propósito (tool/gate, overhead do runtime Izanagi). */
  skipped: string[];
  /** Total de tasks nos docs gerados. */
  taskCount: number;
  /** Total de tasks de aprovação humana (marker HITL). */
  hitlCount: number;
}

/* ============================== EVENTOS ============================== */

/** Evento de run de documento Auto Run (stream JSONL do `--json`). */
export interface RunEventStart {
  type: 'start';
  playbook?: string;
}

export interface RunEventDocumentStart {
  type: 'document_start';
  document: string;
  taskCount: number;
}

export interface RunEventTaskStart {
  type: 'task_start';
  taskIndex: number;
}

export interface RunEventTaskComplete {
  type: 'task_complete';
  taskIndex: number;
  success: boolean;
  summary?: string;
  elapsedMs?: number;
  usageStats?: Record<string, unknown>;
}

export interface RunEventDocumentComplete {
  type: 'document_complete';
  document: string;
  tasksCompleted: number;
}

export interface RunEventLoopComplete {
  type: 'loop_complete';
  iteration: number;
  tasksCompleted: number;
  elapsedMs?: number;
}

export interface RunEventComplete {
  type: 'complete';
  success: boolean;
  totalTasksCompleted: number;
  totalElapsedMs?: number;
  totalCost?: number;
}

/** Aprovação humana (HITL) em modo headless: o doc é pulado, não executado. */
export interface RunEventGated {
  type: 'document_gated';
  document: string;
  reason?: string;
}

/** Doc travado: o Maestro não progrediu e restam tasks pendentes. */
export interface RunEventStalled {
  type: 'document_stalled';
  document: string;
  reason?: string;
  remaining?: number;
}

/** Run abortado (marker `maestro:halt` ou interrupção). */
export interface RunEventHalt {
  type: 'halt';
  reason?: string;
}

/** Dica de tier resolvida pelo Maestro (provider sem tabela de tier). */
export interface RunEventModelResolution {
  type: 'model_resolution';
  tier?: string;
  model?: string;
}

export type RunEvent =
  | RunEventStart
  | RunEventDocumentStart
  | RunEventTaskStart
  | RunEventTaskComplete
  | RunEventDocumentComplete
  | RunEventLoopComplete
  | RunEventComplete
  | RunEventGated
  | RunEventStalled
  | RunEventHalt
  | RunEventModelResolution;

/** Evento de goal run (modo Goal-Driven do Maestro). */
export interface GoalEventStart {
  type: 'goal_start';
  objective?: string;
  maxIterations?: number;
}

export interface GoalEventIterationStart {
  type: 'goal_iteration_start';
  iteration?: number;
}

export interface GoalEventIterationComplete {
  type: 'goal_iteration_complete';
  iteration?: number;
  progress?: number;
  rationale?: string;
  complete?: boolean;
  deadlock?: boolean;
}

export interface GoalEventComplete {
  type: 'goal_complete';
  success: boolean;
  exitReason?: string;
  finalProgress?: number;
  iterations?: number;
}

export type GoalEvent =
  | GoalEventStart
  | GoalEventIterationStart
  | GoalEventIterationComplete
  | GoalEventComplete;

export type MaestroEvent = RunEvent | GoalEvent;

export interface StalledEntry {
  document: string;
  reason?: string;
  remaining?: number;
}

export interface GatedEntry {
  document: string;
  reason?: string;
}

/** Agregação de uma stream de run de documentos. */
export interface RunSummary {
  /** Null quando a stream terminou sem evento `complete`. */
  success: boolean | null;
  totalTasksCompleted: number;
  totalCost?: number;
  stalled: StalledEntry[];
  halted: boolean;
  haltedReason?: string;
  gated: GatedEntry[];
  iterationCount: number;
  documents: string[];
}

/** Agregação de uma stream de goal run. */
export interface GoalSummary {
  success: boolean | null;
  exitReason?: string;
  finalProgress?: number;
  iterations: number;
  /** Quantas iterações terminaram em deadlock. */
  deadlocks: number;
  lastRationale?: string;
}

/* =========================== WRAPPER CLI =========================== */

/** Status derivado do exit code do maestro-cli (0-5 mapeados, resto genérico). */
export type MaestroExitStatus = 'ok' | 'generic' | 'usage' | 'app-down' | 'app-old' | 'timeout';

/**
 * Binário resolvido do maestro-cli. `bin` é o que o spawn usa; `prefixArgs`
 * carrega o caminho do `.js` no fallback do desktop app (spawnando o node).
 */
export interface MaestroCli {
  bin: string;
  prefixArgs: string[];
  /** Caminho amigável para mensagens de erro. */
  display: string;
}

/** Resultado padronizado de uma invocação do maestro-cli. */
export interface MaestroResult {
  code: number;
  status: MaestroExitStatus;
  /** Mensagem PT-BR derivada do exit code. */
  message: string;
  stdout: string;
  stderr: string;
}