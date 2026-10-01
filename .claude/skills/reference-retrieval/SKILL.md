---
name: reference-retrieval
description: "Recupera exemplos, contratos e documentação verificáveis antes de implementar integrações. Prioriza MCP, repositório local e fontes oficiais, com fallback honesto quando browser ou MCP não estiver disponível."
---

# Reference Retrieval · Agent-first grounding

Use esta skill antes de implementar qualquer integração, SDK, MCP, biblioteca de UI ou
API externa. O objetivo é transformar exemplos verificáveis em contratos de implementação,
não copiar snippets sem entender o contexto.

## Workflow

1. **Detecte capabilities**: verifique se há MCP de documentação/exemplos, browser portal,
   Playwright, busca web e acesso ao repositório. Marque cada uma como `available`,
   `unavailable` ou `unknown`.
2. **Prefira retrieval agent-first**: consulte primeiro exemplos já existentes no projeto,
   depois resources/tools MCP, depois documentação oficial versionada. Só use busca visual
   live quando a capability tiver sido detectada.
3. **Capture evidência**: para cada exemplo, registre URL ou caminho, versão/data, contrato
   observado, limitações e o que será adaptado. Não trate marketing ou uma resposta sem
   fonte como fato.
4. **Compare alternativas**: confirme nomes de imports, parâmetros, retornos, erros e
   requisitos de runtime contra pelo menos uma fonte primária.
5. **Emita um artefato curto**: `reference`, `source`, `version`, `observedContract`,
   `adaptation`, `confidence` e `unknowns`. O agente de implementação consome esse
   artefato, não a transcrição completa da pesquisa.
6. **Fallback explícito**: se a fonte não estiver acessível, produza `UNKNOWN`, cite a
   última evidência disponível e peça uma decisão ou implemente somente contra contratos
   locais já comprovados.

## MCP e exemplos

- Descubra resources/tools antes de invocar um nome presumido.
- Valide schema de entrada e saída de cada tool MCP antes de escrever o client.
- Nunca afirme que um MCP, browser portal ou CLI está disponível só porque existe uma
  skill ou uma referência textual.
- Nunca invente endpoint, import, flag, seletor ou versão para preencher uma lacuna.

## Verification Steps

- [ ] capability matrix registrada
- [ ] fonte primária ou caminho local citado
- [ ] versão/commit/data registrados quando disponíveis
- [ ] contrato de entrada, saída e erro observado
- [ ] desconhecidos e fallback declarados
- [ ] agente implementador recebeu o artefato de evidência

> Gerado pelo Izanagi AI: cópia fiel de `skills/reference-retrieval/SKILL.md` (fonte da verdade).
