---
name: "refero-styles"
description: "Padrões de design de interfaces extraídos de produtos reais de alto nível (Refero Styles, Mobbin e Real-world SaaS/DevTools/FinTech) para fundamentar decisões de frontend, fluxos complexos, paletas tonais e arquitetura de componentes. Gatilhos de ativação: refero styles — padrões visuais & componentes de produtos reais; 1. princípios de decisão baseados em referência; 2. catálogo de arquitetura de componentes reais; 3. paletas tonais e elevação (dark & light)."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
---

# Refero Styles — Padrões Visuais & Componentes de Produtos Reais

> Migrado deterministicamente de `skills/refero-styles/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Padrões de design de interfaces extraídos de produtos reais de alto nível (Refero Styles, Mobbin e Real-world SaaS/DevTools/FinTech) para fundamentar decisões de frontend, fluxos complexos, paletas tonais e arquitetura de componentes.

- **Escopo canônico:** Refero Styles — Padrões Visuais & Componentes de Produtos Reais
- **Seções do corpo original:** 1. Princípios de Decisão Baseados em Referência · 2. Catálogo de Arquitetura de Componentes Reais · 3. Paletas Tonais e Elevação (Dark & Light) · 4. Checklist de Validação Refero
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — Evidência Real vs.

**Evidência Real vs. Imaginação Genérica**:

- Cada decisão de layout deve se ancorar em produtos testados no mundo real.
   - Dashboards analíticos: padrão Stripe / Datadog (métricas com sparklines, filtros de data relativos, dados tabulares com paginação resiliente).
   - DevTools / Workspaces: padrão Linear / Raycast / Supabase (paleta de comando `Cmd+K`, atalhos de teclado, navegação por painéis recolhíveis, densidade compacta).
   - E-commerce / Marketplaces: padrão Apple / Shopify (respiro generoso, fotografia imersiva, tipografia editorial, sticky cart actions).

### Passo 2 — Integração com Refero (Local-First com Fallback):

**Integração com Refero (Local-First com Fallback)**:

- Se o servidor MCP `refero` estiver configurado no workspace, consulte os estilos via MCP (`refero_search_styles` ou `refero_get_component`).
   - Se o MCP não estiver disponível ou for offline, utilize o catálogo embutido nesta skill (seção 2 e 3) sem falhar ou travar a execução.

---

## Verification Steps

<!-- fonte da verificação: fallback-honesto:engineering -->

- Executar a skill conforme o escopo de Triggering Criteria no caso real (não hipotético).
- Percorrer cada passo do Step-by-Step Workflow e confirmar evidência verificável de conclusão (não apenas ausência de erro).
- Confirmar que nenhum Red Flag listado está presente no artefato produzido.
- Registrar resultado (sucesso/falha + motivo) antes de considerar a skill cumprida.

## Common Rationalizations

- **"É só um protótipo, refatoro depois."**
  - Verdade: Protótipo sem testes vira produção por acidente. O 'depois' não existe: quem paga a dívida é o próximo commit. Regra do framework: código esparso ou stub (`TODO`, `implement later`) é entrega proibida.
- **"Compila (ou rodou uma vez), então funciona."**
  - Verdade: Compilar valida sintaxe, não comportamento. Anti-falhas é lei: Executar → Esperar → Verificar resultado esperado → Registrar. Sem verificação, sucesso é suposição.
- **"Caso extremo nunca vai acontecer."**
  - Verdade: Vazio, duplicado, timeout e dado inválido acontecem no primeiro lote real. Validação antes de ação irreversível não é opcional — é pré-condição de execução.
- **"Abstraio agora que depois fica fácil trocar."**
  - Verdade: Abstração especulativa é complexidade desnecessária com custo imediato e benefício imaginário. Simples que resolve > flexível que ninguém entende.
- **"Copiei de um projeto que funcionava, deve servir."**
  - Verdade: Contexto diferente invalida solução copiada. Pesquisa é referência técnica, nunca cópia cega — adaptar exige entender o porquê de cada linha.
- **"Sem tempo para tratar erro, lanço exceção genérica."**
  - Verdade: `except: pass` e erro engolido são proibidos. Falha silenciosa transforma bug de 5 minutos em incidente de 5 horas. Registrar motivo é mais barato que depurar às cegas.

## Red Flags

- Arquivo único gigante misturando I/O, regra de negócio e apresentação.
- Bloco catch vazio, `except: pass` ou erro logado sem motivo/actionável.
- Stub, `TODO` ou função que retorna valor fixo em caminho de produção.
- Credencial, token ou path sensível hardcoded no fonte.
- Sucesso assumido sem verificar o resultado esperado da operação.
- Reexecução unsafe: roda duas vezes e duplica efeito (sem idempotência/checkpoint).

## Legacy Reference (v1)

# Refero Styles — Padrões Visuais & Componentes de Produtos Reais

Esta skill conecta as decisões visuais e estruturais do Izanagi aos padrões comprovados de produtos líderes de mercado (inspirado em Refero Styles, Mobbin, Linear, Stripe e Raycast), substituindo suposições genéricas por padrões de interação reais.

---

## 1. Princípios de Decisão Baseados em Referência

1. **Evidência Real vs. Imaginação Genérica**:
   - Cada decisão de layout deve se ancorar em produtos testados no mundo real.
   - Dashboards analíticos: padrão Stripe / Datadog (métricas com sparklines, filtros de data relativos, dados tabulares com paginação resiliente).
   - DevTools / Workspaces: padrão Linear / Raycast / Supabase (paleta de comando `Cmd+K`, atalhos de teclado, navegação por painéis recolhíveis, densidade compacta).
   - E-commerce / Marketplaces: padrão Apple / Shopify (respiro generoso, fotografia imersiva, tipografia editorial, sticky cart actions).

2. **Integração com Refero (Local-First com Fallback)**:
   - Se o servidor MCP `refero` estiver configurado no workspace, consulte os estilos via MCP (`refero_search_styles` ou `refero_get_component`).
   - Se o MCP não estiver disponível ou for offline, utilize o catálogo embutido nesta skill (seção 2 e 3) sem falhar ou travar a execução.

---

## 2. Catálogo de Arquitetura de Componentes Reais

### 2.1 Command Palette (Cmd + K)
- **Estrutura**:
  - Modal com backdrop blur (`backdrop-blur-md bg-black/40`).
  - Input auto-focado sem borda inferior pesada, com ícone de busca e badge `ESC` à direita.
  - Lista agrupada por seções (`Ações Rápidas`, `Navegação`, `Recentes`, `Configurações`).
  - Item selecionado com destaque de superfície (`bg-white/5` ou `bg-zinc-100`) e atalho em tags de teclado (`<kbd>`).
  - Rodapé sutil com legendas de atalho (`↑↓ para navegar`, `↵ para selecionar`, `ESC para fechar`).

### 2.2 Data Tables Profissionais (FinTech & B2B)
- **Estrutura**:
  - Toolbar superior: barra de busca com debounce, filtros de coluna em badges clicáveis, seletor de densidade (compacta/confortável) e botão de exportação.
  - Header fixo com suporte a ordenação (indicador visual sutil de ascendente/descendente).
  - Células com alinhamento semântico: texto à esquerda, números/moedas alinhados à direita com `font-mono tabular-nums`.
  - Estados de hover em linha (`hover:bg-zinc-50 dark:hover:bg-zinc-900/50`).
  - Ações em lote quando itens são selecionados via checkbox.

### 2.3 Settings / Configurações em Abas (SaaS Pattern)
- **Estrutura**:
  - Navegação lateral secundária ou abas horizontais com underline animado (`layoutId` no Framer Motion).
  - Seções em cartões individuais com cabeçalho explicativo (`Título` + `Descrição em muted`).
  - Botão de ação (ex.: `Salvar alterações`) no rodapé de cada cartão ou barra de ação flutuante inferior fixa quando há alterações pendentes (*dirty state*).

### 2.4 Cartões de Métricas (KPI Cards com Micro-Sparkline)
- **Estrutura**:
  - Topo: Nome da métrica (`text-xs font-medium uppercase tracking-wider text-muted-foreground`) + ícone de contexto ou menu `...`.
  - Centro: Valor principal em destaque (`text-2xl font-bold tracking-tight tabular-nums`).
  - Base: Variação percentual (`+12.4% vs mês anterior` com pill verde/vermelho sutil) + mini-gráfico SVG inline (sparkline com gradiente de área sutil).

---

## 3. Paletas Tonais e Elevação (Dark & Light)

### 3.1 Camadas de Elevação (Tonal Elevation - Dark Mode)
- **Base (Canvas)**: `bg-zinc-950` (#09090b)
- **Superfície Nível 1 (Sidebars / Paineis)**: `bg-zinc-900` (#18181b) com borda `border-zinc-800`
- **Superfície Nível 2 (Cards / Modais)**: `bg-zinc-900/90` com borda `border-white/10`
- **Superfície Nível 3 (Dropdowns / Tooltips / Popovers)**: `bg-zinc-800` (#27272a) com sombra `shadow-xl shadow-black/40`

### 3.2 Contrastes & Hierarquia de Texto
- **Primário**: `text-zinc-100` (95% opacidade, legibilidade máxima)
- **Secundário**: `text-zinc-400` (informações de suporte)
- **Muted / Terciário**: `text-zinc-500` ou `text-zinc-600` (labels, metadados, timestamps)
- **Destaque / Acento**: 1 única cor por produto (ex.: Esmeralda `#10b981` para FinTech, Índigo elétrico `#6366f1` para DevTools, Âmbar `#f59e0b` para criatividade).

---

## 4. Checklist de Validação Refero

Ao concluir qualquer componente ou tela:
1. [ ] **Origem de Padrão**: O componente segue a lógica de um produto real de mercado (não inventou padrões bizarros)?
2. [ ] **Tabular Nums**: Todos os números, preços, datas e contadores usam `tabular-nums`?
3. [ ] **Estados Vazios e Loading**: Há skeleton screens desenhadas no mesmo formato dos cards ou tabelas reais?
4. [ ] **Micro-interações**: Hover em botões e linhas tem transições de 150ms-200ms suaves (`ease-out`)?
5. [ ] **Acessibilidade**: Foco por teclado (`focus-visible:ring-2`) claramente visível em todos os controles?
