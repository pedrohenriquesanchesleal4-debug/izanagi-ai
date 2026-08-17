/**
 * `izanagi dashboard [--port N]` — sobe o servidor local do Dashboard
 * (Fase 7, fundação) lendo `.izanagi/state/` do projeto atual.
 */

import { createDashboardServer } from '../../runtime/dashboard/server.js';

export function dashboardCommand(baseDir: string, args: string[]): void {
  const portFlagIdx = args.findIndex((a) => a === '--port' || a === '-p');
  const port = portFlagIdx >= 0 ? Number(args[portFlagIdx + 1]) || 4321 : 4321;

  const server = createDashboardServer({ baseDir });
  server.listen(port, () => {
    console.log(`\n\x1b[35m=== Izanagi Dashboard ===\x1b[0m`);
    console.log(`  \x1b[32m✔\x1b[0m rodando em \x1b[36mhttp://localhost:${port}\x1b[0m`);
    console.log(`  \x1b[90mCtrl+C para encerrar. Lê dados de ${baseDir}/.izanagi/state/.\x1b[0m\n`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\x1b[31mErro:\x1b[0m porta ${port} já em uso — tente \`izanagi dashboard --port <outra>\`.\n`);
    } else {
      console.error(`\x1b[31mErro ao iniciar dashboard:\x1b[0m ${err.message}\n`);
    }
    process.exit(1);
  });
}
