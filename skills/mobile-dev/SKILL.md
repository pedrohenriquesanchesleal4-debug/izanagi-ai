---
name: mobile-dev
description: |
  Skill de Desenvolvimento Mobile para o Portal. Aborda React Native, Expo, Flutter,
  PWA, e padroes de design mobile (iOS Human Interface, Material Design 3).
  Use esta skill para desenvolver ou revisar aplicacoes mobile.
---

# Skill Mobile Development — Portal

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
