import { ModelRouter, TIER_FOR_ROLE, catalogAgeDays, isCatalogStale, STALE_CATALOG_AFTER_DAYS } from '../../runtime/model/router.js';
import { LLMClient } from '../../runtime/llm/client.js';
import { AGENT_ROLES, type AgentRole } from '../../runtime/contracts/task-contract.js';
import type { RoutingContext } from '../../runtime/types.js';

/**
 * `izanagi models`: catálogo de modelos, quem está configurado de verdade e
 * qual modelo cada PAPEL receberia agora. Responde a pergunta que o usuário
 * faz antes de gastar dinheiro: "com o que eu tenho configurado, quem vai
 * rodar o quê e por quanto?".
 */
export function modelsCommand(baseDir: string, args: string[] = []): void {
  const asJson = args.includes('--json');
  const client = new LLMClient();
  const configured = new Set(client.configuredProviders());
  const catalog = ModelRouter.loadProjectProviders(baseDir);
  const rolePolicy = ModelRouter.loadRolePolicy(baseDir);

  const usable = catalog.filter((p) => configured.has(p.id));
  const router = new ModelRouter(usable.length > 0 ? usable : catalog).withRolePolicy(rolePolicy);

  const ctx: RoutingContext = {
    task: '',
    taskComplexity: 3,
    reasoningRequirement: 'medium',
    risk: 0.2,
    tokenBudget: 16000,
    requiresTools: false,
  };

  const routing = AGENT_ROLES.map((role: AgentRole) => {
    try {
      const routed = router.routeForRole(role, ctx);
      return {
        role,
        preferredTier: TIER_FOR_ROLE[role],
        model: routed.model.id,
        provider: routed.provider,
        tier: routed.tier,
        costPer10kTokensUsd: Math.round(router.estimateCostForRole(role, 10_000) * 1e6) / 1e6,
        pinned: Boolean(rolePolicy?.[role]),
        reasons: routed.reasons,
      };
    } catch {
      return { role, preferredTier: TIER_FOR_ROLE[role], model: null, provider: null, tier: null, costPer10kTokensUsd: 0, pinned: false, reasons: ['catálogo vazio'] };
    }
  });

  if (asJson) {
    console.log(JSON.stringify({
      configuredProviders: Array.from(configured),
      usingFallbackCatalog: usable.length === 0,
      routing,
      catalog: catalog.map((p) => ({
        id: p.id,
        name: p.name,
        configured: configured.has(p.id),
        // `null` quando o provider não declara data: ausência de informação
        // aparece como ausente, nunca como 0 (que afirmaria "preço de hoje").
        pricingAsOf: p.pricingAsOf ?? null,
        pricingAgeDays: catalogAgeDays(p),
        pricingStale: isCatalogStale(p),
        models: p.models,
      })),
      staleCatalogAfterDays: STALE_CATALOG_AFTER_DAYS,
    }, null, 2));
    return;
  }

  console.log('\n\x1b[36m=== Izanagi Model Router ===\x1b[0m\n');
  console.log(`\x1b[1mProviders configurados:\x1b[0m ${configured.size > 0 ? Array.from(configured).join(', ') : '\x1b[33mnenhum (modo headless)\x1b[0m'}`);
  if (usable.length === 0 && configured.size === 0) {
    console.log('\x1b[90m  O roteamento abaixo usa o catálogo completo como referência; nada será executado sem provider configurado.\x1b[0m');
  }

  console.log('\n\x1b[1mRoteamento por papel (inteligência assimétrica):\x1b[0m');
  for (const r of routing) {
    const pin = r.pinned ? ' \x1b[35m[fixado]\x1b[0m' : '';
    console.log(`  \x1b[32m${r.role.padEnd(11)}\x1b[0m tier ${String(r.preferredTier).padEnd(9)} -> ${r.model ?? '—'} \x1b[90m(${r.provider ?? '—'}, $${r.costPer10kTokensUsd.toFixed(5)}/10k tokens)\x1b[0m${pin}`);
  }

  console.log('\n\x1b[1mCatálogo:\x1b[0m');
  const obsoletos: string[] = [];
  for (const provider of catalog) {
    const mark = configured.has(provider.id) ? '\x1b[32m✔\x1b[0m' : '\x1b[90m○\x1b[0m';
    // Idade da tabela de preços ao lado do provider. Sem data declarada sai
    // "preço não datado": a ausência tem que ser visível, porque um preço sem
    // procedência é o que alimenta o teto de orçamento errado.
    const dias = catalogAgeDays(provider);
    let selo: string;
    if (dias === null) {
      const local = provider.models.every((m) => m.costPer1kInput === 0 && m.costPer1kOutput === 0);
      selo = local ? '\x1b[90m(self-hosted, custo 0)\x1b[0m' : '\x1b[33m(preço não datado)\x1b[0m';
    } else if (isCatalogStale(provider)) {
      selo = `\x1b[33m(preço de ${provider.pricingAsOf}, ${dias}d — reconfira)\x1b[0m`;
      obsoletos.push(provider.id);
    } else {
      selo = `\x1b[90m(preço de ${provider.pricingAsOf}, ${dias}d)\x1b[0m`;
    }
    console.log(`  ${mark} \x1b[1m${provider.id}\x1b[0m (${provider.name}) ${selo}`);
    for (const m of provider.models) {
      console.log(`      ${m.id.padEnd(22)} ${m.tier.padEnd(9)} ctx ${String(m.contextWindow).padEnd(8)} in $${m.costPer1kInput}/1k  out $${m.costPer1kOutput}/1k`);
    }
  }

  if (obsoletos.length > 0) {
    console.log(`\n\x1b[33m! Tabela de preços com mais de ${STALE_CATALOG_AFTER_DAYS} dias:\x1b[0m ${obsoletos.join(', ')}`);
    console.log('\x1b[90m  O teto de custo do orçamento é calculado com estes números. Confira no provider e sobrescreva em .izanagi/izanagi.config.json → models.\x1b[0m');
  }

  console.log('\n\x1b[90mFixar modelo por papel:\x1b[0m .izanagi/izanagi.config.json → { "roles": { "worker": { "model": "claude-haiku-4-5" } } }');
  console.log('\x1b[90mOu por execução:\x1b[0m IZANAGI_MODEL_WORKER=<id> · izanagi run "..." --model <id>\n');
}
