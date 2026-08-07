---
name: data-validation
description: "Validacao de dados em automacoes: schemas (Pydantic), verificacao de campos obrigatorios, formatos, valores, deteccao de duplicados e relatorios de qualidade. Use antes de enviar dados a qualquer destino."
---

# Data Validation — Nunca Confie em Dados de Entrada

## Princípio

Dados vêm de planilhas, formulários e APIs — sempre imperfeitos. Valide antes de qualquer ação irreversível (upload, escrita, envio).

## Camadas de validação

1. **Schema**: Pydantic model por registro — campos obrigatórios, tipos, formatos (`EmailStr`, `conint`, `pattern`). Falha cedo, com mensagem clara.
2. **Valores**: ranges, enums, datas válidas, números (vírgula vs ponto), strings vazias/whitespace.
3. **Duplicados**: chave natural (email, CPF, ID) — detecte e decida: pular, substituir ou marcar para revisão (nunca delete silencioso).
4. **Consistência**: referências cruzadas (ex: produto existe no cadastro?), regras de negócio.
5. **Resultado pós-ação**: verificar que o destino aceitou (status 201, ID retornado) — não assumir sucesso.

## Estrutura de erro

Toda falha: **linha/registro + campo + valor recebido + motivo**.

```
linha 143: email inválido (valor: "joao#empresa.com")
linha 421: CPF duplicado (registro já existente)
linha 817: data fora do range permitido
```

## Política

- Inválido permanente → não retry, registrar, continuar (ou abortar conforme gravidade).
- Sanitize/normalize quando seguro (trim, casing, formatos) — documente as transformações.
- Relatório final com contagem por tipo de problema.

## References

- Pydantic: https://docs.pydantic.dev
- Ver skills `automation-engineer`, `spreadsheet-automation`.
