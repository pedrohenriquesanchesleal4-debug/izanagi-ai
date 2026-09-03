/**
 * Survey do projeto: o que o runtime SABE do repositório, não o que ele supõe.
 *
 * Sem isto, `izanagi run "adicione paginação ao endpoint /users"` produzia um
 * documento SOBRE adicionar paginação, escrito por um modelo que nunca viu o
 * projeto: a stack era chutada, os caminhos eram inventados, e o resultado
 * passava na verificação porque o schema do artefato não pergunta se o
 * conteúdo corresponde a alguma realidade. Alucinação com aparência de
 * entrega — exatamente o que a regra anti-slop proíbe.
 *
 * O survey é a evidência barata que faltava. Ele é:
 *
 *   determinístico : nenhuma chamada de modelo. Levantar o terreno não custa
 *                    token; o que custa é o que entra no contexto depois, e
 *                    isso o Context Resolver já limita.
 *   limitado       : profundidade, número de entradas e bytes têm teto, e o
 *                    corte é DECLARADO na saída. Um survey que varre o
 *                    monorepo inteiro é o mesmo desperdício de contexto que a
 *                    arquitetura proíbe, só que com nome melhor.
 *   estrutural     : conta arquivos por extensão e lista manifestos. NÃO
 *                    despeja código. Quem precisa de um arquivo específico
 *                    pede `fs.read` — com permissão, política e sandbox.
 *
 * O que ele NÃO faz: julgar. Não há "o projeto usa arquitetura X". Ele
 * devolve o que foi contado, e quem interpreta é o agente a jusante.
 */

import fs from 'fs';
import path from 'path';

/** Diretórios que nunca entram: são derivados, não são o projeto. */
export const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'target', '.next', '.nuxt',
  'coverage', '__pycache__', '.venv', 'venv', 'vendor', '.izanagi', '.cache',
  '.pytest_cache', '.mypy_cache', '.turbo', '.svelte-kit', 'bin/obj',
]);

/** Profundidade máxima da varredura. Três níveis mostram a forma do projeto sem virar um `find /`. */
export const MAX_DEPTH = 3;
/** Entradas visitadas antes de parar. Repositório grande é normal; varrer tudo não é obrigação. */
export const MAX_ENTRIES = 4000;
/** Linhas do README levadas adiante. */
export const README_LINES = 40;
/** Teto de chars do trecho de README. */
export const README_CHARS = 3000;
/** Diretórios reportados na árvore, os maiores primeiro. */
export const MAX_TREE_DIRS = 25;

/** Manifestos reconhecidos, e o que cada um diz sobre a stack. */
const MANIFESTS: Array<{ file: string; stack: string }> = [
  { file: 'package.json', stack: 'node' },
  { file: 'Cargo.toml', stack: 'rust' },
  { file: 'go.mod', stack: 'go' },
  { file: 'pyproject.toml', stack: 'python' },
  { file: 'requirements.txt', stack: 'python' },
  { file: 'pom.xml', stack: 'java' },
  { file: 'build.gradle', stack: 'java' },
  { file: 'Gemfile', stack: 'ruby' },
  { file: 'composer.json', stack: 'php' },
  { file: 'pubspec.yaml', stack: 'dart' },
  { file: 'Package.swift', stack: 'swift' },
  { file: 'mix.exs', stack: 'elixir' },
];

/** Extensão → linguagem, para a stack sair da contagem e não do palpite. */
const EXT_LANG: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
  '.mjs': 'javascript', '.cjs': 'javascript', '.py': 'python', '.rs': 'rust', '.go': 'go',
  '.java': 'java', '.kt': 'kotlin', '.rb': 'ruby', '.php': 'php', '.cs': 'csharp',
  '.swift': 'swift', '.dart': 'dart', '.ex': 'elixir', '.exs': 'elixir', '.c': 'c',
  '.h': 'c', '.cpp': 'cpp', '.hpp': 'cpp', '.sql': 'sql', '.sh': 'shell',
};

export interface ManifestSummary {
  file: string;
  name?: string;
  version?: string;
  /** Nomes dos scripts, não o comando: o comando é do projeto, e despejá-lo aqui é convite a executá-lo. */
  scripts?: string[];
}

export interface TreeEntry {
  dir: string;
  files: number;
  /** Contagem por extensão, as mais frequentes primeiro. */
  kinds: Record<string, number>;
}

export interface ProjectSurvey {
  root: string;
  /** Linguagens/ecossistemas detectados por manifesto e por contagem de arquivo. */
  stack: string[];
  manifests: ManifestSummary[];
  tree: TreeEntry[];
  /** Arquivos que costumam ser porta de entrada, quando existem de fato. */
  entrypoints: string[];
  /** Primeiras linhas do README, quando existe. */
  readme?: string;
  scanned: { dirs: number; files: number; depth: number };
  /** O que foi cortado. Corte não declarado é corte que vira conclusão errada. */
  truncated: { entries: boolean; tree: boolean; readme: boolean };
}

function readJson(file: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Nome do projeto a partir de um manifesto de texto (`name = "x"` / `module x`). */
function nameFromText(file: string): string | undefined {
  try {
    const head = fs.readFileSync(file, 'utf-8').slice(0, 2000);
    const toml = head.match(/^\s*name\s*=\s*["']([^"']+)["']/m);
    if (toml) return toml[1];
    const gomod = head.match(/^\s*module\s+(\S+)/m);
    if (gomod) return gomod[1];
  } catch {
    // Manifesto ilegível é ausência de informação, não motivo para falhar o survey.
  }
  return undefined;
}

function summarizeManifest(root: string, file: string): ManifestSummary {
  const abs = path.join(root, file);
  if (file === 'package.json' || file === 'composer.json') {
    const json = readJson(abs);
    return {
      file,
      ...(typeof json?.name === 'string' ? { name: json.name } : {}),
      ...(typeof json?.version === 'string' ? { version: json.version } : {}),
      ...(json?.scripts && typeof json.scripts === 'object'
        ? { scripts: Object.keys(json.scripts as Record<string, unknown>).slice(0, 20) }
        : {}),
    };
  }
  const name = nameFromText(abs);
  return { file, ...(name ? { name } : {}) };
}

/**
 * Varre o projeto e devolve o levantamento. Nunca lança: diretório ilegível
 * (permissão, link quebrado) some da contagem em vez de derrubar o run — o
 * survey é evidência auxiliar, e evidência parcial vale mais que nenhuma.
 */
export function surveyProject(root: string, opts: { maxEntries?: number; maxDepth?: number } = {}): ProjectSurvey {
  const resolvedRoot = path.resolve(root);
  const maxEntries = opts.maxEntries ?? MAX_ENTRIES;
  const maxDepth = opts.maxDepth ?? MAX_DEPTH;

  const byDir = new Map<string, { files: number; kinds: Record<string, number> }>();
  const langCount: Record<string, number> = {};
  let dirs = 0;
  let files = 0;
  let deepest = 0;
  let entries = 0;
  let truncatedEntries = false;

  // `entry.isDirectory()` é falso para link simbólico, então diretório
  // linkado não é percorrido. É o comportamento certo aqui: seguir link é
  // como uma varredura entra em ciclo, e um projeto que aponta para fora de
  // si mesmo não fica melhor descrito por contar o que está do outro lado.
  const walk = (dir: string, depth: number): void => {
    if (depth > maxDepth || truncatedEntries) return;
    let listing: fs.Dirent[];
    try {
      listing = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    dirs++;
    deepest = Math.max(deepest, depth);
    const rel = path.relative(resolvedRoot, dir) || '.';
    const bucket = byDir.get(rel) ?? { files: 0, kinds: {} };
    byDir.set(rel, bucket);

    for (const entry of listing) {
      if (++entries > maxEntries) {
        truncatedEntries = true;
        return;
      }
      if (entry.name.startsWith('.') && entry.name !== '.github') continue;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(path.join(dir, entry.name), depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      files++;
      bucket.files++;
      const ext = path.extname(entry.name).toLowerCase();
      if (ext) {
        bucket.kinds[ext] = (bucket.kinds[ext] ?? 0) + 1;
        const lang = EXT_LANG[ext];
        if (lang) langCount[lang] = (langCount[lang] ?? 0) + 1;
      }
    }
  };

  walk(resolvedRoot, 0);

  const manifests = MANIFESTS.filter((m) => fs.existsSync(path.join(resolvedRoot, m.file))).map((m) =>
    summarizeManifest(resolvedRoot, m.file),
  );
  const manifestStacks = MANIFESTS.filter((m) => fs.existsSync(path.join(resolvedRoot, m.file))).map((m) => m.stack);
  // Linguagem entra na stack por VOLUME, não por existir um arquivo solto:
  // um `.py` de script num projeto Node não faz dele um projeto Python.
  const byVolume = Object.entries(langCount)
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([lang]) => lang);
  const stack = Array.from(new Set([...manifestStacks, ...byVolume]));

  const allTree = [...byDir.entries()]
    .filter(([, v]) => v.files > 0)
    .map(([dir, v]) => ({
      dir,
      files: v.files,
      kinds: Object.fromEntries(Object.entries(v.kinds).sort((a, b) => b[1] - a[1]).slice(0, 8)),
    }))
    .sort((a, b) => (b.files === a.files ? a.dir.localeCompare(b.dir) : b.files - a.files));
  const tree = allTree.slice(0, MAX_TREE_DIRS);

  const entrypoints = [
    'src/index.ts', 'src/index.js', 'src/main.ts', 'src/main.py', 'src/main.rs',
    'main.go', 'index.js', 'index.ts', 'app.py', 'manage.py', 'Makefile', 'Dockerfile',
  ].filter((f) => fs.existsSync(path.join(resolvedRoot, f)));

  let readme: string | undefined;
  let readmeTruncated = false;
  for (const candidate of ['README.md', 'readme.md', 'README.rst', 'README.txt']) {
    const abs = path.join(resolvedRoot, candidate);
    if (!fs.existsSync(abs)) continue;
    try {
      const lines = fs.readFileSync(abs, 'utf-8').split('\n');
      const head = lines.slice(0, README_LINES).join('\n');
      readmeTruncated = lines.length > README_LINES || head.length > README_CHARS;
      readme = head.length > README_CHARS ? head.slice(0, README_CHARS) : head;
    } catch {
      // README ilegível: o survey continua sem ele.
    }
    break;
  }

  return {
    root: '.',
    stack,
    manifests,
    tree,
    entrypoints,
    ...(readme ? { readme } : {}),
    scanned: { dirs, files, depth: deepest },
    truncated: { entries: truncatedEntries, tree: allTree.length > tree.length, readme: readmeTruncated },
  };
}

/** True quando o diretório tem cara de projeto de código (existe manifesto reconhecido). */
export function looksLikeProject(root: string): boolean {
  return MANIFESTS.some((m) => {
    try {
      return fs.existsSync(path.join(root, m.file));
    } catch {
      return false;
    }
  });
}
