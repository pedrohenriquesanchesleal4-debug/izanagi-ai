/**
 * Detecção de domínio técnico a partir de texto livre.
 *
 * Módulo próprio (e não dentro do Commander) porque duas partes precisam da
 * MESMA definição de domínio: o Commander, para classificar o objetivo, e o
 * Agent Capability Registry, para saber que domínios um agente cobre. Sem uma
 * fonte única, um agente descrito em inglês ("Architecture") nunca casaria com
 * um objetivo escrito em português ("arquitetura"), e o capability matching
 * devolveria vazio justamente nos casos mais óbvios.
 *
 * Os padrões são bilíngues de propósito: o framework é usado em pt-BR mas as
 * descrições de agentes e skills misturam termos técnicos em inglês.
 */

export type Domain =
  | 'frontend' | 'backend' | 'database' | 'security' | 'devops'
  | 'testing' | 'research' | 'debugging' | 'architecture' | 'automation' | 'docs';

export const DOMAINS: Domain[] = [
  'frontend', 'backend', 'database', 'security', 'devops',
  'testing', 'research', 'debugging', 'architecture', 'automation', 'docs',
];

export const DOMAIN_SIGNALS: Array<[Domain, RegExp]> = [
  ['frontend', /frontend|front-end|react|next\.?js|componente|component|\bcss\b|tailwind|\bui\b|ux|landing|dashboard|animation|anima|webgl|scroll|design system/i],
  ['backend', /backend|back-end|\bapi\b|endpoint|\brest\b|graphql|servidor|server|microservi|fila|queue|webhook|node|laravel/i],
  ['database', /database|banco de dados|\bsql\b|postgres|mysql|mongo|redis|schema|migration|migra|prisma|drizzle|índice|indice|\borm\b|modelagem de dados/i],
  ['security', /secur|seguran|owasp|vulnerab|\bauth\b|authentication|autenticac|\bjwt\b|oauth|cripto|crypt|lgpd|gdpr|pentest|secret|hardening/i],
  ['devops', /devops|docker|kubernetes|k8s|ci\/cd|pipeline|deploy|terraform|infra|observab|monitor|iac\b/i],
  ['testing', /\btest|teste|\bqa\b|quality assurance|cobertura|coverage|playwright|vitest|jest|pytest|e2e/i],
  ['research', /pesquis|research|comparar|concorrent|estado da arte|referênc|referenc|evidênc|evidenc|benchmark de mercado/i],
  ['debugging', /\bbug\b|crash|stack.?trace|exception|\berro\b|\berror\b|debug|root cause|causa raiz|falha intermitente|regress/i],
  ['architecture', /arquitet|architect|clean architecture|\bddd\b|domain-driven|cqrs|hexagonal|\badr\b|monólito|monolito|design de sistema|system design|trade-off/i],
  ['automation', /automa|automatiz|scrap|\betl\b|planilha|spreadsheet|robô|robo|em massa|selenium|orquestr/i],
  ['docs', /document|readme|guia|tutorial|changelog|diátaxis|diataxis|technical writing/i],
];

/** Domínios detectados no texto, na ordem canônica de DOMAIN_SIGNALS. */
export function detectDomains(text: string): Domain[] {
  const found: Domain[] = [];
  for (const [domain, re] of DOMAIN_SIGNALS) {
    if (re.test(text)) found.push(domain);
  }
  return found;
}

/** Fração de domínios do objetivo cobertos pelo candidato, em [0,1]. */
export function domainOverlap(objectiveDomains: Domain[], candidateDomains: Domain[]): number {
  if (objectiveDomains.length === 0) return 0;
  const set = new Set(candidateDomains);
  const hits = objectiveDomains.filter((d) => set.has(d)).length;
  return hits / objectiveDomains.length;
}
