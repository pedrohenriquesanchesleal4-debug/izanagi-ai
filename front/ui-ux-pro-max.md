---
name: ui-ux-pro-max
description: "Inteligência e matriz de decisão de UI/UX por prioridade: acessibilidade WCAG, alvos de toque, contraste, tipografia, formulários e prevenção de erros de usabilidade."
triggers:
  - "projetar interface de usuário, landing page ou dashboard"
  - "definir espaçamento, escala tipográfica e paletas de cores"
  - "revisar usabilidade e acessibilidade de uma experiência digital"
  - "auditar consistência de componentes visuais"
stack: [ui-ux, web, mobile, design-systems]
---

# UI/UX Pro Max — Matriz de Inteligência de Design

Esta skill estabelece a hierarquia estrita de decisão de design de produto: quando houver conflito entre estética pura e usabilidade, a ordem de prioridades abaixo é soberana.

---

## 1. Matriz Decisória por Ordem de Prioridade (1 → 10)

| Prio | Categoria | Impacto | Regras Obrigatórias (Must Have) | Anti-Padrões a Evitar |
|---|---|---|---|---|
| **1** | **Acessibilidade** | CRÍTICO | Contraste mín. **4.5:1** (texto normal) e **3:1** (UI/ícones/títulos grandes). Navegação por teclado integral. `alt` em imagens. | Remover `outline` de foco. Ícone clicável sem `aria-label`. |
| **2** | **Touch & Interação** | CRÍTICO | Área de toque mín. **44×44px**. Espaçamento entre alvos ≥ 8px. Feedback de loading visual imediato. | Depender exclusivamente de `:hover` para expor ações críticas. |
| **3** | **Performance Visual** | ALTO | Formatos modernos (WebP/AVIF). Dimensões explícitas em imagens para garantir **CLS < 0.1**. | Layout thrashing. Mudanças repentinas de layout ao carregar imagens. |
| **4** | **Seleção de Estilo** | ALTO | Coerência com o modelo mental do nicho. Ícones SVG profissionais consistentes (lucide, radix, heroicons). | Misturar estilos discordantes (ex: 3D com flat). Emojis como ícones funcionais. |
| **5** | **Layout & Responsivo** | ALTO | Breakpoints mobile-first. Viewport flexível. Zero scroll horizontal indesejado. | Larguras fixas em `px` (`w-[1200px]`). Desabilitar zoom no viewport. |
| **6** | **Tipografia & Cor** | MÉDIO | Tamanho base de leitura ≥ 16px. `line-height` entre 1.4 e 1.6. Hierarquia clara de até 3 níveis de peso. | Texto < 12px. Baixo contraste (cinza escuro sobre cinza preto). |
| **7** | **Motion & Feedback** | MÉDIO | Micro-interações entre **150ms e 300ms**. Easing com desaceleração física. Respeitar `prefers-reduced-motion`. | Animações puramente decorativas lentas (> 500ms). Animar `width/height`. |
| **8** | **Formulários** | MÉDIO | Labels sempre visíveis acima do campo. Mensagens de erro inline próximas ao input. Validação imediata. | Placeholder usado como substituto de label. Erros listados apenas no topo. |
| **9** | **Navegação** | ALTO | Fluxo de "Voltar" previsível. Menus mobile com no máx. 5 itens na barra inferior. Estados ativos claros. | Menus sobrecarregados. Navegação que perde o estado anterior. |
| **10** | **Visualização de Dados** | BAIXO | Legendas explícitas. Tooltips contextuais. Dados com `tabular-nums`. | Depender apenas da cor para diferenciar categorias em gráficos. |

---

## 2. Princípios de Tipografia e Legibilidade

1. **Escala de Leitura Modular**:
   - `Display` (Hero): 48px – 96px (`font-bold tracking-tight leading-none`)
   - `Heading 1`: 32px – 40px (`font-semibold tracking-tight`)
   - `Heading 2`: 24px – 28px (`font-medium`)
   - `Body`: 16px (`leading-relaxed text-zinc-300`)
   - `Small / Metadata`: 13px – 14px (`text-zinc-400 font-normal`)
   - `Micro / Badges`: 11px – 12px (`font-mono uppercase tracking-wider`)
2. **Largura Máxima de Linha de Texto (Measure)**:
   - Para textos longos de leitura (artigos, documentação, descrições), a largura ideal é de **45 a 75 caracteres** (`max-w-prose` ou `max-w-2xl`).
   - Linhas muito largas provocam fadiga visual e perda de foco na quebra de linha.

---

## 3. Estados de Carregamento & Skeleton Screens

Sempre prefira **Skeleton Screens** a spinners genéricos no meio da tela:
- O Skeleton deve ter o formato e a proporção idêntica do conteúdo que será carregado (ex.: avatar redondo, barra de título, duas barras de texto).
- Use uma animação suave de pulso tonal:
```tsx
export function CardSkeleton() {
  return (
    <div className="p-6 rounded-xl bg-zinc-900 border border-zinc-800 animate-pulse space-y-4">
      <div className="w-10 h-10 rounded-full bg-zinc-800" />
      <div className="h-6 w-3/4 rounded bg-zinc-800" />
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-zinc-800/60" />
        <div className="h-4 w-5/6 rounded bg-zinc-800/60" />
      </div>
    </div>
  );
}
```

---

## 4. Micro-Copywriting & Prevenção de Erros

- **Ações Destrutivas**: Sempre exija confirmação de dois passos para deletar dados ou cancele via `undo` temporizado.
- **Labels de Botão Claras**:
  - ❌ Ruim: "OK", "Enviar", "Sim"
  - ✅ Bom: "Criar Projeto", "Salvar Alterações", "Excluir Conta Permanentemente"
- **Empty States Úteis**:
  - Quando uma lista estiver vazia, nunca exiba uma tela branca. Mostre:
    1. Uma ilustração sutil ou ícone contextualmente relevante.
    2. Título explicativo ("Nenhum projeto encontrado").
    3. Descrição com próximo passo ("Crie seu primeiro projeto para começar a monitorar suas APIs").
    4. Botão de ação primário ("+ Novo Projeto").

---

## 5. Checklist de Auditoria UX

- [ ] Contraste de todas as cores de texto atende o padrão WCAG AA (≥ 4.5:1).
- [ ] Nenhum elemento interativo possui área de toque menor que 44×44px no mobile.
- [ ] Todos os formulários possuem labels explícitas e erros inline associados.
- [ ] Estados vazios (Empty States) fornecem ação clara para o usuário avançar.
- [ ] Transições de tela e componentes respeitam a sensibilidade do usuário (`prefers-reduced-motion`).
