# Contribuindo para o Izanagi AI 🚀

Obrigado pelo seu interesse em contribuir com o **Izanagi AI**! Este framework é construído pela comunidade para comunidade, focado em criar os melhores agentes e habilidades de IA para desenvolvimento de software.

---

## 🛠️ Como Contribuir

### 1. Adicionar uma Nova Skill
1. Crie a skill no catálogo legado em `skills/<nome-da-skill>/SKILL.md` (subdiretório por skill) e sincronize o catálogo ativo v2 em `.skills/<nome-da-skill>/SKILL.md` via `node packages/skill-migrator/cli.mjs` (idempotente; valide com `--dry-run`/`--check`).
2. Siga o padrão de estrutura de Skills do Izanagi AI:
   - Frontmatter mínimo (`name`, `description`; opcional: `version`, `category`, `triggers`)
   - Contexto & Objetivo
   - Workflow
   - Checklist de Qualidade
   - Regras ("Sempre" e "Nunca")
3. Adicione a skill e seu alias correspondente em `core/skill-resolver.json`.
4. Adicione o resumo da skill em `skills/INDEX.md`.

### 2. Adicionar/Melhorar um Agente
1. Edite ou crie a definição em `agents/<nome>-agent.json`.
2. Garanta que o JSON contenha os campos obrigatórios: `name`, `version`, `role`, `identity`, `model`, `token_budget`, `skills`, `chains`, `always`, `never`.

### 3. Melhorar a CLI
1. O código da CLI reside em `src/cli/` e o binário em `bin/izanagi.js` (importa de `dist/`, que é gitignored: rode `npm run build` antes de qualquer comando local).
2. Após fazer alterações, execute a verificação de integridade:
   ```bash
   npm run build && node bin/izanagi.js doctor
   ```

---

## 🧪 Validando suas Alterações

Antes de abrir um Pull Request, certifique-se de que o diagnóstico do framework passa sem erros:

```bash
npm run build && izanagi doctor
```

Referências canônicas: comandos completos de desenvolvimento e testes em [`AGENTS.md`](AGENTS.md); contratos dos núcleos poliglotas (Rust, Go, Python, TS) em [`docs/POLYGLOT.md`](docs/POLYGLOT.md); histórico de releases em [`CHANGELOG.md`](CHANGELOG.md).

---

## 📬 Processo de Pull Request

1. Faça o Fork deste repositório.
2. Crie uma branch para sua feature (`git checkout -b feature/nova-skill`).
3. Commit suas alterações (`git commit -m 'feat: adiciona skill x'`).
4. Envie a branch (`git push origin feature/nova-skill`).
5. Abra um Pull Request detalhado descrevendo suas mudanças.

---

## 📜 Licença

Ao contribuir para o Izanagi AI, você concorda que suas contribuições serão licenciadas sob a licença **MIT**.
