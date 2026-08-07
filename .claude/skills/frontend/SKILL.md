---
name: frontend
description: "Skill de frontend para o Izanagi. Contém todos os design tokens do Tailwind CSS, padrões de design identificados nas páginas existentes, e boas práticas de Next.js + Tailwind. Use esta skill para criar ou editar componentes visuais, garantindo consistência com o design system existente. Antes de criar novas classes ou variáveis, consulte a lista de tokens existentes abaixo."
---

# Frontend

## 🎨 Design Tokens Existentes (`tailwind.config.js`) Antes de criar qualquer estilização, **consulte os tokens abaixo**. Priorize SEMPRE o uso de tokens existentes. | Token Tailwind | Valor | Uso | |----------------|-------|-----| | `brand-blue` | `#1e40af` | Cor primária da marca. Botões, links, headers | | `brand-light-blue` | `#3b82f6` | Variante clara do azul. Hovers, destaques | |… | `modal-cancel-bg` | `#f1f5f9` | Background do botão cancelar em modais | | `modal-cancel-bg-hover` | `#e2e8f0` | Hover do botão cancelar | | `modal-cancel-border` | `#e2e8f0` | Borda do botão cancelar | | `modal-cancel-text` |… **Como usar:** | Token | Valor | Uso | |-------|-------|-----| | `bg-brand-gradient` | `linear-gradient(90deg, #1e40af, #3b82f6)` | Gradiente horizontal da marca | | `bg-brand-gradient-2` | `linear-gradient… | `bg-modal-header` | `linear-gradient(90deg, #1d4ed8 0%, #2563eb 60%, #3b82f6 100%)` | Header de modal | | `bg-modal-btn` | `linear-gradient(90deg, #1d4ed8 0%, #2563eb 100%)` | Botão de modal | | `bg-modal-btn-hover` |… **Como usar:** | Token | Valor | Uso | |-------|-------|-----| | `shadow-modal-card` | `0 25px 60px rgba(0,0,0,0.25), 0 8px 24px rgba(59,130,246,0.12)` | Sombra elevada para modais | | `shadow-modal-img` | `0 4px 16px rgba(0,0,0,0.10)` | Sombra suave… | `shadow-modal-btn-hover` | `0 4px 16px rgba(37,99,235,0.45)` | Sombra de botão azul em hover

… (resumo gerado automaticamente)

> Gerado pelo Izanagi AI — resumo da skill original `skills/frontend/SKILL.md`.
