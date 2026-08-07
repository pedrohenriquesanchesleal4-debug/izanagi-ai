import fs from 'fs';
import path from 'path';

/**
 * Blueprint Engine — forbra a entrega de produto COMPLETO em vez de checklist.
 *
 * Inspirado nos mecanismos de frameworks de ponta (Claude Engineer, OpenHands,
 * Bolt.new, Superpowers):
 *  1. FILE MANIFEST GATE — antes de qualquer código, o agente declara a árvore
 *     de arquivos completa (cada caminho necessário + propósito + camada).
 *  2. MATERIALIZATION CONTRACT — a resposta correta = UM arquivo completo por
 *     artefato ESCRITO EM DISCO; nunca prosa, resumo ou checklist.
 *  3. STUB / TODO GATE — falha determinística se houver arquivo vazio, TODO ou
 *     `// implement later`.
 *  4. VERIFICATION LOOP — comandos explícitos (install, typecheck, build, test)
 *     cujo pass/fail reentra no loop.
 */

export type Scope = 'fullstack' | 'frontend' | 'backend' | 'automation' | 'other';

export interface ScaffoldArchetype {
  id: string;
  label: string;
  /** Palavras-chave (lowercase, acentuadas e sem) que acionam o archetype. */
  keywords: string[];
  fileTree: string;
  verifySteps: string[];
}

const ARCHETYPES: ScaffoldArchetype[] = [
  {
    id: 'saas',
    label: 'SaaS / Producto Web Completo (Next.js + Prisma + Auth)',
    keywords: ['saas', 'product', 'produto', 'application', 'aplicação', 'aplicacao', 'app', 'plataforma', 'startup', 'dashboard'],
    fileTree: `app/
  layout.tsx                 # Root layout: fontes, ThemeProvider, Navbar, headers de segurança/SEO
  page.tsx                   # LANDING PAGE cinematográfica (bg-zinc-950, glassmorphism, bento, scrollytelling)
  globals.css                # Design tokens: paleta dark, tipografia, utilidades cinemáticas
  (auth)/
    login/page.tsx           # página de login (form real + validação + estado de erro/loading)
    register/page.tsx        # página de cadastro
  (dashboard)/
    layout.tsx               # Shell autenticado: sidebar, topbar, guarda de rota (redirect se não-logado)
    page.tsx                 # Dashboard: métricas, gráficos, tabelas do core CRUD
    /[recurso]/
      page.tsx               # listagem do recurso central (tabela + filtros + paginação)
      new/page.tsx           # formulário de criação
      [id]/page.tsx          # detalhe / edição
components/
  navbar.tsx                 # nav fixa com blur, CTA, mobile menu
  footer.tsx                 # footer rico
  landing/
    hero.tsx                 # hero com motion reveal
    features.tsx             # bento grid de features
    pricing.tsx              # pricing cards (se aplicável)
    cta.tsx                  # CTA final
  dashboard/
    sidebar.tsx              # navegação da área logada
    stat-card.tsx            # card de métrica animado
    data-table.tsx           # tabela com estados de loading/vazio/erro
lib/
  prisma.ts                  # cliente Prisma singleton
  auth.ts                    # helpers de sessão/middleware de autorização
  utils.ts                   # cn() e helpers
prisma/
  schema.prisma              # User + recurso central + relacionamentos + índices
  migrations/                # migração gerada
lib/validators.ts            # zod schemas p/ inputs (server + client)
lib/api.ts                   # fetch client tipado (erros, auth header)`,
    verifySteps: ['npm install', 'npx prisma generate', 'npx prisma migrate dev', 'npm run build', 'npm run dev'],
  },
  {
    id: 'ecommerce',
    label: 'E-commerce / Loja com Checkout',
    keywords: ['ecommerce', 'e-commerce', 'loja', 'shop', 'store', 'checkout', 'carrinho', 'vend'],
    fileTree: `app/
  layout.tsx
  page.tsx                   # vitrine cinematográfica com catálogo
  /produto/[slug]/page.tsx   # página de produto (galeria, preço, quantidade, add ao carrinho)
  /carrinho/page.tsx         # carrinho (quantidades, total, cupom)
  /checkout/page.tsx         # checkout: endereço + pagamento + confirmação
  /pedido/[id]/page.tsx      # confirmação/detalhe do pedido
components/
  navbar.tsx  footer.tsx  product-card.tsx  cart-overlay.tsx  stepper.tsx
lib/
  cart.ts                    # estado do carrinho
  api.ts  utils.ts  validators.ts
prisma/
  schema.prisma              # User, Product, Order, OrderItem, Address + relações`,verifySteps:['npm install','npx prisma generate','npx prisma migrate dev','npm run build','npm run dev']},
  {
    id: 'fintech',
    label: 'Fintech / Financeiro com Auth & Dados',
    keywords: ['fintech', 'financeiro', 'finanças', 'finance', 'invoice', 'nfse', 'nota fiscal', 'faturamento', 'contas', 'pagamento', 'billing'],
    fileTree: `app/
  layout.tsx  page.tsx                 # landing
  (auth)/login/page.tsx  (auth)/register/page.tsx
  (dashboard)/
    layout.tsx  page.tsx               # métricas financeiras + gráficos
    /emitir/page.tsx                   # formulário de emissão (unitário/lote)
    /recorrente/page.tsx               # contratos recorrentes
    /historico/page.tsx                # histórico + filtros + export
components/
  navbar.tsx  footer.tsx  sidebar.tsx  stat-card.tsx  data-table.tsx  chart.tsx
lib/  prisma.ts  auth.ts  utils.ts  validators.ts  api.ts
prisma/  schema.prisma                 # User, Company, Client, Invoice, RecurringContract
  migrations/`,verifySteps:['npm install','npx prisma generate','npx prisma migrate dev','npm run build','npm start']},
  {
    id: 'cms',
    label: 'CMS / Painel de Conteúdo',
    keywords: ['cms', 'blog', 'painel', 'admin', 'conteúdo', 'conteudo', 'gestão', 'content'],
    fileTree: `app/
  layout.tsx  page.tsx
  (auth)/login/page.tsx
  (dashboard)/
    layout.tsx  page.tsx
    /posts/  page.tsx  new/page.tsx  [id]/edit/page.tsx
    /midia/  page.tsx
components/  navbar.tsx  sidebar.tsx  editor.tsx  data-table.tsx
lib/  prisma.ts  auth.ts  utils.ts  validators.ts
prisma/  schema.prisma                 # User, Post, Media, Category`,verifySteps:['npm install','npx prisma generate','npx prisma migrate dev','npm run build']},
];

/** Deteccao do escopo da tarefa (fullstack/product vs pontual). */
export function detectScope(task: string): Scope {
  const lower = normalize(task);
  if (ARCHETYPES.some((a) => a.keywords.some((k) => lower.includes(k)))) {
    return 'fullstack';
  }
  if (lower.includes('backend') || lower.includes('api') || lower.includes('endpoint') || lower.includes('banco') || lower.includes('database')) {
    return 'backend';
  }
  if (lower.includes('frontend') || lower.includes('landing') || lower.includes('tela') || lower.includes('ui') || lower.includes('site')) {
    return 'frontend';
  }
  if (lower.includes('automa') || lower.includes('planilha') || lower.includes('spreadsheet') || lower.includes('scrap') || lower.includes('etl')) {
    return 'automation';
  }
  return 'other';
}

function normalize(s: string): string {
  const map: Record<string, string> = { á:'a', é:'e', í:'i', ó:'o', ú:'u', à:'a', ã:'a', õ:'o', ç:'c', â:'a', ê:'e', ô:'o' };
  return s.toLowerCase().split('').map((c) => map[c] || c).join('');
}

/** Encontra o archetype de scaffold mais adequado (ou null). */
export function matchArchetype(task: string): ScaffoldArchetype | null {
  const lower = normalize(task);
  let best: ScaffoldArchetype | null = null;
  let bestHits = 0;
  for (const a of ARCHETYPES) {
    const hits = a.keywords.filter((k) => lower.includes(k)).length;
    if (hits > bestHits) {
      best = a;
      bestHits = hits;
    }
  }
  return bestHits > 0 ? best : null;
}

/** Gera o bloco de MANIFESTO obrigatório (file-tree) + contrato de materialização. */
export function buildBlueprintCtx(task: string, baseDir: string): { archetype: ScaffoldArchetype | null; scope: Scope; blueprint: string } {
  const scope = detectScope(task);
  const archetype = matchArchetype(task);

  // Referencias curadas como vocabulário obrigatório
  let refs = '';
  const refDir = path.join(baseDir, 'references');
  for (const f of ['stack-2026.md', 'ui-design-systems.md', 'scrollytelling.md']) {
    const p = path.join(refDir, f);
    if (fs.existsSync(p)) refs += `- \`references/${f}\` (${f.replace('.md', '')})\n`;
  }

  let blueprint = `## 📐 BLUEPRINT & FILE MANIFEST (OBRIGATÓRIO — anti-checklist)\n`;
  blueprint += `Você está entregando ${scope === 'fullstack' ? 'um PRODUTO COMPLETO (ciclo vertical: landing + auth + dashboard + backend + banco + README)' : 'a entrega solicitada por completo, com TODOS os arquivos necessários'}. Nunca responda com lista de tarefas, resumo ou só landing page.\n\n`;

  if (archetype) {
    blueprint += `### Arquivos a criar (manifiesto mínimo — crie TODOS, e acrescente os que julgar necessários):\n\n\`\`\`\n${archetype.fileTree}\n\`\`\`\n\n`;
  }

  blueprint += `### CONTRATO DE MATERIALIZAÇÃO (regras inegociáveis)\n`;
  blueprint += `1. Para CADA arquivo do manifesto: escreva o arquivo COMPLETO em disco, com código de produção 100% implementado (tipagem estrita, estados reais, tratamento de erros, lógica funcional). Nenhum placeholder.\n`;
  blueprint += `2. PROIBIDO: arquivo vazio, stub, \`TODO\`, \`// implement later\`, \`FIXME\`, função sem corpo real, \`console.log\` de teste.\n`;
  blueprint += `3. Depois de escrever todos os arquivos, execute o GATE de verificação (STUB/TODO scan + build) e corrija o que falhar.\n`;
  blueprint += `4. UI de alto craft: estética dark \`bg-zinc-950\`, glassmorphism, bento grids, micro-interações, tipografia precisa. Use as referências abaixo como vocabulário.\n\n`;

  blueprint += `### GATE DE VERIFICAÇÃO (execute até passar)\n`;
  blueprint += `1. Stub/TODO scan: procure por \`TODO\`, \`FIXME\`, \`implement later\`, arquivos vazios — se encontrar QUALQUER um, pare e implemente. Só prossiga com ZERO ocorrências.\n`;
  if (archetype) {
    blueprint += `2. Comandos de build (na pasta do projeto):\n\`\`\`\n${archetype.verifySteps.map((c) => '$ ' + c).join('\n')}\n\`\`\`\n`;
  } else {
    blueprint += `2. Instale dependências, gere o schema/migrations e rode o build/typecheck. Mostre o output real de cada comando. Se falhar, corrija e rode de novo até passar.\n`;
  }
  blueprint += `3. Só declare CONCLUÍDO após todos os comandos passarem E todos os arquivos do manifesto existirem com conteúdo real. Anexe o log do build como evidência (evidência > afirmação).\n\n`;

  if (refs) {
    blueprint += `### Referências curadas do framework (consulte antes de implementar UI/stack):\n${refs}\n\n`;
  }

  return { archetype, scope, blueprint };
}
