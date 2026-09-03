/**
 * Grounding: o run lê o projeto antes de escrever sobre ele.
 *
 * O nó de survey é um `kind: 'tool'` na CABEÇA do grafo. Ele roda antes de
 * qualquer agente, não gasta token nenhum (é uma varredura determinística), e
 * o artefato que produz entra no contexto mínimo dos nós seguintes pelo
 * Context Resolver — que já limita cada insumo a ~1200 chars. O custo do
 * grounding é, portanto, um teto conhecido, e não "o repositório no prompt".
 *
 * A alternativa que existia era pior e invisível: o agente escrevia sobre um
 * projeto que nunca viu, inventava a stack e os caminhos, e o artefato passava
 * na verificação porque o schema pergunta se os campos existem, não se
 * correspondem a alguma realidade.
 *
 * Não roda em modo `direct`: uma resposta de uma chamada não justifica dobrar
 * o grafo para levantar o terreno.
 */

import type { GraphNode } from '../types.js';
import type { AcceptanceCriterion, TaskContract } from '../contracts/task-contract.js';

/** Id do nó de survey. Fixo: o trace e os testes referenciam por nome. */
export const SURVEY_NODE_ID = 'survey';

/**
 * Nó de survey + contrato. Sem agente: quem declarou a tool foi o
 * planejamento do framework, então o trust tier é `builtin`. Concede `fs:read`
 * e nada mais — o survey lê a forma do projeto, nunca escreve.
 */
export function surveyNode(): { node: GraphNode; contract: TaskContract } {
  const acceptance: AcceptanceCriterion[] = [
    {
      id: `${SURVEY_NODE_ID}:valid`,
      description: 'levantamento válido contra o schema de "project-survey"',
      kind: 'deterministic',
      check: { kind: 'artifact-valid' },
    },
    {
      id: `${SURVEY_NODE_ID}:scanned`,
      description: 'o levantamento declara o que foi varrido',
      kind: 'deterministic',
      check: { kind: 'json-field', field: 'scanned', message: 'survey sem contagem do que foi varrido não é evidência' },
    },
  ];

  const node: GraphNode = {
    id: SURVEY_NODE_ID,
    kind: 'tool',
    outputs: ['project-survey'],
    dependencies: [],
    status: 'pending',
    tokenBudget: 0,
    timeoutMs: 30_000,
    metadata: { role: 'worker', tool: { id: 'project.survey', input: { dir: '.' } } },
  };

  const contract: TaskContract = {
    id: SURVEY_NODE_ID,
    objective: 'levantar a forma real do projeto (stack, manifestos, árvore, entrypoints) antes de qualquer decisão',
    role: 'worker',
    inputs: [],
    constraints: [],
    expectedOutput: { kind: 'project-survey' },
    dependencies: [],
    priority: 'normal',
    budget: { maxTokens: 0, maxTimeMs: 30_000, maxToolCalls: 1 },
    verification: { deterministic: acceptance.map((c) => c.check!), requireAllCriteria: true },
    acceptance,
    /**
     * Opcional de propósito, e as três consequências são as certas:
     *
     *  1. survey que falha (diretório ilegível, projeto vazio) NÃO derruba o
     *     run — grounding é evidência auxiliar, e a ausência dela piora a
     *     qualidade sem invalidar o que foi verificado;
     *  2. sob pressão de orçamento, a degradação `drop-optional-tasks` corta o
     *     levantamento antes de cortar trabalho — que é a ordem certa;
     *  3. early stopping não o dispensa na cabeça do grafo, porque `shouldSkip`
     *     exige dependência já VERIFIED e aqui não há nenhuma.
     *
     * Falha ou corte continuam visíveis: o nó aparece com o status real na
     * verificação e no trace. Silêncio seria o problema, não a opcionalidade.
     */
    optional: true,
    permissions: ['fs:read'],
    tool: { id: 'project.survey', input: { dir: '.' } },
  };

  return { node, contract };
}

/**
 * Põe o survey na frente do grafo: todo nó que não dependia de nada passa a
 * depender dele.
 *
 * Só as RAÍZES ganham a dependência. Ligar o survey a todos os nós faria cada
 * um carregar o levantamento no contexto, e o mesmo insumo repetido em sete
 * prompts é a duplicação de contexto que a arquitetura proíbe: quem está a
 * jusante já recebe o que a raiz produziu a partir dele.
 */
export function withSurveyAtHead(nodes: GraphNode[], surveyId = SURVEY_NODE_ID): GraphNode[] {
  return nodes.map((node) =>
    (node.dependencies ?? []).length === 0 ? { ...node, dependencies: [surveyId] } : node,
  );
}
