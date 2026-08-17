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
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    background: #0a0a0c; color: #d4d4d8; font-size: 13px; line-height: 1.5;
  }
  header { padding: 14px 20px; border-bottom: 1px solid #27272a; display: flex; align-items: center; gap: 16px; }
  header h1 { font-size: 14px; font-weight: 600; margin: 0; color: #e4e4e7; letter-spacing: 0.02em; }
  header .tag { color: #71717a; font-size: 11px; }
  nav { display: flex; gap: 2px; padding: 0 20px; border-bottom: 1px solid #27272a; }
  nav button {
    background: none; border: none; color: #71717a; padding: 10px 14px; cursor: pointer;
    font-family: inherit; font-size: 12px; border-bottom: 2px solid transparent;
  }
  nav button.active { color: #e4e4e7; border-bottom-color: #52525b; }
  main { display: grid; grid-template-columns: 340px 1fr; height: calc(100vh - 90px); }
  .list { overflow-y: auto; border-right: 1px solid #27272a; }
  .list-item { padding: 10px 16px; border-bottom: 1px solid #18181b; cursor: pointer; }
  .list-item:hover { background: #18181b; }
  .list-item.active { background: #1f1f23; border-left: 2px solid #52525b; }
  .list-item .id { color: #e4e4e7; font-weight: 600; font-size: 12px; }
  .list-item .meta { color: #71717a; font-size: 11px; margin-top: 2px; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 600; }
  .badge.pass, .badge.pass_with_warnings, .badge.ok { background: #14532d; color: #86efac; }
  .badge.fail, .badge.error, .badge.blocked { background: #450a0a; color: #fca5a5; }
  .badge.running, .badge.pending { background: #451a03; color: #fdba74; }
  .badge.unknown { background: #27272a; color: #a1a1aa; }
  #live { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: #52525b; }
  #live .dot { width: 6px; height: 6px; border-radius: 50%; background: #3f3f46; }
  #live.on .dot { background: #4ade80; box-shadow: 0 0 4px #4ade80; }
  #live.on { color: #86efac; }
  .batch { display: flex; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
  .batch-node { border: 1px solid #27272a; border-radius: 4px; padding: 6px 10px; font-size: 11px; flex: 1; min-width: 140px; }
  .batch-label { color: #3f3f46; font-size: 10px; width: 16px; padding-top: 8px; }
  .detail { padding: 20px; overflow-y: auto; }
  .empty { color: #52525b; padding: 40px; text-align: center; }
  section { margin-bottom: 24px; }
  section h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #71717a; margin: 0 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 4px 8px; text-align: left; border-bottom: 1px solid #18181b; font-size: 12px; }
  th { color: #71717a; font-weight: 500; }
  .node-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; border-bottom: 1px solid #18181b; }
  .node-row .name { flex: 1; color: #d4d4d8; }
  .node-row .dur { color: #52525b; font-size: 11px; }
  .kv { display: flex; gap: 6px; color: #a1a1aa; font-size: 11px; margin-bottom: 4px; }
  .kv b { color: #71717a; font-weight: 500; min-width: 90px; }
  .score { font-weight: 700; }
</style>
</head>
<body>
<header>
  <h1>IZANAGI</h1>
  <span class="tag">dashboard local — foundation (Fase 7)</span>
  <span id="live"><span class="dot"></span><span id="live-label">conectando…</span></span>
</header>
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
  }

  if (currentTab === 'arena') {
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

  html += '<section><h2>Execution Graph</h2>' + renderExecutionGraph(trace) + '</section>';

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
