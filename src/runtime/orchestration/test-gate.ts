/**
 * O nó que roda o teste do projeto.
 *
 * É o primeiro check do runtime que decide por EXECUÇÃO. Todos os outros
 * decidem por leitura: tamanho do texto, presença de termo, existência de
 * arquivo. A métrica `testResults` da avaliação vinha, até aqui, de um artefato
 * `test-results` escrito por um AGENTE — o runtime reportava "testes passando"
 * a partir de um texto produzido pelo mesmo processo que deveria estar sendo
 * testado.
 *
 * ## O que este nó mede, e o que ele NÃO mede
 *
 * Mede: o comando de teste do projeto, executado no diretório de trabalho, com
 * o exit code do processo. `passed` é `exitCode === 0`, decidido pelo sistema
 * operacional.
 *
 * NÃO mede: que o trabalho do run causou esse resultado. A materialização
 * grava em `<output>/<slug>/` e não toca a fonte do projeto (decisão
 * registrada), então num run cujo `--output` fica fora da árvore testada o
 * resultado é a linha de base do projeto, não o efeito da entrega. O artefato
 * declara o comando e o diretório justamente para que quem lê saiba qual dos
 * dois casos está olhando.
 *
 * O nó roda por ÚLTIMO, depois da materialização: quando o `--output` aponta
 * para dentro da árvore que a suíte cobre, o que ele mede é o projeto COM o que
 * o run escreveu. Rodar antes mediria o projeto sem a entrega e chamaria isso
 * de verificação.
 */

import type { GraphNode } from '../types.js';
import type { AcceptanceCriterion, TaskContract } from '../contracts/task-contract.js';
import { DEFAULT_TEST_TIMEOUT_MS } from '../tools/project-test.js';

/** Id do nó. Fixo: `izanagi explain` e os testes referenciam por nome. */
export const TEST_NODE_ID = 'verify-tests';

/**
 * Nó de teste + contrato. Sem agente, como os outros nós de tool gerados pelo
 * planejamento: quem declarou a tool foi o próprio framework, então o trust
 * tier é `builtin` e a `PolicyEngine` não nega `shell` a ele.
 */
export function testGateNode(opts: {
  /** Ids que precisam concluir antes (tudo que pode ter escrito arquivo). */
  dependencies: string[];
  timeoutMs?: number;
}): { node: GraphNode; contract: TaskContract } {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TEST_TIMEOUT_MS;
  const acceptance: AcceptanceCriterion[] = [
    {
      id: `${TEST_NODE_ID}:ran`,
      description: 'a tool devolveu o comando que executou',
      kind: 'deterministic',
      check: { kind: 'json-field', field: 'command', message: 'a tool de teste não devolveu o comando executado' },
    },
    {
      id: `${TEST_NODE_ID}:exit-zero`,
      // A descrição é o que aparece na lista de critérios NÃO comprovados, então
      // ela precisa se ler como a exigência, não como o resultado: "terminou
      // com exit code 0" listado como reprovado diz o contrário do que houve.
      description: 'a suíte de testes do projeto passa (exit code 0)',
      kind: 'deterministic',
      check: { kind: 'exit-zero', message: 'a suíte do projeto não passou ao fim do run' },
    },
  ];

  const node: GraphNode = {
    id: TEST_NODE_ID,
    kind: 'tool',
    outputs: ['test-run'],
    dependencies: [...opts.dependencies],
    status: 'pending',
    // Nó de tool não chama modelo. O custo aqui é tempo de CPU, e o teto dele
    // é o `timeoutMs`, não o orçamento de token.
    tokenBudget: 0,
    timeoutMs,
    metadata: { role: 'worker', tool: { id: 'project.test', input: { dir: '.', timeoutMs } } },
  };

  const contract: TaskContract = {
    id: TEST_NODE_ID,
    objective: 'executar o comando de teste do projeto e registrar o exit code',
    role: 'worker',
    inputs: [...opts.dependencies],
    constraints: [],
    expectedOutput: { kind: 'test-run' },
    dependencies: [...opts.dependencies],
    priority: 'normal',
    budget: { maxTokens: 0, maxTimeMs: timeoutMs, maxToolCalls: 1 },
    verification: {
      deterministic: acceptance.map((c) => c.check!).filter(Boolean),
      requireAllCriteria: true,
    },
    acceptance,
    permissions: ['shell'],
    tool: { id: 'project.test', input: { dir: '.', timeoutMs } },
  };

  return { node, contract };
}
