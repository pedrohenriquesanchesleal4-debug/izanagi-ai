---
name: "web-forms"
description: "Formulários de alto craft com Zod + React Hook Form: validação inline, wizards multi-step, auto-save e acessibilidade WCAG. Use ao construir checkouts, onboarding ou formulários complexos. Gatilhos de ativação: web forms & high-craft form engineering; quando usar; stack recomendada; arquitetura de um formulário de alta performance."
version: 2.0.0
category: design
tools:
  mcp:
    - mcp:fs_read
    - mcp:fs_write
---

# Web Forms & High-Craft Form Engineering

> Migrado deterministicamente de `skills/web-forms/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Design & UI (`design`)
- **Resumo:** Formulários de alto craft com Zod + React Hook Form: validação inline, wizards multi-step, auto-save e acessibilidade WCAG.
- **Ativar quando:** Use ao construir checkouts, onboarding ou formulários complexos.
- **Escopo canônico:** Web Forms & High-Craft Form Engineering
- **Seções do corpo original:** Quando usar · Stack Recomendada · Arquitetura de um Formulário de Alta Performance · Padrões Avançados de Form Design · Checklist de Qualidade (Quality Gates)
- **Ferramentas MCP esperadas:** mcp:fs_read, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — ❌ Validar apenas no backend sem feedback imediato no frontend

❌ Validar apenas no backend sem feedback imediato no frontend

### Passo 2 — ❌ Botão de submit sem estado de loading (permite cliques duplos e duplicidade de envios)

❌ Botão de submit sem estado de loading (permite cliques duplos e duplicidade de envios)

### Passo 3 — ❌ Mensagens de erro genéricas ("Campo inválido") sem explicar o que está errado

❌ Mensagens de erro genéricas ("Campo inválido") sem explicar o que está errado

### Passo 4 — ❌ Perda de dados digitados ao recarregar a página (sem auto-save ou persistência de state)

❌ Perda de dados digitados ao recarregar a página (sem auto-save ou persistência de state)

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] Schema Zod estrito cobrindo todos os tipos e formatos
- [ ] Validação disparada em `onBlur` ou `onChange` com feedback imediato
- [ ] Indicador de loading claro durante o submit (spinner + botão desabilitado)
- [ ] Mensagens de erro amigáveis, sem códigos de erro técnicos
- [ ] Suporte a navegação completa por teclado (Tab, Enter)
- [ ] Atributos ARIA (`aria-invalid`, `aria-describedby`, `role="alert"`) presentes

## Common Rationalizations

- **"Design system a gente monta depois do launch."**
  - Verdade: Sem tokens decididos antes, cada componente nasce com escala própria e o 'depois' vira reescrita total. Direção de design primeiro é HARD-GATE do framework, não preferência.
- **"Inter serve, é neutra."**
  - Verdade: Inter default é o tell nº 1 de 'cara de IA'. Tipografia é decisão de identidade; neutra aqui significa sem intenção — e sem intenção é proibido.
- **"Responsivo eu ajusto no final, primeiro o desktop."**
  - Verdade: Layout pensado só em desktop quebra estruturalmente no mobile: grid, hierarquia e touch targets não se 'ajustam', se redesenham. Mobile-first é mais barato desde a primeira linha.
- **"Acessibilidade a gente adiciona quando tiver demanda."**
  - Verdade: Contraste, foco visível e ARIA são requisitos WCAG, não feature request. Retrofitar acessibilidade custa ordens de magnitude mais que nascer com ela.
- **"O cliente pediu hero com 3 cards, é isso que ele conhece."**
  - Verdade: O cliente pediu resultado, não template estatístico. Cabe ao craft traduzir o pedido em composição com identidade — hero+3cards+gradiente roxo é anti-padrão explícito do framework.
- **"Animação entra no fim, se sobrar tempo."**
  - Verdade: Motion signature decide-se no design, não decorase no deploy. Animação adicionada tarde é ornamento; planejada cedo é comunicação de hierarquia e estado.

## Red Flags

- Hero centralizado + fileira de 3 cards idênticos (composição estatística de IA).
- Gradiente roxo-azul como identidade visual principal.
- border-radius uniforme em todos os elementos, sem hierarquia formal.
- Contraste abaixo de WCAG AA em texto primário.
- Sem estados hover/focus/loading/error definidos nos componentes interativos.
- Tipografia default sem escolha declarada (peso, escala, par de fontes).
- Motion decorativo aleatório em vez de 1–2 momentos-chave com assinatura.

## Legacy Reference (v1)

# Web Forms & High-Craft Form Engineering

Desenvolvimento de formulários web que unem **rigor técnico de validação (Zod + RHF)**, **experiência de usuário Awwwards-grade** (feedback instantâneo, micro-interações, wizards multi-step) e **acessibilidade total (WCAG 2.2 AA)**.

## Quando usar

Use ao: construir formulários de onboarding, checkouts de e-commerce, fluxos de pagamento, painéis de configuração complexos ou qualquer interface onde a entrada de dados seja o núcleo da experiência. **Pule** para: simples inputs estáticos sem validação (skill `frontend`).

## Stack Recomendada

- **`react-hook-form`** (gerenciamento de estado de formulário sem re-renders desnecessários em cada tecla).
- **`zod`** (validação de schema estrita com inferência de tipos TypeScript).
- **Tailwind CSS + Radix UI Primitives** (componentes acessíveis sem estilização engessada).
- **Framer Motion / GSAP** (micro-interações de erro com `shake`, transições de step no wizard).

## Arquitetura de um Formulário de Alta Performance

### 1. Schema Definition (Zod)
Validação centralizada com mensagens de erro claras e orientadas ao usuário (nunca jargões técnicos).

```typescript
import { z } from 'zod';

export const CheckoutSchema = z.object({
  fullName: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  email: z.string().email("E-mail corporativo inválido"),
  taxId: z.string().regex(/^\d{11}$/, "CPF/CNPJ inválido (11 dígitos numéricos)"),
  plan: z.enum(["starter", "pro", "enterprise"], {
    required_error: "Selecione um plano",
  }),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "Você deve aceitar os termos de serviço" }),
  }),
});

export type CheckoutFormData = z.infer<typeof CheckoutSchema>;
```

### 2. Hook Form + Zod Resolver + Feedback Inline Instantâneo
```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckoutSchema, CheckoutFormData } from "./schema";

export function HighCraftForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<CheckoutFormData>({
    resolver: zodResolver(CheckoutSchema),
    mode: "onBlur", // Validação imediata ao sair do campo
  });

  const onSubmit = async (data: CheckoutFormData) => {
    // Simulação de chamada API com Optimistic UI / Loading State
    await new Promise((resolve) => setTimeout(resolve, 1500));
    console.log("Dados validados e enviados:", data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-md mx-auto p-8 rounded-2xl bg-zinc-950 border border-zinc-800/80 shadow-2xl">
      <div>
        <label htmlFor="fullName" className="block text-sm font-medium text-zinc-300 mb-2">
          Nome Completo
        </label>
        <input
          id="fullName"
          {...register("fullName")}
          aria-invalid={errors.fullName ? "true" : "false"}
          aria-describedby="fullName-error"
          className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all"
          placeholder="Ex: Ana Souza"
        />
        {errors.fullName && (
          <p id="fullName-error" role="alert" className="mt-2 text-xs text-rose-400 font-medium">
            {errors.fullName.message}
          </p>
        )}
      </div>

      {/* Outros campos... */}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-medium hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span>Processando...</span>
          </>
        ) : (
          <span>Concluir Cadastro</span>
        )}
      </button>
    </form>
  );
}
```

## Padrões Avançados de Form Design

### 1. Multi-Step Wizards com State Machine Local
Para formulários longos, divida em etapas lógicas com barra de progresso e validação isolada por step (`trigger(["field1", "field2"])` do RHF).

### 2. Auto-Save Draft (LocalStorage)
Persista rascunhos automaticamente a cada alteração em `watch()`, evitando perda de dados se o usuário fechar a aba acidentalmente.

### 3. Acessibilidade Aumentada (WCAG 2.2)
- Associações explícitas de `<label>` e `id`.
- Uso de `aria-invalid` e `role="alert"` para mensagens de erro dinâmicas.
- Foco automático no primeiro campo com erro após um submit inválido.

## Checklist de Qualidade (Quality Gates)
- [ ] Schema Zod estrito cobrindo todos os tipos e formatos
- [ ] Validação disparada em `onBlur` ou `onChange` com feedback imediato
- [ ] Indicador de loading claro durante o submit (spinner + botão desabilitado)
- [ ] Mensagens de erro amigáveis, sem códigos de erro técnicos
- [ ] Suporte a navegação completa por teclado (Tab, Enter)
- [ ] Atributos ARIA (`aria-invalid`, `aria-describedby`, `role="alert"`) presentes

## Anti-Padrões (Proibido)
1. ❌ Validar apenas no backend sem feedback imediato no frontend
2. ❌ Botão de submit sem estado de loading (permite cliques duplos e duplicidade de envios)
3. ❌ Mensagens de erro genéricas ("Campo inválido") sem explicar o que está errado
4. ❌ Perda de dados digitados ao recarregar a página (sem auto-save ou persistência de state)

## Composição com outras skills
- **Antes**: `design-directions` (estética) → `requirement-analyzer` (campos necessários)
- **Depois**: `accessibility-reviewer` (auditoria a11y) → `qa` (testes E2E de formulários com Playwright)

## References
- React Hook Form: https://react-hook-form.com · Zod: https://zod.dev · WAI-ARIA Form Tutorial: https://www.w3.org/WAI/tutorials/forms/
- Veja `references.md` nesta pasta — curadoria de fontes canônicas (2026).
