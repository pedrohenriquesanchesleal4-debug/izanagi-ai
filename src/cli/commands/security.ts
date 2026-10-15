/**
 * `izanagi security scan` — auditoria estática de segurança de skills e extensões.
 */

import { checkSkillSecurityScan } from '../checks.js';

export function securityCommand(baseDir: string, args: string[]): void {
  const sub = (args[0] || 'scan').toLowerCase();
  const rest = args.slice(1);

  if (sub !== 'scan') {
    console.error(`\x1b[31mSubcomando de segurança desconhecido:\x1b[0m ${sub}`);
    console.log('Uso: \x1b[1mizanagi security scan [--json]\x1b[0m\n');
    process.exit(1);
  }

  const isJson = rest.includes('--json');
  const check = checkSkillSecurityScan(baseDir);

  if (isJson) {
    console.log(JSON.stringify(check, null, 2));
    if (!check.ok) process.exit(1);
    return;
  }

  console.log(`\n\x1b[35m=== Izanagi AI — Security Scan ===\x1b[0m\n`);
  console.log(`  Resultado: ${check.ok ? '\x1b[32m✔ APROVADO' : '\x1b[31m✖ RISCO IDENTIFICADO'}\x1b[0m`);
  console.log(`  Detalhe: ${check.detail}\n`);

  const risky = check.results.filter((r) => r.level === 'CRITICAL' || r.level === 'HIGH' || r.level === 'MEDIUM');

  if (risky.length > 0) {
    console.log('\x1b[1mSkills com alertas de segurança:\x1b[0m');
    for (const r of risky) {
      const color = r.level === 'CRITICAL' ? '\x1b[31m' : r.level === 'HIGH' ? '\x1b[33m' : '\x1b[36m';
      console.log(`  ${color}[${r.level}]\x1b[0m \x1b[1m${r.skill}\x1b[0m (${r.findings.length} achados)`);
      for (const f of r.findings) {
        console.log(`    • ${f.rule}: ${f.message}`);
      }
    }
    console.log('');
  } else {
    console.log(`  \x1b[32m✔ Todas as skills analisadas atendem às diretrizes de segurança.\x1b[0m\n`);
  }

  if (!check.ok) {
    process.exit(1);
  }
}
