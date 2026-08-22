---
name: "hallucination-detection"
description: "Detecta alucinações técnicas em código gerado — APIs inexistentes, imports inventados, versões descasadas — cruzando com o repositório real. Use ao revisar código gerado por IA ou depurar erros misteriosos. Gatilhos de ativação: hallucination detection (detecção de falsidades técnicas); quando usar; principais tipos de alucinação técnica; workflow de verificação (4 passos)."
version: 2.0.0
category: ai
tools:
  mcp:
    - mcp:fs_read
    - mcp:fs_write
    - mcp:execute_command
---

# Hallucination Detection (Detecção de Falsidades Técnicas)

> Migrado deterministicamente de `skills/hallucination-detection/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** IA & Agentes (`ai`)
- **Resumo:** Detecta alucinações técnicas em código gerado — APIs inexistentes, imports inventados, versões descasadas — cruzando com o repositório real.
- **Ativar quando:** Use ao revisar código gerado por IA ou depurar erros misteriosos.
- **Escopo canônico:** Hallucination Detection (Detecção de Falsidades Técnicas)
- **Seções do corpo original:** Quando usar · Principais Tipos de Alucinação Técnica · Workflow de Verificação (4 passos) · Checklist de qualidade (antes de entregar) · Anti-padrões (proibido)
- **Ferramentas MCP esperadas:** mcp:fs_read, mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: workflow-section-steps -->

### Passo 1 — Triagem de assinaturas e imports

Antes de aceitar um trecho de código fornecido, verifique cada import e chamada de método crítico contra o repositório ou documentação conhecida.

### Passo 2 — Inspeção de evidência local

```powershell
# Exemplo: verificar se o arquivo ou exportação realmente existe antes de usar
Test-Path -LiteralPath "src\utils\auth.ts"
```

### Passo 3 — Validação de versão de dependências

Confirme se a biblioteca suporta o recurso sugerido na versão exata declarada no projeto.

### Passo 4 — Interceptação e correção

Se detectada alucinação, substitua imediatamente pela API real ou solicite clarificação.

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] 100% dos imports e módulos referenciados existem no projeto ou nas dependências instaladas
- [ ] Métodos e propriedades chamados em objetos correspondem à versão real da biblioteca
- [ ] Paths de arquivos citados foram verificados em disco
- [ ] Nenhuma suposição de API é tratada como garantia

## Common Rationalizations

- **"Modelo moderno entende sozinho, prompt detalhado é desperdício."**
  - Verdade: Sem few-shot, formato de saída estrito e guardrails, o output é probabilístico e imprevisível. Prompt engineering é especificação de comportamento — não decoração.
- **"Resposta plausível, então tá correto."**
  - Verdade: Plausibilidade é o produto, não a prova. Sem avaliação (dataset, critério, comparação), você está validando retórica — hallucinação apresentada como fato é falha classificada do framework.
- **"Embedding/recuperação ruim? Troco o modelo maior."**
  - Verdade: Trocar modelo mascara problema de chunking, consulta e qualidade de dados — e multiplica custo. Diagnostique o pipeline RAG antes de escalar o modelo.
- **"Jogo tudo no contexto, janela hoje é gigante."**
  - Verdade: Contexto inflado custa dinheiro, latência e atenção do modelo (lost in the middle). Economia de tokens é disciplina: contexto mínimo, cache, janela deslizante.
- **"Tool call retornou algo, sigo em frente."**
  - Verdade: Output de tool sem schema validado é dado não confiável entrando no raciocínio. Validar resposta é o mesmo anti-falhas de qualquer integração — LLM não é exceção.
- **"Prompt injection é teórico, meu caso é fechado."**
  - Verdade: Todo texto que entra pelo usuário/documento recuperado é superfície de injection. Fechado significa menos vetores, não zero — defesa custa uma instrução e um filtro.

## Red Flags

- Feature de LLM sem dataset/critério de avaliação (qualidade não medida).
- RAG respondendo sem citação/rastreabilidade da fonte recuperada.
- Tool/MCP exposto sem schema de entrada validado nem limite de escopo.
- Chamada de modelo sem timeout, retry criterioso ou budget de custo.
- Output do modelo parseado com confiança cega (sem validação estrutural).
- Instrução de sistema concatenada com input de usuário sem isolamento.
- Agente com efeito real no mundo sem dry-run nem confirmação de ação irreversível.

## Legacy Reference (v1)

# Hallucination Detection (Detecção de Falsidades Técnicas)

Identifica e intercepta alucinações (falsidades geradas por inferência estatística sem base factual) em código, assinaturas de API, bibliotecas inexistentes e referências cruzadas — **garantindo que o que é entregue exista na realidade técnica**.

## Quando usar

Use ao: revisar código gerado por IA ou de terceiros; depurar erros do tipo `ModuleNotFoundError` ou `TypeError: undefined is not a function`; validar se um método de biblioteca realmente existe na versão especificada. **Pule** para: execução empírica direta via build/testes (skill `agentic-coding`); auditoria estática de segurança SAST (skill `code-auditor`).

## Principais Tipos de Alucinação Técnica

| Tipo | O que é | Como detectar |
|---|---|---|
| **API Fantasma** | Chamar método que não existe na biblioteca (ex: `pandas.read_magic()`) | Conferir na doc oficial / type definitions (`node_modules`, `site-packages`) |
| **Import Inventado** | Importar módulo inexistente (`from utils.fast import super_cache`) | Verificar existência do arquivo no repo |
| **Versão Descasada** | Usar sintaxe de versão nova em ambiente antigo (ou vice-versa) | Checar `package.json` / `pyproject.toml` |
| **Caminho Falso** | Referenciar arquivo em path que não existe no projeto | Verificar via Glob / Test-Path |

## Workflow de Verificação (4 passos)

### 1. Triagem de assinaturas e imports
Antes de aceitar um trecho de código fornecido, verifique cada import e chamada de método crítico contra o repositório ou documentação conhecida.

### 2. Inspeção de evidência local
```powershell
# Exemplo: verificar se o arquivo ou exportação realmente existe antes de usar
Test-Path -LiteralPath "src\utils\auth.ts"
```

### 3. Validação de versão de dependências
Confirme se a biblioteca suporta o recurso sugerido na versão exata declarada no projeto.

### 4. Interceptação e correção
Se detectada alucinação, substitua imediatamente pela API real ou solicite clarificação.

## Checklist de qualidade (antes de entregar)
- [ ] 100% dos imports e módulos referenciados existem no projeto ou nas dependências instaladas
- [ ] Métodos e propriedades chamados em objetos correspondem à versão real da biblioteca
- [ ] Paths de arquivos citados foram verificados em disco
- [ ] Nenhuma suposição de API é tratada como garantia

## Anti-padrões (proibido)
1. ❌ Assumir que "se parece certo, deve existir" (a principal armadilha da IA)
2. ❌ Inventar parâmetros de função para resolver um erro de tipo sem consultar a doc
3. ❌ Ignorar avisos do compilador/linter sobre símbolos não encontrados
4. ❌ Manter código com dependências órfãs ou fictícias

## Composição com outras skills
- **Antes**: `confidence-estimator` (avaliação de certeza) → `deep-research` (pesquisa de docs)
- **Depois**: `agentic-coding` (execução com build real) → `qa` (testes automatizados)

## References
- Mitigating hallucinations in LLMs: OpenAI / Anthropic research docs · Type safety and static analysis (TypeScript / Pydantic / mypy).
- Veja `references.md` nesta pasta — curadoria de fontes canônicas (2026).
