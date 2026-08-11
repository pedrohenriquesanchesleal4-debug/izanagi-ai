/**
 * Benchmark Definitions — casos embutidos para as 10 áreas do framework.
 *
 * Cada caso: task, requirements, expectedArtifacts, validators, metrics.
 * Executáveis via `izanagi benchmark run [domain]`.
 */

import type { BenchmarkCase } from '../types.js';

export const BUILTIN_BENCHMARKS: BenchmarkCase[] = [
  {
    id: 'code-clean-function',
    domain: 'coding',
    task: 'Implemente uma função `normalizeCpf` em TypeScript que valide e normalize CPF (pontuação, dígitos verificadores).',
    requirements: ['validação de CPF', 'retorno tipado', 'tratamento de erro'],
    expectedArtifacts: ['src/normalizeCpf.ts', 'src/normalizeCpf.test.ts'],
    validators: [
      { name: 'no-stub', message: 'output não pode conter TODO/stub', check: '!text.includes("TODO")' },
      { name: 'has-tests', message: 'output deve citar testes', check: 'text.toLowerCase().includes("test")' },
    ],
    metrics: ['correctness', 'requirementCoverage', 'maintainability'],
    tags: ['typescript', 'validacao'],
  },
  {
    id: 'debug-null-ref',
    domain: 'debugging',
    task: 'Debug: aplicação Next.js lança "Cannot read properties of null (reading map)" em SSR. Encontre causa raiz e corrija.',
    requirements: ['causa raiz identificada', 'correção com guard', 'teste de regressão'],
    expectedArtifacts: ['docs/root-cause.md', 'src/fix.ts', 'src/regression.test.ts'],
    validators: [
      { name: 'root-cause', message: 'deve explicar a causa raiz', check: 'text.toLowerCase().includes("causa") || text.toLowerCase().includes("root")' },
      { name: 'no-stub', message: 'sem stub', check: '!text.includes("TODO")' },
    ],
    metrics: ['correctness', 'testResults'],
    tags: ['debug', 'nextjs', 'ssr'],
  },
  {
    id: 'arch-modular-monolith',
    domain: 'architecture',
    task: 'Desenhe a arquitetura de um monólito modular para um SaaS de faturamento com módulos de clientes, contratos e notas.',
    requirements: ['bounded contexts', 'portas e adaptadores', 'mermaid diagram', 'ADR'],
    expectedArtifacts: ['docs/architecture.md', 'docs/adr-001.md'],
    validators: [
      { name: 'has-mermaid', message: 'deve conter diagrama mermaid', check: 'text.includes("mermaid")' },
      { name: 'has-adr', message: 'deve citar ADR', check: 'text.toLowerCase().includes("adr")' },
    ],
    metrics: ['architecture', 'correctness'],
    tags: ['arch', 'clean-arch', 'ddd'],
  },
  {
    id: 'sec-owasp-scan',
    domain: 'security',
    task: 'Auditoria OWASP de uma API Express com login: SQL injection, XSS, auth quebrada, secrets e rate limiting.',
    requirements: ['relatório de vulnerabilidades', 'severidade', 'remediação'],
    expectedArtifacts: ['docs/security-report.md'],
    validators: [
      { name: 'has-owasp', message: 'deve citar OWASP', check: 'text.toLowerCase().includes("owasp")' },
      { name: 'has-severity', message: 'deve classificar severidade', check: 'text.toLowerCase().includes("critical") || text.toLowerCase().includes("high") || text.toLowerCase().includes("severidade")' },
      { name: 'no-stub', message: 'sem stub', check: '!text.includes("TODO")' },
    ],
    metrics: ['security', 'correctness'],
    tags: ['owasp', 'api', 'auth'],
  },
  {
    id: 'db-schema-invoices',
    domain: 'database',
    task: 'Modelagem PostgreSQL para sistema de notas fiscais: companies, clients, invoices, items, recurring_contracts com índices.',
    requirements: ['schema completo', 'relacionamentos', 'índices', 'constraints'],
    expectedArtifacts: ['prisma/schema.prisma'],
    validators: [
      { name: 'has-relations', message: 'deve ter relacionamentos', check: 'text.includes("@relation") || text.includes("REFERENCES")' },
      { name: 'has-primary', message: 'deve ter chave primária', check: 'text.includes("@id") || text.includes("PRIMARY KEY") || text.includes("primary key")' },
      { name: 'no-stub', message: 'sem stub', check: '!text.includes("TODO")' },
    ],
    metrics: ['correctness', 'architecture'],
    tags: ['postgres', 'schema', 'prisma'],
  },
  {
    id: 'frontend-hero-anim',
    domain: 'frontend',
    task: 'Landing page dark (bg-zinc-950) com hero animado (scroll-driven), bento grid e micro-interações — zero AI-slop.',
    requirements: ['direção de design', 'animação de scroll', 'a11y', 'responsivo'],
    expectedArtifacts: ['app/page.tsx', 'components/hero.tsx'],
    validators: [
      { name: 'has-animation', message: 'deve citar animação', check: 'text.toLowerCase().includes("scroll") || text.toLowerCase().includes("animation")' },
      { name: 'no-slop-font', message: 'não usar Inter como única tipografia', check: '!text.toLowerCase().includes("inter") || text.includes("Inter Variable")' },
      { name: 'has-dark', message: 'estética dark', check: 'text.includes("zinc-950") || text.includes("bg-zinc")' },
    ],
    metrics: ['correctness', 'performance'],
    tags: ['nextjs', 'landing', 'animation'],
  },
  {
    id: 'backend-rest-api',
    domain: 'backend',
    task: 'API REST Node/Express com auth JWT, validação Zod, rotas CRUD de clients e testes de integração.',
    requirements: ['auth JWT', 'validação', 'CRUD', 'testes'],
    expectedArtifacts: ['src/server.ts', 'src/routes/clients.ts', 'src/tests/integration.test.ts'],
    validators: [
      { name: 'has-jwt', message: 'deve ter auth JWT', check: 'text.toLowerCase().includes("jwt")' },
      { name: 'has-validation', message: 'deve validar input', check: 'text.toLowerCase().includes("zod") || text.toLowerCase().includes("validate")' },
      { name: 'no-stub', message: 'sem stub', check: '!text.includes("TODO")' },
    ],
    metrics: ['correctness', 'security'],
    tags: ['node', 'express', 'api'],
  },
  {
    id: 'automation-csv-etl',
    domain: 'automation',
    task: 'Automação Python: ler planilha CSV de clientes (utf-8-sig), validar (Pydantic), deduplicar e importar em API com retry.',
    requirements: ['validação de dados', 'deduplicação', 'retry', 'dry-run'],
    expectedArtifacts: ['main.py', 'README.md'],
    validators: [
      { name: 'has-validation', message: 'deve validar dados', check: 'text.toLowerCase().includes("pydantic") || text.toLowerCase().includes("validate")' },
      { name: 'has-dryrun', message: 'deve ter dry-run', check: 'text.toLowerCase().includes("dry")' },
      { name: 'no-stub', message: 'sem stub', check: '!text.includes("TODO")' },
    ],
    metrics: ['correctness', 'requirementCoverage'],
    tags: ['python', 'csv', 'etl'],
  },
  {
    id: 'research-stack-choice',
    domain: 'research',
    task: 'Pesquisa: comparar Next.js 15 vs Remix vs Astro para SaaS de dashboard com auth e tempo real. Fontes citadas.',
    requirements: ['critérios de comparação', 'fontes com confiança', 'recomendação'],
    expectedArtifacts: ['docs/research.md'],
    validators: [
      { name: 'has-sources', message: 'deve citar fontes', check: 'text.toLowerCase().includes("http") || text.toLowerCase().includes("fonte")' },
      { name: 'has-confidence', message: 'deve marcar confiança', check: 'text.toLowerCase().includes("confian")' },
      { name: 'has-recommendation', message: 'deve recomendar', check: 'text.toLowerCase().includes("recomenda")' },
    ],
    metrics: ['correctness', 'confidence'],
    tags: ['research', 'stack', 'nextjs'],
  },
  {
    id: 'refactor-strangler',
    domain: 'refactoring',
    task: 'Refatorar módulo legacy de pagamentos (switch gigante, funções de 300 linhas) para estratégia pattern sem breaking change.',
    requirements: ['sem breaking change', 'estratégia', 'testes cobrindo comportamento'],
    expectedArtifacts: ['src/payment/strategy.ts', 'src/payment/payment.ts'],
    validators: [
      { name: 'has-strategy', message: 'deve usar strategy', check: 'text.toLowerCase().includes("strategy")' },
      { name: 'no-stub', message: 'sem stub', check: '!text.includes("TODO")' },
    ],
    metrics: ['maintainability', 'testResults'],
    tags: ['refactor', 'patterns'],
  },
];
