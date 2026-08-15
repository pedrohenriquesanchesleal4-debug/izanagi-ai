---
name: hallucination-detection
description: "Detecta alucinações técnicas em código gerado — APIs inexistentes, imports inventados, versões descasadas — cruzando com o repositório real. Use ao revisar código gerado por IA ou depurar erros misteriosos."
---

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

> Gerado pelo Izanagi AI — cópia fiel de `skills/hallucination-detection/SKILL.md` (fonte da verdade).
