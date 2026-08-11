import readline from 'readline';

/**
 * Multi-select interativo com setas (↑/↓), espaço para marcar/desmarcar,
 * Enter para confirmar, `a` para selecionar todos, `n` para nenhum.
 * Se o terminal não for interativo (pipe/script), retorna os defaults.
 */
export function selectPacks(
  options: { id: string; label: string; description: string; default?: boolean }[],
  lockedId?: string
): Promise<string[]> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      const defaults = options.filter((o) => o.default || o.id === lockedId).map((o) => o.id);
      resolve(defaults.length > 0 ? defaults : options.map((o) => o.id));
      return;
    }

    const selected = new Set<string>();
    let cursor = 0;

    for (const opt of options) {
      if (opt.id === lockedId || opt.default) {
        selected.add(opt.id);
      }
    }

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);

    const render = () => {
      readline.cursorTo(process.stdout, 0, 0);
      readline.clearScreenDown(process.stdout);
      console.log('\x1b[36m=== Select skill packs (↑/↓ navigate, Space toggle, Enter confirm) ===\x1b[0m\n');
      options.forEach((opt, i) => {
        const isSelected = selected.has(opt.id);
        const isLocked = opt.id === lockedId;
        const marker = isSelected ? (isLocked ? '\x1b[33m[*]\x1b[0m' : '\x1b[32m[x]\x1b[0m') : '\x1b[90m[ ]\x1b[0m';
        const cursorMark = i === cursor ? '\x1b[32m>\x1b[0m ' : '  ';
        const dim = isLocked ? '\x1b[2m' : '';
        console.log(`${cursorMark} ${marker} ${dim}\x1b[1m${opt.label}\x1b[0m\x1b[0m — ${opt.description}`);
      });
      console.log('\n  \x1b[90ma\x1b[0m select all | \x1b[90mn\x1b[0m none | \x1b[90mEnter\x1b[0m confirm');
    };

    process.stdout.write('\x1b[?25l');
    render();

    const cleanup = (result: string[]) => {
      process.stdin.setRawMode(false);
      process.stdin.removeAllListeners('keypress');
      process.stdout.write('\x1b[?25h');
      console.log('');
      resolve(result);
    };

    const onKeypress = (_: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === 'c') {
        process.stdin.setRawMode(false);
        process.exit(130);
      }

      switch (key.name) {
        case 'up':
          cursor = (cursor - 1 + options.length) % options.length;
          render();
          break;
        case 'down':
          cursor = (cursor + 1) % options.length;
          render();
          break;
        case 'space':
          if (options[cursor].id !== lockedId) {
            if (selected.has(options[cursor].id)) {
              selected.delete(options[cursor].id);
            } else {
              selected.add(options[cursor].id);
            }
          }
          render();
          break;
        case 'return':
        case 'enter':
          cleanup(Array.from(selected));
          break;
        case 'a':
          options.forEach((o) => selected.add(o.id));
          render();
          break;
        case 'n':
          options.forEach((o) => {
            if (o.id !== lockedId) selected.delete(o.id);
          });
          render();
          break;
      }
    };

    process.stdin.on('keypress', onKeypress);
  });
}
