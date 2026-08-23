---
name: "dry-kiss-yagni-validator"
description: "Verifica código contra DRY, KISS e YAGNI: duplicação, over-engineering e abstrações/parâmetros não usados, com exemplos de antes/depois. Use ao revisar ou refatorar código para simplicidade. Gatilhos de ativação: skill: dry / kiss / yagni validator; identity; dry — don't repeat yourself; kiss — keep it simple."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
references:
  - "references.md"
---

# Skill: DRY / KISS / YAGNI Validator

> Migrado deterministicamente de `skills/dry-kiss-yagni-validator/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Verifica código contra DRY, KISS e YAGNI: duplicação, over-engineering e abstrações/parâmetros não usados, com exemplos de antes/depois.
- **Ativar quando:** Use ao revisar ou refatorar código para simplicidade.
- **Escopo canônico:** Skill: DRY / KISS / YAGNI Validator
- **Seções do corpo original:** Identity · DRY — Don't Repeat Yourself · KISS — Keep It Simple · YAGNI — You Ain't Gonna Need It · Score
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: paragraphs-as-steps -->

### Passo 1 — Ensures code follows three fundamental principles:

Ensures code follows three fundamental principles: Don't Repeat Yourself (DRY), Keep It Simple Stupid (KISS), and You Ain't Gonna Need It (YAGNI).

### Passo 2 — Veja references.md nesta pasta — curadoria dos melhores sites/referências (2026) para e...

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] No duplicated logic across methods/classes
- [ ] No copy-pasted code blocks
- [ ] Repeated patterns extracted into functions/classes
- [ ] Business rules defined once
- [ ] Configuration externalized (not hardcoded)
- [ ] Simplest solution that works
- [ ] No over-engineered abstractions
- [ ] No design patterns applied where not needed
- [ ] Code is readable at first glance
- [ ] No premature optimization

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

# Skill: DRY / KISS / YAGNI Validator

## Identity

Ensures code follows three fundamental principles: Don't Repeat Yourself (DRY), Keep It Simple Stupid (KISS), and You Ain't Gonna Need It (YAGNI).

---

## DRY — Don't Repeat Yourself

### Checks

- [ ] No duplicated logic across methods/classes
- [ ] No copy-pasted code blocks
- [ ] Repeated patterns extracted into functions/classes
- [ ] Business rules defined once
- [ ] Configuration externalized (not hardcoded)

### Examples

```php
// ❌ Violation
$total = $price + $tax;
$finalTotal = $price + $tax + $shipping;
$discountedTotal = ($price + $tax) * 0.9;

// ✅ DRY
function calculateSubtotal(float $price, float $tax): float {
    return $price + $tax;
}
$total = calculateSubtotal($price, $tax);
$finalTotal = calculateSubtotal($price, $tax) + $shipping;
```

---

## KISS — Keep It Simple

### Checks

- [ ] Simplest solution that works
- [ ] No over-engineered abstractions
- [ ] No design patterns applied where not needed
- [ ] Code is readable at first glance
- [ ] No premature optimization

### Signs of Over-Engineering

```
- FactoryFactory pattern
- Strategy pattern for a single if-else
- Abstract base class with one concrete implementation
- Event system when a simple function call works
- Microservice for a CRUD module
```

---

## YAGNI — You Ain't Gonna Need It

### Checks

- [ ] No unused parameters, methods, or classes
- [ ] No commented-out "future" code
- [ ] No "we might need this later" abstractions
- [ ] No unused dependencies in composer.json
- [ ] No unused imports

### Examples

```php
// ❌ YAGNI violation — building for hypothetical future
class PaymentProcessor
{
    public function process(
        PaymentMethod $method,
        ?bool $useCrypto = null,  // might need later?
        ?string $fallbackCurrency = null,  // for future expansion?
    ) { ... }
}

// ✅ YAGNI — only what's needed now
class PaymentProcessor
{
    public function process(PaymentMethod $method): void { ... }
}
```

---

## Score

```yaml
dry_score: 4/5
kiss_score: 5/5
yagni_score: 3/5

violations:
  - principle: yagni
    location: "UserService.php:22"
    detail: "Unused method getHistory that calls an API that doesn't exist yet"
```

---

## Changelog

### 1.0.0 — Initial release. DRY, KISS, YAGNI checks with examples.

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
