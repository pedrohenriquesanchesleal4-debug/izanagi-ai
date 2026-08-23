import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportAll, GENERATED_MARKER, provenanceFooter } from '../../exporters.js';

/**
 * Idempotência byte-a-byte do exporter multi-CLI (Wave 5, frente A):
 *
 * BUG: os rodapés de proveniência embutiam o caminho absoluto do cwd da máquina
 * geradora ("Gerado pelo Izanagi AI em `${baseDir}`"), o que fazia a mesma fonte
 * gerar bytes diferentes em máquinas diferentes e congelava nos adapters
 * commitados o caminho da máquina que gerou (ex.: C:\Users\...\NexusAI).
 *
 * CONTRATO: dado o MESMO conteúdo-fonte (agents/, skills/) em dois diretórios
 * raiz DIFERENTES (simulando máquinas distintas), `exportAll` deve produzir
 * arquivos BYTE-IDÊNTICOS. Nenhum caminho absoluto da máquina geradora pode
 * vazar para o conteúdo; caminhos relativos funcionais (ex.: `agents/x.json`
 * citado como fonte) continuam permitidos.
 *
 * Estratégia: dois sandboxes tmpdir com fixtures idênticas e caminhos absolutos
 * de comprimentos distintos; export em ambos; comparação byte-a-byte de cada
 * par de arquivos correspondentes + varredura anti-vazamento.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** Fixture mínima porém representativa: 2 agentes (ramos com/sem model, chains, handoffs) + 2 skills (com/sem references.md). */
function writeFixtures(root: string): void {
  fs.mkdirSync(path.join(root, 'agents'), { recursive: true });

  const seniorEngineer = {
    name: 'Senior Engineer',
    role: 'Full-stack dev de alta performance',
    identity: 'Artesão de código: tipagem estrita, TDD, zero stubs.',
    model: 'sonnet',
    skills: ['tdd'],
    chains: { bug: ['bug-hunter', 'tdd'], fullstack: ['architect', 'tdd'] },
    always: ['Validar build antes de encerrar'],
    never: ['Entregar stubs'],
    handoffs: [{ to: 'qa', reason: 'validar qualidade antes do merge' }]
  };
  fs.writeFileSync(
    path.join(root, 'agents', 'senior-engineer-agent.json'),
    `${JSON.stringify(seniorEngineer, null, 2)}\n`,
    'utf8'
  );

  const discovery = {
    name: 'Discovery',
    role: 'Pré-produção: entrevista condicional e prompt rico',
    identity: 'Descoberta guiada antes de codar.'
  };
  fs.writeFileSync(
    path.join(root, 'agents', 'discovery-agent.json'),
    `${JSON.stringify(discovery, null, 2)}\n`,
    'utf8'
  );

  fs.mkdirSync(path.join(root, 'skills', 'tdd'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'skills', 'tdd', 'SKILL.md'),
    '---\ndescription: Test-Driven Development com Iron Law.\n---\n\n# TDD\n\nEscreva o teste antes.\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(root, 'skills', 'tdd', 'references.md'),
    '# Referências TDD\n\n- Kent Beck\n',
    'utf8'
  );

  fs.mkdirSync(path.join(root, 'skills', 'deep-research'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'skills', 'deep-research', 'SKILL.md'),
    '---\ndescription: |\n  Pesquisa multi-fonte na web.\n  Síntese com fontes citadas.\n---\n\n# Deep Research\n\nPlaneje buscas.\n',
    'utf8'
  );
}

/** Lista recursiva de arquivos do sandbox como caminhos relativos POSIX ordenados. */
function listFilesRelative(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else if (entry.isFile()) {
        out.push(path.relative(root, abs).split(path.sep).join('/'));
      }
    }
  };
  walk(root);
  return out.sort();
}

/** Primeira linha divergente entre dois textos, para diagnóstico legível de falha. */
function firstDiffLine(a: string, b: string): string {
  const linesA = a.split('\n');
  const linesB = b.split('\n');
  const max = Math.max(linesA.length, linesB.length);
  for (let i = 0; i < max; i++) {
    const x = linesA[i];
    const y = linesB[i];
    if (x !== y) {
      return `linha ${i + 1}: maquinaA=${JSON.stringify(x ?? '<ausente>')} maquinaB=${JSON.stringify(y ?? '<ausente>')}`;
    }
  }
  return 'textos iguais por linha (divergência só em encoding?)';
}

interface SandboxPair {
  machineA: string;
  machineB: string;
}

/** Dois "machines": fixtures idênticas, caminhos absolutos deliberadamente distintos. */
function makeSandboxPair(): SandboxPair {
  const baseA = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-prov-a-'));
  const baseB = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-prov-b-'));
  // Profundidades/nomes diferentes ⇒ caminhos absolutos com comprimentos diferentes.
  const machineA = path.join(baseA, 'workspace');
  const machineB = path.join(baseB, 'diretorio-de-trabalho-da-maquina-b-bem-mais-comprido');
  writeFixtures(machineA);
  writeFixtures(machineB);
  return { machineA, machineB };
}

function cleanup(pair: SandboxPair): void {
  for (const root of [pair.machineA, pair.machineB]) {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('provenanceFooter: formato determinístico, sem caminho absoluto e compatível com GENERATED_MARKER', () => {
  const footer = provenanceFooter('claude');

  // Formato exato (mudança de comportamento intencional: sem " em <caminho-absoluto>").
  assert.equal(footer, 'Gerado pelo Izanagi AI: `izanagi export --cli claude`');

  // Determinismo: mesma entrada, mesma saída, sempre.
  assert.equal(provenanceFooter('claude'), footer);

  // Contrato do writeIfAbsent: o rodapé PRECISA conter GENERATED_MARKER para que a
  // regeneração sobrescreva gerações anteriores em vez de preservá-las como edição manual.
  assert.ok(footer.includes(GENERATED_MARKER), 'footer deve conter GENERATED_MARKER');

  // Nenhum caminho absoluto do sistema de arquivos pode vazar:
  // - nada de cwd ou tmpdir da máquina que roda o teste
  // - nenhuma linha começa com "/" (absoluto POSIX) nem contém "\" ou drive Windows "C:\"
  assert.ok(!footer.includes(process.cwd()), 'footer não deve conter process.cwd()');
  assert.ok(!footer.includes(os.tmpdir()), 'footer não deve conter os.tmpdir()');
  assert.doesNotMatch(footer, /^\/|\\\\|[A-Za-z]:[\\\\/]/m);
});

test('provenanceFooter: todos os CLIs suportados recebem footer próprio, determinístico e distinto', () => {
  const clis = ['claude', 'codex', 'cursor', 'copilot', 'kimi', 'opencode', 'all'];
  const seen = new Set<string>();
  for (const cli of clis) {
    const footer = provenanceFooter(cli);
    assert.equal(footer, provenanceFooter(cli), `footer de ${cli} deve ser determinístico`);
    assert.ok(footer.includes(`izanagi export --cli ${cli}`), `footer de ${cli} deve citar o comando correto`);
    assert.ok(!footer.includes(' em `'), `footer de ${cli} não pode embutir caminho (padrão legado)`);
    seen.add(footer);
  }
  assert.equal(seen.size, clis.length, 'footers de CLIs distintos devem ser distintos entre si');
});

test('export all: mesma fonte em máquinas distintas produz arquivos BYTE-IDÊNTICOS (idempotência cross-machine)', () => {
  const pair = makeSandboxPair();
  try {
    const createdA = exportAll(pair.machineA);
    const createdB = exportAll(pair.machineB);

    assert.ok(createdA.length > 0, 'export na máquina A deve criar arquivos');
    assert.equal(createdA.length, createdB.length, 'ambas as máquinas devem gerar a mesma quantidade de arquivos');

    const expectedSet = [...createdA].sort();
    assert.deepEqual([...createdB].sort(), expectedSet, 'mesmo conjunto de caminhos relativos nas duas máquinas');

    for (const rel of createdA) {
      const bytesA = fs.readFileSync(path.join(pair.machineA, rel));
      const bytesB = fs.readFileSync(path.join(pair.machineB, rel));
      assert.ok(
        bytesA.equals(bytesB),
        `arquivo ${rel} difere entre máquinas: ${firstDiffLine(bytesA.toString('utf8'), bytesB.toString('utf8'))}`
      );
    }

    // Idempotência local: re-executar no MESMO diretório não altera nenhum byte.
    exportAll(pair.machineA);
    for (const rel of createdA) {
      const bytesAfter = fs.readFileSync(path.join(pair.machineA, rel));
      const bytesFirstPass = fs.readFileSync(path.join(pair.machineB, rel));
      assert.ok(
        bytesAfter.equals(bytesFirstPass),
        `re-execução local alterou ${rel}: ${firstDiffLine(bytesAfter.toString('utf8'), bytesFirstPass.toString('utf8'))}`
      );
    }

    // Sanidade do ambiente de teste: o próprio repo tem o marker, fixtures não precisam.
    assert.ok(repoRoot.length > 0);
    assert.ok(GENERATED_MARKER.length > 0);
  } finally {
    cleanup(pair);
  }
});

test('export all: nenhum arquivo gerado embute caminho absoluto da máquina geradora (padrão de footer legado abolido)', () => {
  const pair = makeSandboxPair();
  try {
    exportAll(pair.machineA);

    for (const rel of listFilesRelative(pair.machineA)) {
      const content = fs.readFileSync(path.join(pair.machineA, rel), 'utf8');
      assert.ok(
        !content.includes(pair.machineA),
        `${rel} contém o caminho absoluto da máquina geradora (${pair.machineA})`
      );
      assert.ok(
        !content.includes(pair.machineB),
        `${rel} contém o caminho absoluto de outra máquina (${pair.machineB})`
      );
      assert.ok(
        !content.includes(`${GENERATED_MARKER} em`),
        `${rel} usa o padrão legado "${GENERATED_MARKER} em <caminho>" — footer deve ser determinístico`
      );
    }
  } finally {
    cleanup(pair);
  }
});
