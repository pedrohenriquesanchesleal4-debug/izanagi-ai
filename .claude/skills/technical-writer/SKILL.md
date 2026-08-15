---
name: technical-writer
description: "Estrutura documentação técnica (arquitetura, APIs, manuais) pelo modelo Diátaxis, com diagramas como código. Use ao documentar sistemas, APIs ou arquiteturas."
---

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

> Gerado pelo Izanagi AI — cópia fiel de `skills/technical-writer/SKILL.md` (fonte da verdade).
