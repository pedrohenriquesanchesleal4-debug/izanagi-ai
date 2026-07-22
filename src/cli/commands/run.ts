export function runCommand(baseDir: string, taskDescription?: string): void {
  if (!taskDescription) {
    console.error('\x1b[31mError:\x1b[0m Please provide a task description. Example: \x1b[1mnexus run "Create secure REST API with Laravel Sanctum"\x1b[0m');
    process.exit(1);
  }

  console.log('\n\x1b[36m=== NexusAI Decision Engine ===\x1b[0m');
  console.log(`\x1b[1mTask:\x1b[0m "${taskDescription}"\n`);

  const lower = taskDescription.toLowerCase();

  // Basic classification heuristics
  let agentName = 'senior-engineer';
  let category = 'implementation';
  let skillChain = ['planner', 'reviewer', 'clean-code'];

  if (lower.includes('architect') || lower.includes('design') || lower.includes('microservice') || lower.includes('clean arch') || lower.includes('estrutura')) {
    agentName = 'architect';
    category = 'architecture';
    skillChain = ['planner', 'architect', 'clean-arch', 'risk', 'tradeoff', 'uml'];
  } else if (lower.includes('security') || lower.includes('auth') || lower.includes('owasp') || lower.includes('vulnerab') || lower.includes('audit')) {
    agentName = 'security';
    category = 'security_audit';
    skillChain = ['security', 'owasp', 'pentest', 'code-auditor', 'reviewer'];
  } else if (lower.includes('bug') || lower.includes('fix') || lower.includes('error') || lower.includes('crash') || lower.includes('debug')) {
    agentName = 'bug-hunter';
    category = 'debugging';
    skillChain = ['debug', 'bug', 'root-cause', 'self-fix', 'reviewer'];
  } else if (lower.includes('db') || lower.includes('database') || lower.includes('sql') || lower.includes('postgres') || lower.includes('migration')) {
    agentName = 'database';
    category = 'database_design';
    skillChain = ['db', 'sql', 'postgres', 'er', 'perf'];
  } else if (lower.includes('docker') || lower.includes('ci/cd') || lower.includes('pipeline') || lower.includes('deploy') || lower.includes('k8s')) {
    agentName = 'devops';
    category = 'devops_infra';
    skillChain = ['devops', 'docker', 'cicd', 'linux'];
  }

  console.log(`\x1b[32m✔ Category Identified:\x1b[0m ${category}`);
  console.log(`\x1b[32m✔ Selected Agent:\x1b[0m ${agentName}`);
  console.log(`\x1b[32m✔ Computed Skill Chain:\x1b[0m ${skillChain.join(' -> ')}\n`);

  console.log('\x1b[1mExecution Plan:\x1b[0m');
  console.log('  1. Load Context & System Rules (SYSTEM.md / RULES.md)');
  console.log(`  2. Activate Agent [${agentName}]`);
  console.log(`  3. Execute Skill Chain [${skillChain.join(', ')}]`);
  console.log('  4. Apply Quality Gates & Security Verification');
  console.log('  5. Generate Output & Reflection Log\n');

  console.log('\x1b[90mTip: Run \x1b[36mnexus compile ' + agentName + '\x1b[90m to output the full prompt instruction for your LLM context.\x1b[0m\n');
}
