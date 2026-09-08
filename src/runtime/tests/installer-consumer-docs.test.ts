/**
 * O que o `izanagi init` escreve na raiz de um projeto que só CONSOME o framework.
 *
 * O bug que estes testes fecham foi encontrado rodando `/init` do Claude Code num
 * workspace consumidor: `AGENTS.md`, `SYSTEM.md` e `RULES.md` eram copiados
 * LITERALMENTE do pacote para a raiz do projeto, e esses três são os documentos de
 * desenvolvimento DO PRÓPRIO FRAMEWORK. O `AGENTS.md` da fonte manda rodar
 * `cargo test --workspace`, `npm run build` e `(cd packages/sdk && npm test)`, e
 * descreve a árvore `crates/`/`packages/`/`src/`. Num consumidor npm nada disso
 * existe: a instância de IA seguinte leria comandos que não rodam e procuraria
 * pastas que não estão lá.
 *
 * E o caminho é automático: `postinstall` chama `installToProject` com todos os
 * packs em todo `npm install izanagi-ai`, então o documento errado não dependia de
 * ninguém digitar `izanagi init`.
 *
 * A regra que estes testes travam: **um documento na raiz do projeto descreve o
 * PROJETO.** O espelho fiel do framework continua existindo, em `.agents/`, que é
 * onde `resolveFrameworkRoot` o procura.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  buildConsumerAgentsDoc,
  getPackageDir,
  installToProject,
  isFrameworkRepo,
} from '../../installer.js';
import { GENERATED_MARKER } from '../../exporters.js';

function tmpConsumer(files: Record<string, string> = {}): string {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'izanagi-consumer-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf-8');
  }
  return dir;
}

/** Só o pack `core` — é ele que carrega os documentos de raiz. */
function initCore(dir: string): void {
  installToProject(dir, ['core']);
}

function readRoot(dir: string, file: string): string {
  return fs.readFileSync(path.join(dir, file), 'utf-8');
}

test('init: o AGENTS.md da raiz do consumidor não carrega comando que não existe lá', () => {
  const dir = tmpConsumer({ 'package.json': JSON.stringify({ name: 'meu-app', dependencies: { 'izanagi-ai': '^3.20.1' } }) });
  try {
    initCore(dir);
    const doc = readRoot(dir, 'AGENTS.md');

    // As quatro seções do AGENTS.md da fonte que só valem no repo do framework.
    for (const forasteiro of ['cargo test --workspace', 'npm run build', 'packages/sdk', 'crates/izanagi_core']) {
      assert.doesNotMatch(
        doc,
        new RegExp(forasteiro.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        `"${forasteiro}" é do repo-fonte: num consumidor npm não existe o que rodar`,
      );
    }

    // E o que de fato roda aqui precisa estar dito, senão a remoção só deixa um vazio.
    assert.match(doc, /npx izanagi doctor/, 'o documento tem de dizer qual comando funciona neste projeto');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('init: o AGENTS.md do consumidor PRESERVA as seções que valem em qualquer projeto', () => {
  const dir = tmpConsumer();
  try {
    initCore(dir);
    const doc = readRoot(dir, 'AGENTS.md');
    // Cortar seção demais transformaria o conserto em perda: o catálogo de
    // agentes e as regras de execução/anti-generic são o valor do arquivo.
    assert.match(doc, /22 Agentes/i, 'o catálogo de agentes vale em qualquer projeto');
    assert.match(doc, /Anti-Generic/i, 'a regra de craft vale em qualquer projeto');
    assert.match(doc, new RegExp(GENERATED_MARKER), 'sem marcador o próximo init não pode regenerar com segurança');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('init: o espelho fiel do framework continua em .agents/, onde o runtime o procura', () => {
  const dir = tmpConsumer();
  try {
    initCore(dir);
    // `resolveFrameworkRoot` aponta para `.agents/` quando `.agents/core` existe:
    // é de lá que sai a referência canônica, e ali a cópia literal está CORRETA.
    const espelho = fs.readFileSync(path.join(dir, '.agents', 'AGENTS.md'), 'utf-8');
    const fonte = fs.readFileSync(path.join(getPackageDir(), 'AGENTS.md'), 'utf-8');
    assert.equal(espelho, fonte, 'o espelho do framework é cópia byte a byte da fonte');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('init: documento de raiz escrito à mão NÃO é sobrescrito', () => {
  const meu = '# AGENTS.md\n\nRegras deste projeto, escritas por uma pessoa.\n';
  const dir = tmpConsumer({ 'AGENTS.md': meu, 'RULES.md': '# minhas regras\n' });
  try {
    initCore(dir);
    // O `copyFileSync` anterior destruía isto sem avisar. Arquivo sem o marcador
    // é de quem escreveu, e "não previsto" não autoriza apagar.
    assert.equal(readRoot(dir, 'AGENTS.md'), meu, 'init apagou um arquivo que não era dele');
    assert.equal(readRoot(dir, 'RULES.md'), '# minhas regras\n');
    // SYSTEM.md não existia: esse pode ser escrito.
    assert.match(readRoot(dir, 'SYSTEM.md'), new RegExp(GENERATED_MARKER));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('init: documento de raiz COM marcador é regenerado', () => {
  const dir = tmpConsumer();
  try {
    initCore(dir);
    const antes = readRoot(dir, 'AGENTS.md');
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), `sujo\n\n> ${GENERATED_MARKER}: x\n`, 'utf-8');
    initCore(dir);
    assert.equal(readRoot(dir, 'AGENTS.md'), antes, 'arquivo gerado precisa poder ser atualizado');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('init: dentro do repo-fonte do framework, os documentos de raiz não são tocados', () => {
  // Rodar init no próprio checkout é o caso em que a cópia literal seria certa e
  // a versão de consumidor seria um estrago: ela apagaria as seções 3/4/5/9, que
  // ali descrevem o projeto de verdade.
  assert.equal(isFrameworkRepo(getPackageDir()), true, 'o checkout do framework precisa se reconhecer');
  const dir = tmpConsumer({ 'package.json': JSON.stringify({ name: 'meu-app' }) });
  try {
    assert.equal(isFrameworkRepo(dir), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }

  const fonte = tmpConsumer({
    'package.json': JSON.stringify({ name: 'izanagi-ai', version: '9.9.9' }),
    'AGENTS.md': '# o meu proprio AGENTS\n',
  });
  try {
    initCore(fonte);
    assert.equal(readRoot(fonte, 'AGENTS.md'), '# o meu proprio AGENTS\n');
    assert.equal(fs.existsSync(path.join(fonte, 'SYSTEM.md')), false, 'no repo-fonte init não inventa documento de raiz');
  } finally { fs.rmSync(fonte, { recursive: true, force: true }); }
});

test('init: o config declara a versão REAL do pacote, não uma constante', () => {
  const dir = tmpConsumer();
  try {
    initCore(dir);
    const config = JSON.parse(fs.readFileSync(path.join(dir, '.izanagi', 'izanagi.config.json'), 'utf-8'));
    const real = JSON.parse(fs.readFileSync(path.join(getPackageDir(), 'package.json'), 'utf-8')).version;
    // Estava `version: '2.1.0'` fixo no código, com o framework em 3.20.x: um
    // arquivo de configuração afirmando dezoito minors de diferença. Número que
    // se reporta é número que aconteceu, inclusive quando o número é a versão.
    assert.equal(config.version, real);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('init: references/ é instalado, porque o runtime as injeta de lá', () => {
  const dir = tmpConsumer();
  try {
    initCore(dir);
    // `run.ts` monta `<baseDir>/references/` e injeta as referências curadas no
    // prompt. Com `.agents/` como baseDir e nenhum pack copiando `references`, a
    // injeção existia e nunca encontrava arquivo nenhum, em projeto nenhum.
    assert.ok(
      fs.existsSync(path.join(dir, '.agents', 'references', 'stack-2026.md')),
      'a injeção de referência curada procura aqui e não achava nada',
    );
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('CLAUDE.md gerado: o ponteiro para o AGENTS.md da raiz não promete o que ele não tem', () => {
  // O bullet "Fonte da verdade" dizia que o `AGENTS.md` da raiz servia "só para:
  // comandos avançados de dev, estrutura completa de pastas, release flow" — as
  // seções 3, 4, 5 e 9, que a versão de consumidor não tem. Ponteiro pendurado:
  // a instância seguinte abriria o arquivo procurando o que não está lá.
  const dir = tmpConsumer();
  try {
    initCore(dir);
    installToProject(dir, ['core', 'agents', 'skills'], 'claude');
    const claude = readRoot(dir, 'CLAUDE.md');
    assert.doesNotMatch(claude, /`AGENTS\.md`: só para: comandos avançados de dev/);
    assert.match(claude, /\.agents\/AGENTS\.md/, 'a referência completa precisa ter um endereço válido');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('buildConsumerAgentsDoc: seção universal não carrega afirmação que só vale no repo-fonte', () => {
  const doc = buildConsumerAgentsDoc(getPackageDir());
  // A seção 1 é universal e continha "Este repositório É o framework (não um app
  // que o usa)" mais um ponteiro para a seção 3, que aqui não existe. Uma frase
  // falsa dentro de uma seção correta contradiz a seção 0 três parágrafos acima.
  assert.doesNotMatch(doc, /Este repositório É o framework/);
  assert.doesNotMatch(doc, /<!--\s*izanagi:source-only/, 'o marcador não pode vazar para a saída');

  // Nenhum ponteiro órfão para as seções omitidas. O rodapé é a exceção: ele
  // DIZ quais foram omitidas, que é informação, não referência quebrada.
  const corpo = doc.split(/^---$/m).slice(0, -1).join('\n');
  assert.doesNotMatch(corpo, /seção [3459]\b/i, 'ponteiro para seção que a versão de consumidor não tem');
});

test('buildConsumerAgentsDoc: nenhum separador `---` duplicado', () => {
  const doc = buildConsumerAgentsDoc(getPackageDir());
  assert.doesNotMatch(doc, /^---\n+---$/m, 'a seção da fonte já termina em `---`: somar o próprio deixa dois');
});

test('buildConsumerAgentsDoc: deriva da fonte, não é prosa duplicada', () => {
  const doc = buildConsumerAgentsDoc(getPackageDir());
  const fonte = fs.readFileSync(path.join(getPackageDir(), 'AGENTS.md'), 'utf-8');
  // O documento do consumidor SELECIONA seções da fonte. Reescrever o texto à
  // mão criaria uma segunda cópia para divergir da primeira, que é o defeito que
  // este arquivo inteiro existe para consertar.
  const universal = fonte.match(/^## 7\..*$/m);
  assert.ok(universal, 'a seção 7 precisa existir na fonte para o teste significar algo');
  assert.match(doc, new RegExp(universal[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(doc, /^## 4\./m, 'a seção de comandos de desenvolvimento é do repo-fonte');
});
