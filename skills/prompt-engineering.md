# Skill: Prompt Engineering & System Design

**Versão:** 1.0.0  
**Domínio:** AI & Instruction Design  
**Budget de Tokens:** ~2000  

---

## Contexto & Objetivo
Projetar e otimizar prompts de sistema, poucos exemplos (few-shot), cadeias de raciocínio (Chain-of-Thought) e proteções contra injeção de prompt para LLMs.

---

## Estrutura de Prompt de Alta Performance
1. **Identidade e Papel**: Define escopo, limites e perspectiva.
2. **Contexto & Regras Globais**: Diretrizes invioláveis ("Sempre", "Nunca").
3. **Instruções Passo a Passo**: Algoritmo de raciocínio estruturado.
4. **Formato de Saída**: Schemas rígidos (JSON, Markdown demarcado).
5. **Exemplos Demonstrativos**: Few-shot exemplificando casos normais e de borda.

---

## Checklist de Qualidade
- [ ] O prompt é direto e elimina redundâncias desnecessárias (economia de tokens).
- [ ] Regras de "Sempre" e "Nunca" são inequívocas.
- [ ] Delimitadores claros (`<user_input>`, ```json) previnem injeção de instruções.
- [ ] O formato de saída é estritamente especificado.
