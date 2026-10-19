import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';
import {
  AgentCapabilityRegistry,
  CORE_EXECUTION_PROFILES,
  profileForAgent,
} from '../registry/capabilities.js';
import { AgentFactory } from '../factories/agent-factory.js';
import { SkillResolver } from '../routing/resolver.js';
import {
  SkillRuntime,
  selectRelevantSkillsWithProvenance,
} from '../skills/runtime.js';
import {
  inferDesignDirection,
  auditVisualQuality,
  renderDesignIntelligenceBlock,
} from '../design/intelligence.js';
import { validateArtifact, simulatedArtifact } from '../contracts/artifacts.js';
import { findAgentFile, resolveSkillPath } from '../../cli/framework.js';
import { buildNodePrompt } from '../../cli/commands/run.js';
import type { GraphNode } from '../types.js';

const BASE_DIR = process.cwd();

test('Phase 1 — 7 Core Execution Profiles consolidam os 23 agentes preservando retrocompatibilidade', () => {
  const profileIds = Object.keys(CORE_EXECUTION_PROFILES);
  assert.deepEqual(profileIds, [
    'commander',
    'builder',
    'frontend-designer',
    'researcher',
    'reviewer',
    'security-reviewer',
    'educator-docs',
  ]);

  const registry = new AgentCapabilityRegistry({ baseDir: BASE_DIR });
  const allAgents = registry.list();
  assert.ok(allAgents.length >= 22, 'todos os agentes do catálogo continuam carregados');

  for (const cap of allAgents) {
    assert.ok(cap.profile, `agente ${cap.id} deve possuir profile consolidado`);
    assert.ok(
      cap.profile! in CORE_EXECUTION_PROFILES,
      `profile ${cap.profile} de ${cap.id} deve pertencer aos 7 perfis centrais`,
    );
  }

  // Mapeamentos diretos esperados
  assert.equal(profileForAgent('orchestrator'), 'commander');
  assert.equal(profileForAgent('senior-engineer'), 'builder');
  assert.equal(profileForAgent('database'), 'builder');
  assert.equal(profileForAgent('form-engineer'), 'frontend-designer');
  assert.equal(profileForAgent('animation'), 'frontend-designer');
  assert.equal(profileForAgent('researcher'), 'researcher');
  assert.equal(profileForAgent('qa'), 'reviewer');
  assert.equal(profileForAgent('adversarial-critic'), 'reviewer');
  assert.equal(profileForAgent('security'), 'security-reviewer');
  assert.equal(profileForAgent('docs'), 'educator-docs');

  // Resolução por alias de perfil no registry e na CLI
  for (const pid of profileIds) {
    const resolvedCap = registry.get(pid);
    assert.ok(resolvedCap, `AgentCapabilityRegistry.get("${pid}") deve resolver para agente primário`);
    const resolvedFile = findAgentFile(BASE_DIR, BASE_DIR, pid);
    assert.ok(resolvedFile && fs.existsSync(resolvedFile), `findAgentFile("${pid}") deve localizar JSON válido`);
  }
});

test('Phase 1 — AgentFactory: assessNeed rejeita prompts triviais/cobertos e persist:false não polui disco', () => {
  const resolver = new SkillResolver({ baseDir: BASE_DIR });
  const factory = new AgentFactory(resolver);

  // Prompt curto/trivial não deve criar agente
  const trivial = factory.assessNeed('corrigir bug simples');
  assert.equal(trivial.needed, false);

  // Tarefa coberta pelos agentes e skills existentes (ex.: API REST + Postgres + Auth)
  const covered = factory.assessNeed(
    'implementar API REST com PostgreSQL, Prisma, autenticação JWT e testes unitários',
  );
  assert.equal(covered.needed, false, `deveria estar coberto, mas retornou: ${covered.reason}`);
  assert.ok(covered.coveredByAgent, 'deve apontar o agente existente que cobre a tarefa');

  // Geração efêmera (persist: false) com force: true não escreve em agents/generated/
  const genDir = path.join(BASE_DIR, 'agents', 'generated');
  const beforeFiles = fs.existsSync(genDir) ? fs.readdirSync(genDir) : [];

  const created = factory.generate({
    requirement: ' Desenvolver driver de telemetria para protocolo aeroespacial ARINC-429 ',
    name: 'arinc-telemetry-agent',
    permissions: ['fs:read', 'sudo rm -rf /', 'shell:*'],
    persist: false,
    force: true,
  });

  assert.equal(created.file, '');
  assert.equal(created.validation.valid, true);
  // Least-privilege: permissões perigosas (sudo, shell:*) são sanitizadas
  assert.deepEqual(created.genome.permissions, ['fs:read']);

  const afterFiles = fs.existsSync(genDir) ? fs.readdirSync(genDir) : [];
  assert.deepEqual(afterFiles, beforeFiles, 'persist:false jamais deve gravar arquivos em agents/generated/');
});

test('Phase 2 — resolveSkillPath: bloqueia path traversal e descobre catálogo (.skills/ e skills/)', () => {
  assert.equal(resolveSkillPath(BASE_DIR, BASE_DIR, '../package.json'), null);
  assert.equal(resolveSkillPath(BASE_DIR, BASE_DIR, '../../etc/passwd'), null);
  assert.equal(resolveSkillPath(BASE_DIR, BASE_DIR, 'skill/invalida'), null);

  const v2Taste = resolveSkillPath(BASE_DIR, BASE_DIR, 'design-taste');
  assert.ok(v2Taste && fs.existsSync(v2Taste), 'deve resolver design-taste no catálogo');

  const v2Refero = resolveSkillPath(BASE_DIR, BASE_DIR, 'refero-styles');
  assert.ok(v2Refero && fs.existsSync(v2Refero), 'deve resolver refero-styles no catálogo');
});

test('Phase 2 — SkillRuntime: progressive disclosure em 3 níveis, hash SHA-256 e proveniência completa', () => {
  const runtime = new SkillRuntime({ cwd: BASE_DIR, baseDir: BASE_DIR });

  const meta = runtime.loadSkill('anti-ai-slop', 'metadata');
  const instr = runtime.loadSkill('anti-ai-slop', 'instructions');
  const refs = runtime.loadSkill('anti-ai-slop', 'references', { maxLines: 200, loadReferences: true });

  assert.ok(meta && instr && refs, 'todos os 3 níveis de disclosure devem carregar');
  assert.equal(meta.sha256.length, 64, 'deve calcular SHA-256 do conteúdo real da skill');
  assert.equal(meta.sha256, instr.sha256, 'hash SHA-256 do arquivo fonte é determinístico');
  assert.ok(
    meta.tokens < instr.tokens,
    `nível metadata (${meta.tokens} tok) deve ser mais enxuto que instructions (${instr.tokens} tok)`,
  );
  assert.ok(
    instr.tokens <= refs.tokens,
    `nível instructions (${instr.tokens} tok) deve ser <= references (${refs.tokens} tok)`,
  );

  // Seleção com sinônimos de domínio + preservação de explicitSkills do nó
  const candidates = [
    'anti-ai-slop',
    'design-directions',
    'editorial-layout',
    'frontend',
    'chaos-engineering',
    'iac-terraform',
  ];
  const selection = selectRelevantSkillsWithProvenance(
    candidates,
    'criar uma landing page para uma cafeteria artesanal em São Paulo',
    6,
    ['design-directions', 'anti-ai-slop'],
  );

  const selectedAliases = selection.selected.map((s) => s.alias);
  assert.ok(selectedAliases.includes('design-directions'), 'skill explícita design-directions preservada');
  assert.ok(selectedAliases.includes('anti-ai-slop'), 'skill explícita anti-ai-slop preservada');
  assert.ok(selectedAliases.includes('frontend'), 'skill de domínio frontend selecionada via sinônimos');
  assert.ok(!selectedAliases.includes('iac-terraform'), 'skill irrelevante iac-terraform descartada');
  assert.ok(
    selection.dropped.some((d) => d.alias === 'iac-terraform' && d.reason === 'low-relevance'),
    'proveniência registra motivo exato do descarte (low-relevance)',
  );
});

test('Phase 2 & 6 — buildNodePrompt: registra skillProvenance no nó e injeta Design Intelligence em nós visuais', () => {
  const node: GraphNode = {
    id: 'design-direction',
    kind: 'agent',
    agent: 'animation',
    skills: ['design-directions', 'design-taste', 'anti-ai-slop'],
    outputs: ['direction'],
    status: 'pending',
  };

  const prompt = buildNodePrompt(
    node,
    {
      task: 'Criar landing page para cafeteria especial e torrefação artesanal com assinatura mensal',
      agent: {},
      skillChain: ['design-directions', 'anti-ai-slop', 'frontend'],
    },
    BASE_DIR,
    { noCacheFoundation: true },
  );

  const provenance = node.metadata?.skillProvenance as any;
  assert.ok(provenance, 'node.metadata.skillProvenance deve ser populado por buildNodePrompt');
  assert.ok(provenance.loaded.length >= 3, 'as skills explícitas do nó devem ser carregadas');
  assert.ok(provenance.totalTokensInjected > 0, 'totalTokensInjected deve ser contabilizado');

  assert.match(prompt, /### Skill: design-directions/);
  assert.match(prompt, /### Skill: design-taste/);
  assert.match(prompt, /### Skill: anti-ai-slop/);
  assert.match(prompt, /DESIGN INTELLIGENCE & ANTI-AI-SLOP PIPELINE/, 'deve injetar pipeline de Design Intelligence em nó visual');
  assert.match(prompt, /Editorial Tactile Warmth/, 'cafeteria artesanal deve inferir direção editorial-warm (light-first), não bg-zinc-950 forçado');
});

test('Phase 6 — DesignIntelligence: infere direções distintas por nicho e quebra monocultura bg-zinc-950', () => {
  const cafe = inferDesignDirection('Landing page para cafeteria artesanal, padaria de fermentação natural e gastronomia');
  const clinic = inferDesignDirection('Sistema web para clínica médica, saúde integrativa e agendamento de pacientes');
  const fintech = inferDesignDirection('Plataforma bancária de investimentos, tesouraria corporativa e pagamentos PIX');
  const devtools = inferDesignDirection('Observability CLI, terminal benchmark and Kubernetes log telemetry platform');
  const creative = inferDesignDirection('Portfólio 3D WebGL interativo com shaders GLSL para estúdio criativo');
  const luxury = inferDesignDirection('E-commerce atelier de alta joalheria, moda editorial e relojoaria');

  assert.equal(cafe.niche, 'editorial-warm');
  assert.equal(cafe.primary.themeMode, 'light-first');

  assert.equal(clinic.niche, 'clinical-swiss');
  assert.equal(clinic.primary.themeMode, 'light-first');

  assert.equal(fintech.niche, 'fintech-institutional');
  assert.equal(devtools.niche, 'devtools-oled');
  assert.equal(devtools.primary.themeMode, 'dark-first');

  assert.equal(creative.niche, 'kinetic-creative');
  assert.equal(luxury.niche, 'ecommerce-atelier');

  const uniqueBackgrounds = new Set([
    cafe.primary.palette.background,
    clinic.primary.palette.background,
    fintech.primary.palette.background,
    devtools.primary.palette.background,
    creative.primary.palette.background,
  ]);
  assert.ok(uniqueBackgrounds.size >= 4, 'nichos distintos devem produzir paletas de fundo distintas');

  const block = renderDesignIntelligenceBlock('Criar dashboard médico para clínica');
  assert.match(block, /Swiss Clinical Clarity/);
  assert.match(block, /Estados Obrigatórios de Componentes/);
});

test('Phase 6 — auditVisualQuality & Contratos Visuais: barra AI-slop e aprova UI artesanal', () => {
  const slopMarkup = `
    <section className="bg-gradient-to-r from-purple-500 to-indigo-600 p-8 font-sans">
      <h1>Unleash the power of Next-Gen AI Workflow</h1>
      <p>Seamless integration to supercharge your workflow and revolutionize the way you work.</p>
      <div className="rounded-2xl shadow-lg p-6">Card 1</div>
      <div className="rounded-2xl shadow-lg p-6">Card 2</div>
      <div className="rounded-2xl shadow-lg p-6">Card 3</div>
      <div className="rounded-2xl shadow-lg p-6">Card 4</div>
      <div className="rounded-2xl shadow-lg p-6">Card 5</div>
    </section>
  `;

  const slopAudit = auditVisualQuality(slopMarkup);
  assert.equal(slopAudit.passed, false, 'deve reprovar código com clichês de IA e gradiente roxo-azul');
  assert.ok(slopAudit.score < 0.7, `score (${slopAudit.score}) deve ficar abaixo do corte de aprovação`);
  assert.ok(slopAudit.findings.some((f) => f.rule === 'generic-copy-cliche'));
  assert.ok(slopAudit.findings.some((f) => f.rule === 'unjustified-neon-purple-gradient'));

  const craftMarkup = `
    <main className="bg-[#FAF7F2] text-[#1C1917] selection:bg-[#9A3412]/15">
      <header className="border-b border-[#E7E0D6] px-6 py-5 flex items-center justify-between">
        <span className="font-serif text-2xl tracking-tight">Torrefação Santa Tereza</span>
        <nav aria-label="Navegação principal" className="flex gap-6 text-sm">
          <a href="#safra" className="hover:text-[#9A3412] focus-visible:outline-2 focus-visible:outline-[#9A3412] transition-colors">Safra 2026</a>
        </nav>
      </header>
      <section aria-labelledby="hero-heading" className="grid grid-cols-12 gap-8 px-6 py-16">
        <div className="col-span-12 lg:col-span-7">
          <p className="font-mono text-xs uppercase tracking-widest text-[#57534E]">Microlotes · Mantiqueira de Minas · 1.350m</p>
          <h1 id="hero-heading" className="font-serif text-5xl leading-[1.06] mt-3">Torra clara semanal com rastreabilidade por talhão.</h1>
          <button type="button" disabled={isSubmitting} className="mt-8 bg-[#9A3412] text-white px-6 py-3 hover:bg-[#7C2D12] focus-visible:ring-2 disabled:opacity-50 transition-colors">
            {isLoading ? 'Reservando lote...' : 'Receber torra de quarta-feira'}
          </button>
          {error && <p role="alert" className="text-[#B91C1C] text-sm mt-2">{error}</p>}
        </div>
      </section>
    </main>
  `;

  const craftAudit = auditVisualQuality(craftMarkup);
  assert.equal(craftAudit.passed, true, 'deve aprovar markup com tipografia intencional, estados e copy específico');
  assert.ok(craftAudit.score >= 0.85, `score (${craftAudit.score}) deve refletir alto craft`);

  // Validação dos contratos de artefato 'direction' e 'design-system'
  const simDirection = simulatedArtifact('direction', {
    nodeId: 'design-direction',
    label: 'animation',
    objective: 'Landing page para cafeteria especial',
  });
  const validDir = validateArtifact('direction', simDirection);
  assert.equal(validDir.valid, true, `simulatedArtifact('direction') deve passar: ${validDir.issues.join(', ')}`);

  const simDesignSystem = simulatedArtifact('design-system', {
    nodeId: 'design-system',
    label: 'form-engineer',
    objective: 'Landing page para cafeteria especial',
  });
  const validDs = validateArtifact('design-system', simDesignSystem);
  assert.equal(validDs.valid, true, `simulatedArtifact('design-system') deve passar: ${validDs.issues.join(', ')}`);
});
