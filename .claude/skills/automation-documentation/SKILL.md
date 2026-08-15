---
name: automation-documentation
description: "Gera README de automações: instalação, configuração (.env), execução com dry-run, testes, limitações e troubleshooting. Use em toda automação entregue, para que outra pessoa consiga executar e manter."
---

# Automation Documentation

Documentação de automações para que **outro humano (ou você daqui a 3 meses)** consiga instalar, executar e manter sem perguntar nada. Toda automação entregue vem com README — não é opcional.

## Quando usar

Use **sempre** ao entregar uma automação (script, ETL, integração, bot). **Pule** para: automação descartável de 1 execução (documente no mínimo os comandos na resposta); docs de produto/site (skill `technical-writer`).

## Template de README (seções obrigatórias)

```markdown
# <nome da automação>

<1 parágrafo: o que faz, por que existe, quem usa>

## Pré-requisitos
- Python 3.11+
- <serviços externos: API, banco, credenciais necessárias>

## Instalação
pip install -r requirements.txt   # ou uv sync

## Configuração (.env)
Copie `.env.example` para `.env` e preencha:
| Variável | Descrição | Exemplo |
|---|---|---|
| API_KEY | Chave do sistema X | sk-... |
| ORIGEM | Caminho da planilha | data/entrada.xlsx |

## Execução
python main.py --dry-run          # valida sem alterar nada (faça primeiro)
python main.py                    # execução real
python main.py --modo incremental # re-execução sem duplicar

## Testes
pytest -q                          # unitários + integração
python main.py --self-check        # validação da própria instalação

## Como funciona (fluxo)
1. Lê planilha → 2. valida schema → 3. envia via API → 4. grava relatório em output/

## Limitações conhecidas
- API limita 100 req/min → execução leva ~30 min para 50k linhas
- Não suporta arquivos .xls legado

## Manutenção
- Verificar mensalmente: credenciais expiradas, mudança de contrato da API
- Logs em logs/ (retenção 30 dias)
- Erros conhecidos: veja troubleshooting abaixo

## Troubleshooting
| Erro | Causa | Solução |
|---|---|---|
| HTTP 401 | API_KEY expirada | renovar no painel |
| UnicodeDecodeError | encoding do CSV | rodar com --encoding utf-8-sig |
```

## Regras de documentação

- **`.env.example` SEMPRE** versionado com as variáveis (valores falsos/placeholder), `.env` nunca.
- **Comandos copiáveis** (não "rode o script" — mostre `python main.py --dry-run`).
- **Documente o modo de segurança primeiro** (dry-run) e depois o real — quem executa deve saber o caminho seguro.
- **Limitações honestas**: volume, rate limits, formatos não suportados — documentar o que não faz evita chamado.
- **Manutenção com periodicidade**: o que verificar e quando (credenciais, contratos, mudanças externas).
- **Troubleshooting por tabela**: erro → causa → solução, alimentado pelos erros reais já vistos.
- **Testes documentados**: como rodar (`pytest -q`) e o que cada suíte cobre.

## Checklist de qualidade (antes de entregar docs)

- [ ] Pré-requisitos e instalação com comandos copiáveis
- [ ] `.env.example` com todas as variáveis explicadas
- [ ] Comandos de execução: dry-run primeiro, depois real
- [ ] Modos/flags documentados (incremental, strict, etc.)
- [ ] Como rodar testes
- [ ] Fluxo em 3-5 passos (o que o script faz)
- [ ] Limitações conhecidas honestas
- [ ] Seção de manutenção com periodicidade
- [ ] Troubleshooting com erros reais

## Anti-padrões (proibido)

1. ❌ README sem pré-requisitos ("depende de umas libs")
2. ❌ Enviar `.env` com credenciais reais (vaza segredo — ver `automation-security`)
3. ❌ "Rode o script" sem comando copiável
4. ❌ Sem dry-run documentado (quem executa não sabe o caminho seguro)
5. ❌ Limitações escondidas (descobre no meio de uma execução crítica)
6. ❌ Sem troubleshooting (todo erro vira chamado)
7. ❌ Docs desatualizadas da implementação (docs mentem > código)

## Composição com outras skills

- **Antes**: todas as de automação (`api-automation`, `spreadsheet-automation`, `browser-automation`...) — documenta o que elas implementaram
- **Depois**: `automation-security` (auditoria de que `.env` não vazou) → `readme-generator` (template alternativo para projetos) → `technical-writer` (docs maiores)

## References

- Write the Docs: https://www.writethedocs.org/guide/ · Diátaxis (documentação por tarefa): https://diataxis.fr · Conventional README (makeareadme): https://github.com/matiassingers/awesome-readme
- Veja `references.md` nesta pasta — curadoria de fontes canônicas (2026).

> Gerado pelo Izanagi AI — cópia fiel de `skills/automation-documentation/SKILL.md` (fonte da verdade).
