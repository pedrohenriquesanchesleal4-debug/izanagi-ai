---
name: accessibility-wcag
description: "Auditoria e implementação rigorosa de acessibilidade digital de acordo com as normas WCAG 2.2 Níveis AA e AAA: contraste de cores, navegação integral por teclado, anéis de foco e ARIA semântico."
triggers:
  - "auditar acessibilidade de componentes, páginas ou fluxos"
  - "implementar foco visível, navegação por teclado e suporte a leitores de tela"
  - "garantir conformidade com WCAG 2.2 AA para lançamentos de produção"
stack: [wcag-2.2, a11y, aria, screen-readers, axe-core]
---

# Accessibility (WCAG 2.2 AA) — Guia de Engenharia Inclusiva

Esta skill estabelece os requisitos inegociáveis de acessibilidade para garantir que qualquer usuário, independentemente de limitações visuais, motoras, cognitivas ou auditivas, consiga operar a interface com independência.

---

## 1. Os 4 Princípios Fundamentais (POUR)

### 1.1 Perceptível (Perceptible)
- **Contraste de Cores Mínimo**:
  - Texto Normal (< 18pt / 24px): **Relação de contraste mínima de 4.5:1** contra o fundo.
  - Texto Grande (≥ 18pt ou bold ≥ 14pt): **Relação mínima de 3:1**.
  - Componentes de UI e Ícones Ativos: **Mínimo de 3:1** contra o fundo adjacente.
- **Alternativas Textuais em Imagens**:
  - Imagem informativa: `alt="Gráfico de crescimento de faturamento exibindo alta de 15% em outubro"`.
  - Imagem puramente decorativa: `alt=""` ou `aria-hidden="true"` (nunca omita o atributo `alt`, caso contrário o leitor soletra o nome do arquivo).
- **Hierarquia de Títulos Sem Pular Níveis**:
  - Toda página possui exatamente um `<h1>`. Os subtítulos devem descer em ordem estrita (`h1 -> h2 -> h3`), nunca pulando de `h1` diretamente para `h4` apenas por conveniência visual.

### 1.2 Operável (Operable)
- **Navegação Integral por Teclado**:
  - 100% das ações utilizáveis por mouse devem ser acionáveis por `Tab`, `Shift+Tab`, `Enter`, `Space` e setas direcionais.
  - **Zero Armadilhas de Foco (*Keyboard Traps*)**: O usuário nunca deve ficar preso dentro de um modal ou dropdown sem conseguir sair via teclado (tecla `Escape`).
- **Anel de Foco Visível Obrigatório**:
  - NUNCA use `outline: none` sem substituir por uma classe de foco visível.
  - Padrão recomendado:
    ```tsx
    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
    ```
- **Área de Toque Mínima**:
  - Alvos interativos devem ter no mínimo **44×44px** de área de clique.

### 1.3 Compreensível (Understandable)
- **Idioma Raiz Definido**:
  - O elemento raiz do HTML deve declarar o idioma correto: `<html lang="pt-BR">`.
- **Rótulos Explícitos de Formulários**:
  - Todo input deve ter `<label htmlFor="id-campo">` ou, em casos excepcionais de botão de busca compacto, `aria-label="Buscar documentos"`.
- **Anúncio de Erros e Mensagens Vivas**:
  - Notificações toast e mensagens de validação dinâmica devem usar `aria-live="polite"` para que o leitor de tela anuncie a mudança sem interromper a fala do usuário.

### 1.4 Robusto (Robust)
- **HTML Semântico Nativo Antes de ARIA**:
  - Prefira `<button>` a `<div onClick={...}>`. Botões nativos já incluem manipulação de teclado (`Enter`/`Space`) e semântica de leitor de tela gratuitamente.
  - Use landmarks semânticos: `<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`.

---

## 2. Padrão de Modal Acessível com Focus Trap

Ao abrir um modal, o foco do teclado deve ser capturado e restaurado ao fechar:

```tsx
'use client';

import { useEffect, useRef } from 'react';

export function AccessibleModal({ isOpen, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Fecha ao pressionar Escape
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <h2 id="modal-title" className="text-lg font-semibold text-zinc-100">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Fechar janela"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            ✕
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
```

---

## 3. Checklist de Auditoria WCAG 2.2 AA

- [ ] Contraste de cor verificado em textos e controles (≥ 4.5:1 para texto normal).
- [ ] Todas as funcionalidades são acessíveis via teclado (`Tab`, `Shift+Tab`, `Enter`).
- [ ] Indicadores de foco (`focus-visible:ring-2`) estão nítidos e não foram removidos com `outline-none`.
- [ ] Imagens informativas possuem `alt` descritivo; imagens decorativas usam `alt=""`.
- [ ] Modais fecham com `Escape` e contêm o foco de teclado enquanto estiverem abertos.
- [ ] O documento HTML possui o atributo `lang` configurado adequadamente.
