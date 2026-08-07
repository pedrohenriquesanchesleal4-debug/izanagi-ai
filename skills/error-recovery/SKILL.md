---
name: error-recovery
description: "Resiliencia em automacoes: retries com criterio, checkpoints, retomada de onde parou, classificacao de erros (recuperavel vs permanente) e recuperacao de estado. Use em qualquer automacao que deva sobreviver a falhas sem perder progresso."
---

# Error Recovery — Automação que Sobrevive a Falhas

## Classificação de erros

| Tipo | Exemplo | Ação |
|---|---|---|
| Transitório | timeout, rede, 5xx, elemento carregando | Retry com backoff (2-3 tentativas) |
| Permanente | 4xx de validação, dado inválido, credencial inválida | Não retry; log motivo; continue ou aborte conforme política |
| Desconhecido | exceção inesperada | Registrar, marcar item como "desconhecido", não assumir |

## Checkpoints (idempotência)

1. Defina uma **chave natural** por item processado (ex: hash do registro, ID, email).
2. Persista estado: arquivo JSON de checkpoint, SQLite ou tabela `processed` no banco.
3. Antes de processar: verifique se o item já foi processado → pule.
4. Após processar: registre o resultado (sucesso/falha/motivo) **antes** de prosseguir.
5. Em falha: salve o checkpoint do último item concluído e o índice do atual.

Reexecução: lê o estado, continua do que falta — nunca reprocessa tudo do zero.

## Retry com backoff

- `tenacity`: `@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, max=30))`.
- Retry apenas para erros transitórios. Nunca retry infinito em credenciais.
- Retry-able: rede, timeout, 5xx, elemento não encontrado temporariamente.

## Recuperação de estado

```
Checkpoint → Processamento → Falha → Salvar estado → Corrigir problema → Continuar
```

- Se a falha for permanente e não bloqueante: registre e continue com o próximo item.
- Se for bloqueante (auth, arquivo corrompido): pare, reporte claramente, permita retomar.

## Relatório

Ao final: total, processados, ignorados (duplicados), falhas (item + motivo), tempo. Ver `automation-engineer` (observabilidade).

## References

- tenacity: https://tenacity.readthedocs.io
- Ver skills `automation-engineer` e `api-automation` (aplicação prática).
