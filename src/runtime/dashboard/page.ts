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
  .badge.pass, .badge.ok { background: #14532d; color: #86efac; }
  .badge.fail, .badge.error { background: #450a0a; color: #fca5a5; }
  .badge.blocked, .badge.pending { background: #451a03; color: #fdba74; }
  .badge.unknown { background: #27272a; color: #a1a1aa; }
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

function badge(status) {
  const s = (status || 'unknown').toLowerCase();
  return '<span class="badge ' + s + '">' + s + '</span>';
}
function fmtMs(ms) { return ms == null ? '-' : (ms < 1000 ? ms + 'ms' : (ms / 1000).toFixed(1) + 's'); }
function esc(s) { return String(s ?? '').replace(/[&<>]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

async function loadTab(tab) {
  currentTab = tab;
  document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('detail').innerHTML = '<div class="empty">Selecione um item à esquerda.</div>';
  const list = document.getElementById('list');
  list.innerHTML = '<div class="empty">carregando…</div>';

  if (tab === 'runs') {
    items = await (await fetch('/api/runs')).json();
    list.innerHTML = items.map((r, i) =>
      '<div class="list-item" data-i="' + i + '">' +
        '<div class="id">' + esc(r.runId) + '</div>' +
        '<div class="meta">' + badge(r.evaluation && r.evaluation.verdict) + ' ' + esc(r.task || '').slice(0, 40) + ' · ' + fmtMs(r.durationMs) + '</div>' +
      '</div>'
    ).join('') || '<div class="empty">nenhum run ainda — rode "izanagi run"</div>';
    list.querySelectorAll('.list-item').forEach((el) => el.addEventListener('click', () => selectRun(items[+el.dataset.i].runId, el)));
  }

  if (tab === 'arena') {
    items = await (await fetch('/api/benchmarks')).json();
    list.innerHTML = items.map((r, i) =>
      '<div class="list-item" data-i="' + i + '">' +
        '<div class="id">' + esc(r.id) + '</div>' +
        '<div class="meta">' + esc(r.suite) + ' · <span class="score">' + r.summary.avgScore + '</span> · ' + r.summary.passed + '/' + r.summary.total + '</div>' +
      '</div>'
    ).join('') || '<div class="empty">nenhum benchmark rodado ainda — "izanagi arena run"</div>';
    list.querySelectorAll('.list-item').forEach((el) => el.addEventListener('click', () => selectBenchmark(items[+el.dataset.i], el)));
  }

  if (tab === 'memory') {
    const m = await (await fetch('/api/memory')).json();
    list.innerHTML = '<div class="list-item active"><div class="id">resumo</div><div class="meta">agentes, skills, failures, learnings</div></div>';
    renderMemory(m);
  }
}

async function selectRun(runId, el) {
  document.querySelectorAll('.list-item').forEach((x) => x.classList.remove('active'));
  el.classList.add('active');
  const data = await (await fetch('/api/runs/' + runId)).json();
  renderRun(data.trace, data.artifacts);
}

function renderRun(trace, artifacts) {
  const ev = trace.evaluation;
  let html = '';
  html += '<section><h2>Run</h2>';
  html += '<div class="kv"><b>id</b>' + esc(trace.runId) + '</div>';
  html += '<div class="kv"><b>task</b>' + esc(trace.task) + '</div>';
  html += '<div class="kv"><b>status</b>' + badge(ev && ev.verdict) + '</div>';
  html += '<div class="kv"><b>duração</b>' + fmtMs(trace.durationMs) + '</div>';
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

  html += '<section><h2>Execution Graph (spans)</h2>';
  html += (trace.spans || []).map((s) =>
    '<div class="node-row">' + badge(s.status) + '<span class="name">' + esc(s.name) + ' <span style="color:#52525b">[' + esc(s.type) + ']</span></span><span class="dur">' + fmtMs(s.durationMs) + '</span></div>'
  ).join('') || '<div class="empty">sem spans</div>';
  html += '</section>';

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
  html += '<section><h2>Failure patterns ativos</h2><table><tr><th>pattern</th><th>ocorrências</th><th>confiança</th></tr>' +
    (m.failures || []).map((f) => '<tr><td>' + esc(f.pattern) + '</td><td>' + f.occurrences + '</td><td>' + f.confidence + '</td></tr>').join('') +
    '</table></section>';
  html += '<section><h2>Learnings</h2>' +
    (m.learnings || []).map((l) => '<div class="kv">' + esc(l.text) + '</div>').join('') +
    '</section>';
  document.getElementById('detail').innerHTML = html;
}

document.querySelectorAll('nav button').forEach((b) => b.addEventListener('click', () => loadTab(b.dataset.tab)));
loadTab('runs');
</script>
</body>
</html>
`;
