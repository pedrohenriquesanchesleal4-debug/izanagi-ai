# Contribuindo para o NexusAI 🚀

Obrigado pelo seu interesse em contribuir com o **NexusAI**! Este framework é construído pela comunidade para comunidade, focado em criar os melhores agentes e habilidades de IA para desenvolvimento de software.

---

## 🛠️ Como Contribuir

### 1. Adicionar uma Nova Skill
1. Crie um novo arquivo Markdown em `skills/<nome-da-skill>.md` ou subdiretório correspondente.
2. Siga o padrão de estrutura de Skills do NexusAI:
   - Header (Versão, Domínio, Budget de Tokens)
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
1. O código da CLI reside em `src/cli/` e o binário em `bin/nexus.js`.
2. Após fazer alterações, execute a verificação de integridade:
   ```bash
   node bin/nexus.js doctor
   ```

---

## 🧪 Validando suas Alterações

Antes de abrir um Pull Request, certifique-se de que o diagnóstico do framework passa sem erros:

```bash
nexus doctor
```

---

## 📬 Processo de Pull Request

1. Faça o Fork deste repositório.
2. Crie uma branch para sua feature (`git checkout -b feature/nova-skill`).
3. Commit suas alterações (`git commit -m 'feat: adiciona skill x'`).
4. Envie a branch (`git push origin feature/nova-skill`).
5. Abra um Pull Request detalhado descrevendo suas mudanças.

---

## 📜 Licença

Ao contribuir para o NexusAI, você concorda que suas contribuições serão licenciadas sob a licença **MIT**.
