# Referências verificadas: taste, anti-slop e memória local

> Curadoria para `discovery`, `design-directions`, `anti-ai-slop`, `motion-design`,
> `qa` e `researcher`. Claims são separados entre fato e inferência para evitar que
> uma inspiração de rede social vire regra sem evidência.

## FACT: skills precisam de divulgação progressiva

- Fonte: [Agent Skills specification](https://agentskills.io/specification)
- Fonte: [Anthropic · Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- Aplicação: metadata curta decide ativação; o corpo da skill só entra após ativação;
  referências e scripts entram sob demanda. O resolver deve continuar carregando índice
  mínimo e delegar material profundo para `references/`.
- Impacto: reduz context rot e permite ampliar o catálogo sem transformar todo agente
  em um prompt monolítico.

## FACT: microdecisões de design podem ser codificadas como skill

- Fonte: [Emil Kowalski · AI Skills for Design Engineers](https://emilkowal.ski/skill)
- Fonte: [Emil Kowalski · Agents with Taste](https://emilkowal.ski/ui/agents-with-taste)
- Fonte: [Emil Kowalski · skills](https://github.com/emilkowalski/skills)
- Aplicação: a skill deve exigir intenção explícita para tipografia, composição, motion
  e estados. Regras práticas como não iniciar entradas em `scale(0)`, usar easing de
  entrada apropriado e dar feedback tátil a controles são heurísticas, não substitutos
  para pesquisa do produto.
- Impacto: transforma “faça algo bonito” em decisões auditáveis e comparáveis.

## FACT: testes de navegador devem preferir locators semânticos

- Fonte: [Playwright · Best Practices](https://playwright.dev/docs/best-practices)
- Aplicação: a auditoria visual deve ser acompanhada por uma verificação de estados,
  acessibilidade e comportamento usando `getByRole`, `getByLabel` e locators estáveis.
- Impacto: um design memorável que não pode ser usado ou testado não passa no gate.

## FACT: Markdown local e grafo visual são portáveis

- Fonte: [Obsidian Help](https://help.obsidian.md)
- Fonte: [Obsidian · Graph view](https://help.obsidian.md/plugins/graph)
- Aplicação: Obsidian é uma camada humana opcional para `.agents/memoria/` e
  `references/`. Markdown continua sendo a fonte portátil; o grafo é navegação, não
  fonte de verdade do runtime.
- Impacto: vale adotar agora sem introduzir dependência de SaaS, embeddings ou banco
  vetorial antes de existir benchmark de recuperação.

## INFERENCE: o próximo gate deve medir intenção, não apenas ausência de tells

Derivação: remover gradiente roxo, `Inter` e cards repetidos evita padrões conhecidos,
mas uma tela ainda pode ser sem identidade. Por isso `anti-ai-slop` agora exige uma
Matriz de Taste com evidência por identidade, tipografia, composição, cor, motion e
conteúdo, além de duas variações estruturais antes do código.

## UNKNOWN: Instagram como fonte normativa

Posts e vídeos salvos no Instagram são úteis como radar de ideias, mas não foram
promovidos a fonte normativa neste catálogo quando a URL canônica, autoria ou transcrição
não puderam ser confirmadas. Um agente pode registrar a referência como lead e rebaixá-la
para `UNKNOWN` até capturar URL, autor, data e trecho verificável.
