import test from 'node:test';
import assert from 'node:assert/strict';
import { auditVisualQuality, inferDesignDirection } from '../design/intelligence.js';

// Recorte fiel do que o Claude gerou para uma landing de tatuagem em 2026-11-24:
// passava em todos os sinais de "geração 1" e ainda parecia feito com IA.
const CLAUDE_LOOK = `
<style>
:root{--bg:#F4EFE5;--ink:#1c1a17;--accent:#9A3412;--serif:"Iowan Old Style","Palatino Linotype",serif}
body{background:var(--bg);font-family:var(--serif)}
.eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:.14em}
.label{text-transform:uppercase}.meta{text-transform:uppercase}
.row{border-top:1px solid #d9d0c0}.row2{border-bottom:1px solid #d9d0c0}.a{border-top:1px solid}.b{border-top:1px solid}
.c{border-bottom:1px solid}.d{border-bottom:1px solid}
</style>
<h1>Uma linha, <em>uma</em> agulha, uma pele.</h1>
<p class="eyebrow">Tatuagem fine-line · São Paulo · desde 2019 · Pinheiros</p>
<span>01 ·</span><span>02 ·</span><span>03 ·</span>
<button>Marcar uma conversa</button>`;

const SIGNATURE = `
<style>
:root{--bg:#2A1810;--ink:#EED9B4;--accent:#F0A202}
body{background:var(--bg);font-family:"Anybody",system-ui,sans-serif}
h1{font-variation-settings:"wdth" 75,"wght" 900;animation:rise linear both;animation-timeline:scroll()}
@media (prefers-reduced-motion: reduce){h1{animation:none}}
</style>
<h1>A massa cresce enquanto você rola.</h1>
<canvas id="forno" aria-label="Fornada em andamento"></canvas>
<button>Reservar a fornada das 16h30</button>`;

test('auditVisualQuality: reprova o "bom gosto padrão" de IA (geração 2)', () => {
  const report = auditVisualQuality(CLAUDE_LOOK);
  const tell = report.tells.find((t) => t.rule === 'ai-tasteful-default-cluster');
  assert.ok(tell, 'deveria detectar o cluster creme + serif + itálico + terracota + caixa-alta');
  assert.equal(report.passed, false);
});

test('auditVisualQuality: aprova direção com conceito próprio e movimento ligado ao scroll', () => {
  const report = auditVisualQuality(SIGNATURE);
  assert.ok(!report.tells.some((t) => t.rule === 'ai-tasteful-default-cluster'));
});

test('auditVisualQuality: Premium Noir & Gold com foto real e scroll narrativo não é falso positivo', () => {
  const premium = `
<style>body{background:#0B0A08;font-family:Poppins,sans-serif}.eyebrow{text-transform:uppercase;letter-spacing:.14em}
.k{text-transform:uppercase}.m{text-transform:uppercase}</style>
<h1>Sua empresa está pagando <span class="gold-text">mais imposto</span> do que deveria?</h1>
<img src="https://images.unsplash.com/photo-123?w=1600" alt="Mão segurando moeda de um real">
<span>01 ·</span><span>02 ·</span><span>03 ·</span><span>04 ·</span>
<script>gsap.registerPlugin(ScrollTrigger)</script>`;
  assert.ok(!auditVisualQuality(premium).tells.some((t) => t.rule === 'ai-tasteful-default-cluster'));
});

test('inferDesignDirection: nicho gastronômico não devolve mais creme + serif como padrão', () => {
  const cafe = inferDesignDirection('Landing page para padaria de fermentação natural');
  const spec = JSON.stringify(cafe.primary);
  assert.doesNotMatch(spec, /#FAF6F0|Instrument Serif|Fraunces|itálico editorial/);
  assert.ok(auditVisualQuality(spec).tells.every((t) => t.rule !== 'ai-tasteful-default-cluster'));
});
