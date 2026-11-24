# References — Spreadsheet Automation

> Curadoria (2026) para automação de planilhas (Excel, CSV, ODS, Google Sheets) com Python.

## Docs canônicas
- [pandas docs](https://pandas.pydata.org/docs) — leitura/escrita (read_excel, read_csv, to_excel) e transformação
- [openpyxl docs](https://openpyxl.readthedocs.io) — escrita/leitura fiel de XLSX: fórmulas, formatação, merges, multi-sheet
- [csv (stdlib)](https://docs.python.org/3/library/csv.html) — CSV streaming, Sniffer de delimitador
- [Google Sheets API (gspread)](https://docs.gspread.org) — leitura/escrita remota com Service Account

## Referências e inspiração
- [validate-docbr](https://pypi.org/project/validate-docbr/) — validação CPF/CNPJ/telefone BR
- [Pydantic v2](https://docs.pydantic.dev) — schemas de validação por linha com erro claro
- [xlrd](https://xlrd.readthedocs.io) — apenas para .xls legado (v2 não lê .xlsx)

## Comunidade / tutoriais
- [Real Python: openpyxl](https://realpython.com/openpyxl-excel-spreadsheets-python/) — padrões de escrita com formatação
- [pandas: working with Excel](https://pandas.pydata.org/docs/user_guide/io.html#excel-files) — boas práticas de IO
- [Encoding BR (utf-8-sig)](https://docs.python.org/3/library/codecs.html) — BOM do Excel BR
