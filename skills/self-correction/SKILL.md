---
name: self-correction
description: "Identifica falhas e desvios no próprio raciocínio ou código durante a execução, aplica a correção imediata sem re-percorrer todo o fluxo anterior e registra o aprendizado para evitar repetição. Use ao notar comportamento inesperado, erro de compilação ou feedback negativo de testes."
---

# Self-Correction (Auto-Correção em Tempo de Execução)

Mecanismo para detectar desvios, erros ou falhas de execução no próprio trabalho, isolar o delta incorreto, aplicar a correção cirúrgica e **registrar o aprendizado na memória persistente** para não repetir o erro.

## Quando usar

Use ao: receber erro de build/teste após uma alteração; notar que a solução inicial violou uma regra do projeto (ex: padrão anti-AI-slop ou regra de arquitetura); identificar que um edge case foi esquecido. **Pule** para: depuração sistemática de bugs complexos em código legado (skill `systematic-debugging` / `bug-hunter`).

## Workflow de Auto-Correção (4 passos)

### 1. Detecção precoce do desalinhamento
Assim que o comando falhar ou o teste retornar erro,pare imediatamente a expansão do código. Não adicione mais features.

### 2. Isolamento do delta (causa imediata)
Compare o que foi alterado (`git diff`) com o comportamento esperado. Identifique exatamente qual linha ou premissa falhou.

### 3. Correção cirúrgica
Altere apenas o necessário para sanar o erro. Evite refatorações paralelas não solicitadas.

### 4. Registro na memória persistente (Aprendizado Anti-Repetição)
Se o erro foi conceitual ou de padrão, registre o aprendizado em `.agents/memoria/erros-corrigidos.md` ou `learnings.md` para que a próxima sessão não tropece no mesmo obstáculo.

## Exemplo de Registro de Erro Corrigido (`.agents/memoria/erros-corrigidos.md`)

```markdown
- **Erro**: Uso de `import ... from 'next/router'` em componente Server Client (App Router).
- **Causa**: Confusão entre Pages Router e App Router (Next.js 14+).
- **Correção**: Substituir por `import { useRouter } from 'next/navigation'`.
- **Prevenção**: Sempre verificar se o componente possui diretiva `'use client'` ou se está em Server Component antes de importar hooks de roteamento.
```

## Checklist de qualidade (antes de entregar)
- [ ] Erro detectado e isolado sem desviar para refatorações tangenciais
- [ ] Correção aplicada com menor diff possível
- [ ] Verificação empírica executada (build/teste passou)
- [ ] Aprendizado registrado na memória do projeto (se aplicável)

## Anti-padrões (proibido)
1. ❌ Ignorar o erro e tentar seguir com código empilhado em cima da falha
2. ❌ Reescrever o arquivo inteiro quando apenas uma linha estava incorreta
3. ❌ Culpar o compilador ou a ferramenta sem analisar o próprio código
4. ❌ Não registrar o erro, permitindo que ocorra novamente na próxima iteração

## Composição com outras skills
- **Antes**: `agentic-coding` (loop de execução) → `systematic-debugging` (análise de causa raiz)
- **Depois**: `continuous-improvement` (evolução contínua) → `memoria-projeto` (atualização da memória)

## References
- Self-correction in autonomous agents: Anthropic / OpenAI engineering notes · Error recovery patterns.
- Veja `references.md` nesta pasta — curadoria de fontes canônicas (2026).
