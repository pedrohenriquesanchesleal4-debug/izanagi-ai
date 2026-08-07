---
name: automation-documentation
description: "Documentacao de automacoes: README com instalacao, configuracao, execucao, testes, limitacoes e manutencao. Use em toda automacao entregue para que outro humano (ou voce) consiga executar e manter."
---

# Automation Documentation — Entregável Usável por Humanos

## README obrigatório (estrutura)

```markdown
# Nome da automação
Uma linha: o que faz e para quem.

## Pré-requisitos
Python X+, serviços, contas, acesso.

## Instalação
pip install -r requirements.txt

## Configuração
Copie .env.example para .env e preencha: quais variáveis, onde conseguir cada valor.

## Execução
python main.py            # produção
python main.py --dry-run  # simulação sem efeitos

## Testes
pytest -q

## Saída
O que a execução gera (relatório, arquivos, estado).

## Limitações
O que a automação NÃO cobre, casos conhecidos de falha, dependências externas.

## Manutenção
Onde mexer se o destino mudar (seletores, endpoints, versões).
```

## Regras

- Documente **o que fazer quando der errado**: erros comuns + ação (checkpoint, retry, contato).
- `.env.example` sempre presente, sem valores reais (ver `automation-security`).
- Comentários no código só onde a intenção não é óbvia — o README é a documentação de verdade.
- Atualize a documentação quando mudar comportamento (nunca doc desatualizada).

## References

- Ver skills `automation-engineer` (entrega em 11 seções) e `docs` do framework (READMEs técnicos).
