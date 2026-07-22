---
name: qa
description: |
  Skill de Quality Assurance para o Portal. Contém checklist completo de qualidade
  de código, validações de acessibilidade, performance, segurança e responsividade.
  Use esta skill para auditar código existente ou validar alterações antes de merge/deploy.
---

# Skill QA — Portal

## ✅ Checklist de Qualidade de Código

### 1. TypeScript Strict

- [ ] **Zero `any`** — todos os tipos explícitos
- [ ] **Zero `as unknown as`** — indica problema de design, refatorar
- [ ] **Props tipadas** — toda interface de componente com `interface NomeProps`
- [ ] **Retorno tipado** — funções com retorno explícito quando não óbvio
- [ ] **Null safety** — uso correto de optional chaining (`?.`) e nullish coalescing (`??`)
- [ ] **Enums ou union types** — para valores fixos (status, tipos)

```tsx
// ✅ Correto
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
}

const status: "draft" | "published" | "archived" = "draft";

// ❌ Problemático
const data: any = response.data;
const result = something as unknown as SomeType;
```

### 2. Componentes React

- [ ] **Single Responsibility** — componente faz uma coisa só
- [ ] **Props mínimas** — sem "god components" com 15+ props
- [ ] **Sem lógica inline pesada** — extrair para hooks ou funções
- [ ] **Keys únicas** — em listas, usar IDs do banco, nunca index
- [ ] **Cleanup de efeitos** — `useEffect` com cleanup quando necessário
- [ ] **Sem estado desnecessário** — derivar valores quando possível

```tsx
// ✅ Derivar em vez de estado separado
const displayedCpf = formatCPF(cpfValue ?? "");

// ❌ Estado redundante
const [displayedCpf, setDisplayedCpf] = useState("");
useEffect(() => setDisplayedCpf(formatCPF(cpfValue)), [cpfValue]);
```

### 3. Hooks Rules

- [ ] Hooks no topo do componente (antes de qualquer condicional)
- [ ] Sem hooks dentro de loops ou condicionais
- [ ] Custom hooks com prefixo `use`
- [ ] Dependencies array do `useEffect` completo e correto

### 4. Performance

- [ ] **Sem re-renders desnecessários** — `React.memo` quando componente recebe props estáveis
- [ ] **Callbacks memoizados** — `useCallback` para funções passadas como props
- [ ] **Valores memoizados** — `useMemo` para cálculos pesados
- [ ] **Lazy loading** — imagens com `OptimizedImage` ou `loading="lazy"`
- [ ] **Code splitting** — `dynamic()` para componentes pesados (ex: editor TipTap)
- [ ] **Sem fetches em loop** — batching de queries quando possível

---

## ♿ Checklist de Acessibilidade (a11y)

### Imagens e Mídia
- [ ] Toda `<img>` tem `alt` descritivo
- [ ] Imagens decorativas têm `alt=""`
- [ ] Vídeos embeds têm `title` no iframe

### Formulários
- [ ] Todo input tem `<label>` associado (via `htmlFor`/`id`)
- [ ] Campos obrigatórios marcados com `required` e indicador visual
- [ ] Mensagens de erro acessíveis (associadas ao campo)
- [ ] `inputMode` correto para campos numéricos
- [ ] `placeholder` não substitui `label`

### Navegação
- [ ] Links têm texto descritivo (nunca "clique aqui")
- [ ] `aria-label` em botões de ícone sem texto
- [ ] `target="_blank"` acompanhado de `rel="noopener noreferrer"`
- [ ] Contraste de cor adequado (4.5:1 para texto normal)

### Interatividade
- [ ] Elementos clicáveis são `<button>` ou `<a>`, nunca `<div onClick>`
- [ ] Modais com `Escape` para fechar
- [ ] Focus trap em modais abertos
- [ ] Skip links para navegação por teclado

---

## 📱 Checklist de Responsividade

### Layout
- [ ] **Mobile-first** — classes base para mobile, breakpoints para desktop
- [ ] Grid responsivo: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- [ ] Containers com `px-4` (mobile) e `container mx-auto` (desktop)
- [ ] Sem overflow horizontal (`overflow-x: hidden` no body)

### Textos
- [ ] Fontes legíveis em mobile (mínimo `text-sm` = 14px)
- [ ] Títulos escalam: `text-xl md:text-2xl lg:text-3xl`
- [ ] Truncamento de texto longo com `truncate` ou `line-clamp`

### Imagens
- [ ] Imagens responsivas com `w-full` e `max-w-*`
- [ ] Aspect ratio mantido (`object-cover`, `object-contain`)
- [ ] Imagens de banner com `min-height` responsivo

### Formulários
- [ ] Inputs com `w-full` em mobile
- [ ] Grids de formulário colapsam em mobile: `grid-cols-1 md:grid-cols-2`
- [ ] Botões com `w-full` em mobile, tamanho fixo em desktop

---

## 🎨 Checklist de Design System

### Tokens Tailwind
- [ ] Usar cores customizadas (`brand-blue`, `brand-dark-blue`) — **nunca hardcodar**
- [ ] Usar gradientes do tema (`bg-brand-gradient`) quando disponíveis
- [ ] Usar sombras customizadas (`shadow-modal-card`) para modais
- [ ] Usar animações do tema (`animate-modal-in`) para transições

### Consistência Visual
- [ ] Estrutura de página: `Header → PageHeader → section → Footer`
- [ ] Cards com `bg-white rounded-lg shadow-lg p-6/p-8`
- [ ] Inputs com `border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue`
- [ ] Botões com `transition-colors duration-300`
- [ ] Espaçamento consistente: `gap-4`, `gap-8`, `space-y-4`, `space-y-6`

### Cores Proibidas (Hardcoded)
```tsx
// ❌ NUNCA usar quando existe token
className="bg-[#1e40af]"     // → usar bg-brand-blue
className="bg-[#3b82f6]"     // → usar bg-brand-light-blue
className="bg-[#1e3a8a]"     // → usar bg-brand-dark-blue
className="bg-[#059669]"     // → usar bg-brand-green
style={{ color: '#1e40af' }} // → usar className="text-brand-blue"
```

---

## 🔒 Checklist de Segurança

### Dados do Usuário
- [ ] CPF, e-mail e dados sensíveis **nunca** expostos em URLs
- [ ] Formulários com validação server-side (não só client-side)
- [ ] `maxLength` em inputs para prevenir overflow

### APIs
- [ ] API Routes validam input antes de processar
- [ ] Secrets nunca expostos no client-side (sem `NEXT_PUBLIC_` para secrets)
- [ ] Respostas de erro genéricas (sem expor stack traces)
- [ ] Rate limiting em endpoints críticos

### Supabase
- [ ] RLS (Row Level Security) ativo em todas as tabelas
- [ ] Queries client-side usam `anon key` (nunca `service_role`)
- [ ] Upload com validação de tipo e tamanho

### XSS/Injection
- [ ] `dangerouslySetInnerHTML` — usar com extrema cautela, sanitizar antes
- [ ] Inputs sanitizados antes de persistir no banco
- [ ] URLs de redirect validadas (sem open redirect)

---

## 🔍 Checklist de SEO

- [ ] `<title>` único e descritivo por página
- [ ] `<meta name="description">` presente
- [ ] Heading hierarchy correta: um `<h1>` por página
- [ ] Imagens com `alt` text descritivo
- [ ] URLs amigáveis (slugs legíveis)
- [ ] Links internos com `<Link>` do Next.js (não `<a>`)
- [ ] Conteúdo principal acessível sem JavaScript (SSG/SSR)

---

## 🧪 Processo de Revisão

### Antes de Submeter Código

1. **Executar lint**: `npm run lint` — zero warnings
2. **Verificar build**: `npm run build` — sem erros
3. **Testar mobile**: Redimensionar browser para 375px de largura
4. **Testar navegação**: Verificar todas as rotas afetadas
5. **Testar estados**: Loading, erro, vazio, sucesso

### Template de Code Review

```markdown
## Revisão de Qualidade

### ✅ Aprovado / ❌ Reprovado

**TypeScript**:
- [ ] Sem `any`
- [ ] Props tipadas
- [ ] Null safety

**UI/UX**:
- [ ] Tokens do design system usados
- [ ] Responsivo (mobile/tablet/desktop)
- [ ] Estados de loading/erro tratados

**Acessibilidade**:
- [ ] Labels em inputs
- [ ] Alt text em imagens
- [ ] Contraste adequado

**Performance**:
- [ ] Sem re-renders desnecessários
- [ ] Imagens otimizadas
- [ ] Build sem warnings

**Segurança**:
- [ ] Validação de inputs
- [ ] Sem dados sensíveis expostos
- [ ] RLS respeitado
```
