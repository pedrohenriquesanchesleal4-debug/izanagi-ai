# Core: Skill Composer

> Version 1.0.0
> Priority: Critical
> Dependencies: Skill Resolver (`core/skill-resolver.json` → `compositions`), Memory Manager
> Compatibility: ">=2.0.0"

---

## Identity

O Skill Composer é o motor que transforma skills isoladas em **cadeias coordenadas (DAG)** por domínio de tarefa. Ele lê o mapa de composições em `core/skill-resolver.json` → `compositions`, ativa a cadeia completa do domínio em ordem e garante que **o artefato de cada skill vire input da próxima**. Uma skill sozinha é um arquivo morto; uma cadeia é um pipeline de entrega.

```
tarefa → domínio → cadeia (DAG) → artefato final
```

---

## Princípio: Output→Input Chaining

Toda skill da cadeia produz um artefato que **alimenta a próxima**. O output nunca morre na skill que o gerou — ele é o contrato de entrada da etapa seguinte.

```
ui-ux-pro-max ──design system──▶ frontend ──componentes──▶ motion-design ──micro-interações──▶
animation-web ──scrollytelling──▶ webgl-3d ──cena 3D──▶ web-perf-seo ──Core Web Vitals──▶ a11y ──▶ qa
```

Regras do chaining:

1. **Contrato explícito**: cada skill declara seu output (o que entrega) e o input que espera (o que consome da etapa anterior).
2. **Nunca regerar**: a skill N lê o artefato da skill N-1; não recria o que já foi produzido.
3. **Parar cedo**: se uma skill da cadeia não tem nada a adicionar (delta vazio), ela passa o artefato adiante intacto — sem etapa fantasma.

---

## Regra de Ativação

**Carregar uma skill isolada sem suas dependências de domínio é PROIBIDO** — é o anti-pattern "skill de enfeite" (skill que existe mas não compõe).

- ✅ Toda skill ativada **puxa a cadeia do seu domínio** (`compositions` no resolver).
- ✅ A ativação é **toda ou nada**: ou a cadeia completa roda, ou nenhuma skill do domínio é carregada.
- ✅ Se a tarefa não pertence a domínio mapeado, a cadeia `unknown` do Decision Engine é usada (nunca skill solta).
- ❌ Proibido invocar skill por "curiosidade" ou "porque existe no resolver".

---

## Fase Study-First

Toda cadeia começa por estudo, nunca por código:

1. **Memória**: carregar `.agents/memoria/` — learnings, erros anteriores, decisões registradas (`memoria-projeto`).
2. **Pesquisa**: se a tarefa exige informação externa (stack, refs visuais, preços, APIs, versões), rodar `deep-research` **antes** de qualquer implementação.
3. **Só então**: ativar a cadeia de execução do domínio.

Proibido codar no escuro: sem memória carregada e sem pesquisa (quando aplicável), a cadeia não inicia.

---

## Composições por Domínio

### 1. `web_cinematic` — Site/landing animada

- **Gatilhos**: "site animado", "landing", "scrollytelling", "site estilo vídeo", "Apple-style"
- **Cadeia**: `ui-ux-pro-max` → `frontend` → `motion-design` → `animation-web` → `webgl-3d` → `web-perf-seo` → `a11y` → `qa`
  - ui-ux-pro-max: define design system (paleta, tipografia, tokens) que será a língua visual de tudo.
  - frontend: consome os tokens e constrói a estrutura de componentes base.
  - motion-design: aplica micro-interações e easing com identidade de movimento.
  - animation-web: converte a navegação em narrativa (scroll-driven, pin, image sequence).
  - webgl-3d: adiciona a camada 3D imersiva onde o scroll exige profundidade.
  - web-perf-seo: valida Core Web Vitals (LCP < 2.5s, INP < 200ms, CLS < 0.1) e SEO.
  - a11y: garante reduced-motion, contraste e fallback sem JS.
  - qa: validação final de qualidade e regressão visual.
- **Artefato**: landing cinematográfica completa (design system + componentes + scrollytelling + 3D + perf validada).

### 2. `webgl_experience` — Site 3D/WebGL

- **Gatilhos**: "site 3d", "three.js", "webgl", "cena 3d", "shader", "partículas"
- **Cadeia**: `ui-ux-pro-max` → `webgl-3d` → `animation-web` → `motion-design` → `frontend` → `web-perf-seo`
  - ui-ux-pro-max: paleta e atmosfera visual que a cena 3D precisa respeitar.
  - webgl-3d: constrói a cena (Three/R3F, shaders, GLTF) como núcleo da experiência.
  - animation-web: amarra a cena ao scroll (scroll-driven 3D, pin + scrub).
  - motion-design: refina easing e micro-interações de câmera/UI.
  - frontend: integra a cena ao layout e componentes da página.
  - web-perf-seo: valida FPS, LCP, DPR cap e fallback mobile.
- **Artefato**: cena 3D com scroll (navegável, performática, com fallback).

### 3. `api_backend` — API/REST/GraphQL

- **Gatilhos**: "API", "REST", "endpoint", "GraphQL", "backend", "schema"
- **Cadeia**: `architect` → `backend` → `db` → `security` → `graphql` (condicional: se GraphQL) → `logging` → `qa`
  - architect: desenha contratos de API e boundaries (hexagonal/clean).
  - backend: implementa endpoints conforme os contratos.
  - db: modela e cria as camadas de persistência usadas pelos endpoints.
  - security: aplica auth, validação de entrada, rate limiting e OWASP.
  - graphql: (só se a API for GraphQL) schema + resolvers + caching.
  - logging: logs estruturados e rastreáveis em cada endpoint.
  - qa: valida contrato, casos de erro e segurança do schema.
- **Artefato**: API segura com schema validado (REST ou GraphQL) + logs + testes.

### 4. `data_system` — Modelagem/pipelines

- **Gatilhos**: "modelagem", "schema", "ETL", "pipeline", "data warehouse", "migração"
- **Cadeia**: `data-engineering` → `db` → `backend` → `iac-terraform` → `observability`
  - data-engineering: desenha o modelo de dados e o pipeline (fontes, transformações).
  - db: materializa o schema com tipos, índices e constraints corretas.
  - backend: expõe/consome os dados por serviços e repositórios.
  - iac-terraform: provisiona o storage (RDS, Redis, filas) como código.
  - observability: métricas de pipeline, lags e alertas de qualidade de dados.
- **Artefato**: schema + migrations + pipeline (provisionado e observável).

### 5. `security_audit` — Auditoria de segurança

- **Gatilhos**: "auditoria", "vulnerabilidade", "OWASP", "pentest", "LGPD", "audit"
- **Cadeia**: `security-privacy` → `bug-hunter` → `code-auditor` → `qa`
  - security-privacy: varre OWASP Top 10, auth, secrets e LGPD/GDPR.
  - bug-hunter: reproduz e valida as falhas encontradas (não chute).
  - code-auditor: revisa o delta de código e confirma severidade/fix.
  - qa: valida que os fixes não quebraram comportamento.
- **Artefato**: relatório OWASP com severidade/CWE/linha + fixes aplicados e testados.

### 6. `devops_delivery` — Entrega/Infra

- **Gatilhos**: "deploy", "CI/CD", "infra", "terraform", "docker", "kubernetes", "SLO"
- **Cadeia**: `cloud-infra` → `iac-terraform` → `serverless-edge` (condicional: se serverless) → `sre-reliability` → `logging` → `observability`
  - cloud-infra: escolhe o desenho cloud (AWS/GCP/Azure) e boas práticas.
  - iac-terraform: provisiona recursos como código (módulos, remote state).
  - serverless-edge: (se o alvo for serverless/edge) Lambda/Workers e cold start.
  - sre-reliability: define SLIs/SLOs e error budget da entrega.
  - logging: logs estruturados em runtime.
  - observability: métricas, tracing e alertas com runbook.
- **Artefato**: infra IaC + SLOs (deployável e monitorável).

### 7. `debug_session` — Depuração

- **Gatilhos**: "bug", "erro", "crash", "stack trace", "null", "500", "quebrou"
- **Cadeia**: `root-cause` → `bug` → `tdd` → `self-fix` → `memoria-projeto`
  - root-cause: isola a causa raiz (não o sintoma).
  - bug: confirma reprodução mínima e a linha exata.
  - tdd: escreve o teste de regressão ANTES do fix (Iron Law).
  - self-fix: aplica a correção e valida o ciclo.
  - memoria-projeto: registra bug + causa + fix + lição para nunca repetir.
- **Artefato**: correção com teste de regressão + lição registrada na memória.

### 8. `refactor_safe` — Refatoração segura

- **Gatilhos**: "refactor", "limpar", "extrair", "melhorar", "restruturar", "dívida técnica"
- **Cadeia**: `architect` → `complexity` → `refactor` → `tdd` → `breaking-change` → `solid` → `clean-code`
  - architect: define a fronteira alvo e o impacto no desenho.
  - complexity: mede a complexidade atual (o que refatorar primeiro).
  - refactor: aplica a refatoração guiada.
  - tdd: rede de testes de proteção antes e depois.
  - breaking-change: detecta quebras de contrato público.
  - solid: valida os princípios após o movimento.
  - clean-code: valida legibilidade e nomes no delta.
- **Artefato**: refactor sem breaking changes (testes verdes + contrato preservado).

### 9. `new_project_discovery` — Pré-produção/descoberta

- **Gatilhos**: "novo projeto", "ideia", "começar do zero", "brainstorm", "viabilidade"
- **Cadeia**: `brainstorming` → `deep-research` → `ui-ux-pro-max` → `requirement-analyzer` → `tradeoff` → `risk` → `task-planner`
  - brainstorming: entrevista dirigida até o design/spec ser aprovado (HARD-GATE).
  - deep-research: coleta stack, concorrentes, preços e referências externas.
  - ui-ux-pro-max: define direção de design do produto.
  - requirement-analyzer: transforma a entrevista em requisitos acionáveis.
  - tradeoff: explicita alternativas e escolhas de stack.
  - risk: mapeia os riscos top-3 com mitigação.
  - task-planner: quebra em tarefas atômicas para a fase de execução.
- **Artefato**: prompt rico aprovado (NUNCA código) — spec + stack + plano.

### 10. `fullstack_crud` — App fullstack completo

- **Gatilhos**: "app completo", "CRUD", "fullstack", "sistema", "dashboard com backend"
- **Cadeia**: `architect` → `db` → `backend` → `frontend` → `security` → `ui-ux-pro-max` → `qa` → `memoria-projeto`
  - architect: estrutura de pastas, contratos e modelo antes do código.
  - db: schema e migrações.
  - backend: API e regras de negócio.
  - frontend: UI consumindo a API.
  - security: auth, validação e proteção ponta a ponta.
  - ui-ux-pro-max: eleva a UI a alto craft (anti "cara de IA").
  - qa: validação end-to-end final.
  - memoria-projeto: registra decisões e padrões do app.
- **Artefato**: app fullstack completo (schema + API + UI + segurança + QA).

### 11. `mobile_app` — Aplicativo mobile

- **Gatilhos**: "mobile", "React Native", "Expo", "Flutter", "app iOS/Android", "PWA"
- **Cadeia**: `mobile-dev` → `frontend` → `ui-ux-pro-max` → `graphql` (condicional: se API) → `web-perf-seo` → `qa`
  - mobile-dev: padrões nativos (iOS HIG, Material 3, gestos, offline).
  - frontend: componentes e telas cross-platform.
  - ui-ux-pro-max: design system mobile e acessibilidade.
  - graphql: (se a API for GraphQL) queries otimizadas e cache.
  - web-perf-seo: bundle, startup time e Core Web Vitals (PWA).
  - qa: validação de fluxos e regressão visual.
- **Artefato**: app mobile (iOS/Android/PWA) com UI de alto craft e performance validada.

### 12. `ai_ml_feature` — Feature com LLM/RAG

- **Gatilhos**: "IA", "LLM", "RAG", "agente", "prompt", "chatbot", "embedding", "MCP"
- **Cadeia**: `ai-agent` → `prompt-eng` → `backend` → `db` → `security` → `observability`
  - ai-agent: padrões LLM/RAG/MCP e arquitetura do agente.
  - prompt-eng: engenharia de prompt e avaliação de saída.
  - backend: serviços de integração com o modelo.
  - db: vetores/embeddings e cache de contexto.
  - security: guardrails, prompt injection e PII.
  - observability: rastreio de calls, tokens, latência e qualidade.
- **Artefato**: feature com LLM/RAG (segura, observável e testada).

---

## Regras de Desduplicação (Zero Redundância)

Quando duas skills da cadeia sobrepõem responsabilidade (ex: `qa` e `code-auditor`), a segunda **atua apenas no delta** — o que a primeira não cobriu:

- ✅ **Delta-first**: skill N+1 só processa o que a N não produziu (ex: `code-auditor` revisa o fix do `bug-hunter`, não re-audita a base).
- ✅ **Zero releitura**: nunca reler arquivos que outra skill da cadeia já leu; consumir o artefato intermediário.
- ✅ **Uma fonte de verdade**: o artefato da cadeia é único e acumula (design system → componentes → animações → validação).
- ✅ **Skill fantasma proibida**: se o delta de uma skill é vazio, ela não roda (o artefato passa adiante).
- ❌ Proibido `qa` re-testar o que `tdd` já cobriu; proibido `refactor` re-medir o que `complexity` já mediu.

---

## Skill Routing Table

| Gatilho de task | Domínio | Agentes responsáveis |
|---|---|---|
| site animado / landing / scrollytelling | `web_cinematic` | animation, senior-engineer |
| site 3D / WebGL / shaders | `webgl_experience` | animation |
| API / REST / GraphQL / backend | `api_backend` | senior-engineer, architect |
| modelagem / pipeline / ETL / schema | `data_system` | database |
| auditoria / OWASP / vulnerabilidade | `security_audit` | security, bug-hunter |
| deploy / infra / CI/CD / SLO | `devops_delivery` | devops |
| bug / crash / stack trace | `debug_session` | bug-hunter, senior-engineer, techlead |
| refactor / dívida técnica | `refactor_safe` | senior-engineer, architect, techlead |
| novo projeto / ideia / descoberta | `new_project_discovery` | pm, architect, docs |
| app fullstack / CRUD | `fullstack_crud` | senior-engineer, database, architect |
| app mobile / RN / Flutter / PWA | `mobile_app` | senior-engineer (mobile) |
| LLM / RAG / agente / chatbot | `ai_ml_feature` | senior-engineer (IA) |
| review / PR / teach / document | cadeias dos agentes (não-domínio) | techlead, professor, docs |

---

## Exemplo de Execução: `web_cinematic`

Input: *"Quero uma landing cinematográfica para o produto Nexus — com scrollytelling estilo Apple e uma cena 3D no hero."*

| Etapa | Skill | Input consumido | Output produzido |
|---|---|---|---|
| 0 | `memoria-projeto` | `.agents/memoria/` | contexto: decisões, erros passados |
| 0b | `deep-research` | stack/refs visuais externas | referências Apple/Red Bull + stack escolhida |
| 1 | `ui-ux-pro-max` | brief + refs | design system (paleta, tipografia, tokens) |
| 2 | `frontend` | design system | componentes base com tokens aplicados |
| 3 | `motion-design` | componentes | micro-interações + easing signature |
| 4 | `animation-web` | componentes animados | scrollytelling (pin, image sequence) |
| 5 | `webgl-3d` | narrativa definida | cena 3D no hero com scroll scrub |
| 6 | `web-perf-seo` | landing completa | Lighthouse: LCP/INP/CLS + SEO on-page |
| 7 | `a11y` | perf validada | reduced-motion, contraste, fallback sem JS |
| 8 | `qa` | artefato completo | relatório final + regressão visual aprovada |

Artefato final: **landing cinematográfica completa** — cada etapa consumiu o output da anterior e ninguém releu o que já fora lido.

---

## Metrics

| Metric | Target |
|---|---|
| Chains resolvidas por task | 100% |
| Skills ativadas fora de cadeia | 0 |
| Releituras duplicadas por cadeia | 0 |
| Deep-research antes de stack nova | 100% |
| Artefatos quebrados entre etapas | 0 |
