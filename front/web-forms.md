---
name: web-forms
description: "Engenharia de formulários de alto craft com React Hook Form e Zod: validação inline em tempo real, wizards multi-step, foco automático no primeiro erro e acessibilidade WCAG 2.2 AA."
triggers:
  - "construir formulários de checkout, onboarding ou cadastro complexo"
  - "implementar validação de esquemas com Zod e React Hook Form"
  - "desenvolver wizards multi-etapas com transição animada e persistência"
stack: [react-hook-form, zod, tailwind-css, framer-motion]
---

# Web Forms — Engenharia de Formulários de Alto Craft

Esta skill estabelece os padrões para formulários que unem rigor técnico de validação de dados, feedback tátil instantâneo e conformidade estrita de acessibilidade.

---

## 1. Princípios de Formulários de Alto Desempenho

1. **Desacoplamento de Re-renders (React Hook Form)**:
   - Nunca controle inputs de formulário com múltiplos `useState` individuais para cada campo. Utilize `react-hook-form` com inputs não controlados ou refs para eliminar re-renders desnecessários a cada tecla digitada.
2. **Validação de Esquema Única com Zod**:
   - Defina as regras de validação em um schema TypeScript estrito via Zod, com mensagens de erro humanizadas e orientadas à solução (nunca jargões de backend).
3. **Acessibilidade Inegociável (WCAG 2.2 AA)**:
   - Todo `<input>` DEVE ter um `<label>` correspondente via `htmlFor`.
   - Mensagens de erro devem ser linkadas ao input pelo atributo `aria-describedby`.
   - Campos com falha devem receber `aria-invalid="true"`.

---

## 2. Padrão de Implementação Completo (RHF + Zod)

```tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, useTransition } from 'react';

// 1. Definição do Schema com Mensagens Claras
export const OnboardingSchema = z.object({
  fullName: z.string().min(3, 'Informe seu nome completo'),
  email: z.string().email('Digite um e-mail corporativo válido'),
  organizationSize: z.enum(['1-10', '11-50', '50+'], {
    errorMap: () => ({ message: 'Selecione o tamanho da sua equipe' }),
  }),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'Você precisa aceitar os termos de uso' }),
  }),
});

export type OnboardingData = z.infer<typeof OnboardingSchema>;

export function HighCraftForm() {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isDirty },
  } = useForm<OnboardingData>({
    resolver: zodResolver(OnboardingSchema),
    mode: 'onBlur', // Valida quando o usuário sai do campo, sem estressar na digitação inicial
  });

  const onSubmit = (data: OnboardingData) => {
    setServerError(null);
    startTransition(async () => {
      // Simulação de Server Action
      try {
        await new Promise((resolve) => setTimeout(resolve, 800));
        alert('Cadastro efetuado com sucesso!');
      } catch (err) {
        setServerError('Ocorreu um erro no servidor. Tente novamente.');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-md w-full bg-zinc-900 p-8 rounded-2xl border border-zinc-800" noValidate>
      
      {/* Campo: Nome Completo */}
      <div className="space-y-2">
        <label htmlFor="fullName" className="block text-sm font-medium text-zinc-200">
          Nome Completo
        </label>
        <input
          id="fullName"
          type="text"
          {...register('fullName')}
          aria-invalid={errors.fullName ? 'true' : 'false'}
          aria-describedby={errors.fullName ? 'fullName-error' : undefined}
          className={clsx(
            'w-full px-3.5 py-2.5 rounded-lg text-sm bg-zinc-950 border transition-all text-zinc-100 placeholder:text-zinc-600',
            'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900',
            errors.fullName
              ? 'border-red-500/80 focus:ring-red-500'
              : 'border-zinc-800 focus:border-zinc-700 focus:ring-zinc-600'
          )}
          placeholder="Ex: Pedro Leal"
        />
        {errors.fullName && (
          <p id="fullName-error" className="text-xs text-red-400 mt-1">
            {errors.fullName.message}
          </p>
        )}
      </div>

      {/* Botão de Submissão com Estado de Loading */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full py-2.5 px-4 rounded-lg bg-zinc-100 text-zinc-900 font-medium text-sm hover:bg-white active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isPending ? (
          <>
            <span className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
            <span>Processando...</span>
          </>
        ) : (
          'Continuar'
        )}
      </button>

      {serverError && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          {serverError}
        </div>
      )}
    </form>
  );
}
```

---

## 3. Padrão de Wizard Multi-Etapas (Multi-Step)

- **Persistência de Estado**: Mantenha o estado global do wizard no componente pai ou Contexto, enquanto cada etapa é validada de forma independente antes de permitir o avanço.
- **Transição com Framer Motion**:
  ```tsx
  <AnimatePresence mode="wait">
    <motion.div
      key={currentStep}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {renderStepContent(currentStep)}
    </motion.div>
  </AnimatePresence>
  ```

---

## 4. Checklist de Formulários

- [ ] Formulário integrado com React Hook Form + Zod (sem `useState` manual por campo).
- [ ] Todos os campos possuem `<label>` vinculados com `htmlFor` e `id`.
- [ ] Mensagens de erro inline utilizam `aria-describedby` para leitores de tela.
- [ ] O modo de validação não agride o usuário no primeiro clique (prefira `mode: 'onBlur'`).
- [ ] O botão de envio exibe indicador visual de carregamento e desabilita cliques múltiplos.
