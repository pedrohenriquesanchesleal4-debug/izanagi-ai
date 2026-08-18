---
name: spreadsheet-automation
description: "Use para automatizar planilhas (Excel, CSV, ODS, Google Sheets) como fonte ou destino de dados: leitura, validação, normalização e escrita sem perda de dados."
---

# Spreadsheet Automation — Planilhas como Fonte de Dados Confiável

Automação de planilhas de nível de produção: ler, validar, normalizar, transformar e escrever dados tabulares com **zero perda silenciosa de dados**. Toda transformação é rastreável, toda rejeição é reportada com linha + campo + motivo.

## Quando usar

Use quando a tarefa envolver **planilhas como fonte, destino ou intermediário de dados**:

- Ler dados de planilhas (XLSX, XLS, CSV, ODS, Google Sheets export) para processamento/upload em sistema.
- Escrever/exportar resultados, relatórios ou templates para planilha (com formatação, se o destino exigir).
- Normalizar, transformar e validar dados tabulares antes de integrar com API/banco/ETL.
- Detectar duplicados, vazios, inconsistências, linhas órfãs ou valores fora de domínio.
- Migrar dados de planilha legada para sistema estruturado.

**Pule** para: dados já estruturados em banco (skill `data-engineering`/`db`), scraping de sites (skill `browser-automation`), integração REST pura (skill `api-automation`), ou quando a fonte já for uma API estruturada.

## Stack (escolha por necessidade real)

| Formato | Ferramenta | Quando |
|---|---|---|
| CSV / TSV | `csv` (stdlib) + `pandas` | Intercâmbio simples, big data (chunks), log exports |
| XLSX (escrita/leitura completa) | `openpyxl` | Fórmulas, formatação, múltiplas sheets, comentários |
| XLS/XLSX legado rápido | `pandas` (`read_excel`) | Análise, transformação, exploração |
| XLS legado (binário .xls) | `xlrd` (v2 só p/ .xls) | Arquivos .xls antigos (nunca para .xlsx) |
| ODS | `pandas` (engine `odf`) ou `odfpy` | LibreOffice/Google export |
| Google Sheets | `gspread` + Service Account | Fonte remota com API |

**Regra**: `pandas` para análise/transformação; `openpyxl` para escrita fiel (formatação, fórmulas, merges); `csv` para arquivos gigantes em streaming. Nunca misture engines sem necessidade.

## Workflow obrigatório (5 passos)

### Passo 1 — Inspecione antes de processar (nunca pule)

```python
import pandas as pd

df = pd.read_excel("entrada.xlsx", sheet_name=None)  # todas as sheets
for name, sheet in df.items():
    print(f"=== {name}: {sheet.shape} ===")
    print(sheet.head(3).to_string())
    print("dtypes:", dict(sheet.dtypes.astype(str)))
    print("nulos:", sheet.isna().sum().to_dict())
    print("duplicados:", sheet.duplicated().sum())
```

Confirme antes de qualquer transformação: **formato real das colunas** (datas podem vir como string), **encoding**, **delimitador** (CSV brasileiro costuma ser `;`), **linhas de cabeçalho** (alguns arquivos têm título antes do header), **sheets múltiplas** (o dado pode estar em `Planilha2`, não na primeira).

### Passo 2 — Defina o schema e valide cedo (Pydantic)

Modele cada linha e falhe **antes** de processar o volume:

```python
from pydantic import BaseModel, EmailStr, field_validator
from datetime import date

class Cliente(BaseModel):
    nome: str
    email: EmailStr
    nascimento: date | None = None
    valor: float

    @field_validator("nome", mode="before")
    @classmethod
    def strip(cls, v):
        return v.strip() if isinstance(v, str) else v

erros = []
linhas_ok = []
for i, row in df.iterrows():
    try:
        linhas_ok.append(Cliente(**row.to_dict()))
    except Exception as e:
        erros.append({"linha": i + 2, "campos": row.to_dict(), "motivo": str(e)})
```

**Relatório de erro obrigatório** — cada rejeição com: **linha da planilha (número real, +2 se header em linha 1), campo, valor recebido, motivo**. Grave em `erros.json`/`rejeitados.csv` e resuma no final: `X de Y linhas válidas, Z rejeitadas`.

### Passo 3 — Normalize com regras explícitas

- **Trim**: `str.strip()` em toda string textual (nunca confie no dado de origem).
- **Datas**: `pd.to_datetime(col, errors="coerce", dayfirst=True)` para formato BR (dd/mm/aaaa); **nunca** assuma default americano.
- **Números**: substitua vírgula decimal por ponto **antes** de `astype(float)`; trate `R$ 1.234,56` com regex `[\d.,]+` + conversão.
- **CPF/CNPJ/telefone**: remova máscaras (`\D`) e valide dígitos verificadores (biblioteca `validate-docbr` ou manual).
- **Encoding**: CSV sempre `encoding="utf-8-sig"` (Excel BR grava BOM); `latin-1` só se o conteúdo confirmar.
- **Delimitador**: `sep=";"` quando origem for Excel BR; detecte com `csv.Sniffer` se incerto.

### Passo 4 — Duplicados: marque, não delete silenciosamente

Defina a **chave natural** (ex: email, CPF, código do cliente) e:

```python
chave = "email"
df["_dup"] = df.duplicated(subset=[chave], keep=False)
dups = df[df["_dup"]]
unicos = df[~df["_dup"]]
```

- Grave duplicados em `duplicados.csv` para revisão humana.
- Decida a política **com o usuário**: primeiro registro vence, último vence, ou concatenação — nunca apague sem registro.

### Passo 5 — Escreva sem destruir a fonte

- **Nunca altere o arquivo original**: trabalhe em cópia; gere novo arquivo com sufixo (`_normalizado.xlsx`).
- Para XLSX com formatação/fórmulas: `openpyxl` com `load_workbook(keep_vba=False, data_only=False)` e preserve estilos (copie `cell.font/border/fill` se reescrever células).
- Multi-sheet: `pd.ExcelWriter(path, engine="openpyxl")` com `sheet_name` por dataframe.
- Arquivos grandes: `pd.read_csv(..., chunksize=50_000)` + acumulador; `openpyxl.read_only=True, data_only=True` para leitura leve.
- Google Sheets: use `gspread` com Service Account (credenciais **fora do código**, via env var — ver skill `automation-security`).

## Anti-padrões (proibido)

1. ❌ `pd.read_excel(...)` sem `dtype`/inspeção — silenciosamente converte números com zero à esquerda (CPF vira `1.23e+11`).
2. ❌ Assumir encoding default — arquivo BR sem `utf-8-sig` quebra acentos silenciosamente.
3. ❌ `drop_duplicates()` sem registrar o que foi removido.
4. ❌ `to_excel` sobrescrevendo o arquivo de origem.
5. ❌ `astype(float)` em coluna com vírgula decimal — explode com `ValueError` ou converte errado.
6. ❌ Datas sem `dayfirst` — `01/02/2024` vira 1º de fevereiro ou 2 de janeiro dependendo do locale.
7. ❌ Carregar arquivo gigante inteiro em memória sem `chunksize`/`read_only`.
8. ❌ Tratar erro por linha com `try/except` raso que não registra **qual** linha falhou.
9. ❌ Confiar em `sheet[0]` quando o arquivo tem múltiplas sheets — sempre liste e confirme.
10. ❌ Hardcoded de caminho/credencial no script — sempre `.env` + variáveis de ambiente.

## Checklist de qualidade (antes de entregar)

- [ ] Inspeção inicial registrada (shape, dtypes, nulos, duplicados por sheet)
- [ ] Schema Pydantic validando linhas com mensagem clara (linha + campo + motivo)
- [ ] Encoding explícito em toda leitura/escrita
- [ ] Datas normalizadas com `dayfirst` explícito
- [ ] Duplicados marcados em arquivo de revisão (nunca apagados)
- [ ] Fonte original intacta; saída em novo arquivo
- [ ] Relatório final: totais válidos/rejeitados/duplicados + caminho dos arquivos
- [ ] Idempotente: rodar 2x produz o mesmo resultado (ou dry-run documentado)
- [ ] Segredos em `.env`, nunca no código
- [ ] README com comando de execução + exemplo de entrada/saída

## Composição com outras skills

- **Antes**: `automation-planning` (escopo) → `automation-research` (bibliotecas/limitações) → `automation-engineer` (orquestração do processo)
- **Depois**: `data-validation` (schema mais rígido) → `api-automation` (upload do resultado) → `automation-security` (credenciais) → `automation-documentation` (README) → `testing-automation` (testes das transformações)

## References

- pandas: https://pandas.pydata.org/docs · openpyxl: https://openpyxl.readthedocs.io · gspread: https://docs.gspread.org · validate-docbr: https://pypi.org/project/validate-docbr/
- Ver skill `automation-engineer` (engenharia completa do processo) e `data-validation`.

> Gerado pelo Izanagi AI: cópia fiel de `skills/spreadsheet-automation/SKILL.md` (fonte da verdade).
