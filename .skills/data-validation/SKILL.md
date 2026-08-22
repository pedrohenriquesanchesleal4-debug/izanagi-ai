---
name: "data-validation"
description: "Valida dados antes de enviar a qualquer destino (API, banco, planilha): schemas, formatos, duplicados e relatório de qualidade por erro. Use antes de importar ou sincronizar dados para evitar lote inválido. Gatilhos de ativação: data validation; quando usar; workflow (5 passos); regras de ouro."
version: 2.0.0
category: data
tools:
  mcp:
    - mcp:execute_command
    - mcp:fs_read
---

# Data Validation

> Migrado deterministicamente de `skills/data-validation/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Dados (`data`)
- **Resumo:** Valida dados antes de enviar a qualquer destino (API, banco, planilha): schemas, formatos, duplicados e relatório de qualidade por erro.
- **Ativar quando:** Use antes de importar ou sincronizar dados para evitar lote inválido.
- **Escopo canônico:** Data Validation
- **Seções do corpo original:** Quando usar · Workflow (5 passos) · Regras de ouro · Checklist de qualidade (antes de entregar) · Anti-padrões (proibido)
- **Ferramentas MCP esperadas:** mcp:execute_command, mcp:fs_read

## Step-by-Step Workflow

<!-- estratégia de extração: workflow-section-steps -->

### Passo 1 — Defina o schema por linha (Pydantic — erro claro por campo)

```python
from pydantic import BaseModel, Field, ValidationError
from datetime import date

class Cliente(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    email: str = Field(pattern=r"[^@]+@[^@]+\.[^@]+")
    cpf: str = Field(pattern=r"^\d{11}$")
    nascimento: date
    plano: str = Field(pattern="^(basico|pro|empresa)$")
```

### Passo 2 — Valide em lote com coleta de erros (não pare no primeiro)

```python
from typing import Any
import pandas as pd

def validar_lote(df: pd.DataFrame) -> tuple[list[Cliente], list[dict]]:
    ok, erros = [], []
    for idx, row in df.iterrows():
        try:
            ok.append(Cliente.model_validate(row.to_dict()))
        except ValidationError as e:
            erros.append({"linha": idx + 2, "erros": e.errors()})   # linha no arquivo real
    return ok, erros
```

### Passo 3 — Detecte duplicados por chave natural

```python
vistos: set[str] = set()
for c in ok:
    if c.cpf in vistos:
        erros.append({"linha": "?", "erros": "CPF duplicado"})
    vistos.add(c.cpf)
```

### Passo 4 — Gere relatório de qualidade

```
Total lido: 1.234 linhas | Válidas: 1.198 | Erros: 36 (2,9%)
Por tipo: email inválido 14 | CPF com máscara 12 | plano desconhecido 6 | duplicado 4
```

### Passo 5 — Decida a política de execução

- `--dry-run`: valida e reporta, não envia nada (obrigatório antes de produção).
- `--strict`: aborta se erro > limiar (ex. 5%).
- `--ignore-errors`: envia só os válidos + relatório — **apenas com aceite explícito**.

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] Schema por linha com tipos e formatos (Pydantic)
- [ ] Erros coletados em lote com número da linha real
- [ ] Duplicados detectados por chave natural
- [ ] Relatório de qualidade com totais e % de erro
- [ ] Dry-run disponível e testado antes de execução real
- [ ] Política de erro explícita (strict/limiar/ignorar com aceite)
- [ ] Dados sensíveis mascarados no relatório (LGPD — ver `automation-security`)

## Common Rationalizations

- **"Dados de produção são limpos, validação em lote é paranoia."**
  - Verdade: Produção contém vazio, duplicado, formato legado e outlier desde o primeiro dia. Validação de schema ANTES da carga é o mínimo; assumir limpeza é exportar o bug para o destino.
- **"Registro duplicado é raro, trato se aparecer."**
  - Verdade: Raro em volume alto é frequente em absoluto. Upsert por ID natural/idempotency key é design padrão, não otimização defensiva.
- **"Migro essa base na mão, é uma vez só."**
  - Verdade: 'Uma vez só' executada sob pressão, sem dry-run e sem rollback, é o cenário clássico de perda irreversível. Migração na mão é migração sem verificação.
- **"Índice a gente cria quando a query ficar lenta."**
  - Verdade: Sem índice, a lentidão chega em produção no pico de uso e o índice de emergência trava a tabela justamente no horário crítico. Modelagem inclui acesso previsto.
- **"ETL falhou no meio, rodo do zero que resolve."**
  - Verdade: Recomeçar do zero reprocessa efeito colateral e pode duplicar tudo. Checkpoint é obrigatório: falhou no 643 de 1000, retoma do 644.
- **"PII nesse dataset tá ok porque é ambiente interno."**
  - Verdade: Ambiente interno é o vetor clássico de vazamento (acesso amplo, sem auditoria). Minimização e tratamento de PII aplicam-se onde o dado está, não onde ele 'deveria' estar.

## Red Flags

- DELETE/UPDATE sem WHERE em script operacional (ou com WHERE 'óbvio' não conferido).
- Migração sem path de rollback testado.
- Pipeline batch sem checkpoint — falha no fim recomeça tudo.
- Contagem de registros origem vs destino nunca reconciliada.
- Retry automático em operação não-idempotente sem idempotency key.
- Schema do destino aceitando qualquer coisa (validação adiada indefinidamente).
- PII em log, export ou ambiente compartilhado sem tratamento.

## Legacy Reference (v1)

# Data Validation

Validação de dados antes de enviar a qualquer destino (API, banco, planilha, sistema externo): schemas por linha, formatos, domínios, duplicados e **relatório de qualidade** — para que um lote com erro nunca entre silenciosamente.

## Quando usar

Use ao: importar planilha/CSV para sistema; sincronizar dados entre sistemas; preparar payload para API; processar export de legado; qualquer pipeline onde dado ruim causa erro "3 telas depois". **Pule** para: dados já validados na origem com garantia (schema do banco); validação de UI (ver `qa`).

## Workflow (5 passos)

### 1. Defina o schema por linha (Pydantic — erro claro por campo)

```python
from pydantic import BaseModel, Field, ValidationError
from datetime import date

class Cliente(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    email: str = Field(pattern=r"[^@]+@[^@]+\.[^@]+")
    cpf: str = Field(pattern=r"^\d{11}$")
    nascimento: date
    plano: str = Field(pattern="^(basico|pro|empresa)$")
```

### 2. Valide em lote com coleta de erros (não pare no primeiro)

```python
from typing import Any
import pandas as pd

def validar_lote(df: pd.DataFrame) -> tuple[list[Cliente], list[dict]]:
    ok, erros = [], []
    for idx, row in df.iterrows():
        try:
            ok.append(Cliente.model_validate(row.to_dict()))
        except ValidationError as e:
            erros.append({"linha": idx + 2, "erros": e.errors()})   # linha no arquivo real
    return ok, erros
```

### 3. Detecte duplicados por chave natural

```python
vistos: set[str] = set()
for c in ok:
    if c.cpf in vistos:
        erros.append({"linha": "?", "erros": "CPF duplicado"})
    vistos.add(c.cpf)
```

### 4. Gere relatório de qualidade

```
Total lido: 1.234 linhas | Válidas: 1.198 | Erros: 36 (2,9%)
Por tipo: email inválido 14 | CPF com máscara 12 | plano desconhecido 6 | duplicado 4
```

### 5. Decida a política de execução

- `--dry-run`: valida e reporta, não envia nada (obrigatório antes de produção).
- `--strict`: aborta se erro > limiar (ex. 5%).
- `--ignore-errors`: envia só os válidos + relatório — **apenas com aceite explícito**.

## Regras de ouro

- **Erro claro por campo**, não "dados inválidos" genérico — o operador precisa saber o quê e onde.
- **Valide o mais cedo possível** (na borda de entrada), nunca só no destino.
- **Normalize antes de validar** (máscara CPF/telefone, trim, caixa) OU rejeite — nunca misture silenciosamente.
- **Duplicado é erro de negócio** (chave natural), não só de formato.
- **Relatório sempre**: mesmo com 0 erros, mostre contagem (evidência de que rodou).

## Checklist de qualidade (antes de entregar)

- [ ] Schema por linha com tipos e formatos (Pydantic)
- [ ] Erros coletados em lote com número da linha real
- [ ] Duplicados detectados por chave natural
- [ ] Relatório de qualidade com totais e % de erro
- [ ] Dry-run disponível e testado antes de execução real
- [ ] Política de erro explícita (strict/limiar/ignorar com aceite)
- [ ] Dados sensíveis mascarados no relatório (LGPD — ver `automation-security`)

## Anti-padrões (proibido)

1. ❌ Validar só quando "dá pau" no destino
2. ❌ Parar no primeiro erro sem coletar o restante
3. ❌ Relatório sem número de linha (impossível corrigir no arquivo)
4. ❌ Misturar registros válidos e inválidos no mesmo lote sem decisão explícita
5. ❌ Aceitar duplicado "porque o sistema deixa"
6. ❌ Dados pessoais completos no relatório/log (viola LGPD)
7. ❌ `str(dict)` de erro sem contexto do campo

## Composição com outras skills

- **Antes**: `spreadsheet-automation` (leitura da planilha) → `api-automation`/`browser-automation` (destino)
- **Depois**: `error-recovery` (o que fazer com os erros) → `automation-documentation` (documentar política) → `automation-security` (mascarar PII)

## References

- Pydantic v2 validators: https://docs.pydantic.dev/latest/concepts/validators/ · pandas: https://pandas.pydata.org/docs · validate-docbr (CPF/CNPJ): https://pypi.org/project/validate-docbr/
- Veja `references.md` nesta pasta — curadoria de fontes canônicas (2026).
