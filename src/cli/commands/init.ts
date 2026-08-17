import fs from 'fs';
import path from 'path';
import { installToProject, PACKS, CORE_PACK_ID } from '../../installer.js';
import { selectPacks } from '../prompts.js';
import { checkNestedDuplicate } from '../checks.js';

interface InitArgs {
  targetDir: string;
  packs?: string[];
  cli?: string;
}

function parseInitArgs(args: string[]): InitArgs {
  let targetDir = process.cwd();
  const packs: string[] = [];
  let cli: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--packs' || arg === '-p') {
      const value = args[i + 1];
      if (value) {
        packs.push(...value.split(',').map((s) => s.trim()).filter(Boolean));
        i++;
      }
    } else if (arg.startsWith('--packs=')) {
      packs.push(...arg.slice(8).split(',').map((s) => s.trim()).filter(Boolean));
    } else if (arg === '--cli' || arg === '-c') {
      const value = args[i + 1];
      if (value) {
        cli = value.trim();
        i++;
      }
    } else if (arg.startsWith('--cli=')) {
      cli = arg.slice(6).trim();
    } else if (arg === '--all') {
      packs.push(...PACKS.map((p) => p.id));
    } else if (!arg.startsWith('-')) {
      targetDir = arg;
    }
  }

  return { targetDir, packs: packs.length > 0 ? packs : undefined, cli };
}

function validatePacks(packs: string[]): string[] {
  const valid = new Set(PACKS.map((p) => p.id));
  const invalid = packs.filter((p) => !valid.has(p));
  if (invalid.length > 0) {
    console.error(
      `\x1b[31mError:\x1b[0m unknown pack(s): ${invalid.join(', ')}.\nValid packs: ${Array.from(valid).join(', ')}`
    );
    process.exit(1);
  }
  return packs;
}

export async function initCommand(args: string[]): Promise<void> {
  const { targetDir, packs, cli } = parseInitArgs(args);
  const destinationRoot = path.resolve(targetDir);

  if (fs.existsSync(destinationRoot)) {
    const isEmpty = fs.readdirSync(destinationRoot).length === 0;
    if (!isEmpty && destinationRoot !== process.cwd()) {
      console.error(`\x1b[31mError:\x1b[0m directory already exists and is not empty: ${destinationRoot}`);
      process.exit(1);
    }
  }

  const nestedDuplicate = checkNestedDuplicate(destinationRoot);
  if (nestedDuplicate) {
    console.log(`\n\x1b[33mWarning:\x1b[0m ${nestedDuplicate.detail}\n`);
  }

  console.log(`\n\x1b[36m=== Initializing Izanagi AI in: ${destinationRoot} ===\x1b[0m\n`);

  let selectedPacks: string[];

  if (packs) {
    selectedPacks = validatePacks(packs);
    const display = Array.from(new Set([CORE_PACK_ID, ...selectedPacks])).join(', ');
    console.log(`\x1b[33mSelected packs:\x1b[0m ${display}\n`);
  } else {
    selectedPacks = await selectPacks(PACKS, CORE_PACK_ID);
  }

  installToProject(destinationRoot, selectedPacks, cli);

  console.log('\x1b[32mIzanagi AI successfully initialized!\x1b[0m');
  console.log(`\x1b[90mNext:\x1b[0m \x1b[1mcd ${path.basename(destinationRoot)}\x1b[0m && \x1b[36mizanagi run "your task"\x1b[0m\n`);
}
