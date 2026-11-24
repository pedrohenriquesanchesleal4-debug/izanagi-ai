# Referências Canônicas — Emil Kowalski Skills (Agents with Taste)

## Fontes Oficiais

- **Emil Kowalski — Agents with Taste**: `https://emilkowal.ski/ui/agents-with-taste`
- **Emil Kowalski — AI Skills for Design Engineers**: `https://emilkowal.ski/skill`
- **Repositório `emilkowalski/skills`**: `https://github.com/emilkowalski/skills` (`emil-design-eng`, `animate`, `animate-expo`, `review-animations`, `improve-animations`, `find-animation-opportunities`, `animation-vocabulary`, `apple-design`, `pick-ui-library`)

## Tabela de Curvas Cubic-Bezier e Springs Recomendadas

| Uso | Curva / Spring | Duração Ideal |
|---|---|---|
| **Popover / Dropdown Entrance** | `cubic-bezier(0.16, 1, 0.3, 1)` | `150ms – 180ms` |
| **Modal / Drawer Entrance** | `cubic-bezier(0.22, 1, 0.36, 1)` | `200ms – 240ms` |
| **Element Exit (Fechamento)** | `cubic-bezier(0.4, 0, 1, 1)` | `120ms – 150ms` |
| **Shared Layout / Tab Pill** | `spring({ duration: 0.4, bounce: 0.15 })` | `~350ms` |
| **Button Active Press** | `ease-out` (`scale(0.97)`) | `100ms – 140ms` |
