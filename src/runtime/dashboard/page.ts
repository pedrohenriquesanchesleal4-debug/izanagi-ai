/**
 * HTML/CSS/JS do Dashboard, embutido como string — sem build step, sem
 * dependência nova. Vanilla JS puro (fetch + DOM), tema técnico escuro.
 */
export const DASHBOARD_HTML = `<!doctype html>
<html lang="pt-br">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Izanagi Dashboard</title>
<style>
  :root {
    color-scheme: dark;
    --bg: #08080a; --bg-2: #0e0e11; --bg-3: #151519; --border: #212127; --border-soft: #1a1a1f;
    --text: #e4e4e7; --text-dim: #9a9aa2; --text-faint: #55555f;
    --accent: #8b7cf6; --accent-dim: #4c3fa8;
    --ok: #34d399; --ok-bg: #0d2b21; --bad: #f87171; --bad-bg: #2d1113; --warn: #fbbf24; --warn-bg: #2b210a;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    background: var(--bg); color: var(--text); font-size: 13px; line-height: 1.6; -webkit-font-smoothing: antialiased;
  }
  header {
    padding: 16px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 14px;
    background: linear-gradient(180deg, var(--bg-2), var(--bg));
  }
  header .mark {
    width: 22px; height: 22px; border-radius: 6px; flex-shrink: 0;
    background: linear-gradient(135deg, var(--accent), var(--accent-dim));
    display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; color: #fff;
  }
  header h1 { font-size: 14px; font-weight: 700; margin: 0; color: var(--text); letter-spacing: 0.04em; }
  header .tag { color: var(--text-faint); font-size: 11px; }
  header .spacer { flex: 1; }
  .stats { display: flex; gap: 22px; padding: 10px 24px; border-bottom: 1px solid var(--border); background: var(--bg-2); }
  .stat { display: flex; flex-direction: column; gap: 2px; }
  .stat .n { font-size: 17px; font-weight: 700; color: var(--text); }
  .stat .n.ok { color: var(--ok); }
  .stat .n.bad { color: var(--bad); }
  .stat .l { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-faint); }
  nav { display: flex; gap: 4px; padding: 0 24px; border-bottom: 1px solid var(--border); background: var(--bg); }
  nav button {
    background: none; border: none; color: var(--text-dim); padding: 11px 14px; cursor: pointer;
    font-family: inherit; font-size: 12px; font-weight: 500; border-bottom: 2px solid transparent; transition: color .15s;
  }
  nav button:hover { color: var(--text); }
  nav button.active { color: var(--text); border-bottom-color: var(--accent); }
  main { display: grid; grid-template-columns: 320px 1fr; height: calc(100vh - 140px); }
  .list { overflow-y: auto; border-right: 1px solid var(--border); background: var(--bg-2); }
  .list-item { padding: 11px 16px; border-bottom: 1px solid var(--border-soft); cursor: pointer; transition: background .12s; }
  .list-item:hover { background: var(--bg-3); }
  .list-item.active { background: var(--bg-3); border-left: 2px solid var(--accent); padding-left: 14px; }
  .list-item .id { color: var(--text); font-weight: 600; font-size: 12px; }
  .list-item .meta { color: var(--text-dim); font-size: 11px; margin-top: 3px; }
  .badge {
    display: inline-block; padding: 2px 7px; border-radius: 20px; font-size: 9.5px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.03em;
  }
  .badge.pass, .badge.pass_with_warnings, .badge.ok { background: var(--ok-bg); color: var(--ok); }
  .badge.fail, .badge.error, .badge.blocked { background: var(--bad-bg); color: var(--bad); }
  .badge.running, .badge.pending { background: var(--warn-bg); color: var(--warn); }
  .badge.unknown { background: var(--bg-3); color: var(--text-dim); }
  .badge.verified { background: var(--ok-bg); color: var(--ok); }
  .badge.unverified { background: var(--warn-bg); color: var(--warn); }
  .badge.failed { background: var(--bad-bg); color: var(--bad); }
  .muted { color: var(--text-dim); font-weight: 400; font-size: 12px; }
  #live { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-faint); }
  #live .dot { width: 6px; height: 6px; border-radius: 50%; background: #3f3f46; transition: background .2s; }
  #live.on .dot { background: var(--ok); box-shadow: 0 0 6px var(--ok); animation: pulse 2s ease-in-out infinite; }
  #live.on { color: var(--ok); }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
  .batch { display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
  .batch-node { border: 1px solid var(--border); border-radius: 6px; padding: 8px 12px; font-size: 11px; flex: 1; min-width: 150px; background: var(--bg-2); }
  .batch-label { color: var(--text-faint); font-size: 10px; width: 18px; padding-top: 9px; }
  .detail { padding: 24px; overflow-y: auto; }
  .empty { color: var(--text-faint); padding: 60px 20px; text-align: center; }
  section { margin-bottom: 26px; }
  section h2 {
    font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent);
    margin: 0 0 10px; padding-bottom: 6px; border-bottom: 1px solid var(--border-soft);
  }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 6px 8px; text-align: left; border-bottom: 1px solid var(--border-soft); font-size: 12px; }
  th { color: var(--text-faint); font-weight: 500; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.03em; }
  tr:hover td { background: var(--bg-2); }
  .node-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--border-soft); }
  .node-row .name { flex: 1; color: var(--text); }
  .node-row .dur { color: var(--text-faint); font-size: 11px; }
  .kv { display: flex; gap: 8px; color: var(--text-dim); font-size: 11.5px; margin-bottom: 5px; }
  .kv b { color: var(--text-faint); font-weight: 500; min-width: 90px; }
  .score { font-weight: 700; color: var(--text); }
</style>
</head>
<body>
<header>
  <span class="mark">イ</span>
  <h1>IZANAGI</h1>
  <span class="tag">dashboard local — foundation (Fase 7)</span>
  <span class="spacer"></span>
  <span id="live"><span class="dot"></span><span id="live-label">conectando…</span></span>
</header>
<div class="stats" id="stats"></div>
<nav>
  <button data-tab="runs" class="active">Runs</button>
  <button data-tab="arena">Arena</button>
  <button data-tab="memory">Memory</button>
</nav>
<main>
  <div class="list" id="list"></div>
  <div class="detail" id="detail"><div class="empty">Selecione um item à esquerda.</div></div>
</main>
<script>
let currentTab = 'runs';
let items = [];
let selectedRunId = null;

function badge(status) {
  const s = (status || 'running').toLowerCase();
  return '<span class="badge ' + s + '">' + s + '</span>';
}
function fmtMs(ms) { return ms == null ? '-' : (ms < 1000 ? ms + 'ms' : (ms / 1000).toFixed(1) + 's'); }
function esc(s) { return String(s ?? '').replace(/[&<>]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

async function loadTab(tab) {
  currentTab = tab;
  selectedRunId = null;
  document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('detail').innerHTML = '<div class="empty">Selecione um item à esquerda.</div>';
  await refreshList();
}

function renderStats(runs) {
  const stats = document.getElementById('stats');
  const total = runs.length;
  const finished = runs.filter((r) => r.evaluation);
  const passed = finished.filter((r) => r.evaluation.verdict === 'PASS' || r.evaluation.verdict === 'PASS_WITH_WARNINGS').length;
  const running = total - finished.length;
  const avgScore = finished.length ? (finished.reduce((a, r) => a + (r.evaluation.score || 0), 0) / finished.length).toFixed(2) : '-';
  const healingRuns = runs.filter((r) => (r.healing || []).length > 0).length;
  stats.innerHTML =
    stat(total, 'runs') +
    stat(finished.length ? Math.round((passed / finished.length) * 100) + '%' : '-', 'pass rate', passed >= finished.length / 2 ? 'ok' : 'bad') +
    stat(avgScore, 'score médio') +
    stat(running, 'em andamento', running > 0 ? 'ok' : '') +
    stat(healingRuns, 'com healing');
}
function stat(n, label, cls) {
  return '<div class="stat"><span class="n' + (cls ? ' ' + cls : '') + '">' + n + '</span><span class="l">' + label + '</span></div>';
}

async function refreshList() {
  const list = document.getElementById('list');

  if (currentTab === 'runs') {
    items = await (await fetch('/api/runs')).json();
    list.innerHTML = items.map((r, i) =>
      '<div class="list-item' + (r.runId === selectedRunId ? ' active' : '') + '" data-i="' + i + '">' +
        '<div class="id">' + esc(r.runId) + '</div>' +
        '<div class="meta">' + badge(r.evaluation && r.evaluation.verdict) + ' ' + esc(r.task || '').slice(0, 40) + ' · ' + fmtMs(r.durationMs) + '</div>' +
      '</div>'
    ).join('') || '<div class="empty">nenhum run ainda — rode "izanagi run"</div>';
    list.querySelectorAll('.list-item').forEach((el) => el.addEventListener('click', () => selectRun(items[+el.dataset.i].runId, el)));
    renderStats(items);
  }

  if (currentTab === 'arena') {
    document.getElementById('stats').innerHTML = '';
    items = await (await fetch('/api/benchmarks')).json();
    list.innerHTML = items.map((r, i) =>
      '<div class="list-item" data-i="' + i + '">' +
        '<div class="id">' + esc(r.id) + '</div>' +
        '<div class="meta">' + esc(r.suite) + ' · <span class="score">' + r.summary.avgScore + '</span> · ' + r.summary.passed + '/' + r.summary.total + '</div>' +
      '</div>'
    ).join('') || '<div class="empty">nenhum benchmark rodado ainda — "izanagi arena run"</div>';
    list.querySelectorAll('.list-item').forEach((el) => el.addEventListener('click', () => selectBenchmark(items[+el.dataset.i], el)));
  }

  if (currentTab === 'memory') {
    document.getElementById('stats').innerHTML = '';
    const m = await (await fetch('/api/memory')).json();
    list.innerHTML = '<div class="list-item active"><div class="id">resumo</div><div class="meta">agentes, skills, modelos, failures, learnings</div></div>';
    renderMemory(m);
  }
}

async function selectRun(runId, el) {
  selectedRunId = runId;
  document.querySelectorAll('.list-item').forEach((x) => x.classList.remove('active'));
  el.classList.add('active');
  const data = await (await fetch('/api/runs/' + runId)).json();
  renderRun(data.trace, data.artifacts);
}

function renderExecutionGraph(trace) {
  const graph = trace.graph;
  if (!graph || !graph.parallelBatches || !graph.parallelBatches.length) {
    return (trace.spans || []).map((s) =>
      '<div class="node-row">' + badge(s.status) + '<span class="name">' + esc(s.name) + ' <span style="color:#52525b">[' + esc(s.type) + ']</span></span><span class="dur">' + fmtMs(s.durationMs) + '</span></div>'
    ).join('') || '<div class="empty">sem spans</div>';
  }
  const byId = Object.fromEntries((graph.nodes || []).map((n) => [n.id, n]));
  return graph.parallelBatches.map((batch, i) =>
    '<div class="batch"><span class="batch-label">' + (i + 1) + '</span>' +
    batch.map((id) => {
      const n = byId[id] || { id, status: 'unknown' };
      return '<div class="batch-node">' + badge(n.status) + ' <b>' + esc(n.id) + '</b><br><span style="color:#52525b">' + esc(n.agent || (n.skills || []).join(',') || n.kind) + ' · ' + fmtMs(n.durationMs) + '</span></div>';
    }).join('') +
    '</div>'
  ).join('') + '<div class="kv" style="margin-top:6px"><b>legenda</b>cada linha é um lote paralelo — nós lado a lado rodaram ao mesmo tempo</div>';
}

function renderRun(trace, artifacts) {
  const ev = trace.evaluation;
  const running = !ev;
  let html = '';
  html += '<section><h2>Run</h2>';
  html += '<div class="kv"><b>id</b>' + esc(trace.runId) + '</div>';
  html += '<div class="kv"><b>task</b>' + esc(trace.task) + '</div>';
  html += '<div class="kv"><b>status</b>' + (running ? badge('running') : badge(ev.verdict)) + '</div>';
  html += '<div class="kv"><b>modo</b>' + esc(trace.mode || 'legado (sem Commander)') + '</div>';
  html += '<div class="kv"><b>duração</b>' + fmtMs(trace.durationMs) + (running ? ' (em andamento)' : '') + '</div>';
  html += '<div class="kv"><b>modelo</b>' + esc(trace.model || '-') + '</div>';
  html += '<div class="kv"><b>agentes</b>' + esc((trace.agents || []).join(', ')) + '</div>';
  html += '<div class="kv"><b>skills</b>' + esc((trace.skills || []).join(', ')) + '</div>';
  html += '<div class="kv"><b>tokens</b>' + (trace.tokens ? trace.tokens.total : '-') + '</div>';
  html += '</section>';

  if (ev) {
    html += '<section><h2>Evaluation</h2>';
    html += '<div class="kv"><b>score</b><span class="score">' + ev.score + '</span></div>';
    html += '<div class="kv"><b>verdict</b>' + badge(ev.verdict) + '</div>';
    if (ev.metrics) {
      html += '<table>' + Object.entries(ev.metrics).map(([k, v]) => '<tr><td>' + esc(k) + '</td><td>' + v + '</td></tr>').join('') + '</table>';
    }
    html += '</section>';
  }

  html += renderVerification(trace);
  html += renderEconomy(trace);
  html += '<section><h2>Execution Graph</h2>' + renderExecutionGraph(trace) + '</section>';
  html += renderConversation(trace);

  if (trace.healing && trace.healing.length) {
    html += '<section><h2>Healing</h2>';
    html += trace.healing.map((h) =>
      '<div class="kv"><b>' + esc(h.kind) + '</b>' + esc(h.category || h.failureKind) + ' — ' + esc((h.message || '').slice(0, 100)) + '</div>'
    ).join('');
    html += '</section>';
  }

  html += '<section><h2>Artifacts</h2>';
  html += '<table><tr><th>nome</th><th>versão</th><th>válido</th><th>produtor</th></tr>' +
    (artifacts || []).map((a) => '<tr><td>' + esc(a.name) + '</td><td>' + a.version + '</td><td>' + (a.valid ? '✔' : '✖') + '</td><td>' + esc((a.producer && (a.producer.agent || a.producer.skill)) || '-') + '</td></tr>').join('') +
    '</table></section>';

  document.getElementById('detail').innerHTML = html;
}

/**
 * Verificacao por no. O que importa aqui nao e o numero de VERIFIED, e quais
 * ficaram sem evidencia conclusiva: e a diferenca entre "terminou" e "o agente
 * disse que terminou".
 */
function renderVerification(trace) {
  const rows = trace.verification || [];
  if (!rows.length) return '';
  const verified = rows.filter((v) => v.status === 'VERIFIED').length;
  let html = '<section><h2>Verificação <span class="muted">' + verified + '/' + rows.length + ' VERIFIED</span></h2>';
  html += '<table><tr><th>tarefa</th><th>status</th><th>score</th><th>motivo</th></tr>';
  html += rows.map((v) =>
    '<tr><td>' + esc(v.nodeId) + '</td><td>' + badge(v.status) + '</td><td>' + (v.score != null ? v.score.toFixed(2) : '-') +
    '</td><td>' + esc(v.reason || '') + (v.unmet && v.unmet.length ? '<div class="muted">' + esc(v.unmet.slice(0, 3).join('; ')) + '</div>' : '') + '</td></tr>'
  ).join('');
  return html + '</table></section>';
}

/** Token Economy Engine: para onde foi o orcamento deste run. */
function renderEconomy(trace) {
  const t = trace.telemetry;
  if (!t) return '';
  const linhas = [
    ['tokens entrada', t.inputTokens],
    ['tokens saída', t.outputTokens],
    ['custo estimado', t.estimatedCostUsd != null ? '$' + Number(t.estimatedCostUsd).toFixed(4) : null],
    ['cache local (hits)', t.cacheHits],
    ['cache do provider (tokens)', t.providerCachedTokens],
    ['contexto poupado (chars)', t.contextCharsSaved],
    ['tarefas em paralelo', t.parallelTasks],
    ['escaladas de modelo', t.modelEscalations],
    ['retries', t.retries],
    ['tool calls', t.toolCalls],
    ['degradações aplicadas', Array.isArray(t.degradationsApplied) ? t.degradationsApplied.join(', ') : t.degradationsApplied],
  ].filter((l) => l[1] !== undefined && l[1] !== null && l[1] !== '' && l[1] !== 0);
  if (!linhas.length) return '';
  let html = '<section><h2>Economia</h2><table>';
  html += linhas.map((l) => '<tr><td>' + esc(l[0]) + '</td><td>' + esc(String(l[1])) + '</td></tr>').join('');
  return html + '</table></section>';
}

/**
 * Conversa entre agentes. Carrega referencia de artefato e resumo de uma
 * linha, nunca o conteudo produzido — o dashboard mostra exatamente o que o
 * trace guarda, sem reconstruir nada.
 */
function renderConversation(trace) {
  const msgs = trace.conversation || [];
  if (!msgs.length) return '';
  const tipos = {};
  msgs.forEach((m) => { tipos[m.type] = (tipos[m.type] || 0) + 1; });
  const resumo = Object.keys(tipos).map((k) => k + '=' + tipos[k]).join(', ');
  let html = '<section><h2>Conversa entre agentes <span class="muted">' + msgs.length + ' mensagens · ' + esc(resumo) + '</span></h2>';
  html += '<table><tr><th>de</th><th>para</th><th>tipo</th><th>resumo</th><th>artefatos</th></tr>';
  html += msgs.map((m) =>
    '<tr><td>' + esc(m.from) + '</td><td>' + esc(m.to) + '</td><td>' + esc(m.type) + '</td><td>' + esc(m.summary) +
    '</td><td class="muted">' + esc((m.artifactRefs || []).map((r) => String(r).split(':')[1] || r).join(', ')) + '</td></tr>'
  ).join('');
  return html + '</table></section>';
}

function selectBenchmark(report, el) {
  document.querySelectorAll('.list-item').forEach((x) => x.classList.remove('active'));
  el.classList.add('active');
  let html = '<section><h2>Benchmark Report</h2>';
  html += '<div class="kv"><b>id</b>' + esc(report.id) + '</div>';
  html += '<div class="kv"><b>suite</b>' + esc(report.suite) + '</div>';
  html += '<div class="kv"><b>framework</b>v' + esc(report.frameworkVersion) + '</div>';
  html += '<div class="kv"><b>score médio</b><span class="score">' + report.summary.avgScore + '</span></div>';
  html += '<div class="kv"><b>passou</b>' + report.summary.passed + '/' + report.summary.total + '</div>';
  html += '</section><section><h2>Por domínio</h2><table>' +
    Object.entries(report.byDomain || {}).map(([d, s]) => '<tr><td>' + esc(d) + '</td><td>' + s + '</td></tr>').join('') +
    '</table></section><section><h2>Casos</h2><table><tr><th>caso</th><th>domínio</th><th>status</th><th>score</th></tr>' +
    report.results.map((r) => '<tr><td>' + esc(r.caseId) + '</td><td>' + esc(r.domain) + '</td><td>' + badge(r.passed ? 'pass' : 'fail') + '</td><td>' + r.score + '</td></tr>').join('') +
    '</table></section>';
  document.getElementById('detail').innerHTML = html;
}

function renderMemory(m) {
  let html = '<section><h2>Agentes</h2><table><tr><th>agente</th><th>runs</th><th>score médio</th></tr>' +
    Object.entries(m.agents || {}).map(([id, s]) => '<tr><td>' + esc(id) + '</td><td>' + s.runs + '</td><td>' + s.avgScore.toFixed(2) + '</td></tr>').join('') +
    '</table></section>';
  html += '<section><h2>Skills</h2><table><tr><th>skill</th><th>uses</th></tr>' +
    Object.entries(m.skills || {}).map(([id, s]) => '<tr><td>' + esc(id) + '</td><td>' + s.uses + '</td></tr>').join('') +
    '</table></section>';
  html += '<section><h2>Modelos</h2><table><tr><th>modelo</th><th>runs</th><th>taxa de sucesso</th><th>tokens médios</th></tr>' +
    Object.entries(m.models || {}).map(([id, s]) => '<tr><td>' + esc(id) + '</td><td>' + s.runs + '</td><td>' + Math.round((s.successes / Math.max(1, s.runs)) * 100) + '%</td><td>' + Math.round(s.avgTokens) + '</td></tr>').join('') +
    '</table></section>';
  html += '<section><h2>Failure patterns ativos</h2><table><tr><th>pattern</th><th>ocorrências</th><th>confiança</th></tr>' +
    (m.failures || []).map((f) => '<tr><td>' + esc(f.pattern) + '</td><td>' + f.occurrences + '</td><td>' + f.confidence + '</td></tr>').join('') +
    '</table></section>';
  html += '<section><h2>Learnings</h2>' +
    (m.learnings || []).map((l) => '<div class="kv">' + esc(l.text) + '</div>').join('') +
    '</section>';
  document.getElementById('detail').innerHTML = html;
}

function connectLive() {
  const live = document.getElementById('live');
  const label = document.getElementById('live-label');
  const source = new EventSource('/api/events');
  source.onopen = () => { live.classList.add('on'); label.textContent = 'live'; };
  source.onerror = () => { live.classList.remove('on'); label.textContent = 'reconectando…'; };
  source.onmessage = async (evt) => {
    let payload;
    try { payload = JSON.parse(evt.data); } catch { return; }
    if (payload.kind === 'runs' && (currentTab === 'runs')) {
      await refreshList();
      if (selectedRunId) {
        const data = await (await fetch('/api/runs/' + selectedRunId)).json();
        renderRun(data.trace, data.artifacts);
      }
    }
    if (payload.kind === 'benchmarks' && currentTab === 'arena') {
      await refreshList();
    }
  };
}

document.querySelectorAll('nav button').forEach((b) => b.addEventListener('click', () => loadTab(b.dataset.tab)));
loadTab('runs');
connectLive();
</script>
</body>
</html>
`;
