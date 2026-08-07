---
name: spreadsheet-automation
description: "Automacao de planilhas (Excel, CSV, XLSX, XLS, ODS): leitura, escrita, validacao, normalizacao, transformacao, deteccao de duplicados e integracao com outros sistemas via pandas/openpyxl. Use para automatizar qualquer tarefa envolvendo planilhas."
---

# Spreadsheet Automation — Planilhas como Fonte de Dados Confiável

## Quando usar

- Ler dados de planilhas (XLSX, XLS, CSV, ODS) para processamento/upload.
- Escrever/exportar resultados para planilha.
- Normalizar, transformar e validar dados tabulares.
- Detectar duplicados, vazios, inconsistências antes de integrações.

## Ferramentas

- **pandas** — análise e transformação (CSV, Excel, leitura em chunks para arquivos grandes).
- **openpyxl** — escrita/leitura de XLSX com formatação, preservando fórmulas quando necessário.
- **csv** (stdlib) — arquivos CSV com `encoding` explícito (utf-8-sig para Excel BR).

## Boas práticas

1. **Inspecione antes**: `df.head()`, `df.dtypes`, `df.isna().sum()`, `df.duplicated().sum()` — conheça o dado antes de processar.
2. **Encoding explícito**: sempre `encoding="utf-8-sig"` em CSV; nunca assuma default.
3. **Normalize**: trim de espaços, padronize maiúsculas/minúsculas, datas (`pd.to_datetime` com `errors="coerce"`), números (vírgula vs ponto).
4. **Valide por schema**: use Pydantic para modelar linhas e falhar cedo com mensagem clara (linha + campo + motivo).
5. **Duplicados**: defina chave natural (ex: email/CPF) e use `drop_duplicates(subset=...)` ou marque para revisão, não delete silenciosamente.
6. **Chunks**: arquivos grandes → `pd.read_csv(..., chunksize=...)` ou `openpyxl.read_only=True`.
7. **Nunca altere a fonte original**: trabalhe em cópia; se precisar escrever, gere novo arquivo.

## Estrutura de erro

Toda falha de validação deve reportar: **linha da planilha, campo, valor recebido, motivo**.

## References

- pandas: https://pandas.pydata.org/docs · openpyxl: https://openpyxl.readthedocs.io
- Ver skill `automation-engineer` (engenharia completa) e `data-validation`.
