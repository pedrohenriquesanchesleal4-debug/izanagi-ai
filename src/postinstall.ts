import { installToProject } from './installer.js';

try {
  installToProject();
} catch (err: any) {
  console.warn('[NexusAI Warning] Erro durante a pós-instalação (.agents):', err?.message || err);
}
