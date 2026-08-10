#!/usr/bin/env node
/**
 * UI/UX Pro Max — Node.js port do motor de busca local (BM25)
 * ------------------------------------------------------------
 * Port fiel do pacote ui-ux-pro-max-skill (MIT, 115k★) — zero dependências
 * externas, 100% offline, dados do projeto nunca saem da máquina.
 *
 * Uso:
 *   node search.mjs "<query>"                          # auto-detecta domínio
 *   node search.mjs "<query>" --domain <domain>        # busca num domínio
 *   node search.mjs "<query>" --stack <stack>          # guidelines por stack
 *   node search.mjs "<query>" --design-system          # design system completo
 *     [-p "Projeto"] [-f markdown|ascii] [--json]
 *     [--variance 1-10] [--motion 1-10] [--density 1-10]
 *     [--persist --page "dashboard" --output-dir <dir> --force]
 *
 * Domínios: style, color, chart, landing, product, ux, typography, icons,
 *           gsap, react, web, google-fonts
 * Stacks:   react, nextjs, vue, svelte, astro, nuxtjs, nuxt-ui, angular,
 *           laravel, swiftui, react-native, flutter, jetpack-compose,
 *           html-tailwind, shadcn, threejs, javafx, wpf, winui, avalonia,
 *           uno, uwp
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const MAX_RESULTS = 3;
const TRUNCATE_AT = 300;

// ============ CONFIGURAÇÃO (equivalente ao core.py) ============
const CSV_CONFIG = {
  style: {
    file: 'styles.csv',
    search_cols: ['Style Category', 'Keywords', 'Best For', 'Type', 'AI Prompt Keywords'],
    output_cols: ['Style Category', 'Type', 'Keywords', 'Primary Colors', 'Effects & Animation', 'Best For', 'Light Mode ✓', 'Dark Mode ✓', 'Performance', 'Accessibility', 'Framework Compatibility', 'Complexity', 'AI Prompt Keywords', 'CSS/Technical Keywords', 'Implementation Checklist', 'Design System Variables'],
  },
  color: {
    file: 'colors.csv',
    search_cols: ['Product Type', 'Notes'],
    output_cols: ['Product Type', 'Primary', 'On Primary', 'Secondary', 'On Secondary', 'Accent', 'On Accent', 'Background', 'Foreground', 'Card', 'Card Foreground', 'Muted', 'Muted Foreground', 'Border', 'Destructive', 'On Destructive', 'Ring', 'Notes'],
  },
  chart: {
    file: 'charts.csv',
    search_cols: ['Data Type', 'Keywords', 'Best Chart Type', 'When to Use', 'When NOT to Use', 'Accessibility Notes'],
    output_cols: ['Data Type', 'Keywords', 'Best Chart Type', 'Secondary Options', 'When to Use', 'When NOT to Use', 'Data Volume Threshold', 'Color Guidance', 'Accessibility Grade', 'Accessibility Notes', 'A11y Fallback', 'Library Recommendation', 'Interactive Level'],
  },
  landing: {
    file: 'landing.csv',
    search_cols: ['Pattern Name', 'Keywords', 'Conversion Optimization', 'Section Order'],
    output_cols: ['Pattern Name', 'Keywords', 'Section Order', 'Primary CTA Placement', 'Color Strategy', 'Conversion Optimization'],
  },
  product: {
    file: 'products.csv',
    search_cols: ['Product Type', 'Keywords', 'Primary Style Recommendation', 'Key Considerations'],
    output_cols: ['Product Type', 'Keywords', 'Primary Style Recommendation', 'Secondary Styles', 'Landing Page Pattern', 'Dashboard Style (if applicable)', 'Color Palette Focus'],
  },
  ux: {
    file: 'ux-guidelines.csv',
    search_cols: ['Category', 'Issue', 'Description', 'Platform'],
    output_cols: ['Category', 'Issue', 'Platform', 'Description', 'Do', "Don't", 'Code Example Good', 'Code Example Bad', 'Severity'],
  },
  typography: {
    file: 'typography.csv',
    search_cols: ['Font Pairing Name', 'Category', 'Mood/Style Keywords', 'Best For', 'Heading Font', 'Body Font'],
    output_cols: ['Font Pairing Name', 'Category', 'Heading Font', 'Body Font', 'Mood/Style Keywords', 'Best For', 'Google Fonts URL', 'CSS Import', 'Tailwind Config', 'Notes'],
  },
  icons: {
    file: 'icons.csv',
    search_cols: ['Category', 'Icon Name', 'Keywords', 'Best For'],
    output_cols: ['Category', 'Icon Name', 'Keywords', 'Library', 'Import Code', 'Usage', 'Best For', 'Style'],
  },
  gsap: {
    file: 'motion.csv',
    search_cols: ['Category', 'Intensity Tier', 'Keywords', 'Trigger'],
    output_cols: ['Category', 'Intensity Tier', 'Trigger', 'Duration', 'Easing', 'GSAP Snippet', 'Framework Notes', 'Do', "Don't", 'Performance Notes'],
  },
  react: {
    file: 'react-performance.csv',
    search_cols: ['Category', 'Issue', 'Keywords', 'Description'],
    output_cols: ['Category', 'Issue', 'Platform', 'Description', 'Do', "Don't", 'Code Example Good', 'Code Example Bad', 'Severity'],
  },
  web: {
    file: 'app-interface.csv',
    search_cols: ['Category', 'Issue', 'Keywords', 'Description'],
    output_cols: ['Category', 'Issue', 'Platform', 'Description', 'Do', "Don't", 'Code Example Good', 'Code Example Bad', 'Severity'],
  },
  'google-fonts': {
    file: 'google-fonts.csv',
    search_cols: ['Family', 'Category', 'Stroke', 'Classifications', 'Keywords', 'Subsets', 'Designers'],
    output_cols: ['Family', 'Category', 'Stroke', 'Classifications', 'Styles', 'Variable Axes', 'Subsets', 'Designers', 'Popularity Rank', 'Google Fonts URL'],
  },
};

const UNTRUNCATED_COLS = new Set([
  'Code Example Good', 'Code Example Bad', 'Code Good', 'Code Bad',
  'Implementation Checklist', 'Design System Variables', 'CSS Import',
  'Tailwind Config', 'GSAP Snippet',
]);

const STACK_CONFIG = {
  react: { file: 'stacks/react.csv' }, nextjs: { file: 'stacks/nextjs.csv' },
  vue: { file: 'stacks/vue.csv' }, svelte: { file: 'stacks/svelte.csv' },
  astro: { file: 'stacks/astro.csv' }, swiftui: { file: 'stacks/swiftui.csv' },
  'react-native': { file: 'stacks/react-native.csv' }, flutter: { file: 'stacks/flutter.csv' },
  nuxtjs: { file: 'stacks/nuxtjs.csv' }, 'nuxt-ui': { file: 'stacks/nuxt-ui.csv' },
  'html-tailwind': { file: 'stacks/html-tailwind.csv' }, shadcn: { file: 'stacks/shadcn.csv' },
  'jetpack-compose': { file: 'stacks/jetpack-compose.csv' }, threejs: { file: 'stacks/threejs.csv' },
  angular: { file: 'stacks/angular.csv' }, laravel: { file: 'stacks/laravel.csv' },
  javafx: { file: 'stacks/javafx.csv' }, wpf: { file: 'stacks/wpf.csv' },
  winui: { file: 'stacks/winui.csv' }, avalonia: { file: 'stacks/avalonia.csv' },
  uno: { file: 'stacks/uno.csv' }, uwp: { file: 'stacks/uwp.csv' },
};

const STACK_SEARCH_COLS = ['Category', 'Guideline', 'Description', 'Do', "Don't"];
const STACK_OUTPUT_COLS = ['Category', 'Guideline', 'Description', 'Do', "Don't", 'Code Good', 'Code Bad', 'Severity', 'Docs URL'];

const _STOPWORDS = new Set([
  'to', 'in', 'on', 'at', 'is', 'of', 'by', 'or', 'an', 'if', 'no', 'so',
  'do', 'be', 'we', 'it', 'as', 'the', 'and', 'for', 'are', 'was',
]);

const _SYNONYMS = {
  'e-commerce': 'ecommerce', 'dark-mode': 'dark', darkmode: 'dark',
  'light-mode': 'light', lightmode: 'light', a11y: 'accessibility',
  nav: 'navigation', 'sign-up': 'signup', 'log-in': 'login',
  colour: 'color', colours: 'colors', customisation: 'customization',
  organisation: 'organization', behaviour: 'behavior', 'ux/ui': 'ux ui',
};

// ============ TOKENIZAÇÃO / BM25 ============
function normalize(text) {
  for (const [variant, canonical] of Object.entries(_SYNONYMS)) {
    text = text.split(variant).join(canonical);
  }
  return text;
}

function tokenize(text) {
  text = normalize(String(text).toLowerCase());
  text = text.replace(/[^\p{L}\p{N}\s]/gu, ' ');
  return text.split(/\s+/).filter((w) => w.length >= 2 && !_STOPWORDS.has(w));
}

class BM25 {
  constructor(k1 = 1.5, b = 0.75) {
    this.k1 = k1;
    this.b = b;
    this.corpus = [];
    this.docLengths = [];
    this.avgdl = 0;
    this.idf = {};
    this.docFreqs = new Map();
    this.N = 0;
    this.termFreqs = [];
  }

  fit(documents) {
    this.corpus = documents.map((d) => tokenize(d));
    this.N = this.corpus.length;
    if (this.N === 0) return;
    this.docLengths = this.corpus.map((d) => d.length);
    this.avgdl = this.docLengths.reduce((a, b) => a + b, 0) / this.N;
    this.termFreqs = this.corpus.map((doc) => {
      const tf = new Map();
      for (const word of doc) tf.set(word, (tf.get(word) || 0) + 1);
      for (const word of tf.keys()) this.docFreqs.set(word, (this.docFreqs.get(word) || 0) + 1);
      return tf;
    });
    for (const [word, freq] of this.docFreqs) {
      this.idf[word] = Math.log((this.N - freq + 0.5) / (freq + 0.5) + 1);
    }
  }

  score(query) {
    const queryTokens = tokenize(query);
    const scores = [];
    for (let idx = 0; idx < this.N; idx++) {
      let score = 0;
      const docLen = this.docLengths[idx];
      const tfs = this.termFreqs[idx];
      for (const token of queryTokens) {
        if (!(token in this.idf)) continue;
        const tf = tfs.get(token) || 0;
        const idf = this.idf[token];
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + (this.b * docLen) / this.avgdl);
        score += (idf * numerator) / denominator;
      }
      scores.push([idx, score]);
    }
    return scores.sort((a, b) => b[1] - a[1]);
  }

  vocabulary() {
    return Object.keys(this.idf);
  }
}

// ============ CSV (com cache) ============
function parseCSV(text) {
  // Remove BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n') {
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else if (ch === '\r') {
      // ignore
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

const _csvCache = new Map(); // filepath -> rows
const _bm25Cache = new Map(); // filepath + searchCols -> BM25

function loadCSV(filepath) {
  if (_csvCache.has(filepath)) return _csvCache.get(filepath);
  let rows = [];
  try {
    const text = fs.readFileSync(filepath, 'utf-8');
    const parsed = parseCSV(text);
    if (parsed.length > 0) {
      const header = parsed[0];
      rows = parsed.slice(1).map((r) => {
        const obj = {};
        header.forEach((h, i) => { obj[h] = r[i] !== undefined ? r[i] : ''; });
        return obj;
      });
    }
  } catch (e) {
    return null;
  }
  _csvCache.set(filepath, rows);
  return rows;
}

function getBM25(filepath, searchCols, data) {
  const key = filepath + '|' + searchCols.join(',');
  if (_bm25Cache.has(key)) return _bm25Cache.get(key);
  const documents = data.map((row) => searchCols.map((c) => row[c] || '').join(' '));
  const bm25 = new BM25();
  bm25.fit(documents);
  _bm25Cache.set(key, bm25);
  return bm25;
}

// ============ BUSCA ============
function searchCSV(filepath, searchCols, outputCols, query, maxResults) {
  const data = loadCSV(filepath);
  if (!data || data.length === 0) return [[], null];
  const bm25 = getBM25(filepath, searchCols, data);
  const ranked = bm25.score(query);
  const results = [];
  for (const [idx, score] of ranked) {
    if (score <= 0 || results.length >= maxResults) continue;
    const row = data[idx];
    const out = {};
    for (const col of outputCols) if (col in row) out[col] = row[col];
    results.push(out);
  }
  return [results, bm25];
}

function suggestTerms(bm25, query, limit = 6) {
  if (!bm25) return [];
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return [];
  const candidates = [];
  for (const term of bm25.vocabulary()) {
    for (const qt of queryTokens) {
      if (term.startsWith(qt.slice(0, 3)) || qt.startsWith(term.slice(0, 3))) {
        candidates.push(term);
        break;
      }
    }
  }
  return [...new Set(candidates)].slice(0, limit);
}

// ============ DETECÇÃO DE DOMÍNIO ============
function loadProductKeywords() {
  const seed = ['saas', 'ecommerce', 'e-commerce', 'fintech', 'healthcare', 'gaming',
    'portfolio', 'crypto', 'dashboard', 'fitness', 'marketplace'];
  const filepath = path.join(DATA_DIR, CSV_CONFIG.product.file);
  const data = loadCSV(filepath);
  if (!data) return seed;
  const keywords = new Set(seed);
  for (const row of data) {
    const raw = row.Keywords || '';
    for (const kw of raw.split(/[,;]/)) {
      const k = kw.trim().toLowerCase();
      if (k && k.length >= 3) keywords.add(k);
    }
  }
  return [...keywords].sort((a, b) => b.length - a.length);
}

let _DOMAIN_KEYWORDS = null;
function domainKeywords() {
  if (_DOMAIN_KEYWORDS) return _DOMAIN_KEYWORDS;
  _DOMAIN_KEYWORDS = {
    color: ['color', 'palette', 'hex', '#', 'rgb', 'token', 'semantic', 'accent', 'destructive', 'muted', 'foreground'],
    chart: ['chart', 'graph', 'visualization', 'trend', 'bar', 'pie', 'scatter', 'heatmap', 'funnel'],
    landing: ['landing', 'page', 'cta', 'conversion', 'hero', 'testimonial', 'pricing', 'section'],
    product: loadProductKeywords(),
    style: ['style', 'design', 'ui', 'minimalism', 'glassmorphism', 'neumorphism', 'brutalism', 'dark mode', 'flat', 'aurora', 'prompt', 'css', 'implementation', 'variable', 'checklist', 'tailwind'],
    ux: ['ux', 'usability', 'accessibility', 'wcag', 'touch', 'scroll', 'animation', 'keyboard', 'navigation', 'mobile'],
    typography: ['font pairing', 'typography pairing', 'heading font', 'body font'],
    'google-fonts': ['google font', 'font family', 'font weight', 'font style', 'variable font', 'noto', 'font for', 'find font', 'font subset', 'font language', 'monospace font', 'serif font', 'sans serif font', 'display font', 'handwriting font', 'font', 'typography', 'serif', 'sans'],
    icons: ['icon', 'icons', 'lucide', 'heroicons', 'symbol', 'glyph', 'pictogram', 'svg icon'],
    gsap: ['gsap', 'quickto', 'scrolltrigger', 'stagger', 'magnetic cursor', 'parallax', 'page transition', 'scroll reveal', 'scroll-triggered', 'scrollytelling', 'flip plugin', 'splittext', 'shimmer', 'skeleton loader'],
    react: ['react', 'next.js', 'nextjs', 'suspense', 'memo', 'usecallback', 'useeffect', 'rerender', 'bundle', 'waterfall', 'barrel', 'dynamic import', 'rsc', 'server component'],
    web: ['aria', 'focus', 'outline', 'semantic', 'virtualize', 'autocomplete', 'form', 'input type', 'preconnect'],
  };
  return _DOMAIN_KEYWORDS;
}

const DOMAIN_TIEBREAK_ORDER = [
  'ux', 'product', 'style', 'color', 'typography', 'google-fonts',
  'chart', 'landing', 'icons', 'gsap', 'react', 'web',
];

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function detectDomain(query) {
  const queryLower = query.toLowerCase();
  const keywords = domainKeywords();
  const scores = {};
  for (const [domain, domainKws] of Object.entries(keywords)) {
    let total = 0;
    for (const kw of domainKws) {
      if (new RegExp('\\b' + escapeRegex(kw) + '\\b', 'i').test(queryLower)) {
        total += Math.max(1, kw.split(' ').length);
      }
    }
    scores[domain] = total;
  }
  const ranked = Object.entries(scores).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    const ia = DOMAIN_TIEBREAK_ORDER.indexOf(a[0]);
    const ib = DOMAIN_TIEBREAK_ORDER.indexOf(b[0]);
    return (ib === -1 ? -999 : ib) - (ia === -1 ? -999 : ia);
  });
  const [best, bestScore] = ranked[0];
  return bestScore > 0 ? best : 'style';
}

export function search(query, domain = null, maxResults = MAX_RESULTS) {
  const autoDetected = domain === null;
  if (domain === null) domain = detectDomain(query);
  const config = CSV_CONFIG[domain] || CSV_CONFIG.style;
  const filepath = path.join(DATA_DIR, config.file);
  if (!fs.existsSync(filepath)) {
    return { error: `File not found: ${filepath}`, domain };
  }
  const [results, bm25] = searchCSV(filepath, config.search_cols, config.output_cols, query, maxResults);
  const out = { domain, query, file: config.file, count: results.length, results };
  if (autoDetected) out.auto_detected = true;
  if (!results.length) out.suggestions = suggestTerms(bm25, query);
  return out;
}

export function searchStack(query, stack, maxResults = MAX_RESULTS) {
  if (!STACK_CONFIG[stack]) {
    return { error: `Unknown stack: ${stack}. Available: ${Object.keys(STACK_CONFIG).join(', ')}`, stack };
  }
  const filepath = path.join(DATA_DIR, STACK_CONFIG[stack].file);
  if (!fs.existsSync(filepath)) {
    return { error: `Stack file not found: ${filepath}`, stack };
  }
  const [results, bm25] = searchCSV(filepath, STACK_SEARCH_COLS, STACK_OUTPUT_COLS, query, maxResults);
  const out = { domain: 'stack', stack, query, file: STACK_CONFIG[stack].file, count: results.length, results };
  if (!results.length) out.suggestions = suggestTerms(bm25, query);
  return out;
}

// ============ DESIGN SYSTEM ============
const REASONING_FILE = 'ui-reasoning.csv';
const SEARCH_CONFIG = { product: { max: 1 }, style: { max: 3 }, color: { max: 2 }, landing: { max: 2 }, typography: { max: 2 } };

const DIAL_TIERS = {
  variance: [
    [1, 3, { label: 'Centered / Minimal', style_keywords: ['Minimalism', 'Exaggerated Minimalism', 'centered', 'symmetric', 'grid-based'] }],
    [4, 7, { label: 'Balanced / Modern', style_keywords: ['modern', 'structured', 'balanced'] }],
    [8, 10, { label: 'Bold / Asymmetric', style_keywords: ['Brutalism', 'Bento Grids', 'asymmetric', 'experimental'] }],
  ],
  motion: [
    [1, 3, { label: 'Subtle', tier: 'Subtle' }],
    [4, 7, { label: 'Standard', tier: 'Standard' }],
    [8, 10, { label: 'Complex', tier: 'Complex' }],
  ],
  density: [
    [1, 3, { label: 'Spacious', spacing: { xs: '4px', sm: '8px', md: '24px', lg: '32px', xl: '48px', '2xl': '64px', '3xl': '96px' } }],
    [4, 7, { label: 'Standard', spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px', '2xl': '48px', '3xl': '64px' } }],
    [8, 10, { label: 'Dense / Dashboard', spacing: { xs: '2px', sm: '4px', md: '8px', lg: '12px', xl: '16px', '2xl': '24px', '3xl': '32px' } }],
  ],
};

const DARK_PRIMARY_MARKERS = ['dark mode primary', 'dark primary', 'dark-only', 'dark only', 'dark preferred', 'dark focused', 'dark-first', 'dark rich', 'light mode only as exception'];
const DARK_QUERY_MARKERS = ['dark mode', 'dark theme', 'dark ui', 'dark-mode', 'darkmode', 'night mode', 'midnight', 'oled'];
const DARK_ANTI_PATTERN_MARKERS = ['dark mode', 'dark modes', 'dark theme'];
const DARK_BACKGROUND_MAX_LUMINANCE = 0.18;

function resolveDial(name, value) {
  if (value === null || value === undefined) return null;
  value = Math.max(1, Math.min(10, parseInt(value, 10)));
  for (const [lo, hi, info] of DIAL_TIERS[name]) {
    if (lo <= value && value <= hi) return { ...info, value };
  }
  return null;
}

function relativeLuminance(hexColor) {
  if (!hexColor) return null;
  let value = hexColor.trim().replace(/^#/, '');
  if (value.length === 3) value = value.split('').map((c) => c + c).join('');
  if (value.length !== 6) return null;
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  const channels = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function paletteIsDark(palette) {
  const lum = relativeLuminance((palette || {}).Background || '');
  return lum !== null && lum < DARK_BACKGROUND_MAX_LUMINANCE;
}

function styleIsDarkPrimary(style) {
  if (!style) return false;
  const declared = `${style['Light Mode ✓'] || ''} ${style['Dark Mode ✓'] || ''}`.toLowerCase();
  return DARK_PRIMARY_MARKERS.some((m) => declared.includes(m));
}

function queryWantsDark(query) {
  return DARK_QUERY_MARKERS.some((m) => (query || '').toLowerCase().includes(m));
}

function resolveColorMode(query, style) {
  return queryWantsDark(query) || styleIsDarkPrimary(style) ? 'dark' : 'light';
}

function selectPaletteForMode(palettes, mode) {
  if (!palettes || palettes.length === 0) return {};
  if (mode === 'dark') {
    for (const p of palettes) if (paletteIsDark(p)) return p;
  }
  return palettes[0];
}

function filterAntiPatternsForMode(antiPatterns, mode) {
  if (mode !== 'dark' || !antiPatterns) return antiPatterns;
  const kept = antiPatterns.split('+').filter((clause) => !DARK_ANTI_PATTERN_MARKERS.some((m) => clause.toLowerCase().includes(m)));
  return kept.map((c) => c.trim()).filter(Boolean).join(' + ');
}

function loadReasoning() {
  const filepath = path.join(DATA_DIR, REASONING_FILE);
  const data = loadCSV(filepath);
  return data || [];
}

function findReasoningRule(reasoningData, category) {
  const categoryLower = category.toLowerCase();
  for (const rule of reasoningData) {
    if ((rule.UI_Category || '').toLowerCase() === categoryLower) return rule;
  }
  for (const rule of reasoningData) {
    const uiCat = (rule.UI_Category || '').toLowerCase();
    if (uiCat && (uiCat.includes(categoryLower) || categoryLower.includes(uiCat))) return rule;
  }
  for (const rule of reasoningData) {
    const uiCat = (rule.UI_Category || '').toLowerCase();
    const keywords = uiCat.replace(/\//g, ' ').replace(/-/g, ' ').split(/\s+/).filter(Boolean);
    if (keywords.some((k) => categoryLower.includes(k))) return rule;
  }
  return {};
}

function applyReasoning(reasoningData, category) {
  const rule = findReasoningRule(reasoningData, category);
  if (!rule || Object.keys(rule).length === 0) {
    return {
      pattern: 'Hero + Features + CTA',
      style_priority: ['Minimalism', 'Flat Design'],
      color_mood: 'Professional',
      typography_mood: 'Clean',
      key_effects: 'Subtle hover transitions',
      anti_patterns: '',
      decision_rules: {},
      severity: 'MEDIUM',
    };
  }
  let decisionRules = {};
  try { decisionRules = JSON.parse(rule.Decision_Rules || '{}'); } catch (e) { /* ignore */ }
  return {
    pattern: rule.Recommended_Pattern || '',
    style_priority: String(rule.Style_Priority || '').split('+').map((s) => s.trim()),
    color_mood: rule.Color_Mood || '',
    typography_mood: rule.Typography_Mood || '',
    key_effects: rule.Key_Effects || '',
    anti_patterns: rule.Anti_Patterns || '',
    decision_rules: decisionRules,
    severity: rule.Severity || 'MEDIUM',
  };
}

function selectBestMatch(results, priorityKeywords) {
  if (!results || results.length === 0) return {};
  if (!priorityKeywords || priorityKeywords.length === 0) return results[0];
  for (const priority of priorityKeywords) {
    const p = priority.toLowerCase().trim();
    for (const result of results) {
      const name = (result['Style Category'] || '').toLowerCase();
      if (p && (name.includes(p) || p.includes(name))) return result;
    }
  }
  const scored = results.map((result) => {
    const resultStr = JSON.stringify(result).toLowerCase();
    let score = 0;
    for (const kw of priorityKeywords) {
      const k = kw.toLowerCase().trim();
      if (!k) continue;
      if ((result['Style Category'] || '').toLowerCase().includes(k)) score += 10;
      else if ((result.Keywords || '').toLowerCase().includes(k)) score += 3;
      else if (resultStr.includes(k)) score += 1;
    }
    return [score, result];
  });
  scored.sort((a, b) => b[0] - a[0]);
  return scored[0][0] > 0 ? scored[0][1] : results[0];
}

export function generateDesignSystem(query, projectName = null, { variance = null, motion = null, density = null } = {}) {
  const varianceInfo = resolveDial('variance', variance);
  const motionInfo = resolveDial('motion', motion);
  const densityInfo = resolveDial('density', density);
  const reasoningData = loadReasoning();

  // Passo 1: buscar produto → categoria
  const productResult = search(query, 'product', 1);
  const productResults = productResult.results || [];
  const category = productResults.length > 0 ? (productResults[0]['Product Type'] || 'General') : 'General';

  // Passo 2: regras de raciocínio para a categoria
  const reasoning = applyReasoning(reasoningData, category);
  let stylePriority = reasoning.style_priority;
  if (varianceInfo) stylePriority = [...varianceInfo.style_keywords, ...stylePriority];

  // Passo 3: busca multi-domínio
  const searchResults = {};
  for (const [dom, cfg] of Object.entries(SEARCH_CONFIG)) {
    if (dom === 'style') {
      const priorityQuery = stylePriority.slice(0, 2).join(' ');
      const combinedQuery = priorityQuery ? `${query} ${priorityQuery}` : query;
      searchResults[dom] = search(combinedQuery, dom, cfg.max);
    } else {
      searchResults[dom] = search(query, dom, cfg.max);
    }
  }
  searchResults.product = productResult;

  // Passo 4: selecionar melhores matches
  const styleResults = searchResults.style.results || [];
  const colorResults = searchResults.color.results || [];
  const typographyResults = searchResults.typography.results || [];
  const landingResults = searchResults.landing.results || [];

  const bestStyle = selectBestMatch(styleResults, stylePriority);
  const colorMode = resolveColorMode(query, bestStyle);
  const bestColor = selectPaletteForMode(colorResults, colorMode);
  const bestTypography = typographyResults[0] || {};
  const bestLanding = landingResults[0] || {};

  // MOTION dial: snippet GSAP do motion.csv
  let motionSnippet = {};
  if (motionInfo) {
    const motionResult = search(`${query} ${motionInfo.tier}`, 'gsap', 5);
    const motionMatches = motionResult.results || [];
    const tiered = motionMatches.find((m) => m['Intensity Tier'] === motionInfo.tier);
    motionSnippet = tiered || motionMatches[0] || {};
  }

  // Passo 5: montar recomendação final
  const styleEffects = bestStyle['Effects & Animation'] || '';
  const combinedEffects = styleEffects || reasoning.key_effects;

  return {
    project_name: projectName || query.toUpperCase(),
    category,
    pattern: {
      name: bestLanding['Pattern Name'] || reasoning.pattern || 'Hero + Features + CTA',
      sections: bestLanding['Section Order'] || 'Hero > Features > CTA',
      cta_placement: bestLanding['Primary CTA Placement'] || 'Above fold',
      color_strategy: bestLanding['Color Strategy'] || '',
      conversion: bestLanding['Conversion Optimization'] || '',
    },
    style: {
      name: bestStyle['Style Category'] || 'Minimalism',
      type: bestStyle.Type || 'General',
      effects: styleEffects,
      keywords: bestStyle.Keywords || '',
      best_for: bestStyle['Best For'] || '',
      performance: bestStyle.Performance || '',
      accessibility: bestStyle.Accessibility || '',
      light_mode: bestStyle['Light Mode ✓'] || '',
      dark_mode: bestStyle['Dark Mode ✓'] || '',
    },
    colors: {
      primary: bestColor.Primary || '#2563EB',
      on_primary: bestColor['On Primary'] || '',
      secondary: bestColor.Secondary || '#3B82F6',
      accent: bestColor.Accent || '#F97316',
      background: bestColor.Background || '#F8FAFC',
      foreground: bestColor.Foreground || '#1E293B',
      muted: bestColor.Muted || '',
      border: bestColor.Border || '',
      destructive: bestColor.Destructive || '',
      ring: bestColor.Ring || '',
      notes: bestColor.Notes || '',
      cta: bestColor.Accent || '#F97316',
      text: bestColor.Foreground || '#1E293B',
    },
    typography: {
      heading: bestTypography['Heading Font'] || 'Inter',
      body: bestTypography['Body Font'] || 'Inter',
      mood: bestTypography['Mood/Style Keywords'] || reasoning.typography_mood || '',
      best_for: bestTypography['Best For'] || '',
      google_fonts_url: bestTypography['Google Fonts URL'] || '',
      css_import: bestTypography['CSS Import'] || '',
    },
    key_effects: combinedEffects,
    anti_patterns: filterAntiPatternsForMode(reasoning.anti_patterns, colorMode),
    decision_rules: reasoning.decision_rules || {},
    severity: reasoning.severity,
    dials: {
      variance: varianceInfo ? varianceInfo.value : null,
      variance_label: varianceInfo ? varianceInfo.label : null,
      motion: motionInfo ? motionInfo.value : null,
      motion_label: motionInfo ? motionInfo.label : null,
      density: densityInfo ? densityInfo.value : null,
      density_label: densityInfo ? densityInfo.label : null,
    },
    motion_snippet: motionSnippet,
    spacing_scale: densityInfo ? densityInfo.spacing : null,
  };
}

// ============ FORMATADORES ============
function truncate(value, full) {
  const s = String(value);
  return !full && s.length > TRUNCATE_AT ? s.slice(0, TRUNCATE_AT) + '...' : s;
}

export function formatSearchOutput(result, full = false) {
  if (result.error) return `Error: ${result.error}`;
  const out = [];
  if (result.stack) {
    out.push('## UI Pro Max Stack Guidelines');
    out.push(`**Stack:** ${result.stack} | **Query:** ${result.query}`);
  } else {
    out.push('## UI Pro Max Search Results');
    let domainNote = result.domain;
    if (result.auto_detected) {
      domainNote += ' (auto-detected)';
      if (result.runner_up_domain) domainNote += `, runner-up: ${result.runner_up_domain}`;
    }
    out.push(`**Domain:** ${domainNote} | **Query:** ${result.query}`);
  }
  out.push(`**Source:** ${result.file} | **Found:** ${result.count} results\n`);
  if (result.count === 0) {
    out.push('No matches. This is not a match with an empty value — the query did not hit the database. Retry with broader/different keywords before falling back to general defaults, and say explicitly that no database match was found if you do fall back.');
    if (result.suggestions && result.suggestions.length) {
      out.push(`**Closest known terms:** ${result.suggestions.join(', ')}`);
    }
    return out.join('\n');
  }
  result.results.forEach((row, i) => {
    out.push(`### Result ${i + 1}`);
    for (const [key, value] of Object.entries(row)) {
      const v = String(value);
      const val = !full && !UNTRUNCATED_COLS.has(key) && v.length > TRUNCATE_AT ? v.slice(0, TRUNCATE_AT) + '...' : v;
      out.push(`- **${key}:** ${val}`);
    }
    out.push('');
  });
  return out.join('\n');
}

function mdSection(title, body) {
  return `## ${title}\n\n${body}`;
}

export function formatDesignSystemMarkdown(ds) {
  const out = [];
  out.push(`# Design System — ${ds.project_name}`);
  out.push('');
  out.push(`> Categoria: **${ds.category}** · Severidade: **${ds.severity}**`);

  if (ds.dials.variance || ds.dials.motion || ds.dials.density) {
    out.push('');
    out.push('**Dials aplicados:** ' + [
      ds.dials.variance ? `variance=${ds.dials.variance} (${ds.dials.variance_label})` : null,
      ds.dials.motion ? `motion=${ds.dials.motion} (${ds.dials.motion_label})` : null,
      ds.dials.density ? `density=${ds.dials.density} (${ds.dials.density_label})` : null,
    ].filter(Boolean).join(' · '));
  }

  out.push('');
  out.push(mdSection('Padrão de Página', [
    `- **Pattern:** ${ds.pattern.name}`,
    `- **Seções:** ${ds.pattern.sections}`,
    `- **CTA:** ${ds.pattern.cta_placement}`,
    ds.pattern.color_strategy ? `- **Estratégia de cor:** ${ds.pattern.color_strategy}` : '',
    ds.pattern.conversion ? `- **Otimização de conversão:** ${ds.pattern.conversion}` : '',
  ].filter(Boolean).join('\n')));

  out.push(mdSection('Estilo', [
    `- **Estilo:** ${ds.style.name} (${ds.style.type})`,
    ds.style.keywords ? `- **Keywords:** ${ds.style.keywords}` : '',
    ds.style.best_for ? `- **Best for:** ${ds.style.best_for}` : '',
    ds.style.performance ? `- **Performance:** ${ds.style.performance}` : '',
    ds.style.accessibility ? `- **Acessibilidade:** ${ds.style.accessibility}` : '',
    ds.style.light_mode ? `- **Light mode:** ${ds.style.light_mode}` : '',
    ds.style.dark_mode ? `- **Dark mode:** ${ds.style.dark_mode}` : '',
  ].filter(Boolean).join('\n')));

  out.push(mdSection('Cores', [
    '| Token | Valor |',
    '|---|---|',
    `| Primary | \`${ds.colors.primary}\` |`,
    `| On Primary | \`${ds.colors.on_primary || '—'}\` |`,
    `| Secondary | \`${ds.colors.secondary}\` |`,
    `| Accent | \`${ds.colors.accent}\` |`,
    `| Background | \`${ds.colors.background}\` |`,
    `| Foreground | \`${ds.colors.foreground}\` |`,
    ds.colors.muted ? `| Muted | \`${ds.colors.muted}\` |` : '',
    ds.colors.border ? `| Border | \`${ds.colors.border}\` |` : '',
    ds.colors.destructive ? `| Destructive | \`${ds.colors.destructive}\` |` : '',
    ds.colors.ring ? `| Ring | \`${ds.colors.ring}\` |` : '',
    ds.colors.notes ? `\n**Notas:** ${ds.colors.notes}` : '',
  ].filter(Boolean).join('\n')));

  out.push(mdSection('Tipografia', [
    `- **Heading:** ${ds.typography.heading}`,
    `- **Body:** ${ds.typography.body}`,
    ds.typography.mood ? `- **Mood:** ${ds.typography.mood}` : '',
    ds.typography.best_for ? `- **Best for:** ${ds.typography.best_for}` : '',
    ds.typography.google_fonts_url ? `- **Google Fonts:** ${ds.typography.google_fonts_url}` : '',
    ds.typography.css_import ? `- **CSS Import:**\n  \`\`\`css\n${ds.typography.css_import}\n  \`\`\`` : '',
  ].filter(Boolean).join('\n')));

  if (ds.key_effects) out.push(mdSection('Efeitos & Animação', ds.key_effects));
  if (ds.anti_patterns) out.push(mdSection('Anti-padrões (evite)', ds.anti_patterns));

  if (Object.keys(ds.decision_rules).length > 0) {
    const rules = Object.entries(ds.decision_rules).map(([k, v]) => `- **${k}:** ${JSON.stringify(v)}`).join('\n');
    out.push(mdSection('Regras de decisão', rules));
  }

  if (ds.spacing_scale) {
    const scale = Object.entries(ds.spacing_scale).map(([k, v]) => `\`${k}=${v}\``).join(' · ');
    out.push(mdSection(`Escala de espaçamento (${ds.dials.density_label})`, scale));
  }

  if (ds.motion_snippet && Object.keys(ds.motion_snippet).length > 0) {
    const ms = ds.motion_snippet;
    out.push(mdSection('Snippet de motion (GSAP)', [
      ms.Category ? `- **Categoria:** ${ms.Category}` : '',
      ms['Intensity Tier'] ? `- **Tier:** ${ms['Intensity Tier']}` : '',
      ms.Trigger ? `- **Trigger:** ${ms.Trigger}` : '',
      ms.Duration ? `- **Duração:** ${ms.Duration}` : '',
      ms.Easing ? `- **Easing:** ${ms.Easing}` : '',
      ms['GSAP Snippet'] ? `\n\`\`\`js\n${ms['GSAP Snippet']}\n\`\`\`` : '',
      ms.Do ? `- **Do:** ${ms.Do}` : '',
      ms["Don't"] ? `- **Don't:** ${ms["Don't"]}` : '',
    ].filter(Boolean).join('\n')));
  }

  return out.join('\n');
}

export function formatDesignSystemAscii(ds) {
  const lines = [];
  const bar = '='.repeat(60);
  lines.push(bar);
  lines.push(`DESIGN SYSTEM — ${ds.project_name}`);
  lines.push(`Category: ${ds.category} | Severity: ${ds.severity}`);
  lines.push(bar);
  lines.push(`Pattern:   ${ds.pattern.name}`);
  lines.push(`Sections:  ${ds.pattern.sections}`);
  lines.push(`CTA:       ${ds.pattern.cta_placement}`);
  lines.push('');
  lines.push(`Style:     ${ds.style.name} (${ds.style.type})`);
  if (ds.style.keywords) lines.push(`Keywords:  ${ds.style.keywords}`);
  lines.push('');
  lines.push('Colors:');
  for (const [k, v] of Object.entries({ Primary: ds.colors.primary, Secondary: ds.colors.secondary, Accent: ds.colors.accent, Background: ds.colors.background, Foreground: ds.colors.foreground })) {
    lines.push(`  ${k}: ${v}`);
  }
  lines.push('');
  lines.push(`Typography: Heading ${ds.typography.heading} / Body ${ds.typography.body}`);
  if (ds.key_effects) lines.push(`\nEffects: ${ds.key_effects}`);
  if (ds.anti_patterns) lines.push(`\nAnti-patterns (avoid): ${ds.anti_patterns}`);
  if (ds.motion_snippet && ds.motion_snippet['GSAP Snippet']) {
    lines.push(`\nGSAP Snippet:\n${ds.motion_snippet['GSAP Snippet']}`);
  }
  return lines.join('\n');
}

// ============ PERSISTÊNCIA (Master + Overrides) ============
function safeSlug(name, fallback = 'default') {
  const slug = String(name || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

export function persistDesignSystem(ds, { page = null, outputDir = null, force = false } = {}) {
  const projectDir = path.resolve(outputDir || process.cwd());
  const dsDir = path.join(projectDir, 'design-system', safeSlug(ds.project_name));
  const masterPath = path.join(dsDir, 'MASTER.md');

  if (fs.existsSync(masterPath) && !force) {
    return { status: 'skipped_exists', design_system_dir: dsDir, message: 'MASTER.md already exists; not overwritten. Use --force to overwrite.' };
  }

  const created = [];
  fs.mkdirSync(dsDir, { recursive: true });
  fs.writeFileSync(masterPath, formatDesignSystemMarkdown(ds), 'utf-8');
  created.push(masterPath);

  let pagePath = null;
  if (page) {
    const pagesDir = path.join(dsDir, 'pages');
    fs.mkdirSync(pagesDir, { recursive: true });
    pagePath = path.join(pagesDir, `${safeSlug(page)}.md`);
    fs.writeFileSync(pagePath, [
      `# Page Override — ${page}`,
      '',
      '> Regras desta página sobrescrevem o MASTER.md. Leia MASTER.md primeiro.',
      '',
      `Design system base: **${ds.project_name}** (${ds.category})`,
      '',
      `## Overrides para ${page}`,
      '',
      '- (gerado a partir do design system master; ajuste conforme o contexto específico da página)',
      '',
      `**Padrão base:** ${ds.pattern.name} — ${ds.pattern.sections}`,
    ].join('\n'), 'utf-8');
    created.push(pagePath);
  }

  return { status: 'success', design_system_dir: dsDir, created_files: created };
}

// ============ CLI ============
function parseArgs(argv) {
  const args = { query: null, domain: null, stack: null, max_results: MAX_RESULTS, json: false, full: false, design_system: false, project_name: null, format: 'ascii', persist: false, page: null, output_dir: null, force: false, variance: null, motion: null, density: null };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => { i++; return argv[i]; };
    switch (a) {
      case '--domain': case '-d': args.domain = next(); break;
      case '--stack': case '-s': args.stack = next(); break;
      case '--max-results': case '-n': args.max_results = parseInt(next(), 10) || MAX_RESULTS; break;
      case '--json': args.json = true; break;
      case '--full': args.full = true; break;
      case '--design-system': case '-ds': args.design_system = true; break;
      case '--project-name': case '-p': args.project_name = next(); break;
      case '--format': case '-f': args.format = next(); break;
      case '--persist': args.persist = true; break;
      case '--page': args.page = next(); break;
      case '--output-dir': case '-o': args.output_dir = next(); break;
      case '--force': args.force = true; break;
      case '--variance': args.variance = parseInt(next(), 10); break;
      case '--motion': args.motion = parseInt(next(), 10); break;
      case '--density': args.density = parseInt(next(), 10); break;
      case '--help': case '-h': args.help = true; break;
      default:
        if (a.startsWith('-') && a.length > 1) { console.error(`Unknown option: ${a}`); process.exit(2); }
        positional.push(a);
    }
  }
  args.query = positional.join(' ');
  return args;
}

function printHelp() {
  console.log(`UI/UX Pro Max — Node.js search engine (BM25, offline, MIT)
Usage:
  node search.mjs "<query>" [--domain <d>] [--stack <s>] [-n <max>] [--json] [--full]
  node search.mjs "<query>" --design-system [-p "Project"] [-f markdown|ascii] [--json]
      [--variance 1-10] [--motion 1-10] [--density 1-10]
      [--persist --page "dashboard" --output-dir <dir> --force]

Domains: ${Object.keys(CSV_CONFIG).join(', ')}
Stacks:  ${Object.keys(STACK_CONFIG).join(', ')}`);
}

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.query) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  if (args.design_system) {
    const ds = generateDesignSystem(args.query, args.project_name, {
      variance: args.variance, motion: args.motion, density: args.density,
    });
    let text;
    if (args.format === 'markdown') text = formatDesignSystemMarkdown(ds);
    else text = formatDesignSystemAscii(ds);

    if (args.json) {
      let persistence = null;
      if (args.persist) persistence = persistDesignSystem(ds, { page: args.page, outputDir: args.output_dir, force: args.force });
      console.log(JSON.stringify({ design_system: ds, persistence }, null, 2));
    } else {
      console.log(text);
      if (args.persist) {
        const persistence = persistDesignSystem(ds, { page: args.page, outputDir: args.output_dir, force: args.force });
        console.log('\n' + '='.repeat(60));
        if (persistence.status === 'skipped_exists') {
          console.log(`⚠️  ${persistence.message}`);
        } else {
          console.log(`✅ Design system persisted to ${persistence.design_system_dir}/`);
          for (const f of persistence.created_files) console.log(`   📄 ${f}`);
          console.log('\n📖 Usage: When building a page, check pages/[page].md first.');
          console.log('   If it exists, its rules override MASTER.md. Otherwise, use MASTER.md.');
        }
        console.log('='.repeat(60));
      }
    }
  } else if (args.stack) {
    const result = searchStack(args.query, args.stack, args.max_results);
    if (args.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatSearchOutput(result, args.full));
  } else {
    const result = search(args.query, args.domain, args.max_results);
    if (args.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatSearchOutput(result, args.full));
  }
};

// Permite import ESM (export ...) e execução direta
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
