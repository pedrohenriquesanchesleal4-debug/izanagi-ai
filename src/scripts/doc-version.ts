/**
 * Banner de versão dos documentos de raiz.
 *
 * O `v3.6.0` corrigiu à mão banners presos em `2.11.0`/`1.0.0` e a drift
 * voltou na primeira minor seguinte: `bump.ts` e `release.ts` mexem só no
 * `package.json`, e nenhum teste conferia o resto. Documentação que afirma uma
 * versão que o código já passou é da mesma família dos bugs que o
 * `HANDOFF.md` registra (o framework afirmando um número que ninguém conferiu).
 *
 * A regra escolhida é MAJOR.MINOR, não a versão exata, e o motivo importa:
 * patch neste repositório é conserto, não mudança de arquitetura, então exigir
 * que um patch reescreva `ARCHITECTURE.md` produziria edição vazia. Minor é
 * onde a arquitetura muda, e é onde alguém já está escrevendo o changelog.
 *
 * E o banner NÃO é estampado automaticamente. Escrever `3.19.0` num documento
 * que ninguém leu é justamente afirmar um número que não aconteceu: o que
 * existe aqui é o gate (`staleDocVersions`, usado pelo teste) e o aviso que
 * `bump`/`release` imprimem com a lista do que precisa de revisão humana.
 */
import fs from 'fs';
import path from 'path';

/** Documento de raiz que declara a própria versão, e como ela é escrita lá. */
export interface DocVersionBanner {
  /** Caminho relativo à raiz do repositório. */
  file: string;
  /**
   * Captura a versão no grupo 1. Cada documento escreve o banner de um jeito
   * diferente, e unificar a forma é mudança de texto sem ganho: o que precisa
   * ser único é a FONTE do número, não a frase.
   */
  pattern: RegExp;
}

/**
 * Os documentos que declaram versão. `README.md` e `ARCHITECTURE.md` não vão
 * no pacote npm (`package.json` → `files`), e por isso a ausência do arquivo é
 * tratada como "não distribuído", nunca como falha.
 */
export const DOC_VERSION_BANNERS: DocVersionBanner[] = [
  { file: 'README.md', pattern: /^>\s*\*\*v(\d+\.\d+\.\d+)\*\*/m },
  { file: 'ROADMAP.md', pattern: /^>\s*Versão atual:\s*\*\*(\d+\.\d+\.\d+)\*\*/m },
  { file: 'ARCHITECTURE.md', pattern: /^>\s*Version:\s*(\d+\.\d+\.\d+)/m },
  { file: 'SYSTEM.md', pattern: /^>\s*Version\s+(\d+\.\d+\.\d+)/m },
  { file: 'RULES.md', pattern: /^>\s*Version\s+(\d+\.\d+\.\d+)/m },
  { file: 'AGENTS.md', pattern: /^>\s*Version\s+(\d+\.\d+\.\d+)/m },
];

/** `3.18.4` → `3.18`. Comparar por minor é a decisão registrada no topo. */
export function minorOf(version: string): string {
  const [major, minor] = version.split('.');
  return `${major}.${minor}`;
}

export interface DeclaredDocVersion {
  file: string;
  /** `null` quando o arquivo existe mas o banner não foi encontrado. */
  declared: string | null;
  /** `false` quando o arquivo não existe nesta árvore (não distribuído). */
  present: boolean;
}

/** Lê o que cada documento AFIRMA, sem julgar. */
export function readDocVersions(rootDir: string): DeclaredDocVersion[] {
  return DOC_VERSION_BANNERS.map((banner) => {
    const abs = path.join(rootDir, banner.file);
    if (!fs.existsSync(abs)) return { file: banner.file, declared: null, present: false };
    const match = banner.pattern.exec(fs.readFileSync(abs, 'utf-8'));
    return { file: banner.file, declared: match ? match[1] : null, present: true };
  });
}

export interface StaleDoc {
  file: string;
  declared: string | null;
  expectedMinor: string;
  /** `missing-banner` quando o arquivo existe e o padrão não casou. */
  reason: 'minor-drift' | 'missing-banner';
}

/**
 * Documentos presentes cuja MAJOR.MINOR declarada não é a do `package.json`.
 * Arquivo ausente não entra: ausência é "não distribuído", não desatualização.
 */
export function staleDocVersions(rootDir: string, version: string): StaleDoc[] {
  const expectedMinor = minorOf(version);
  const stale: StaleDoc[] = [];
  for (const doc of readDocVersions(rootDir)) {
    if (!doc.present) continue;
    if (doc.declared === null) {
      stale.push({ file: doc.file, declared: null, expectedMinor, reason: 'missing-banner' });
      continue;
    }
    if (minorOf(doc.declared) !== expectedMinor) {
      stale.push({ file: doc.file, declared: doc.declared, expectedMinor, reason: 'minor-drift' });
    }
  }
  return stale;
}

/**
 * Aviso para `bump`/`release`. Devolve string vazia quando não há nada a
 * revisar, para que o caller não imprima cabeçalho de lista vazia.
 */
export function docVersionWarning(rootDir: string, version: string): string {
  const stale = staleDocVersions(rootDir, version);
  if (stale.length === 0) return '';
  const lines = stale.map((doc) => doc.reason === 'missing-banner'
    ? `  - ${doc.file}: banner de versão não encontrado`
    : `  - ${doc.file}: declara ${doc.declared}, esperado ${doc.expectedMinor}.x`);
  return [
    `Documentos com banner de versão para revisar (${stale.length}):`,
    ...lines,
    'O banner não é estampado automaticamente: revise o conteúdo e atualize a versão na mesma edição.',
  ].join('\n');
}
