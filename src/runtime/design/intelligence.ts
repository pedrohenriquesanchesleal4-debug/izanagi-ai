/**
 * Design Intelligence Pipeline & Anti-AI-Slop Visual Quality Engine
 *
 * Resolve a causa raiz de interfaces genéricas ("cara de IA"):
 * 1) Substitui o template único forçado (`bg-zinc-950` + glassmorphism + bento)
 *    por direções visuais BESPOKE derivadas do nicho/marca da tarefa;
 * 2) Define Taste Matrix explícita (densidade, tipografia, paleta semântica,
 *    ritmo de layout, motion e todos os estados de componente);
 * 3) Audita deterministicamente código/artefatos visuais contra tells de AI-slop
 *    (copy clichê, gradiente roxo-azul não solicitado, ausência de estados
 *    interativos, monotonia tipográfica e card soup).
 */

export type DesignNiche =
  | 'editorial-warm'
  | 'clinical-swiss'
  | 'fintech-institutional'
  | 'devtools-oled'
  | 'kinetic-creative'
  | 'ecommerce-atelier'
  | 'modern-product';

export interface DesignDirectionSpec {
  id: string;
  name: string;
  niche: DesignNiche;
  themeMode: 'light-first' | 'dark-first' | 'dual-adaptive';
  rationale: string;
  palette: {
    background: string;
    surface: string;
    textPrimary: string;
    textMuted: string;
    accentPrimary: string;
    accentSecondary: string;
    border: string;
    semantic: {
      success: string;
      warning: string;
      danger: string;
    };
  };
  typography: {
    display: string;
    sans: string;
    mono: string;
    scaleRatio: string;
    rules: string[];
  };
  layout: {
    grid: string;
    spacingBase: string;
    maxWidth: string;
    signaturePattern: string;
  };
  motion: {
    signature: string;
    easing: string;
    duration: string;
    reducedMotionRule: string;
  };
}

export interface TasteMatrix {
  visualDensity: 'airy-editorial' | 'balanced-product' | 'high-density-data';
  motionIntensity: 'restrained-micro' | 'choreographed-scroll' | 'immersive-kinetic';
  contrastProfile: 'warm-organic' | 'crisp-high-contrast' | 'oled-carbon';
  requiredComponentStates: string[];
  antiSlopRules: string[];
}

export interface DesignIntelligencePlan {
  niche: DesignNiche;
  primary: DesignDirectionSpec;
  alternatives: Array<{ id: string; name: string; summary: string }>;
  tasteMatrix: TasteMatrix;
}

export interface VisualQualityFinding {
  rule:
    | 'generic-copy-cliche'
    | 'unjustified-neon-purple-gradient'
    | 'missing-typography-hierarchy'
    | 'missing-interactive-states'
    | 'card-soup-monotony'
    | 'missing-accessibility-semantics';
  severity: 'low' | 'medium' | 'high';
  message: string;
  match?: string;
}

export interface VisualAuditReport {
  passed: boolean;
  score: number;
  tells: VisualQualityFinding[];
  findings: VisualQualityFinding[];
  tasteCompliance: {
    hasIntentionalTypography: boolean;
    hasSemanticTokensOrPalette: boolean;
    hasInteractiveStates: boolean;
    zeroCopyCliches: boolean;
    zeroUnjustifiedPurpleSlop: boolean;
  };
  summary: string;
}

const DIRECTIONS_BY_NICHE: Record<DesignNiche, {
  primary: DesignDirectionSpec;
  alternatives: Array<{ id: string; name: string; summary: string }>;
  taste: Pick<TasteMatrix, 'visualDensity' | 'motionIntensity' | 'contrastProfile'>;
}> = {
  'editorial-warm': {
    primary: {
      id: 'editorial-tactile-warmth',
      name: 'Editorial Tactile Warmth',
      niche: 'editorial-warm',
      themeMode: 'light-first',
      rationale: 'Superfícies orgânicas em tom papel/linho (#FAF6F0), tinta café/carvão (#1C1917) e tipografia serifada editorial combinada com sans humanista.',
      palette: {
        background: '#FAF6F0 (stone-50 / warm alabaster)',
        surface: '#F2ECE1 (warm linen card/section)',
        textPrimary: '#1C1917 (stone-900 / espresso ink)',
        textMuted: '#57534E (stone-600)',
        accentPrimary: '#9A3412 (terracotta / burnt sienna)',
        accentSecondary: '#3F6212 (botanical olive)',
        border: '#E7E0D3 (1px warm hairline)',
        semantic: { success: '#15803D', warning: '#B45309', danger: '#B91C1C' },
      },
      typography: {
        display: 'Instrument Serif / Playfair Display / Fraunces (tracking -0.03em, line-height 1.05)',
        sans: 'Plus Jakarta Sans / DM Sans (body 16px-18px, line-height 1.6)',
        mono: 'JetBrains Mono (origem, lote, preços, metadados)',
        scaleRatio: '1.333 (Perfect Fourth)',
        rules: [
          'Títulos em serif de alto contraste com palavras-chave em itálico editorial',
          'Números de preços, datas e lotes sempre com font-variant-numeric: tabular-nums',
          'Zero uso de Inter puro em títulos',
        ],
      },
      layout: {
        grid: 'Grid editorial assimétrico de 12 colunas com divisores de 1px visíveis e ritmo 60/40',
        spacingBase: '8px base com respiro generoso entre seções (96px–128px)',
        maxWidth: '1360px',
        signaturePattern: 'Split-screen manifesto + vitrine numerada estilo revista impressa (01, 02, 03) sem cards genéricos',
      },
      motion: {
        signature: 'Reveal suave de linha editorial + parallax sutil em fotografia real',
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        duration: '450ms–700ms',
        reducedMotionRule: 'Desativar parallax e manter apenas fade de opacidade 200ms sob prefers-reduced-motion',
      },
    },
    alternatives: [
      { id: 'kinfolk-minimal', name: 'Kinfolk Minimalist Atelier', summary: 'Foco absoluto em fotografia macro, espaço negativo amplo (40%+) e tipografia serifada fina.' },
      { id: 'brutalist-craft', name: 'Artisanal Swiss Grid', summary: 'Bordas expostas de 1px em preto carvão sobre fundo creme, fichas técnicas em monospace.' },
      { id: 'nocturnal-roast', name: 'Nocturnal Espresso Club', summary: 'Modo escuro quente (#14110F) com acentos cobre/âmbar (#D97706) e atmosfera intimista.' },
    ],
    taste: {
      visualDensity: 'airy-editorial',
      motionIntensity: 'choreographed-scroll',
      contrastProfile: 'warm-organic',
    },
  },
  'clinical-swiss': {
    primary: {
      id: 'swiss-clinical-clarity',
      name: 'Swiss Clinical Clarity',
      niche: 'clinical-swiss',
      themeMode: 'light-first',
      rationale: 'Confiança institucional, legibilidade WCAG AAA, superfícies claras de alta luminância e hierarquia neo-grotesca rigorosa.',
      palette: {
        background: '#F8FAFC (slate-50 / clinical white)',
        surface: '#FFFFFF (pure surface com borda 1px #E2E8F0)',
        textPrimary: '#0F172A (slate-900)',
        textMuted: '#475569 (slate-600)',
        accentPrimary: '#0284C7 (medical cobalt / sky-600)',
        accentSecondary: '#0D9488 (clinical teal)',
        border: '#E2E8F0 (slate-200)',
        semantic: { success: '#059669', warning: '#D97706', danger: '#DC2626' },
      },
      typography: {
        display: 'Space Grotesk / Plus Jakarta Sans (tracking -0.025em, semibold)',
        sans: 'Public Sans / Plus Jakarta Sans (alta legibilidade em formulários e prontuários)',
        mono: 'IBM Plex Mono (horários, protocolos, códigos)',
        scaleRatio: '1.250 (Major Third)',
        rules: [
          'Contraste mínimo 7:1 em informações críticas e alertas',
          'Labels sempre visíveis acima dos inputs (nunca placeholder-only)',
        ],
      },
      layout: {
        grid: 'Grid suíço modular de 12 colunas com alinhamento estrito à esquerda',
        spacingBase: '8px base, densidade limpa e escaneável',
        maxWidth: '1280px',
        signaturePattern: 'Painel de triagem direta acima da dobra + indicadores de disponibilidade em tempo real',
      },
      motion: {
        signature: 'Transições funcionais instantâneas de estado e feedback de formulário',
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        duration: '150ms–250ms',
        reducedMotionRule: 'Transições instantâneas sem deslocamento espacial',
      },
    },
    alternatives: [
      { id: 'warm-care-humanist', name: 'Humanist Care & Wellness', summary: 'Tons sálvia e areia (#F4F7F4) com tipografia acolhedora para saúde mental/pediatria.' },
      { id: 'precision-diagnostics', name: 'Precision Lab & Biotech', summary: 'Visual técnico de laboratório com tabelas densas, gráficos de precisão e badges semânticos.' },
    ],
    taste: {
      visualDensity: 'balanced-product',
      motionIntensity: 'restrained-micro',
      contrastProfile: 'crisp-high-contrast',
    },
  },
  'fintech-institutional': {
    primary: {
      id: 'institutional-precision-ledger',
      name: 'Institutional Precision & Data Density',
      niche: 'fintech-institutional',
      themeMode: 'dual-adaptive',
      rationale: 'Precisão contábil inspirada em Stripe/Ramp/Mercury: tipografia tabular rigorosa, bordas hairline de 1px e hierarquia de dados sem distração.',
      palette: {
        background: '#F9FAFB (light ledger) / #0A0D12 (dark institutional)',
        surface: '#FFFFFF / #11161F',
        textPrimary: '#0B0F19 / #F3F4F6',
        textMuted: '#4B5563 / #9CA3AF',
        accentPrimary: '#0F766E (emerald-teal institucional) ou #1D4ED8 (sovereign blue)',
        accentSecondary: '#B45309 (amber alert/reconciliation)',
        border: '#E5E7EB / #1F2937 (1px crisp hairline)',
        semantic: { success: '#10B981', warning: '#F59E0B', danger: '#EF4444' },
      },
      typography: {
        display: 'General Sans / Geist / Plus Jakarta Sans (tracking -0.02em)',
        sans: 'Geist / Plus Jakarta Sans (14px–16px para densidade operacional)',
        mono: 'Geist Mono / JetBrains Mono (valores monetários, CNPJ/CPF, hashes, IDs)',
        scaleRatio: '1.200 (Minor Third — otimizado para dashboards densos)',
        rules: [
          'Obrigatório tabular-nums em todas as colunas financeiras, KPIs e gráficos',
          'Raios de borda contidos (6px–8px): proibido rounded-3xl infantilizado em tabelas financeiras',
        ],
      },
      layout: {
        grid: 'Shell operacional com sidebar colapsável (240px), command bar superior e área de dados full-bleed',
        spacingBase: '4px/8px (alta densidade escaneável)',
        maxWidth: '1440px',
        signaturePattern: 'Ledger table com filtros rápidos, conciliação inline, KPIs com sparklines e trilha de auditoria',
      },
      motion: {
        signature: 'Number transitions suaves e feedback otimista em mutações de tabela',
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        duration: '150ms–220ms',
        reducedMotionRule: 'Atualização numérica direta sem interpolação de contagem',
      },
    },
    alternatives: [
      { id: 'sovereign-wealth', name: 'Sovereign Private Banking', summary: 'Estética editorial financeira (Financial Times / Stripe Press) com serif autoritativa e papel marfim.' },
      { id: 'quant-terminal', name: 'High-Frequency Quant Terminal', summary: 'Modo escuro de alto contraste (#07090E) com foco em séries temporais, latência zero e atalhos de teclado.' },
    ],
    taste: {
      visualDensity: 'high-density-data',
      motionIntensity: 'restrained-micro',
      contrastProfile: 'crisp-high-contrast',
    },
  },
  'devtools-oled': {
    primary: {
      id: 'oled-technical-precision',
      name: 'OLED Technical Precision',
      niche: 'devtools-oled',
      themeMode: 'dark-first',
      rationale: 'Inspirado em Linear, Raycast e Vercel: superfície carbono (#09090B), divisórias de 1px (#27272A), tipografia monospace de primeira classe e UX orientada a teclado.',
      palette: {
        background: '#09090B (zinc-950 carbon)',
        surface: '#121215 (elevated surface com 1px #27272A)',
        textPrimary: '#FAFAFA (zinc-50)',
        textMuted: '#A1A1AA (zinc-400)',
        accentPrimary: '#10B981 (signal emerald) ou #38BDF8 (terminal cyan)',
        accentSecondary: '#F59E0B (build amber)',
        border: '#27272A (zinc-800 hairline)',
        semantic: { success: '#22C55E', warning: '#EAB308', danger: '#F43F5E' },
      },
      typography: {
        display: 'Geist / Space Grotesk (tracking -0.03em)',
        sans: 'Geist / IBM Plex Sans',
        mono: 'JetBrains Mono / Geist Mono (logs, diffs, comandos, telemetria)',
        scaleRatio: '1.250 (Major Third)',
        rules: [
          'Atalhos de teclado visíveis em <kbd> estilizados',
          'Blocos de código/terminal reais com syntax highlighting e botão de cópia funcional',
        ],
      },
      layout: {
        grid: 'Grid técnico com células de 1px expostas (hairline grid) e command palette (Cmd+K)',
        spacingBase: '4px/8px',
        maxWidth: '1320px',
        signaturePattern: 'Demonstração interativa de produto / terminal ao vivo acima da dobra em vez de ilustração abstrata',
      },
      motion: {
        signature: 'Micro-transições de 120ms–180ms com física spring seca',
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        duration: '120ms–200ms',
        reducedMotionRule: 'Sem animações decorativas de background; foco instantâneo',
      },
    },
    alternatives: [
      { id: 'industrial-spec', name: 'Industrial Spec Sheet (Teenage Engineering)', summary: 'Fundo cinza técnico claro (#E5E5E0), acento laranja internacional (#FF4F00) e estética de manual de hardware.' },
      { id: 'amber-phosphor', name: 'Retro-Futurist Telemetry', summary: 'Contraste carbono com âmbar técnico (#F59E0B) e diagramas de arquitetura em ASCII/SVG.' },
    ],
    taste: {
      visualDensity: 'high-density-data',
      motionIntensity: 'restrained-micro',
      contrastProfile: 'oled-carbon',
    },
  },
  'kinetic-creative': {
    primary: {
      id: 'choreographed-kinetic-canvas',
      name: 'Choreographed Kinetic Canvas',
      niche: 'kinetic-creative',
      themeMode: 'dark-first',
      rationale: 'Direção de arte Awwwards SOTD com tipografia monumental, scrollytelling coreografado e contraste dramático.',
      palette: {
        background: '#0B0B0E (deep obsidian)',
        surface: '#141419',
        textPrimary: '#F5F5F0 (warm bone white)',
        textMuted: '#8E8E99',
        accentPrimary: '#E11D48 (crimson signal) ou #D9F99D (acid lime)',
        accentSecondary: '#38BDF8',
        border: 'rgba(245, 245, 240, 0.12)',
        semantic: { success: '#22C55E', warning: '#F59E0B', danger: '#EF4444' },
      },
      typography: {
        display: 'Syne / Clash Display / Instrument Serif (clamp(2.75rem, 6vw, 6.5rem), line-height 0.95)',
        sans: 'Plus Jakarta Sans /General Sans',
        mono: 'Space Mono (índices de cena, timecodes, coordenadas)',
        scaleRatio: '1.414 (Augmented Fourth)',
        rules: [
          'Contraste extremo de escala entre títulos display e metadados técnicos (12px uppercase tracking 0.12em)',
        ],
      },
      layout: {
        grid: 'Composição editorial assimétrica com seções pinned e capítulos numerados',
        spacingBase: '8px',
        maxWidth: '1440px',
        signaturePattern: 'Scroll-driven storytelling com progressão narrativa e capítulos visuais',
      },
      motion: {
        signature: 'Timeline coreografada no scroll + reveal tipográfico por linha',
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        duration: '500ms–900ms',
        reducedMotionRule: 'Fallback estático editorial completo quando prefers-reduced-motion: reduce estiver ativo',
      },
    },
    alternatives: [
      { id: 'monochrome-gallery', name: 'Monochrome Exhibition Gallery', summary: 'Fundo branco museu (#FAFAFA), tipografia suíça gigante e transições de corte seco.' },
    ],
    taste: {
      visualDensity: 'airy-editorial',
      motionIntensity: 'immersive-kinetic',
      contrastProfile: 'oled-carbon',
    },
  },
  'ecommerce-atelier': {
    primary: {
      id: 'atelier-commerce-grid',
      name: 'Atelier Commerce & Tactile Grid',
      niche: 'ecommerce-atelier',
      themeMode: 'light-first',
      rationale: 'Vitrine de alta conversão onde o produto físico/digital é o herói: fundo neutro quente, fotografia grande, especificações claras e checkout sem atrito.',
      palette: {
        background: '#FCFBF9',
        surface: '#F4F1EA',
        textPrimary: '#141413',
        textMuted: '#5C5A55',
        accentPrimary: '#141413 (ink black CTA) + #B45309 (warm highlight)',
        accentSecondary: '#15803D (in-stock badge)',
        border: '#E6E2D8',
        semantic: { success: '#15803D', warning: '#B45309', danger: '#B91C1C' },
      },
      typography: {
        display: 'Instrument Serif / Fraunces / Plus Jakarta Sans',
        sans: 'Plus Jakarta Sans / DM Sans',
        mono: 'JetBrains Mono (SKU, preços, dimensões, frete)',
        scaleRatio: '1.250',
        rules: [
          'Preços, descontos e totais do carrinho sempre em tabular-nums',
          'CTAs de compra com estado de loading, confirmação otimista e resumo claro de frete/impostos',
        ],
      },
      layout: {
        grid: 'Grid de catálogo 3/4 colunas com filtros facetados + drawer de carrinho persistente',
        spacingBase: '8px',
        maxWidth: '1400px',
        signaturePattern: 'Product card com troca sutil de imagem no hover, seletor rápido de variante e barra de progresso de frete grátis',
      },
      motion: {
        signature: 'Drawer slide-over suave e feedback imediato de adição à sacola',
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        duration: '250ms–350ms',
        reducedMotionRule: 'Abertura direta do drawer sem animação de escala',
      },
    },
    alternatives: [
      { id: 'streetwear-drop', name: 'High-Contrast Editorial Drop', summary: 'Grid brutalista com bordas pretas de 1px, countdown tabular e tipografia condensada.' },
    ],
    taste: {
      visualDensity: 'balanced-product',
      motionIntensity: 'restrained-micro',
      contrastProfile: 'warm-organic',
    },
  },
  'modern-product': {
    primary: {
      id: 'high-craft-product-system',
      name: 'High-Craft Product System',
      niche: 'modern-product',
      themeMode: 'dual-adaptive',
      rationale: 'Design system de produto B2B/SaaS contemporâneo: hierarquia tipográfica intencional, superfícies em camadas sutis, estados completos e zero clichês de IA.',
      palette: {
        background: '#FAFAFA (light) / #0C0D10 (dark)',
        surface: '#FFFFFF / #14161B',
        textPrimary: '#111827 / #F9FAFB',
        textMuted: '#4B5563 / #9CA3AF',
        accentPrimary: '#2563EB (royal cobalt) ou #0D9488 (teal)',
        accentSecondary: '#D97706',
        border: '#E5E7EB / #262932',
        semantic: { success: '#16A34A', warning: '#D97706', danger: '#DC2626' },
      },
      typography: {
        display: 'Plus Jakarta Sans / Space Grotesk (tracking -0.025em)',
        sans: 'Plus Jakarta Sans / Geist',
        mono: 'JetBrains Mono (métricas, IDs, atalhos)',
        scaleRatio: '1.250',
        rules: [
          'Combinar pelo menos duas famílias (Display/Sans + Mono para dados) com pesos contrastantes',
          'Evitar textos genéricos ("Build the future"); usar microcopy específica do domínio da tarefa',
        ],
      },
      layout: {
        grid: 'Grid assimétrico na landing (hero com preview interativo real) + layout de aplicação estruturado no dashboard',
        spacingBase: '8px',
        maxWidth: '1320px',
        signaturePattern: 'Hero com artefato funcional interativo do próprio produto + seções com ritmo visual variado (nunca 3 cards iguais repetidos)',
      },
      motion: {
        signature: 'Transições de estado orientadas a propósito (150ms–280ms)',
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        duration: '150ms–280ms',
        reducedMotionRule: 'Respeitar prefers-reduced-motion em todas as animações',
      },
    },
    alternatives: [
      { id: 'editorial-saas', name: 'Editorial Knowledge Workspace (Notion/Craft)', summary: 'Superfície papel claro, ícones monocromáticos precisos e tipografia editorial para colaboração.' },
      { id: 'oled-precision-saas', name: 'OLED Command Center (Linear/Raycast)', summary: 'Modo escuro carbono com bordas 1px, command bar Cmd+K e alta densidade de informação.' },
    ],
    taste: {
      visualDensity: 'balanced-product',
      motionIntensity: 'restrained-micro',
      contrastProfile: 'crisp-high-contrast',
    },
  },
};

const REQUIRED_COMPONENT_STATES = [
  'default (repouso com hierarquia clara)',
  'hover (feedback visual sutil em elementos clicáveis)',
  'focus-visible (anel de foco acessível para navegação por teclado WCAG 2.2 AA)',
  'active / pressed (resposta tátil imediata)',
  'disabled (opacidade/contraste semântico e cursor-not-allowed)',
  'loading / skeleton (estado de carregamento realista sem bloquear a tela inteira)',
  'empty-state (orientação acionável com CTA quando listas/tabelas estão vazias)',
  'error-inline (mensagem específica junto ao campo/ação com instrução de recuperação)',
];

const ANTI_SLOP_RULES = [
  'PROIBIDO impor bg-zinc-950 + glassmorphism + bento grid quando o nicho pede superfície clara, editorial ou institucional.',
  'PROIBIDO gradiente roxo-azul/indigo-pink genérico (from-purple-* to-blue-*/indigo-*) sem justificativa explícita da marca.',
  'PROIBIDO usar apenas a fonte Inter default sem par tipográfico (Display/Serif + Sans + Mono tabular).',
  'PROIBIDO layout "Hero centralizado genérico + 3 cards idênticos com ícone em círculo" repetido pela página.',
  'PROIBIDO copy clichê de IA ("Build the future", "Elevate your business", "Unleash the power", "Seamless integration", "Lorem ipsum").',
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Infere a direção de design bespoke mais adequada ao domínio/nicho do pedido,
 * evitando a monocultura de template único.
 */
export function inferDesignDirection(task: string): DesignIntelligencePlan {
  const t = normalize(task);

  let niche: DesignNiche = 'modern-product';
  if (/\b(ecommerce|e-commerce|loja|catalogo|carrinho|checkout|produto fisico|varejo|vitrine)\b/.test(t)) {
    niche = 'ecommerce-atelier';
  } else if (/\b(fintech|financeir\w*|financ\w*|banc\w*|pagament\w*|pix|tesouraria|billing|cobranc\w*|faturament\w*|nota fiscal|nfse|contabil\w*|investiment\w*|ledger|erp|folha)\b/.test(t)) {
    niche = 'fintech-institutional';
  } else if (/\b(clinica\w*|medic\w*|saude|hospital\w*|odonto\w*|psicolog\w*|terapia|laboratori\w*|pacient\w*|prontuario|juridic\w*|advocacia|educac\w*|escola\w*|universidade\w*)\b/.test(t)) {
    niche = 'clinical-swiss';
  } else if (/\b(3d|webgl|threejs|shader\w*|scrollytelling|cinema|filme\w*|festival|game\w*|estudio criativo|agencia criativa|musica|arte)\b/.test(t)) {
    niche = 'kinetic-creative';
  } else if (/\b(devtools|cli|terminal|ide|observabil\w*|telemetry|telemetria|monitorament\w*|infra|kubernetes|docker|cybersecurity|seguranca|api|sdk|llm|agent\w*|codigo|developer)\b/.test(t)) {
    niche = 'devtools-oled';
  } else if (/\b(cafeteria\w*|cafe\w*|coffee|restaurante\w*|gastronomia|padaria\w*|vinho\w*|cervejaria\w*|hotel|pousada|arquitetura|interiores|moda|atelier|joalheria|revista|editorial|artesanal|torrefacao|floricultura|livro\w*|livraria)\b/.test(t)) {
    niche = 'editorial-warm';
  }

  const entry = DIRECTIONS_BY_NICHE[niche];
  return {
    niche,
    primary: entry.primary,
    alternatives: entry.alternatives,
    tasteMatrix: {
      ...entry.taste,
      requiredComponentStates: REQUIRED_COMPONENT_STATES,
      antiSlopRules: ANTI_SLOP_RULES,
    },
  };
}

/**
 * Renderiza o bloco de Design Intelligence para injeção em prompts de nós
 * visuais (`frontend`, `fullstack`, `design-direction`, `design-system`).
 */
export function renderDesignIntelligenceBlock(task: string): string {
  const plan = inferDesignDirection(task);
  const p = plan.primary;
  const altLines = plan.alternatives
    .map((a) => `  - **${a.name}** (\`${a.id}\`): ${a.summary}`)
    .join('\n');

  return [
    `## 🎨 DESIGN INTELLIGENCE & ANTI-AI-SLOP PIPELINE (Nicho detectado: \`${plan.niche}\`)`,
    ``,
    `### 1. Direção Visual Recomendada: **${p.name}** (\`${p.themeMode}\`)`,
    `- **Racional da Marca:** ${p.rationale}`,
    `- **Paleta Semântica:**`,
    `  - Background: \`${p.palette.background}\` · Surface: \`${p.palette.surface}\``,
    `  - Texto Primário: \`${p.palette.textPrimary}\` · Texto Secundário: \`${p.palette.textMuted}\``,
    `  - Accent Primário: \`${p.palette.accentPrimary}\` · Accent Secundário: \`${p.palette.accentSecondary}\``,
    `  - Border/Hairline: \`${p.palette.border}\``,
    `- **Sistema Tipográfico (Escala ${p.typography.scaleRatio}):**`,
    `  - Display/Headings: ${p.typography.display}`,
    `  - Body/UI Sans: ${p.typography.sans}`,
    `  - Data/Mono: ${p.typography.mono}`,
    `  - Regras: ${p.typography.rules.join(' · ')}`,
    `- **Arquitetura de Layout & Espaçamento:**`,
    `  - Grid: ${p.layout.grid} (Max-width: ${p.layout.maxWidth}, Base: ${p.layout.spacingBase})`,
    `  - Assinatura Visual: ${p.layout.signaturePattern}`,
    `- **Motion & Acessibilidade:**`,
    `  - Assinatura: ${p.motion.signature} (${p.motion.duration}, \`${p.motion.easing}\`)`,
    `  - Reduced Motion: ${p.motion.reducedMotionRule}`,
    ``,
    `### 2. Direções Alternativas do Nicho (se mais aderentes à marca):`,
    altLines,
    ``,
    `### 3. Taste Matrix & Estados Obrigatórios de Componentes`,
    `- **Perfil:** Densidade \`${plan.tasteMatrix.visualDensity}\` · Motion \`${plan.tasteMatrix.motionIntensity}\` · Contraste \`${plan.tasteMatrix.contrastProfile}\``,
    `- **Estados obrigatórios em telas/componentes interativos:** ${plan.tasteMatrix.requiredComponentStates.join('; ')}.`,
    ``,
    `### 4. Regras Duras Anti-AI-Slop (Verificadas Automaticamente)`,
    ...plan.tasteMatrix.antiSlopRules.map((r) => `- ${r}`),
    ``,
  ].join('\n');
}

const AI_COPY_CLICHE_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bbuild the future\b/i, label: 'Build the future' },
  { re: /\belevate your business\b/i, label: 'Elevate your business' },
  { re: /\bunleash the power\b/i, label: 'Unleash the power' },
  { re: /\bsupercharge your workflow\b/i, label: 'Supercharge your workflow' },
  { re: /\bseamless integration\b/i, label: 'Seamless integration' },
  { re: /\btransform the way you\b/i, label: 'Transform the way you' },
  { re: /\brevolutionize your\b/i, label: 'Revolutionize your' },
  { re: /\bnext-generation platform\b/i, label: 'Next-generation platform' },
  { re: /\blorem ipsum\b/i, label: 'Lorem ipsum' },
];

const PURPLE_SLOP_GRADIENT_PATTERNS: RegExp[] = [
  /from-purple-\d{3}\s+(?:via-[a-z]+-\d{3}\s+)?to-(?:blue|indigo|pink|violet)-\d{3}/i,
  /from-indigo-\d{3}\s+(?:via-purple-\d{3}\s+)?to-(?:purple|pink|violet)-\d{3}/i,
  /linear-gradient\([^)]*(?:#8b5cf6|#9333ea|#7c3aed)[^)]*(?:#3b82f6|#ec4899|#6366f1)/i,
];

/**
 * Audita deterministicamente código/artefato visual contra os tells de AI-Slop
 * e verifica a presença de decisões intencionais de design.
 */
export function auditVisualQuality(
  content: unknown,
  opts: { task?: string; allowPurpleBrand?: boolean } = {},
): VisualAuditReport {
  const text = typeof content === 'string' ? content : JSON.stringify(content ?? '');
  const tells: VisualQualityFinding[] = [];
  const allowPurple =
    opts.allowPurpleBrand || /\b(roxo|purple|violet|lilac|lilas)\b/i.test(opts.task ?? '');

  // 1. Copy clichés de IA
  for (const c of AI_COPY_CLICHE_PATTERNS) {
    if (c.re.test(text)) {
      tells.push({
        rule: 'generic-copy-cliche',
        severity: 'high',
        message: `Copy clichê de IA detectada: "${c.label}" — substitua por proposta de valor específica do domínio.`,
        match: c.label,
      });
    }
  }

  // 2. Gradiente roxo-azul/rosa genérico não solicitado
  if (!allowPurple) {
    for (const re of PURPLE_SLOP_GRADIENT_PATTERNS) {
      const m = text.match(re);
      if (m) {
        tells.push({
          rule: 'unjustified-neon-purple-gradient',
          severity: 'high',
          message: `Gradiente neon roxo-azul/rosa genérico de IA detectado ("${m[0]}") sem justificativa da marca.`,
          match: m[0],
        });
        break;
      }
    }
  }

  // 3. Monotonia tipográfica (quando o artefato contém código HTML/JSX/CSS)
  const looksLikeMarkupOrStyle = /<[a-zA-Z]|className=|font-family|--font-|tailwind/i.test(text);
  const hasIntentionalTypography =
    /font-(?:serif|mono|display)|--font-|tracking-|leading-|tabular-nums|Playfair|Fraunces|Instrument|Space\s*Grotesk|Plus\s*Jakarta|Geist|JetBrains|Syne|IBM\s*Plex/i.test(
      text,
    ) || /typography|tipografia|font-family/i.test(text);

  if (looksLikeMarkupOrStyle && !hasIntentionalTypography && /\bInter\b/i.test(text)) {
    tells.push({
      rule: 'missing-typography-hierarchy',
      severity: 'medium',
      message: 'Uso exclusivo de Inter sem par tipográfico (Display/Serif/Mono) nem ajustes de tracking/leading/tabular-nums.',
      match: 'Inter',
    });
  }

  // 4. Estados interativos e acessibilidade em código de componente
  const hasInteractiveMarkup = /<(?:button|input|select|textarea|form)\b/i.test(text);
  const hasInteractiveStates =
    /hover:|focus:|focus-visible:|disabled:|aria-|role=|:hover|:focus-visible/i.test(text) ||
    !hasInteractiveMarkup;

  if (hasInteractiveMarkup && !hasInteractiveStates) {
    tells.push({
      rule: 'missing-interactive-states',
      severity: 'medium',
      message: 'Elementos interativos (<button>, <input>, <form>) sem estados hover/focus-visible/disabled ou atributos ARIA.',
    });
  }

  // 5. Card soup (excesso de rounded-2xl shadow-lg idênticos)
  const cardMatches = text.match(/rounded-2xl[^"\n]*shadow-(?:lg|xl)/g) ?? [];
  if (cardMatches.length >= 4) {
    tells.push({
      rule: 'card-soup-monotony',
      severity: 'medium',
      message: `Repetição monótona de cards idênticos (${cardMatches.length}x "rounded-2xl shadow-lg/xl") — diversifique a composição com grid editorial, tabelas ou seções assimétricas.`,
    });
  }

  const hasSemanticTokensOrPalette =
    /#[0-9a-fA-F]{3,6}|--(bg|surface|text|accent|color)-|bg-(?:stone|slate|zinc|neutral|amber|emerald|sky|teal)-\d{2,3}|palette|paleta|tokens/i.test(
      text,
    );

  const zeroCopyCliches = !tells.some((t) => t.rule === 'generic-copy-cliche');
  const zeroUnjustifiedPurpleSlop = !tells.some((t) => t.rule === 'unjustified-neon-purple-gradient');

  const highCount = tells.filter((t) => t.severity === 'high').length;
  const mediumCount = tells.filter((t) => t.severity === 'medium').length;
  const penalty = highCount * 0.3 + mediumCount * 0.15;
  const score = Math.max(0, Math.min(1, Number((1 - penalty).toFixed(2))));
  const passed = highCount === 0 && score >= 0.7;

  return {
    passed,
    score,
    tells,
    findings: tells,
    tasteCompliance: {
      hasIntentionalTypography,
      hasSemanticTokensOrPalette,
      hasInteractiveStates,
      zeroCopyCliches,
      zeroUnjustifiedPurpleSlop,
    },
    summary: passed
      ? `Auditoria visual APROVADA (score ${score.toFixed(2)}, ${tells.length} alerta(s)).`
      : `Auditoria visual REPROVADA (score ${score.toFixed(2)}): ${tells.map((t) => t.message).join(' | ')}`,
  };
}
