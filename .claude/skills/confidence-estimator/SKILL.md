---
name: confidence-estimator
description: "Calibra o grau de certeza (alto/médio/baixo) em recomendações e código, sinalizando suposições para evitar alucinações apresentadas como fato. Use em decisões arquiteturais ou respostas ambíguas."
---

# Confidence Estimator (Calibração de Certeza)

Quantifica e comunica com precisão o grau de certeza do agente em recomendações, código e premissas — **transformando suposições silenciosas em incertezas explícitas** e prevenindo que alucinações passem como fatos.

## Quando usar

Use ao: arquitetar sistemas com tecnologias pouco conhecidas; responder perguntas complexas onde há ambiguidade na documentação; estimar impacto de refatoração; auditar código gerado por outros modelos ou humanos. **Pule** para: código 100% verificado no repositório local (certeza alta intrínseca); tarefas mecânicas sem ambiguidades (skill `agentic-coding`).

## Matriz de Fatores de Confiança (Escala 0.0 a 1.0)

| Fator | Nível | Peso | Critério de Evidência |
|---|---|---|---|
| **Fonte Oficial** | Alta | 1.0 | Documentação oficial lida, commit verificado, API testada |
| **Código Local** | Alta | 0.95 | Padrão existente inspecionado diretamente no repositório |
| **Experiência Conhecida** | Média | 0.80 | Padrão amplamente testado em projetos anteriores equivalentes |
| **Inferência / Analogia** | Média | 0.60 | Dedução lógica baseada em princípios similares, sem teste direto |
| **Suposição / Chute** | Baixa | 0.30 | Falta de dados; premissa sem verificação ("deve funcionar assim") |

## Protocolo de Comunicação por Nível de Confiança

- **Confiança Alta (≥ 0.9)**: Afirmação direta, sem qualificadores.
  - *Exemplo*: `"Configure o middleware Next.js em `middleware.ts` com matchers explícitos para rotas protegidas."`
- **Confiança Média (0.6 - 0.89)**: Qualificador moderado e indicação de premissa.
  - *Exemplo*: `"Esta abordagem de cache em memória deve funcionar bem para o seu volume atual, assumindo < 50k requisições/dia."`
- **Confiança Baixa (< 0.6)**: Alerta explícito de incerteza e proposta de verificação.
  - *Exemplo*: `"Não tenho certeza absoluta sobre a compatibilidade desta versão do driver com o PostgreSQL 16. Recomendo validar com um teste dry-run antes."`
- **Incerteza Crítica (Falta de dados)**: Interrupção e solicitação de contexto.
  - *Exemplo*: `"Não tenho elementos suficientes para estimar o impacto desta migração. Poderia fornecer o schema atual e o volume de linhas?"`

## Workflow de Estimação (3 passos)

1. **Auto-auditoria de premissa**: Antes de responder, pergunte-se: "Vi isso no código ou estou deduzindo?"
2. **Atribuição de peso**: Calcule mentalmente a confiabilidade da fonte e dos detalhes técnicos.
3. **Qualificação da resposta**: Aplique o prefixo ou tom correspondente ao nível de confiança calculado.

## Checklist de qualidade (antes de entregar)
- [ ] Afirmações baseadas em suposições estão explicitamente qualificadas ("presumindo que...", "com base em padrões similares...")
- [ ] Nenhuma suposição é apresentada como fato absoluto
- [ ] Quando há ambiguidade, o agente solicita esclarecimento em vez de chutar
- [ ] Versões de bibliotecas mencionadas têm nível de confiança verificado

## Anti-padrões (proibido)
1. ❌ Afirmar com certeza absoluta uma API ou comportamento hipotético (alucinação perigosa)
2. ❌ Ocultar dúvidas para parecer mais "confiante"
3. ❌ Chutar números de performance ou limites sem benchmark ou docs oficiais
4. ❌ Aceitar premissas do usuário sem verificar a consistência técnica

## Composição com outras skills
- **Antes**: `hallucination-detection` (verificação de fatos) → `deep-research` (busca externa)
- **Depois**: `agentic-coding` (execução com verificação empírica) → `self-critique` (revisão)

## References
- Epistemic calibration: https://en.wikipedia.org/wiki/Confidence_assessment · Calibrated probability assessment: Good, D. J.
- Veja `references.md` nesta pasta — curadoria de fontes canônicas (2026).

> Gerado pelo Izanagi AI: cópia fiel de `skills/confidence-estimator/SKILL.md` (fonte da verdade).
