---
name: "technical-writer"
description: "Estrutura documentação técnica (arquitetura, APIs, manuais) pelo modelo Diátaxis, com diagramas como código. Use ao documentar sistemas, APIs ou arquiteturas. Gatilhos de ativação: technical writer (documentação técnica de alto craft); quando usar; os 4 pilares da documentação (diátaxis); workflow de redução de ruído (3 passos)."
version: 2.0.0
category: docs
tools:
  mcp:
    - mcp:fs_read
    - mcp:fs_write
references:
  - "references.md"
---

# Technical Writer (Documentação Técnica de Alto Craft)

> Migrado deterministicamente de `skills/technical-writer/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Documentação & Comunicação (`docs`)
- **Resumo:** Estrutura documentação técnica (arquitetura, APIs, manuais) pelo modelo Diátaxis, com diagramas como código.
- **Ativar quando:** Use ao documentar sistemas, APIs ou arquiteturas.
- **Escopo canônico:** Technical Writer (Documentação Técnica de Alto Craft)
- **Seções do corpo original:** Quando usar · Os 4 Pilares da Documentação (Diátaxis) · Workflow de Redução de Ruído (3 passos) · Exemplo de Documentação de Endpoint de API · Checklist de qualidade (antes de entregar)
- **Ferramentas MCP esperadas:** mcp:fs_read, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: workflow-section-ordered -->

### Passo 1 — Eliminar introduções genéricas:

**Eliminar introduções genéricas**: Vá direto ao ponto técnico na primeira linha.

### Passo 2 — Estrutura baseada em blocos:

**Estrutura baseada em blocos**: Use tabelas para parâmetros, blocos de código com sintaxe destacada e avisos visuais para pontos críticos.

### Passo 3 — Revisão de legibilidade:

**Revisão de legibilidade**: Verifique se a documentação responde à pergunta do desenvolvedor em menos de 30 segundos.

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] Documentação estruturada seguindo o modelo Diátaxis adequado
- [ ] Exemplos de código testados e funcionais (sem sintaxe fictícia)
- [ ] Tabelas claras para parâmetros e headers
- [ ] Zero termos vagos ou redundantes ("fácil de usar", "poderoso")

## Common Rationalizations

- **"Código limpo se auto-documenta, comentário é redundância."**
  - Verdade: Código mostra o COMO, nunca o PORQUÊ nem o contrato de uso. README com instalação/execução/configuração é parte da entrega, não cortesia.
- **"README eu escrevo antes do publish."**
  - Verdade: Antes do publish é depois do esquecimento. Documentação escrita junto à implementação captura decisões que em 3 dias já não estão mais na memória.
- **"Doc envelhece rápido, então melhor nem escrever."**
  - Verdade: Doc desatualizada é corrigível; doc ausente é institucionalizada ignorância. O framework exige limitações conhecidas documentadas — honestidade sobre o que falta é conteúdo, não fraqueza.
- **"Só eu uso esse projeto, documento é overhead."**
  - Verdade: 'Eu daqui a 6 meses' também é outro desenvolvedor. Handoff sem documentação transforma toda manutenção futura em arqueologia.
- **"Coloquei um exemplo genérico no README, serve."**
  - Verdade: Exemplo que não roda é pior que nenhum: ensina errado com autoridade. Todo comando documentado precisa ter sido executado de fato (zero falsificação).
- **"Referência eu completo depois, agora é só chute razoável."**
  - Verdade: URL inventada é alucinação documentada. Nunca entregue referência não verificada — pesquise ou declare explicitamente que não verificou.

## Red Flags

- README sem comando exato de instalação e execução testado.
- `.env.example` ausente num projeto que exige configuração.
- Documentação divergente do comportamento real do código.
- Seção 'Limitações' vazia ou omitida (finge completude).
- Link/referência citada sem verificação (risco de alucinação).
- Termo de domínio usado sem definição numa base nova.

## Legacy Reference (v1)

# Technical Writer (Documentação Técnica de Alto Craft)

Criação de documentação técnica clara, estruturada e voltada para desenvolvedores e operadores — utilizando princípios modernos como **Diátaxis** (manuais orientados a tarefas, tutoriais e explicações) e diagramas como código.

## Quando usar

Use ao: documentar APIs públicas ou internas; criar guias de arquitetura e manuais de onboarding para novos desenvolvedores; estruturar wikis técnicas. **Pule** para: READMEs rápidos de repositórios (skill `readme-generator`).

## Os 4 Pilares da Documentação (Diátaxis)

1. **Tutoriais (Orientados ao aprendizado)**: Leem-se pela mão do iniciante para dar uma experiência de sucesso rápido (ex: "Seu primeiro endpoint em 5 minutos").
2. **How-to Guides (Orientados a tarefas)**: Receitas passo a passo para resolver problemas reais específicos (ex: "Como configurar OAuth2 com Google").
3. **Reference (Orientados à informação)**: Descrição técnica árida e precisa (ex: "Especificação exata de parâmetros da API REST").
4. **Explanation (Orientados à compreensão)**: Discussão teórica, trade-offs e arquitetura (ex: "Por que escolhemos PostgreSQL em vez de NoSQL").

## Workflow de Redução de Ruído (3 passos)

1. **Eliminar introduções genéricas**: Vá direto ao ponto técnico na primeira linha.
2. **Estrutura baseada em blocos**: Use tabelas para parâmetros, blocos de código com sintaxe destacada e avisos visuais para pontos críticos.
3. **Revisão de legibilidade**: Verifique se a documentação responde à pergunta do desenvolvedor em menos de 30 segundos.

## Exemplo de Documentação de Endpoint de API

```markdown
### POST /api/v1/projects
Cria um novo projeto no workspace autenticado.

#### Headers
| Header | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `Authorization` | string | Sim | Bearer token JWT |
| `Content-Type` | string | Sim | `application/json` |

#### Payload de Requisição
```json
{
  "name": "Meu Projeto SaaS",
  "region": "us-east-1"
}
```

#### Resposta de Sucesso (201 Created)
```json
{
  "id": "proj_99812",
  "name": "Meu Projeto SaaS",
  "createdAt": "2026-08-10T19:00:00Z"
}
```
```

## Checklist de qualidade (antes de entregar)
- [ ] Documentação estruturada seguindo o modelo Diátaxis adequado
- [ ] Exemplos de código testados e funcionais (sem sintaxe fictícia)
- [ ] Tabelas claras para parâmetros e headers
- [ ] Zero termos vagos ou redundantes ("fácil de usar", "poderoso")

## Anti-padrões (proibido)
1. ❌ Documentação desatualizada que diverge do código real ("docs mentem mais que código")
2. ❌ Blocos de texto intermináveis sem formatação ou tabelas
3. ❌ Exemplos de código com erros de sintaxe óbvios

## Composição com outras skills
- **Antes**: `architect` (arquitetura) → `docs` (agente de documentação)
- **Depois**: `readme-generator` (geração de README) → `qa` (revisão de clareza)

## References
- Diátaxis Framework: https://diataxis.fr · Google Technical Writing Courses: https://developers.google.com/tech-writing.
- Veja `references.md` nesta pasta — curadoria de fontes canônicas (2026).
