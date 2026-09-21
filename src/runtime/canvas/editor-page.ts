/**
 * Canvas Orchestration — editor visual (SPA vanilla, zero dependências).
 *
 * Uma única string exportada: `CANVAS_EDITOR_HTML`. O servidor
 * (`src/runtime/canvas/server.ts`) entrega esta página em GET /. Todo o
 * desenho de nós/arestas é DOM+SVG dentro de um mundo com `transform`
 * (translate/scale), animado exclusivamente por classes CSS (opacity e
 * transform), sem layout thrashing.
 *
 * A página conversa apenas com os endpoints JSON/SSE do servidor: nenhuma
 * lógica de execução vive aqui. Eventos do run chegam por EventSource
 * (`workflow-event`), e o estado é derivado da timeline, nunca inventado.
 */

export const CANVAS_EDITOR_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Canvas Editor · Izanagi AI</title>
<style>
  :root {
    --bg: #09090b;
    --panel: #131316;
    --panel2: #1a1a1f;
    --line: #2a2a31;
    --text: #e4e4e7;
    --muted: #8b8b94;
    --faint: #5b5b64;
    --cyan: #22d3ee;
    --emerald: #34d399;
    --red: #f87171;
    --amber: #fbbf24;
    --blue: #60a5fa;
    --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    --sans: Inter, system-ui, -apple-system, sans-serif;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--mono);
    font-size: 12px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  button, select, input, textarea { font-family: var(--mono); font-size: 12px; }
  button {
    background: var(--panel2);
    color: var(--text);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 4px 10px;
    cursor: pointer;
    white-space: nowrap;
  }
  button:hover { border-color: var(--cyan); color: var(--cyan); }
  button:disabled { opacity: 0.4; cursor: default; border-color: var(--line); color: var(--muted); }
  button.primary { background: #0e3a44; border-color: #155e75; color: #a5f3fc; }
  button.danger { border-color: #7f1d1d; color: var(--red); }
  input[type=text], input[type=number], select, textarea {
    background: #0c0c0f;
    color: var(--text);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 3px 6px;
    min-width: 0;
  }
  input:focus, select:focus, textarea:focus { outline: none; border-color: var(--cyan); }
  .mono { font-family: var(--mono); }

  #topbar {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 10px;
    border-bottom: 1px solid var(--line);
    background: var(--panel);
    flex: 0 0 auto;
  }
  #topbar .brand { color: var(--cyan); font-weight: 700; letter-spacing: 0.04em; }
  #topbar .sep { width: 1px; height: 18px; background: var(--line); }
  #topbar .spacer { flex: 1 1 auto; }
  #taskInput { width: 220px; }
  #providerSelect { width: 130px; }
  #layoutSelect { width: 110px; }
  #runStatusBadge {
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid var(--line);
    color: var(--muted);
    text-transform: lowercase;
  }
  #runStatusBadge.running { color: var(--cyan); border-color: #155e75; }
  #runStatusBadge.paused { color: var(--amber); border-color: #78350f; }
  #runStatusBadge.completed, #runStatusBadge.dry-run { color: var(--emerald); border-color: #065f46; }
  #runStatusBadge.failed { color: var(--red); border-color: #7f1d1d; }
  #runStatusBadge.cancelled { color: var(--muted); border-color: var(--line); }
  #headlessBadge { color: var(--amber); }

  #layoutRow { display: flex; flex: 1 1 auto; min-height: 0; }
  #sidebar {
    width: 210px; flex: 0 0 auto;
    background: var(--panel);
    border-right: 1px solid var(--line);
    overflow-y: auto;
    padding: 8px;
  }
  #sidebar h3 { color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; margin: 8px 2px 6px; }
  #canvasList { list-style: none; }
  #canvasList li {
    padding: 5px 8px;
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  #canvasList li:hover { color: var(--text); background: var(--panel2); }
  #canvasList li.active { color: var(--cyan); border-color: #164e63; background: #0c1620; }

  #stage { flex: 1 1 auto; display: flex; min-width: 0; }
  #viewport {
    flex: 1 1 auto; position: relative;
    background:
      linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
    background-size: 24px 24px;
    overflow: hidden;
    cursor: default;
  }
  #viewport.panning { cursor: grab; }
  #world {
    position: absolute; top: 0; left: 0;
    transform-origin: 0 0;
    width: 0; height: 0;
  }
  #edges { position: absolute; top: 0; left: 0; overflow: visible; pointer-events: none; }
  #edges path.edge { pointer-events: stroke; stroke-width: 14; stroke: transparent; cursor: pointer; }
  #edges path.edgeStroke { pointer-events: none; }
  #edges .e-label { pointer-events: none; fill: var(--faint); font-size: 9px; }
  #nodes { position: absolute; top: 0; left: 0; }

  .node {
    position: absolute;
    background: #151519;
    border: 1px solid #34343c;
    border-radius: 6px;
    padding: 6px 8px 6px 10px;
    cursor: grab;
    user-select: none;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  }
  .node:hover { border-color: #4b4b56; }
  .node.selected { border-color: var(--cyan); box-shadow: 0 0 0 1px rgba(34,211,238,0.35); }
  .node .dot {
    position: absolute; right: -7px; top: 50%; transform: translateY(-50%);
    width: 11px; height: 11px; border-radius: 50%;
    background: var(--panel2); border: 1px solid var(--faint);
    cursor: crosshair;
  }
  .node:hover .dot { border-color: var(--cyan); background: #0e3a44; }
  .node .n-kind { font-size: 9px; color: var(--faint); text-transform: uppercase; letter-spacing: 0.12em; }
  .node .n-title { font-size: 12px; font-weight: 600; color: var(--text); margin: 2px 0 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .node .n-agent { font-size: 10px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .node .n-tip { font-size: 9px; color: var(--faint); height: 10px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .node.k-input .n-kind { color: var(--blue); }
  .node.k-output .n-kind { color: var(--emerald); }
  .node.k-agent .n-kind { color: var(--cyan); }
  .node.k-tool .n-kind { color: var(--amber); }
  .node.running { border-color: var(--cyan); }
  .node.running .n-kind::after { content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--cyan); margin-left: 6px; animation: pulse 1s ease-in-out infinite; vertical-align: 1px; }
  .node.done { border-color: #0d5c43; }
  .node.done .n-kind::after { content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--emerald); margin-left: 6px; vertical-align: 1px; }
  .node.failed { border-color: var(--red); }
  .node.failed .n-kind::after { content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--red); margin-left: 6px; vertical-align: 1px; }
  .node.retry { border-color: var(--amber); }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }

  #minimap {
    position: absolute; right: 12px; bottom: 12px;
    width: 170px; height: 110px;
    background: rgba(10,10,12,0.9);
    border: 1px solid var(--line);
    border-radius: 6px;
    pointer-events: none;
    z-index: 5;
  }

  #inspector {
    width: 250px; flex: 0 0 auto;
    background: var(--panel);
    border-left: 1px solid var(--line);
    overflow-y: auto;
    padding: 10px;
  }
  #inspector h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); margin-bottom: 8px; }
  .field { margin-bottom: 8px; }
  .field label { display: block; font-size: 10px; color: var(--faint); margin-bottom: 2px; }
  .field input, .field select { width: 100%; }
  .field textarea { width: 100%; resize: vertical; min-height: 44px; }
  #inspector .row { display: flex; gap: 6px; }
  #inspector .row .field { flex: 1 1 0; }

  #rightpanel {
    width: 320px; flex: 0 0 auto;
    background: var(--panel);
    border-left: 1px solid var(--line);
    display: flex; flex-direction: column;
    min-height: 0;
  }
  #tabs { display: flex; border-bottom: 1px solid var(--line); }
  #tabs button { border: none; border-bottom: 2px solid transparent; border-radius: 0; background: transparent; color: var(--muted); flex: 1 1 0; }
  #tabs button.active { color: var(--cyan); border-bottom-color: var(--cyan); }
  #panelcontent { flex: 1 1 auto; overflow-y: auto; padding: 8px; }
  #errors { flex: 0 0 auto; max-height: 160px; overflow-y: auto; border-top: 1px solid var(--line); padding: 6px 8px; display: none; }
  .err { padding: 4px 6px; border-radius: 4px; margin-bottom: 4px; border-left: 3px solid var(--red); background: #1c1012; color: #f0a8a8; }
  .warn { border-left-color: var(--amber); background: #191407; color: #e8c98a; }
  .info { border-left-color: var(--blue); background: #0c1620; color: #9cc6ee; }
  .panel-title { color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px; }

  table.mini { width: 100%; border-collapse: collapse; font-size: 11px; }
  table.mini th { text-align: left; color: var(--faint); font-weight: 400; padding: 2px 4px; border-bottom: 1px solid var(--line); }
  table.mini td { padding: 3px 4px; border-bottom: 1px solid rgba(255,255,255,0.04); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); }
  table.mini td.dim { color: var(--muted); }

  .msg-item { padding: 5px 6px; border-bottom: 1px solid rgba(255,255,255,0.04); }
  .msg-item .msg-head { color: var(--muted); }
  .msg-item .msg-meta { color: var(--faint); font-size: 10px; }
  .msg-item .from { color: var(--cyan); }
  .msg-item .to { color: var(--emerald); }

  .batch { display: flex; gap: 4px; flex-wrap: wrap; padding: 4px 0; }
  .batch-label { color: var(--faint); min-width: 70px; padding-top: 2px; }
  .chip { background: var(--panel2); border: 1px solid var(--line); border-radius: 4px; padding: 2px 6px; color: var(--text); }
  .chip.done { border-color: #0d5c43; color: var(--emerald); }
  .chip.failed { border-color: #7f1d1d; color: var(--red); }
  .chip.running { border-color: #155e75; color: var(--cyan); }

  .evt-item { padding: 3px 4px; border-bottom: 1px solid rgba(255,255,255,0.03); color: var(--muted); font-size: 11px; }
  .evt-item .evt-type { color: var(--blue); }
  .evt-item .evt-node { color: var(--cyan); }

  #banner {
    position: fixed; right: 14px; bottom: 14px; z-index: 50;
    background: var(--panel2); border: 1px solid var(--line);
    border-radius: 6px; padding: 8px 12px;
    opacity: 0; transform: translateY(8px);
    transition: opacity 0.18s ease-out, transform 0.18s ease-out;
    pointer-events: none;
    max-width: 420px;
  }
  #banner.show { opacity: 1; transform: translateY(0); }
  #banner.err { border-color: var(--red); color: #f0a8a8; }
  #banner.ok { border-color: var(--emerald); color: #a7f3d0; }
  #banner.runinfo { border-color: var(--cyan); color: #a5f3fc; }

  #footerstatus {
    flex: 0 0 auto;
    border-top: 1px solid var(--line);
    padding: 4px 10px;
    color: var(--faint);
    font-size: 10px;
    display: flex; gap: 16px;
  }
  #footerstatus .hi { color: var(--muted); }
  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-thumb { background: #2a2a31; border-radius: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
</style>
</head>
<body>
<header id="topbar">
  <span class="brand">canvas editor</span>
  <span class="sep"></span>
  <button id="btnNew" title="Novo canvas">novo</button>
  <button id="btnSave" title="Salvar (Ctrl+S)">salvar</button>
  <button id="btnValidate" title="Validar contra schema e semântica">validar</button>
  <span class="sep"></span>
  <select id="layoutSelect" title="Direção do auto-layout">
    <option value="horizontal">horizontal</option>
    <option value="vertical">vertical</option>
    <option value="tree">tree</option>
    <option value="dag">dag</option>
  </select>
  <button id="btnLayout" title="Re-posicionar nós via autoLayout">auto-layout</button>
  <span class="sep"></span>
  <input id="taskInput" type="text" placeholder="tarefa do run" title="Tarefa do run (título do grafo)">
  <input id="inputJson" type="text" placeholder="--input {json}" title="Input JSON do run (opcional)">
  <select id="providerSelect" title="Provider do run (vazio = auto)">
    <option value="">provider: auto</option>
  </select>
  <span class="sep"></span>
  <button id="btnDryRun" title="Planeja sem executar (plano + modelos)">dry-run</button>
  <button id="btnRun" class="primary" title="Executa o workflow">run</button>
  <button id="btnPause" title="Pausa (marca de estado no editor)">pausar</button>
  <button id="btnResume" title="Retoma">retomar</button>
  <button id="btnStop" title="Interrompe o run (aborta)">stop</button>
  <span class="spacer"></span>
  <span id="runStatusBadge">idle</span>
  <span id="headlessBadge"></span>
</header>

<div id="layoutRow">
  <aside id="sidebar">
    <h3>canvas</h3>
    <ul id="canvasList"></ul>
    <h3>atalhos</h3>
    <div style="color:var(--faint);font-size:10px;line-height:1.7">
      espaço: pan<br>
      duplo clique: novo nó<br>
      botão do nó: nova aresta<br>
      del: remover seleção<br>
      ctrl+z / ctrl+y: desfazer/refazer<br>
      ctrl+s: salvar<br>
      f2: renomear seleção
    </div>
  </aside>

  <section id="stage">
    <div id="viewport">
      <div id="world">
        <svg id="edges" width="0" height="0"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#71717a"></path></marker></defs></svg>
        <div id="nodes"></div>
      </div>
      <svg id="minimap"></svg>
    </div>
    <div id="inspector">
      <h3>inspetor</h3>
      <div style="color:var(--faint)">selecione um nó ou uma aresta para editar</div>
    </div>
  </section>

  <aside id="rightpanel">
    <div id="tabs">
      <button data-tab="messages" class="active">mensagens</button>
      <button data-tab="nodes">nós</button>
      <button data-tab="plan">plano</button>
      <button data-tab="events">eventos</button>
    </div>
    <div id="panelcontent"></div>
    <div id="errors"></div>
  </aside>
</div>

<div id="footerstatus">
  <span><span class="hi">base</span> <span id="footBase">-</span></span>
  <span><span class="hi">runs</span> <span id="footRuns">0</span></span>
  <span id="footPos">0,0</span>
</div>

<div id="banner"></div>

<script>
(function () {
  'use strict';

  /* ============ ESTADO ============ */
  var NODE_W = 200;
  var NODE_H = 84;
  var NODE_KINDS = ['agent', 'orchestrator', 'evaluator', 'skill', 'tool', 'condition', 'human-review', 'parallel', 'merge', 'model', 'router', 'memory', 'input', 'output', 'group', 'webhook'];
  var MESSAGE_TYPES = ['task', 'result', 'feedback', 'review', 'artifact', 'review-request', 'notice', 'custom'];
  var SIDES = ['left', 'right', 'top', 'bottom'];

  var state = {
    definition: { nodes: [], edges: [] },
    name: 'untitled',
    selection: null,
    zoom: 1,
    pan: { x: 32, y: 32 },
    spaceDown: false,
    drag: null,
    tempEdge: null,
    undo: [],
    redo: [],
    agents: [],
    providerConfigured: [],
    runId: null,
    runStatus: 'idle',
    runHeadless: false,
    runNodes: {},
    runMessages: [],
    plan: null,
    events: [],
    tab: 'messages',
    activeEdges: {},
    task: ''
  };

  /* ============ DOM ============ */
  var el = {};
  function grab(id) { el[id] = document.getElementById(id); }
  ['viewport', 'world', 'edges', 'nodes', 'minimap', 'inspector', 'canvasList', 'topbar',
   'btnNew', 'btnSave', 'btnValidate', 'btnLayout', 'layoutSelect', 'taskInput', 'inputJson', 'providerSelect',
   'btnRun', 'btnDryRun', 'btnPause', 'btnResume', 'btnStop', 'runStatusBadge', 'headlessBadge',
   'rightpanel', 'tabs', 'panelcontent', 'errors', 'footerstatus', 'footBase', 'footRuns', 'footPos', 'banner'].forEach(grab);

  /* ============ HELPERS ============ */
  function api(path, method, body) {
    var opts = { method: method || 'GET', headers: { 'Content-Type': 'application/json' } };
    if (body !== undefined) opts.body = JSON.stringify(body);
    return fetch(path, opts).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) {
          var e = new Error((data && data.error) || ('HTTP ' + r.status));
          e.status = r.status;
          e.data = data;
          throw e;
        }
        return data;
      });
    });
  }

  function banner(msg, cls, ms) {
    el.banner.textContent = msg;
    el.banner.className = cls || '';
    el.banner.classList.add('show');
    clearTimeout(banner._t);
    banner._t = setTimeout(function () { el.banner.classList.remove('show'); }, ms || 3800);
  }

  function toastError(err) {
    var msg = (err && err.message) ? err.message : String(err);
    banner(msg, 'err', 6000);
  }

  function clamp(n, lo, hi) { return n < lo ? lo : n > hi ? hi : n; }

  function findNode(id) {
    return state.definition.nodes.find(function (n) { return n.id === id; });
  }
  function findEdge(id) {
    return state.definition.edges.find(function (e) { return e.id === id; });
  }
  function nodeMeta(n) { if (!n.izanagi) n.izanagi = {}; return n.izanagi; }
  function pushUndo() {
    state.undo.push(JSON.stringify(state.definition));
    if (state.undo.length > 60) state.undo.shift();
    state.redo = [];
  }
  function undo() {
    if (state.undo.length === 0) return;
    state.redo.push(JSON.stringify(state.definition));
    state.definition = JSON.parse(state.undo.pop());
    state.selection = null;
    renderAll();
  }
  function redo() {
    if (state.redo.length === 0) return;
    state.undo.push(JSON.stringify(state.definition));
    state.definition = JSON.parse(state.redo.pop());
    state.selection = null;
    renderAll();
  }

  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }
  function nodeSize(n) {
    return { w: n.width || NODE_W, h: n.height || NODE_H };
  }
  function anchorPoint(n, side) {
    var s = nodeSize(n);
    if (side === 'left') return { x: n.x, y: n.y + s.h / 2 };
    if (side === 'right') return { x: n.x + s.w, y: n.y + s.h / 2 };
    if (side === 'top') return { x: n.x + s.w / 2, y: n.y };
    return { x: n.x + s.w / 2, y: n.y + s.h };
  }
  function edgePath(e) {
    var a = findNode(e.fromNode);
    var b = findNode(e.toNode);
    if (!a || !b) return null;
    var p1 = anchorPoint(a, e.fromSide || 'right');
    var p2 = anchorPoint(b, e.toSide || 'left');
    var dx = Math.abs(p2.x - p1.x) * 0.5;
    var c1x = p2.x > p1.x ? p1.x + dx : p1.x - dx;
    var c2x = p2.x > p1.x ? p2.x - dx : p2.x + dx;
    return 'M ' + p1.x + ' ' + p1.y + ' C ' + c1x + ' ' + p1.y + ' ' + c2x + ' ' + p2.y + ' ' + p2.x + ' ' + p2.y;
  }

  function worldPoint(clientX, clientY) {
    var rect = el.viewport.getBoundingClientRect();
    return {
      x: Math.round((clientX - rect.left - state.pan.x) / state.zoom),
      y: Math.round((clientY - rect.top - state.pan.y) / state.zoom)
    };
  }

  /* ============ RENDER ============ */
  function applyTransform() {
    el.world.style.transform = 'translate(' + state.pan.x + 'px, ' + state.pan.y + 'px) scale(' + state.zoom + ')';
  }
  function zoomAt(factor, clientX, clientY) {
    var rect = el.viewport.getBoundingClientRect();
    var px = clientX - rect.left;
    var py = clientY - rect.top;
    var wx = (px - state.pan.x) / state.zoom;
    var wy = (py - state.pan.y) / state.zoom;
    state.zoom = clamp(state.zoom * factor, 0.2, 2.5);
    state.pan.x = px - wx * state.zoom;
    state.pan.y = py - wy * state.zoom;
    applyTransform();
  }

  function nodeStatusClass(n) {
    var r = state.runNodes[n.id];
    if (!r) return '';
    if (r.status === 'running') return 'running';
    if (r.status === 'done') return 'done';
    if (r.status === 'retry') return 'retry';
    if (r.status === 'failed') return 'failed';
    return '';
  }

  function renderNodes() {
    el.nodes.innerHTML = '';
    for (var i = 0; i < state.definition.nodes.length; i++) {
      var n = state.definition.nodes[i];
      var iz = n.izanagi || {};
      var kind = iz.kind || 'agent';
      var agent = iz.agent || '';
      var r = state.runNodes[n.id];
      var tip = '';
      if (r) {
        var parts = [];
        if (r.status === 'done' && r.latencyMs !== undefined) parts.push(r.latencyMs + 'ms');
        if (r.model) parts.push(r.model);
        if (r.error) parts.push(r.error.slice(0, 40));
        tip = parts.join(' · ');
      }
      var div = document.createElement('div');
      div.className = 'node k-' + kind + ' ' + nodeStatusClass(n);
      div.dataset.id = n.id;
      div.style.left = n.x + 'px';
      div.style.top = n.y + 'px';
      div.style.width = (n.width || NODE_W) + 'px';
      div.style.height = (n.height || NODE_H) + 'px';
      if (state.selection && state.selection.type === 'node' && state.selection.id === n.id) div.classList.add('selected');
      var title = (typeof n.text === 'string' && n.text) ? n.text : n.id;
      div.innerHTML = '<span class="n-kind">' + kind + '</span>'
        + '<div class="n-title">' + esc(title) + '</div>'
        + '<div class="n-agent">' + esc(agent) + '</div>'
        + '<div class="n-tip">' + esc(tip) + '</div>'
        + '<span class="dot"></span>';
      el.nodes.appendChild(div);
    }
  }

  function renderEdges() {
    var svg = el.edges;
    while (svg.lastChild && svg.lastChild.tagName !== 'DEFS') svg.removeChild(svg.lastChild);
    for (var i = 0; i < state.definition.edges.length; i++) {
      var e = state.definition.edges[i];
      var d = edgePath(e);
      if (!d) continue;
      var iz = e.izanagi || {};
      var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.dataset.id = e.id;
      var broad = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      broad.setAttribute('class', 'edge');
      broad.setAttribute('d', d);
      broad.setAttribute('data-edge', e.id);
      var stroke = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      stroke.setAttribute('class', 'edgeStroke');
      stroke.setAttribute('d', d);
      var color = e.color || '#52525b';
      stroke.setAttribute('fill', 'none');
      stroke.setAttribute('stroke', color);
      stroke.setAttribute('stroke-width', '1.6');
      stroke.setAttribute('marker-end', (e.endArrow === 'none' ? '' : 'url(#arrow)'));
      if (state.activeEdges[e.id]) {
        stroke.setAttribute('stroke', '#22d3ee');
        stroke.setAttribute('stroke-dasharray', '5 4');
        stroke.style.animation = 'pulse 0.5s linear infinite';
      }
      if (state.selection && state.selection.type === 'edge' && state.selection.id === e.id) {
        stroke.setAttribute('stroke', '#22d3ee');
        stroke.setAttribute('stroke-width', '2.4');
      }
      g.appendChild(broad);
      g.appendChild(stroke);
      var label = e.label || iz.messageType || '';
      if (label) {
        var mid = edgeMid(e);
        var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('class', 'e-label');
        t.setAttribute('x', mid.x);
        t.setAttribute('y', mid.y - 4);
        t.textContent = label;
        g.appendChild(t);
      }
      svg.appendChild(g);
    }
  }

  function edgeMid(e) {
    var a = findNode(e.fromNode);
    var b = findNode(e.toNode);
    if (!a || !b) return { x: 0, y: 0 };
    var p1 = anchorPoint(a, e.fromSide || 'right');
    var p2 = anchorPoint(b, e.toSide || 'left');
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  }

  function renderGraph() {
    applyTransform();
    renderEdges();
    renderNodes();
    renderMinimap();
    renderFooter();
  }

  function renderMinimap() {
    var svg = el.minimap;
    svg.innerHTML = '';
    var W = 170, H = 110, pad = 8;
    if (state.definition.nodes.length === 0) return;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    state.definition.nodes.forEach(function (n) {
      var s = nodeSize(n);
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x + s.w > maxX) maxX = n.x + s.w;
      if (n.y + s.h > maxY) maxY = n.y + s.h;
    });
    var bw = maxX - minX || 1;
    var bh = maxY - minY || 1;
    var scale = Math.min((W - pad * 2) / bw, (H - pad * 2) / bh);
    var ox = pad - minX * scale;
    var oy = pad - minY * scale;
    var NS = 'http://www.w3.org/2000/svg';
    state.definition.edges.forEach(function (e) {
      var d = edgePath(e);
      if (!d) return;
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('transform', 'translate(' + ox + ',' + oy + ') scale(' + scale + ')');
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', '#3f3f46');
      p.setAttribute('stroke-width', '1');
      svg.appendChild(p);
    });
    state.definition.nodes.forEach(function (n) {
      var s = nodeSize(n);
      var rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', ox + n.x * scale);
      rect.setAttribute('y', oy + n.y * scale);
      rect.setAttribute('width', Math.max(2, s.w * scale));
      rect.setAttribute('height', Math.max(2, s.h * scale));
      rect.setAttribute('rx', '1.5');
      var iz = n.izanagi || {};
      rect.setAttribute('fill', iz.kind === 'output' ? '#0d5c43' : iz.kind === 'input' ? '#1d4ed8' : '#3f3f46');
      svg.appendChild(rect);
    });
  }

  function renderList() {
    api('/api/canvases').then(function (data) {
      el.canvasList.innerHTML = '';
      var lists = data.canvases || [];
      for (var i = 0; i < lists.length; i++) {
        var name = lists[i].replace(/\\.canvas$/i, '');
        var li = document.createElement('li');
        li.textContent = name;
        li.dataset.name = name;
        if (name === state.name) li.classList.add('active');
        el.canvasList.appendChild(li);
      }
    }).catch(toastError);
  }

  function loadCanvas(name) {
    api('/api/canvases/' + encodeURIComponent(name)).then(function (data) {
      state.name = data.name || name;
      state.definition = JSON.parse(JSON.stringify(data.definition || { nodes: [], edges: [] }));
      state.selection = null;
      state.undo = [];
      state.redo = [];
      clearRunVisuals();
      el.taskInput.value = state.name;
      document.title = 'Canvas Editor · ' + state.name;
      renderAll();
      refreshSidebar();
      banner('canvas carregado: ' + state.name, 'ok');
    }).catch(toastError);
  }

  function saveCanvas() {
    return api('/api/canvases/' + encodeURIComponent(state.name) + '/save', 'POST', { definition: state.definition }).then(function (data) {
      banner('salvo em canvases/' + state.name + '.canvas', 'ok');
      return data;
    });
  }

  function validateCanvasRemote() {
    return api('/api/canvases/validate', 'POST', { definition: state.definition }).then(function (data) {
      renderErrors(data);
      if (data.valid) banner('canvas válido (' + data.warnings.length + ' avisos, ' + data.infos.length + ' infos)', 'ok');
      else banner('canvas inválido: ' + data.errors.length + ' erro(s)', 'err');
      return data;
    });
  }

  function runLayout() {
    api('/api/canvases/layout', 'POST', { definition: state.definition, direction: el.layoutSelect.value }).then(function (data) {
      pushUndo();
      state.definition = data.definition;
      renderGraph();
      banner('auto-layout ' + data.algorithm + ': ' + data.positions.length + ' nós re-posicionados', 'ok');
    }).catch(toastError);
  }

  function renderErrors(v) {
    if (!v || !v.diagnostics || v.diagnostics.length === 0) {
      el.errors.style.display = 'none';
      el.errors.innerHTML = '';
      return;
    }
    el.errors.style.display = 'block';
    el.errors.innerHTML = '';
    for (var i = 0; i < v.diagnostics.length; i++) {
      var d = v.diagnostics[i];
      var div = document.createElement('div');
      var cls = d.level === 'ERROR' ? 'err' : d.level === 'WARNING' ? 'warn' : 'info';
      div.className = cls;
      div.textContent = '[' + (d.code || '?') + '] ' + d.message + (d.refId ? ' (ref: ' + d.refId + ')' : '');
      el.errors.appendChild(div);
    }
  }

  /* ============ INSPETOR ============ */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fieldRow(label, html) {
    return '<div class="field"><label>' + label + '</label>' + html + '</div>';
  }
  function inputField(label, field, value, extra) {
    return fieldRow(label, '<input type="text" data-field="' + field + '" value="' + esc(value == null ? '' : value) + '"' + (extra || '') + '>');
  }
  function numberField(label, field, value, extra) {
    return fieldRow(label, '<input type="number" data-field="' + field + '" value="' + esc(value == null ? '' : value) + '"' + (extra || '') + '>');
  }
  function selectField(label, field, value, options) {
    var html = '<select data-field="' + field + '">';
    for (var i = 0; i < options.length; i++) {
      var o = options[i];
      html += '<option value="' + esc(o) + '"' + (value === o ? ' selected' : '') + '>' + esc(o) + '</option>';
    }
    html += '</select>';
    return fieldRow(label, html);
  }
  function textareaField(label, field, value, extra) {
    return fieldRow(label, '<textarea data-field="' + field + '"' + (extra || '') + '>' + esc(value == null ? '' : value) + '</textarea>');
  }

  function renderInspector() {
    if (!state.selection) {
      el.inspector.innerHTML = '<h3>inspetor</h3><div style="color:var(--faint)">selecione um nó ou uma aresta para editar</div>';
      return;
    }
    if (state.selection.type === 'node') renderNodeInspector(findNode(state.selection.id));
    else renderEdgeInspector(findEdge(state.selection.id));
  }

  function renderNodeInspector(n) {
    if (!n) return;
    var iz = nodeMeta(n);
    var h = '<h3>nó: ' + esc(n.id) + '</h3>';
    h += inputField('texto (label)', 'text', n.text);
    h += selectField('kind', 'kind', iz.kind || 'agent', NODE_KINDS);
    h += inputField('agente', 'agent', iz.agent, ' list="agentList"');
    h += '<datalist id="agentList">' + state.agents.map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.name) + '</option>'; }).join('') + '</datalist>';
    h += inputField('skills (csv)', 'skills', Array.isArray(iz.skills) ? iz.skills.join(', ') : '');
    h += '<div class="row">' + selectField('model', 'modelMode', (iz.model && iz.model.mode) || 'auto', ['auto', 'manual', 'inherit']) + '</div>';
    h += '<div class="row">' + inputField('provider', 'modelProvider', iz.model && iz.model.provider) + inputField('model id', 'modelId', iz.model && iz.model.model) + '</div>';
    h += '<div class="row">' + numberField('budget', 'tokenBudget', iz.tokenBudget) + numberField('timeout ms', 'timeoutMs', iz.timeoutMs) + '</div>';
    h += '<div class="row">' + numberField('max attempts', 'maxAttempts', iz.maxAttempts) + numberField('x', 'x', n.x) + '</div>';
    h += '<div class="row">' + numberField('y', 'y', n.y) + numberField('largura', 'width', n.width) + '</div>';
    h += textareaField('loop (json)', 'loop', typeof iz.loop === 'string' ? iz.loop : (iz.loop ? JSON.stringify(iz.loop) : ''));
    h += textareaField('contexto', 'context', iz.context);
    h += '<div style="margin-top:10px"><button class="danger" id="btnDeleteNode">remover nó</button></div>';
    el.inspector.innerHTML = h;
  }

  function renderEdgeInspector(e) {
    if (!e) return;
    var iz = e.izanagi || {};
    var h = '<h3>aresta: ' + esc((e.label || iz.messageType || e.id)) + '</h3>';
    h += inputField('label', 'label', e.label);
    h += selectField('messageType', 'messageType', iz.messageType || '', MESSAGE_TYPES);
    h += '<div class="row">' + selectField('fromSide', 'fromSide', e.fromSide || 'right', SIDES) + selectField('toSide', 'toSide', e.toSide || 'left', SIDES) + '</div>';
    h += textareaField('condição (json)', 'condition', typeof iz.condition === 'string' ? iz.condition : (iz.condition ? JSON.stringify(iz.condition) : ''));
    h += '<div style="margin-top:10px"><button class="danger" id="btnDeleteEdge">remover aresta</button></div>';
    el.inspector.innerHTML = h;
  }

  function commitInspector(target, field, value) {
    var n = target.id;
    var iz = nodeMeta(n);
    var changed = true;
    if (field === 'text') n.text = value;
    else if (field === 'kind') iz.kind = value;
    else if (field === 'agent') iz.agent = value || undefined;
    else if (field === 'skills') iz.skills = value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    else if (field === 'tokenBudget') iz.tokenBudget = value === '' ? undefined : Number(value);
    else if (field === 'timeoutMs') iz.timeoutMs = value === '' ? undefined : Number(value);
    else if (field === 'maxAttempts') iz.maxAttempts = value === '' ? undefined : Number(value);
    else if (field === 'modelMode') {
      if (!iz.model) iz.model = {};
      iz.model.mode = value;
      if (value === 'auto') { iz.model.provider = undefined; iz.model.model = undefined; }
    } else if (field === 'modelProvider') { if (!iz.model) iz.model = {}; iz.model.provider = value || undefined; }
    else if (field === 'modelId') { if (!iz.model) iz.model = {}; iz.model.model = value || undefined; }
    else if (field === 'context') iz.context = value || undefined;
    else if (field === 'loop') { iz.loop = parseMaybeJson(value, undefined); }
    else if (field === 'x' || field === 'y' || field === 'width') {
      changed = false;
      if (value !== '') {
        n[field] = Number(value);
        changed = true;
      }
    }
    else changed = false;
    if (changed) pushUndo();
    renderGraph();
    renderInspector();
  }

  function commitEdgeInspector(e, field, value) {
    var iz = e.izanagi || {};
    if (field === 'label') e.label = value || undefined;
    else if (field === 'messageType') { if (!e.izanagi) e.izanagi = {}; e.izanagi.messageType = value || undefined; }
    else if (field === 'fromSide') e.fromSide = value;
    else if (field === 'toSide') e.toSide = value;
    else if (field === 'condition') { if (!e.izanagi) e.izanagi = {}; e.izanagi.condition = parseMaybeJson(value, undefined); }
    pushUndo();
    renderGraph();
    renderInspector();
  }

  function parseMaybeJson(v, fallback) {
    if (v == null || v === '') return fallback;
    var t = String(v).trim();
    if (t === '') return fallback;
    try { return JSON.parse(t); } catch { return fallback; }
  }

  /* ============ GESTOS (pointer events) ============ */
  function onPointerDown(e) {
    if (e.button !== 0 && e.button !== 2) return;
    var nodeEl = e.target.closest ? e.target.closest('.node') : null;
    var dot = e.target.closest ? e.target.closest('.dot') : null;
    var edgeEl = e.target.closest ? e.target.closest('path.edge') : null;
    if (state.spaceDown) { startPan(e); return; }
    if (dot && nodeEl) { startEdgeDrag(e, nodeEl.dataset.id); return; }
    if (nodeEl) { startNodeDrag(e, nodeEl.dataset.id); return; }
    if (edgeEl && edgeEl.dataset.edge) { select({ type: 'edge', id: edgeEl.dataset.edge }); return; }
    startPan(e);
  }

  function startNodeDrag(e, id) {
    var n = findNode(id);
    if (!n) return;
    state.drag = { type: 'node', id: id, sx: e.clientX, sy: e.clientY, ox: n.x, oy: n.y, moved: false };
    select({ type: 'node', id: id });
    e.preventDefault();
  }

  function startEdgeDrag(e, fromId) {
    var from = findNode(fromId);
    if (!from) return;
    select({ type: 'node', id: fromId });
    state.drag = { type: 'edge', fromId: fromId, sx: e.clientX, sy: e.clientY, targetId: null };
    state.tempEdge = { fromId: fromId, path: null };
    updateTempEdgePath(e);
    e.preventDefault();
  }

  function startPan(e) {
    state.drag = { type: 'pan', sx: e.clientX, sy: e.clientY, px: state.pan.x, py: state.pan.y };
    el.viewport.classList.add('panning');
    e.preventDefault();
  }

  function onPointerMove(e) {
    var d = state.drag;
    if (!d) return;
    if (d.type === 'node') {
      var n = findNode(d.id);
      if (!n) return;
      var dx = (e.clientX - d.sx) / state.zoom;
      var dy = (e.clientY - d.sy) / state.zoom;
      n.x = Math.round(d.ox + dx);
      n.y = Math.round(d.oy + dy);
      d.moved = true;
      renderGraph();
    } else if (d.type === 'edge') {
      updateTempEdgePath(e);
    } else if (d.type === 'pan') {
      state.pan.x = d.px + (e.clientX - d.sx);
      state.pan.y = d.py + (e.clientY - d.sy);
      applyTransform();
    }
    var w = worldPoint(e.clientX, e.clientY);
    el.footPos.textContent = w.x + ',' + w.y;
  }

  function updateTempEdgePath(e) {
    var from = findNode(state.drag.fromId);
    if (!from) return;
    var p1 = anchorPoint(from, 'right');
    var w = worldPoint(e.clientX, e.clientY);
    var dx = Math.abs(w.x - p1.x) * 0.5;
    var d = 'M ' + p1.x + ' ' + p1.y + ' C ' + (p1.x + dx) + ' ' + p1.y + ' ' + (w.x - dx) + ' ' + w.y + ' ' + w.x + ' ' + w.y;
    var prev = el.edges.querySelector('#tempEdge');
    var NS = 'http://www.w3.org/2000/svg';
    if (!prev) {
      var p = document.createElementNS(NS, 'path');
      p.id = 'tempEdge';
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', '#22d3ee');
      p.setAttribute('stroke-width', '1.6');
      p.setAttribute('stroke-dasharray', '4 3');
      el.edges.appendChild(p);
      prev = p;
    }
    prev.setAttribute('d', d);
  }

  function onPointerUp(e) {
    var d = state.drag;
    if (!d) return;
    state.drag = null;
    el.viewport.classList.remove('panning');
    if (state.tempEdge) {
      var targetEl = document.elementFromPoint(e.clientX, e.clientY);
      var nodeEl = targetEl && targetEl.closest ? targetEl.closest('.node') : null;
      var tId = nodeEl ? nodeEl.dataset.id : null;
      removeTempEdge();
      if (tId && tId !== d.fromId) {
        addEdge(d.fromId, tId);
      }
    }
    if (d.type === 'node') pushUndo();
  }

  function removeTempEdge() {
    state.tempEdge = null;
    var prev = el.edges.querySelector('#tempEdge');
    if (prev) prev.remove();
  }

  function addEdge(fromId, toId) {
    var from = findNode(fromId);
    var to = findNode(toId);
    if (!from || !to) return;
    pushUndo();
    state.definition.edges.push({
      id: uid('e'),
      fromNode: fromId,
      toNode: toId,
      fromSide: 'right',
      toSide: 'left',
      endArrow: 'arrow',
      izanagi: { messageType: 'task' }
    });
    renderGraph();
    renderInspector();
    banner('aresta: ' + fromId + ' → ' + toId, 'ok', 2200);
  }

  function select(sel) {
    state.selection = sel;
    renderGraph();
    renderInspector();
  }

  function deleteSelection() {
    if (!state.selection) return;
    pushUndo();
    if (state.selection.type === 'node') {
      var id = state.selection.id;
      state.definition.nodes = state.definition.nodes.filter(function (n) { return n.id !== id; });
      state.definition.edges = state.definition.edges.filter(function (e) { return e.fromNode !== id && e.toNode !== id; });
      delete state.runNodes[id];
    } else {
      state.definition.edges = state.definition.edges.filter(function (e) { return e.id !== state.selection.id; });
    }
    state.selection = null;
    renderAll();
  }

  /* ============ RUN / SSE ============ */
  function clearRunVisuals() {
    state.runId = null;
    state.runStatus = 'idle';
    state.runHeadless = false;
    state.runNodes = {};
    state.runMessages = [];
    state.plan = null;
    state.events = [];
    state.activeEdges = {};
    closeSse();
    setRunButtons();
    renderPanel();
    renderGraph();
    el.headlessBadge.textContent = '';
  }

  function setRunButtons() {
    var s = state.runStatus;
    var running = s === 'running' || s === 'idle' && false || s === 'queued';
    el.btnRun.disabled = s === 'running' || s === 'paused';
    el.btnDryRun.disabled = s === 'running' || s === 'paused';
    el.btnPause.disabled = s !== 'running';
    el.btnResume.disabled = s !== 'paused';
    el.btnStop.disabled = s !== 'running' && s !== 'paused';
    el.runStatusBadge.textContent = s;
    el.runStatusBadge.className = s;
    updateFooterRuns();
  }

  function startRun(dryRun) {
    var task = el.taskInput.value.trim() || state.name;
    var input = null;
    var rawInput = el.inputJson.value.trim();
    if (rawInput) {
      try { input = JSON.parse(rawInput); }
      catch (err) { banner('--input não é JSON válido: ' + err.message, 'err'); return; }
    }
    var body = {
      name: state.name,
      definition: state.definition,
      task: task,
      dryRun: !!dryRun
    };
    if (input) body.input = input;
    var prov = el.providerSelect.value;
    if (prov) body.provider = prov;
    state.runStatus = 'queued';
    setRunButtons();
    api('/api/run', 'POST', body).then(function (data) {
      state.runId = data.runId;
      state.runStatus = 'running';
      state.runHeadless = !!data.headless;
      el.headlessBadge.textContent = data.headless ? 'headless' : '';
      setRunButtons();
      banner('run iniciado: ' + data.runId + (data.headless ? ' (headless)' : ''), 'runinfo');
      subscribeSse(data.runId);
    }).catch(function (err) {
      if (err.data && err.data.diagnostics) renderErrors(err.data);
      state.runStatus = 'idle';
      setRunButtons();
      toastError(err);
    });
  }

  function subscribeSse(runId) {
    closeSse();
    var es = new EventSource('/api/runs/' + encodeURIComponent(runId) + '/events');
    state.sse = es;
    es.addEventListener('run-status', function (evt) {
      // Estado inicial do run (sincroniza reconnect); status vivo vem dos eventos.
    });
    es.addEventListener('workflow-event', function (evt) {
      var data;
      try { data = JSON.parse(evt.data); } catch { return; }
      handleWorkflowEvent(data);
    });
    es.addEventListener('run-finished', function (evt) {
      var data;
      try { data = JSON.parse(evt.data); } catch { return; }
      handleRunFinished(data);
    });
    es.onerror = function () {
      // O EventSource reconecta sozinho; se o servidor derrubou a conexão por
      // fim do run, o run-finished já terá fechado a stream local.
    };
  }

  function closeSse() {
    if (state.sse) {
      state.sse.close();
      state.sse = null;
    }
  }

  function handleWorkflowEvent(evt) {
    if (state.events.length >= 400) state.events.shift();
    state.events.push(evt);
    var t = evt.type;
    if (t === 'workflow.started') {
      state.runStatus = 'running';
    } else if (t === 'workflow.completed') {
      state.runStatus = state.runHeadless && evt.status === 'DRY_RUN' ? 'dry-run' : 'completed';
    } else if (t === 'workflow.failed') {
      state.runStatus = 'failed';
    } else if (t === 'workflow.cancelled') {
      state.runStatus = 'cancelled';
    } else if (t === 'workflow.paused') {
      state.runStatus = 'paused';
    } else if (t === 'workflow.resumed') {
      state.runStatus = 'running';
    } else if (t === 'node.started') {
      var n0 = state.runNodes[evt.nodeId] || { status: 'pending' };
      n0.status = evt.attempt && evt.attempt > 1 ? 'retry' : 'running';
      state.runNodes[evt.nodeId] = n0;
    } else if (t === 'node.completed') {
      var n1 = state.runNodes[evt.nodeId] || {};
      n1.status = evt.status === 'succeeded' ? 'done' : 'skipped';
      n1.latencyMs = evt.latencyMs;
      n1.tokens = evt.tokens;
      n1.model = evt.model || n1.model;
      n1.attempt = undefined;
      state.runNodes[evt.nodeId] = n1;
    } else if (t === 'node.failed') {
      var n2 = state.runNodes[evt.nodeId] || {};
      n2.status = evt.attempt && evt.attempt > 1 ? 'retry' : 'failed';
      n2.error = evt.error;
      state.runNodes[evt.nodeId] = n2;
    } else if (t === 'message.sent') {
      state.runMessages.push(evt);
      flashEdge(evt.from, evt.to, evt.messageType);
    } else if (t === 'model.resolved') {
      var n3 = state.runNodes[evt.nodeId] || {};
      n3.model = evt.model;
      n3.provider = evt.provider;
      state.runNodes[evt.nodeId] = n3;
    }
    setRunButtons();
    if (state.tab === 'events') renderPanel();
    renderGraph();
  }

  function flashEdge(from, to, messageType) {
    var matches = state.definition.edges.filter(function (e) {
      return e.fromNode === from && (e.toNode === to || (Array.isArray(to) && to.indexOf(e.toNode) >= 0));
    });
    matches.forEach(function (e) {
      state.activeEdges[e.id] = true;
      setTimeout(function () { delete state.activeEdges[e.id]; renderGraph(); }, 1400);
    });
  }

  function handleRunFinished(data) {
    state.runStatus = data.status || 'completed';
    setRunButtons();
    if (data.headless !== undefined) {
      state.runHeadless = !!data.headless;
      el.headlessBadge.textContent = state.runHeadless ? 'headless' : '';
    }
    if (data.workflowStatus && data.error) banner('run ' + data.status + ': ' + data.error, 'err');
    else if (data.score !== undefined) banner('run ' + data.status + ' · score ' + data.score + (data.dryRun ? ' · dry-run' : ''), 'ok', 5200);
    else banner('run ' + data.status, 'ok', 4200);
    loadRunDetail(state.runId);
  }

  function loadRunDetail(runId) {
    api('/api/runs/' + encodeURIComponent(runId)).then(function (data) {
      if (data.plan) state.plan = data.plan;
      if (data.messages) state.runMessages = data.messages;
      if (data.nodes) {
        data.nodes.forEach(function (rn) {
          var cur = state.runNodes[rn.id] || {};
          if (rn.status === 'pending' && cur.status !== 'done' && cur.status !== 'failed') cur.status = 'pending';
          if (rn.latencyMs != null) cur.latencyMs = rn.latencyMs;
          if (rn.error) cur.error = rn.error;
          state.runNodes[rn.id] = cur;
        });
      }
      if (data.events && data.events.length > state.events.length) {
        state.events = data.events.slice(-400);
      }
      closeSse();
      renderAll();
    }).catch(function () { /* run pode ter sido podado; segue o estado vivo */ });
  }

  function controlRun(action) {
    if (!state.runId) return;
    api('/api/run/' + encodeURIComponent(state.runId), 'POST', { runId: state.runId, action: action })
      .then(function (data) { banner('run ' + action + ' ok', 'runinfo'); })
      .catch(toastError);
  }

  /* ============ PAINÉIS ============ */
  function renderPanel() {
    var t = state.tab;
    var h = '';
    if (t === 'messages') {
      h += '<div class="panel-title">mensagens agente-a-agente (' + state.runMessages.length + ')</div>';
      if (state.runMessages.length === 0) h += '<div style="color:var(--faint)">nenhuma mensagem ainda</div>';
      for (var i = 0; i < state.runMessages.length; i++) {
        var m = state.runMessages[i];
        var to = Array.isArray(m.to) ? m.to.join(', ') : m.to;
        h += '<div class="msg-item"><div class="msg-head"><span class="from">' + esc(m.from) + '</span> → <span class="to">' + esc(to) + '</span> <span style="color:var(--blue)">[' + esc(m.messageType) + ']</span></div>'
          + '<div class="msg-meta">' + (m.tokenEstimate != null ? m.tokenEstimate + ' tokens · ' : '') + (m.payloadKeys ? m.payloadKeys.length + ' campos' : '') + '</div></div>';
      }
    } else if (t === 'nodes') {
      h += '<div class="panel-title">nós do run (' + Object.keys(state.runNodes).length + '/' + state.definition.nodes.length + ')</div>';
      h += '<table class="mini"><tr><th>nó</th><th>status</th><th>modelo</th><th>ms</th><th>tok</th></tr>';
      for (var k = 0; k < state.definition.nodes.length; k++) {
        var n = state.definition.nodes[k];
        var r = state.runNodes[n.id] || { status: 'pending' };
        h += '<tr><td>' + esc(n.id) + '</td><td class="dim">' + r.status + '</td><td class="dim">' + esc(r.model || '') + '</td><td class="dim">' + (r.latencyMs != null ? r.latencyMs : '') + '</td><td class="dim">' + (r.tokens != null ? r.tokens : '') + '</td></tr>';
      }
      h += '</table>';
    } else if (t === 'plan') {
      if (!state.plan) {
        h += '<div class="panel-title">plano (dry-run)</div><div style="color:var(--faint)">rode um dry-run para ver batidas paralelas e modos</div>';
      } else {
        h += '<div class="panel-title">plano: modo ' + esc(state.plan.mode) + ' · ' + (state.plan.estimate ? state.plan.estimate.nodes + ' tarefas em ' + state.plan.estimate.parallelStages + ' etapas' : '') + '</div>';
        var batches = (state.plan.graph && state.plan.graph.parallelBatches) || [];
        for (var b = 0; b < batches.length; b++) {
          h += '<div class="batch"><span class="batch-label">batch ' + (b + 1) + '</span>';
          for (var c = 0; c < batches[b].length; c++) {
            var nid = batches[b][c];
            var r2 = state.runNodes[nid];
            var cls = r2 ? (r2.status === 'done' ? ' done' : r2.status === 'failed' ? ' failed' : r2.status === 'running' ? ' running' : '') : '';
            h += '<span class="chip' + cls + '">' + esc(nid) + '</span>';
          }
          h += '</div>';
        }
      }
    } else if (t === 'events') {
      h += '<div class="panel-title">timeline (' + state.events.length + ' eventos)</div>';
      var start = Math.max(0, state.events.length - 200);
      for (var j = start; j < state.events.length; j++) {
        var ev = state.events[j];
        var ref = ev.nodeId ? ' <span class="evt-node">' + esc(ev.nodeId) + '</span>' : (ev.from ? ' <span class="evt-node">' + esc(ev.from) + '</span>' : '');
        h += '<div class="evt-item"><span class="evt-type">' + esc(ev.type) + '</span>' + ref + ' <span style="color:var(--faint)">' + esc((ev.at || '').slice(11, 19)) + '</span></div>';
      }
    }
    el.panelcontent.innerHTML = h;
  }

  function renderAll() {
    renderGraph();
    renderInspector();
    renderPanel();
    setRunButtons();
  }

  function refreshSidebar() {
    renderList();
    var items = el.canvasList.querySelectorAll('li');
    for (var i = 0; i < items.length; i++) items[i].classList.toggle('active', items[i].dataset.name === state.name);
  }

  function updateFooterRuns() {
    var n = 0;
    if (state.runId) n = 1;
    el.footRuns.textContent = n;
  }
  function renderFooter() {
    el.footBase.textContent = state.name;
    updateFooterRuns();
  }

  /* ============ META / BOOT ============ */
  function loadMeta() {
    api('/api/agents').then(function (data) {
      state.agents = data.agents || [];
    }).catch(function () {});
    api('/api/models').then(function (data) {
      state.providerConfigured = [];
      var provs = data.providers || [];
      for (var i = 0; i < provs.length; i++) {
        if (provs[i].configured) state.providerConfigured.push(provs[i].id);
      }
      var cur = el.providerSelect.value;
      el.providerSelect.innerHTML = '<option value="">provider: auto</option>';
      for (var j = 0; j < state.providerConfigured.length; j++) {
        var opt = document.createElement('option');
        opt.value = state.providerConfigured[j];
        opt.textContent = state.providerConfigured[j];
        el.providerSelect.appendChild(opt);
      }
      el.providerSelect.value = cur;
    }).catch(function () {});
  }

  /* ============ EVENTOS GLOBAIS ============ */
  function wireUi() {
    el.btnNew.addEventListener('click', function () {
      var name = window.prompt('Nome do novo canvas:', 'minha-feature');
      if (!name) return;
      api('/api/canvases', 'POST', { name: name }).then(function (data) {
        state.name = data.name;
        state.definition = JSON.parse(JSON.stringify(data.definition));
        state.selection = null;
        state.undo = [];
        state.redo = [];
        clearRunVisuals();
        el.taskInput.value = state.name;
        document.title = 'Canvas Editor · ' + state.name;
        renderAll();
        refreshSidebar();
        banner('canvas criado: ' + state.name, 'ok');
      }).catch(toastError);
    });

    el.btnSave.addEventListener('click', function () { saveCanvas().catch(toastError); });
    el.btnValidate.addEventListener('click', function () { validateCanvasRemote().catch(toastError); });
    el.btnLayout.addEventListener('click', runLayout);
    el.btnRun.addEventListener('click', function () { startRun(false); });
    el.btnDryRun.addEventListener('click', function () { startRun(true); });
    el.btnPause.addEventListener('click', function () { controlRun('pause'); });
    el.btnResume.addEventListener('click', function () { controlRun('resume'); });
    el.btnStop.addEventListener('click', function () { controlRun('stop'); });

    el.canvasList.addEventListener('click', function (e) {
      var li = e.target.closest('li');
      if (li && li.dataset.name) loadCanvas(li.dataset.name);
    });

    [el.btnRun, el.btnDryRun].forEach(function (b) {
      b.addEventListener('click', function () { el.errors.style.display = 'none'; el.errors.innerHTML = ''; });
    });

    el.tabs.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn || !btn.dataset.tab) return;
      state.tab = btn.dataset.tab;
      var btns = el.tabs.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('active', btns[i].dataset.tab === state.tab);
      renderPanel();
    });

    el.inspector.addEventListener('change', function (e) {
      var t = e.target;
      var field = t.dataset.field;
      if (!field) return;
      if (state.selection && state.selection.type === 'node') {
        var n = findNode(state.selection.id);
        if (n) commitInspector(n, field, t.value);
      } else if (state.selection && state.selection.type === 'edge') {
        var ed = findEdge(state.selection.id);
        if (ed) commitEdgeInspector(ed, field, t.value);
      }
    });

    el.inspector.addEventListener('click', function (e) {
      if (e.target.id === 'btnDeleteNode' || e.target.id === 'btnDeleteEdge') deleteSelection();
    });

    el.viewport.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    el.viewport.addEventListener('wheel', function (e) {
      e.preventDefault();
      var factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      zoomAt(factor, e.clientX, e.clientY);
    }, { passive: false });

    el.viewport.addEventListener('dblclick', function (e) {
      if (e.target.closest('.node')) return;
      var w = worldPoint(e.clientX, e.clientY);
      pushUndo();
      state.definition.nodes.push({
        id: uid('n'),
        type: 'text',
        x: w.x - NODE_W / 2,
        y: w.y - NODE_H / 2,
        text: 'novo nó',
        izanagi: { kind: 'agent' }
      });
      renderGraph();
      renderInspector();
      banner('nó criado em ' + w.x + ',' + w.y, 'ok', 2000);
    });

    window.addEventListener('keydown', function (e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) {
        if (e.key === 'Escape') e.target.blur();
        return;
      }
      var mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if (mod && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return; }
      if (mod && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        saveCanvas().catch(toastError);
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        state.spaceDown = true;
        el.viewport.classList.add('panning');
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelection(); return; }
      if (e.key === 'F2') {
        var inp = el.inspector.querySelector('[data-field="text"]');
        if (inp) { inp.focus(); inp.select(); }
        return;
      }
      if (e.key === 'Escape') { state.selection = null; renderGraph(); renderInspector(); }
    });

    window.addEventListener('keyup', function (e) {
      if (e.key === ' ') {
        state.spaceDown = false;
        el.viewport.classList.remove('panning');
      }
    });

    el.taskInput.addEventListener('change', function () { state.task = el.taskInput.value; });
  }

  function init() {
    var width = window.innerWidth;
    if (width < 1180) {
      el.rightpanel.style.display = 'none';
      el.inspector.style.display = 'none';
    }
    wireUi();
    applyTransform();
    loadMeta();
    renderList();
    renderGraph();
    setRunButtons();
    state.definition = { nodes: [], edges: [] };
    el.footBase.textContent = 'nenhum canvas aberto';
  }

  window.addEventListener('DOMContentLoaded', init);
})();
</script>
</body>
</html>
`;