/**
 * Groundedness: o artefato cita lugares que existem?
 *
 * A Verification Engine já pergunta se o artefato tem os campos do schema e se
 * tem o tamanho mínimo. Ela não pergunta se o conteúdo corresponde a alguma
 * realidade — e é aí que a alucinação passa: um plano de implementação
 * perfeitamente formatado, com campos completos e tamanho de sobra, citando
 * `app/controllers/users.rb` num projeto que não tem `app/`.
 *
 * Este módulo é a checagem determinística que faltava. Nenhum modelo, nenhuma
 * heurística de linguagem: extrai as referências de caminho do texto e olha o
 * disco.
 *
 * ## A decisão que define o valor da checagem
 *
 * A pergunta NÃO é "todos os arquivos citados existem?". Um plano legítimo
 * propõe arquivos novos, e reprovar isso transformaria a checagem em ruído
 * contra exatamente o trabalho que se quer. A pergunta é **"o LUGAR citado
 * existe?"**: `src/routes/users-pagination.ts` num projeto com `src/routes/`
 * é uma proposta plausível, mesmo que o arquivo ainda não exista;
 * `app/controllers/users.rb` num projeto sem `app/` é um layout inventado.
 *
 * A checagem, portanto, é sobre o diretório-pai. Ela pega quem inventou a
 * forma do projeto, e deixa passar quem propôs um arquivo dentro dela.
 *
 * ## Precisão acima de cobertura
 *
 * Reprovar um caminho legítimo é pior do que deixar passar um inventado: o
 * primeiro faz o usuário desconfiar da verificação inteira, o segundo é o
 * estado anterior. Por isso a extração é conservadora — exige separador de
 * diretório E extensão de arquivo conhecida. `GET /users` é rota, não caminho,
 * e não entra. `package.json` sem diretório não entra. Referência nenhuma
 * encontrada devolve `unknown`, nunca aprovação: ausência de sinal não é sinal.
 */

import fs from 'fs';
import path from 'path';

/** Extensões que fazem um token parecer arquivo de projeto, e não uma rota ou um domínio. */
const FILE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'py', 'rs', 'go', 'java', 'kt',
  'rb', 'php', 'cs', 'swift', 'dart', 'ex', 'exs', 'c', 'h', 'cpp', 'hpp', 'sql',
  'sh', 'yml', 'yaml', 'toml', 'md', 'css', 'scss', 'html', 'vue', 'svelte', 'prisma', 'graphql',
]);

/**
 * Prefixos que não são do projeto. Um caminho absoluto de sistema ou uma URL
 * não dizem nada sobre o repositório, e conferi-los produziria reprovação por
 * um motivo que não é o que a checagem mede.
 */
const IGNORED_PREFIXES = ['http://', 'https://', '/usr/', '/etc/', '/var/', '/tmp/', 'C:\\', '~/'];

/** Diretórios derivados: citar `node_modules/x` não é afirmar nada sobre a forma do projeto. */
const IGNORED_SEGMENTS = new Set(['node_modules', '.git', 'dist', 'build', 'target', 'vendor']);

/**
 * Extrai referências de caminho do texto.
 *
 * Cada segmento é `[\w.@-]*[\w@-]`: aceita escopo de pacote (`@izanagi/sdk`) e
 * ponto no meio (`users.ts`), mas **não termina em ponto** — sem isso,
 * `src/routes/users.ts.` no fim de uma frase entraria com o ponto colado e a
 * extensão sairia vazia. O casamento exige pelo menos uma barra e uma extensão
 * conhecida, que é o que separa caminho de arquivo de rota HTTP, de namespace
 * e de domínio.
 *
 * Espaço NÃO entra em segmento nenhum. Aceitá-lo (para cobrir caminho com
 * espaço, que é raro) fazia o casamento atravessar palavras inteiras:
 * `users.ts e app/models/user.rb` virava UMA referência, e a checagem passava
 * a medir outra coisa.
 */
export function extractPathReferences(text: string): string[] {
  const out = new Set<string>();
  const re = /(?:^|[\s"'`(\[<|,])((?:\.{0,2}\/)?[\w.@-]*[\w@-](?:\/[\w.@-]*[\w@-])+)(?=$|[\s"'`)\]>|,:;.!?])/gm;
  for (const match of text.matchAll(re)) {
    const raw = match[1];
    const ext = path.extname(raw).slice(1).toLowerCase();
    if (!FILE_EXTENSIONS.has(ext)) continue;
    if (IGNORED_PREFIXES.some((p) => raw.startsWith(p))) continue;
    const normalized = raw.replace(/^\.\//, '');
    if (normalized.split('/').some((seg) => IGNORED_SEGMENTS.has(seg))) continue;
    // `..` sai: o artefato está falando de fora do projeto, e a checagem não
    // tem o que dizer sobre isso.
    if (normalized.startsWith('../')) continue;
    out.add(normalized);
  }
  return [...out];
}

export interface GroundednessReport {
  /** Referências consideradas (já filtradas). */
  total: number;
  /** Referências cujo diretório-pai existe no projeto. */
  grounded: number;
  /** Caminhos cujo lugar não existe: o layout foi inventado. */
  ungrounded: string[];
  /** grounded/total em [0,1]. `null` quando não havia referência nenhuma. */
  ratio: number | null;
}

/** Teto de raízes-candidatas testadas por referência. Projeto com mais diretórios de topo que isto não fica mais claro testando todos. */
const MAX_SOURCE_ROOTS = 40;

/**
 * Raízes contra as quais uma referência pode ser resolvida: a raiz do projeto
 * e cada diretório de PRIMEIRO nível dele.
 *
 * Isto existe por um falso positivo real, encontrado rodando a checagem contra
 * o `docs/HANDOFF.md` deste próprio repositório: ele cita
 * `runtime/protocol/conversation.ts`, que existe — em `src/runtime/...`. Gente
 * e modelo escrevem caminho relativo à raiz de FONTE (`src/`, `app/`,
 * `packages/`), não à raiz do repositório, e reprovar isso encheria a
 * verificação de falso positivo contra exatamente o trabalho legítimo. Dezessete
 * de dezessete referências de um documento correto saíam como inventadas.
 *
 * Só o primeiro nível entra: descer mais faria qualquer caminho casar em algum
 * lugar, e a checagem pararia de medir alguma coisa.
 */
function sourceRoots(projectRoot: string): string[] {
  const roots = [projectRoot];
  try {
    for (const entry of fs.readdirSync(projectRoot, { withFileTypes: true })) {
      if (roots.length > MAX_SOURCE_ROOTS) break;
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.') || IGNORED_SEGMENTS.has(entry.name)) continue;
      roots.push(path.join(projectRoot, entry.name));
    }
  } catch {
    // Raiz ilegível: sobra a própria raiz, e o relatório sai mais severo — o
    // que é o lado seguro de errar aqui é o lado que NÃO reprova, então a
    // ausência de candidatas só reduz o que se consegue confirmar.
  }
  return roots;
}

/**
 * Confere as referências contra o disco. Nunca lança: erro de filesystem faz a
 * referência contar como não conferida, e o resultado diz isso pelo `total`.
 */
export function checkGroundedness(text: string, root: string): GroundednessReport {
  const refs = extractPathReferences(text);
  if (refs.length === 0) return { total: 0, grounded: 0, ungrounded: [], ratio: null };

  const resolvedRoot = path.resolve(root);
  const roots = sourceRoots(resolvedRoot);
  let grounded = 0;
  const ungrounded: string[] = [];

  for (const ref of refs) {
    let found = false;
    let insideProject = false;
    for (const base of roots) {
      const abs = path.resolve(base, ref);
      // Fora da raiz do projeto: não é afirmação sobre este projeto.
      if (abs !== resolvedRoot && !abs.startsWith(resolvedRoot + path.sep)) continue;
      insideProject = true;
      try {
        // O próprio arquivo existir é o caso forte. O diretório-pai existir é o
        // caso que a checagem realmente mede: propor arquivo novo num lugar que
        // existe é trabalho, não alucinação.
        if (fs.existsSync(abs) || fs.existsSync(path.dirname(abs))) {
          found = true;
          break;
        }
      } catch {
        // Caminho ilegível: tenta a próxima raiz.
      }
    }
    if (!insideProject) continue;
    if (found) grounded++;
    else ungrounded.push(ref);
  }

  const total = grounded + ungrounded.length;
  return { total, grounded, ungrounded, ratio: total === 0 ? null : grounded / total };
}
