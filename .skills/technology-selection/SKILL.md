---
name: "technology-selection"
description: "Escolhe stack de automação (linguagem, libs, API vs browser vs planilha vs CLI) com justificativa explícita registrada. Use antes de implementar qualquer automação nova. Gatilhos de ativação: technology selection; quando usar; árvore de decisão; critérios de escolha (avaliar na ordem)."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
---

# Technology Selection

> Migrado deterministicamente de `skills/technology-selection/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Escolhe stack de automação (linguagem, libs, API vs browser vs planilha vs CLI) com justificativa explícita registrada.
- **Ativar quando:** Use antes de implementar qualquer automação nova.
- **Escopo canônico:** Technology Selection
- **Seções do corpo original:** Quando usar · Árvore de decisão · Critérios de escolha (avaliar na ordem) · Decisões padrão do framework (salvo justificativa) · Regras de ouro
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — ❌ Scraper de HTML quando existe API oficial

❌ Scraper de HTML quando existe API oficial

### Passo 2 — ❌ "Usei X porque é popular" sem avaliar alternativa

❌ "Usei X porque é popular" sem avaliar alternativa

### Passo 3 — ❌ Trocar a stack no meio do projeto sem registrar motivo

❌ Trocar a stack no meio do projeto sem registrar motivo

### Passo 4 — ❌ Ignorar volume (pandas em memória para 10M linhas)

❌ Ignorar volume (pandas em memória para 10M linhas)

### Passo 5 — ❌ Selenium para projeto novo (Playwright é o padrão)

❌ Selenium para projeto novo (Playwright é o padrão)

### Passo 6 — ❌ Biblioteca sem manutenção (checar últimos releases)

❌ Biblioteca sem manutenção (checar últimos releases)

### Passo 7 — ❌ Decidir por costume sem olhar o problema ("sempre fiz com X")

❌ Decidir por costume sem olhar o problema ("sempre fiz com X")

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] Abordagem escolhida pela árvore (API > planilha > browser > CLI)
- [ ] Alternativas descartadas com motivo explícito
- [ ] Linguagem/bibliotecas do padrão do framework ou justificativa real
- [ ] Volume considerado (streaming/batching se necessário)
- [ ] Justificativa registrada no README
- [ ] Licença dos componentes verificada (não bloqueia entrega)

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

# Technology Selection

Decisão de stack para automações com justificativa explícita: abordagem (API > browser > planilha > CLI), linguagem (Python por padrão) e bibliotecas. **A tecnologia é consequência do problema** — primeiro entenda o problema, depois escolha, e registre o porquê.

## Quando usar

Use ao iniciar qualquer automação nova, quando há mais de uma forma de resolver (API vs browser; pandas vs openpyxl; Python vs Node), ou ao avaliar biblioteca nova. **Pule** para: continuação de automação existente (mantenha a stack do repo); problemas já padronizados no framework (ex. ETL → já tem `data-engineering`).

## Árvore de decisão

```
Existe API/endpoint oficial ou export? ── sim → API (sempre: mais estável e barato)
        │ não
        ▼
É planilha (Excel/CSV/ODS/Sheets)? ── sim → pandas/openpyxl/gspread
        │ não
        ▼
É navegador/site sem API? ── sim → Playwright (browser-automation)
        │ não
        ▼
É CLI/processo nativo? ── sim → subprocess + parses estruturados
        │ não
        ▼
Combine fontes → API + planilha + browser em etapas separadas (mapeie cada uma)
```

## Critérios de escolha (avaliar na ordem)

| Critério | Pergunta | Exemplo |
|---|---|---|
| **Estabilidade** | O que muda menos? | API oficial > scraper de HTML |
| **Custo de manutenção** | O que quebra menos com o tempo? | contrato JSON > seletor de classe |
| **Velocidade de entrega** | O que resolve hoje? | openpyxl > escrever XLSX na mão |
| **Volume** | Escala? | pandas (memória) vs polars/streaming (grande) |
| **Ecossistema** | Libs maduras? | httpx + pydantic (padrão do framework) |
| **Licença/custo** | Grátis? | Playwright OSS > Selenium Grid pago |
| **Manutenibilidade** | Alguém mantém depois? | Python (padrão) > linguagem exótica |

## Decisões padrão do framework (salvo justificativa)

- **Linguagem**: Python 3.11+ — bibliotecas de automação maduras, legível, testável.
- **HTTP**: `httpx` (timeout, pooling, async-ready) — não `requests` em projeto novo.
- **Planilha**: `pandas` (transformação) + `openpyxl` (XLSX fiel) + `gspread` (Google Sheets).
- **Browser**: Playwright (auto-wait, seletores por role) — Selenium só legado.
- **Validação**: Pydantic v2 (schema por linha com erro claro).
- **Config**: `python-dotenv` + `.env` fora do Git.
- **Testes**: pytest (unit + integração) — ver `testing-automation`.

## Regras de ouro

- **API-first**: se existe API, é API. Scraping é último recurso (frágil, lento, legalmente sensível).
- **Justificativa registrada**: no README, 1 linha: "Playwright porque o sistema X não tem API pública".
- **Python é padrão, não dogma**: se o problema exige outra coisa (ex. já existe SDK Node), a justificativa vence — mas escreva por quê.
- **Não adote lib por hype**: biblioteca nova sem manutenção = dívida. Prefira as do padrão do framework.
- **Uma decisão por vez**: não troque 3 libs no mesmo PR.

## Checklist de qualidade (antes de implementar)

- [ ] Abordagem escolhida pela árvore (API > planilha > browser > CLI)
- [ ] Alternativas descartadas com motivo explícito
- [ ] Linguagem/bibliotecas do padrão do framework ou justificativa real
- [ ] Volume considerado (streaming/batching se necessário)
- [ ] Justificativa registrada no README
- [ ] Licença dos componentes verificada (não bloqueia entrega)

## Anti-padrões (proibido)

1. ❌ Scraper de HTML quando existe API oficial
2. ❌ "Usei X porque é popular" sem avaliar alternativa
3. ❌ Trocar a stack no meio do projeto sem registrar motivo
4. ❌ Ignorar volume (pandas em memória para 10M linhas)
5. ❌ Selenium para projeto novo (Playwright é o padrão)
6. ❌ Biblioteca sem manutenção (checar últimos releases)
7. ❌ Decidir por costume sem olhar o problema ("sempre fiz com X")

## Composição com outras skills

- **Antes**: `automation-planning` (escopo e critérios) → `automation-research` (libs e alternativas)
- **Depois**: a skill da abordagem escolhida (`api-automation`, `spreadsheet-automation`, `browser-automation`) → `testing-automation` → `automation-documentation` (registrar a justificativa)

## References

- Python docs: https://docs.python.org/3/ · httpx: https://www.python-httpx.org · Playwright: https://playwright.dev · pandas: https://pandas.pydata.org · Pydantic: https://docs.pydantic.dev · 12-factor (dependencies): https://12factor.net/dependencies
- Veja `references.md` nesta pasta — curadoria de fontes canônicas (2026).
