# Padrão de Skill de Alta Densidade (Izanagi Standard)

> Referência interna do framework — o contrato de qualidade para TODA skill em `skills/<name>/SKILL.md` (e espelhada em `.agents/skills/`).
> Inspirado no padrão do `ui-ux-pro-max` (113k★): específico, dirigido a decisão, com código, anti-padrões e checklist.
> Use este documento ao **criar skills novas**, **atualizar skills existentes** e ao **portar skills de repos externos** (obra/superpowers, anthropics/skills, addyosmani/agent-skills, ComposioHQ...).

## Por que existe

Skills genéricas ("use boas práticas") não mudam o comportamento do agente — ocupam tokens e não agregam. Uma skill só vale se o agente, ao carregá-la, **toma decisões melhores e escreve código melhor**. Este padrão garante densidade mínima de informação acionável.

## Anatomia obrigatória de uma SKILL.md (nesta ordem)

```markdown
---
name: <kebab-case>
description: "<1-2 frases: QUANDO usar, QUANDO pular, e o que a skill entrega. Verbs acionáveis."
---

# <Título>

## Quando usar            ← 1 parágrafo: gatilhos reais + "Pule para" (o que NÃO é este caso)
## Stack / Padrões         ← ferramentas recomendadas COM justificativa (1 linha cada)
## Workflow (N passos)     ← passos numerados com CÓDIGO real (nunca "faça algo")
## Regras de ouro         ← 5-8 regras testáveis ("Sempre X", "Nunca Y")
## Checklist               ← caixas [ ] verificáveis (o que conta como pronto)
## Anti-padrões            ← 5-8 itens ❌ com o porquê
## Composição com skills   ← Antes: <skills> / Depois: <skills> (cadeia do skill-resolver)
## References              ← links reais canônicos (docs oficiais) + references.md da pasta
```

## Critérios de densidade (gate de qualidade)

| Critério | Mínimo aceitável | O que reprova |
|---|---|---|
| **Especificidade** | Passos nomeiam arquivos, funções, libs | "faça a integração" |
| **Código real** | ≥1 bloco de código executável por skill | instruções sem exemplo |
| **Decisão** | "Use X quando Y; senão Z" (árvore/tabela) | listas de adjetivos |
| **Negativo explícito** | Anti-padrões nomeados ❌ | só "boas práticas" positivas |
| **Verificabilidade** | Checklist com [ ] testáveis | "garanta qualidade" |
| **Cadeia** | Composição antes/depois citando skills reais | skill isolada sem contexto |
| **Tamanho** | 80-200 linhas (curta o bastante para ler, densa o bastante para decidir) | <50 linhas genéricas; >300 linhas narrativa |

**Exceções legítimas** (formato curto por design, manter): `economia-tokens`, `professor-modo`, `handoff-sessao`, `memoria-projeto` — meta-skills operacionais onde a brevidade É a regra de ouro. Toda skill nova DEVE justificar-se nesse padrão.

## Workflow de atualização em massa (usado no upgrade 2026-08)

1. **Medir**: `Get-ChildItem skills -Directory | % { (Get-Content "$($_.FullName)\SKILL.md").Count }` — liste as < 70 linhas.
2. **Priorizar por bloco**: skills do mesmo domínio (ex. automação) juntas — o padrão reforça a cadeia.
3. **Reescrever mantendo o núcleo**: preserve o que a skill já fazia de certo; adicione decisão/código/anti-padrões.
4. **Criar `references.md`** na pasta quando não existir (docs oficiais + fontes canônicas reais).
5. **Espelhar**: `Copy-Item skills\<name>\* .agents\skills\<name>\ -Force` — `.agents/` é o template de instalação (regra de ouro; nunca divergir).
6. **Validar**: `npm run verify` + `npm run doctor` (0 erros).

## Ao portar skills de repos externos (superpowers, greep, anthropics...)

1. **Traga a essência, não o arquivo**: skill externa é referência de comportamento; o formato do Izanagi é este.
2. **Traduza para PT-BR** (padrão do framework) mantendo termos técnicos em inglês.
3. **Substitua contexto genérico por código concreto** do domínio (ex. superpowers `brainstorming` → nossa `brainstorming` com 3 fases e HARD-GATE).
4. **Conecte à cadeia**: adicione a composição ao `core/skill-resolver.json` (compositions) se a skill entra em fluxo novo.
5. **Registre a curadoria** em `references/repos-ai-agents.md` (fonte + o que aproveitamos).

## Fontes de referência (curadoria externa)

- `obra/superpowers` (266k★) — base conceitual: brainstorming, TDD iron law, systematic debugging
- `anthropics/skills` — documentação e oficinais
- `addyosmani/agent-skills` — automação prática
- `ComposioHQ/awesome-claude-skills` — índice curado
- `ui-ux-pro-max-skill` (113k★) — origem do padrão de densidade deste documento
- Ver `references/repos-ai-agents.md` para a lista completa.
