---
name: data-validation
description: "Validação de dados em automações: schemas (Pydantic), verificação de campos obrigatórios, formatos (email, CPF/CNPJ, datas, telefone), faixas de valores, detecção de duplicados (chave natural), e relatórios de qualidade com contagem de erros. Use antes de enviar dados a qualquer destino (API, banco, planilha) para garantir zero dado inválido."
---

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
