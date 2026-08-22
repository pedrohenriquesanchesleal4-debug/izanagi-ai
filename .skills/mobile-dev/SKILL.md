---
name: "mobile-dev"
description: "Padrões de desenvolvimento mobile com React Native/Expo, Flutter e PWA, incluindo diretrizes de design iOS/Material. Use ao desenvolver ou revisar aplicações mobile. Gatilhos de ativação: skill mobile development — izanagi; react native + expo (preferido); flutter; pwa (progressive web app)."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
---

# Skill Mobile Development — Izanagi

> Migrado deterministicamente de `skills/mobile-dev/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Padrões de desenvolvimento mobile com React Native/Expo, Flutter e PWA, incluindo diretrizes de design iOS/Material.
- **Ativar quando:** Use ao desenvolver ou revisar aplicações mobile.
- **Escopo canônico:** Skill Mobile Development — Izanagi
- **Seções do corpo original:** React Native + Expo (Preferido) · Flutter · PWA (Progressive Web App) · Design Patterns Mobile · References
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: sections-as-steps -->

### Passo 1 — Aplicar: Stack Recomendada

| Camada | Tecnologia |
|--------|------------|
| Framework | Expo SDK 50+ |
| Navegacao | Expo Router (file-based) |
| Estado | Zustand / TanStack Query |
| Forms | React Hook Form + Zod |
| UI | NativeWind (Tailwind para RN) |
| Storage | expo-secure-store (sensiveis), AsyncStorage (dados leves) |
| HTTP | Axios / TanStack Query |
| Auth | Supabase Auth (deep links) |

### Passo 2 — Aplicar: Expo Router (File-based)

```tsx
app/
├── (tabs)/
│   ├── _layout.tsx        // Tab navigator
│   ├── index.tsx          // Home tab
│   ├── beneficios.tsx     // Beneficios tab
│   └── perfil.tsx         // Perfil tab
├── (auth)/
│   ├── _layout.tsx
│   ├── login.tsx
│   └── register.tsx
├── _layout.tsx            // Root layout
└── noticias/[slug].tsx    // Dynamic route
```

---

### Passo 3 — Aplicar: Stack Recomendada

| Camada | Tecnologia |
|--------|------------|
| Framework | Flutter 3.x |
| Estado | Riverpod / BLoC |
| Routing | GoRouter |
| HTTP | Dio |
| Local DB | Isar / Drift (SQLite) |

---

### Passo 4 — Aplicar: Requisitos

- `manifest.json` com icons, theme color, display standalone
- Service Worker com cache strategies (Cache First para assets, Network First para API)
- HTTPS obrigatório
- Push notifications (Web Push API)

### Passo 5 — Aplicar: Quando PWA vs Nativo

| Cenário | PWA | React Native | Flutter |
|---------|-----|-------------|---------|
| Simples informativo | ✅ | ❌ | ❌ |
| Precisa de camera/BLE/NFC | ❌ | ✅ | ✅ |
| Performance critica | ❌ | ✅ | ✅ |
| Offline first | ✅ | ✅ | ✅ |
| Push notifications | ✅ | ✅ | ✅ |

---

### Passo 6 — Aplicar: Design Patterns Mobile

- **Mobile-first**: telas projetadas para mobile, adaptadas para tablet
- **Touch targets**: minimo 44x44dp para elementos tocaveis
- **Loading states**: Skeleton screens (evitar spinners)
- **Pull-to-refresh**: em todas as listas
- **Infinite scroll**: paginacao com FlatList (RN) ou ListView (Flutter)
- **Error states**: tela de erro com botao "Tentar novamente"

### Passo 7 — Aplicar: References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.

## Verification Steps

<!-- fonte da verificação: fallback-honesto:engineering -->

- Executar a skill conforme o escopo de Triggering Criteria no caso real (não hipotético).
- Percorrer cada passo do Step-by-Step Workflow e confirmar evidência verificável de conclusão (não apenas ausência de erro).
- Confirmar que nenhum Red Flag listado está presente no artefato produzido.
- Registrar resultado (sucesso/falha + motivo) antes de considerar a skill cumprida.

## Common Rationalizations

- **"É só um protótipo, refatoro depois."**
  - Verdade: Protótipo sem testes vira produção por acidente. O 'depois' não existe: quem paga a dívida é o próximo commit. Regra do framework: código esparso ou stub (`TODO`, `implement later`) é entrega proibida.
- **"Compila (ou rodou uma vez), então funciona."**
  - Verdade: Compilar valida sintaxe, não comportamento. Anti-falhas é lei: Executar → Esperar → Verificar resultado esperado → Registrar. Sem verificação, sucesso é suposição.
- **"Caso extremo nunca vai acontecer."**
  - Verdade: Vazio, duplicado, timeout e dado inválido acontecem no primeiro lote real. Validação antes de ação irreversível não é opcional — é pré-condição de execução.
- **"Abstraio agora que depois fica fácil trocar."**
  - Verdade: Abstração especulativa é complexidade desnecessária com custo imediato e benefício imaginário. Simples que resolve > flexível que ninguém entende.
- **"Copiei de um projeto que funcionava, deve servir."**
  - Verdade: Contexto diferente invalida solução copiada. Pesquisa é referência técnica, nunca cópia cega — adaptar exige entender o porquê de cada linha.
- **"Sem tempo para tratar erro, lanço exceção genérica."**
  - Verdade: `except: pass` e erro engolido são proibidos. Falha silenciosa transforma bug de 5 minutos em incidente de 5 horas. Registrar motivo é mais barato que depurar às cegas.

## Red Flags

- Arquivo único gigante misturando I/O, regra de negócio e apresentação.
- Bloco catch vazio, `except: pass` ou erro logado sem motivo/actionável.
- Stub, `TODO` ou função que retorna valor fixo em caminho de produção.
- Credencial, token ou path sensível hardcoded no fonte.
- Sucesso assumido sem verificar o resultado esperado da operação.
- Reexecução unsafe: roda duas vezes e duplica efeito (sem idempotência/checkpoint).

## Legacy Reference (v1)

# Skill Mobile Development — Izanagi

## React Native + Expo (Preferido)

### Stack Recomendada
| Camada | Tecnologia |
|--------|------------|
| Framework | Expo SDK 50+ |
| Navegacao | Expo Router (file-based) |
| Estado | Zustand / TanStack Query |
| Forms | React Hook Form + Zod |
| UI | NativeWind (Tailwind para RN) |
| Storage | expo-secure-store (sensiveis), AsyncStorage (dados leves) |
| HTTP | Axios / TanStack Query |
| Auth | Supabase Auth (deep links) |

### Expo Router (File-based)
```tsx
app/
├── (tabs)/
│   ├── _layout.tsx        // Tab navigator
│   ├── index.tsx          // Home tab
│   ├── beneficios.tsx     // Beneficios tab
│   └── perfil.tsx         // Perfil tab
├── (auth)/
│   ├── _layout.tsx
│   ├── login.tsx
│   └── register.tsx
├── _layout.tsx            // Root layout
└── noticias/[slug].tsx    // Dynamic route
```

---

## Flutter

### Stack Recomendada
| Camada | Tecnologia |
|--------|------------|
| Framework | Flutter 3.x |
| Estado | Riverpod / BLoC |
| Routing | GoRouter |
| HTTP | Dio |
| Local DB | Isar / Drift (SQLite) |

---

## PWA (Progressive Web App)

### Requisitos
- `manifest.json` com icons, theme color, display standalone
- Service Worker com cache strategies (Cache First para assets, Network First para API)
- HTTPS obrigatório
- Push notifications (Web Push API)

### Quando PWA vs Nativo
| Cenário | PWA | React Native | Flutter |
|---------|-----|-------------|---------|
| Simples informativo | ✅ | ❌ | ❌ |
| Precisa de camera/BLE/NFC | ❌ | ✅ | ✅ |
| Performance critica | ❌ | ✅ | ✅ |
| Offline first | ✅ | ✅ | ✅ |
| Push notifications | ✅ | ✅ | ✅ |

---

## Design Patterns Mobile

- **Mobile-first**: telas projetadas para mobile, adaptadas para tablet
- **Touch targets**: minimo 44x44dp para elementos tocaveis
- **Loading states**: Skeleton screens (evitar spinners)
- **Pull-to-refresh**: em todas as listas
- **Infinite scroll**: paginacao com FlatList (RN) ou ListView (Flutter)
- **Error states**: tela de erro com botao "Tentar novamente"

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
