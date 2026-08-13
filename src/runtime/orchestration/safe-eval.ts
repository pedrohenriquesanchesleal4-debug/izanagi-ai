/**
 * Safe Expression Evaluator — substitui `new Function(...)` para avaliar
 * condições de grafo (`GraphNode.condition`) e validators de benchmark
 * (`BenchmarkValidator.check`).
 *
 * Esses dois pontos avaliam expressões que podem vir de dados carregados do
 * disco (ex.: `.agents/benchmarks/*.json` de terceiros via BenchmarkRegistry),
 * então `new Function`/`eval` equivalem a execução de código arbitrário sobre
 * conteúdo não confiável. Este avaliador interpreta um subconjunto pequeno e
 * fixo de JS (o mesmo usado em src/runtime/benchmarks/definitions.ts) via um
 * parser próprio — nunca gera nem executa código JS dinâmico.
 *
 * Gramática suportada:
 *   expr      := or
 *   or        := and ('||' and)*
 *   and       := equality ('&&' equality)*
 *   equality  := relational (('===' | '!==' | '==' | '!=') relational)*
 *   relational:= unary (('<=' | '>=' | '<' | '>') unary)*
 *   unary     := '!' unary | postfix
 *   postfix   := primary ('.' IDENT ('(' args ')')?)*
 *   primary   := NUMBER | STRING | 'true' | 'false' | IDENT | '(' expr ')'
 *
 * Métodos permitidos em strings: includes, startsWith, endsWith, toLowerCase,
 * toUpperCase, trim. Propriedade permitida em strings/arrays: length. Acesso
 * a membros de objetos comuns (dados de estado) é permitido; `__proto__`,
 * `constructor` e `prototype` são sempre bloqueados.
 */

type Token = { type: 'num' | 'str' | 'ident' | 'op' | 'eof'; value: string };

const STRING_METHODS = new Set(['includes', 'startsWith', 'endsWith', 'toLowerCase', 'toUpperCase', 'trim']);
const BLOCKED_MEMBERS = new Set(['__proto__', 'constructor', 'prototype']);

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      let value = '';
      while (j < n && src[j] !== quote) {
        if (src[j] === '\\' && j + 1 < n) {
          value += src[j + 1];
          j += 2;
        } else {
          value += src[j];
          j++;
        }
      }
      if (j >= n) throw new Error('safe-eval: string não terminada');
      tokens.push({ type: 'str', value });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < n && /[0-9.]/.test(src[j])) j++;
      tokens.push({ type: 'num', value: src.slice(i, j) });
      i = j;
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j++;
      tokens.push({ type: 'ident', value: src.slice(i, j) });
      i = j;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (['===', '!=='].includes(src.slice(i, i + 3))) {
      tokens.push({ type: 'op', value: src.slice(i, i + 3) });
      i += 3;
      continue;
    }
    if (['==', '!=', '&&', '||', '<=', '>='].includes(two)) {
      tokens.push({ type: 'op', value: two });
      i += 2;
      continue;
    }
    if ('()!.,<>'.includes(c)) {
      tokens.push({ type: 'op', value: c });
      i++;
      continue;
    }
    throw new Error(`safe-eval: caractere inesperado "${c}" na expressão`);
  }
  tokens.push({ type: 'eof', value: '' });
  return tokens;
}

class Parser {
  private pos = 0;
  constructor(
    private readonly tokens: Token[],
    private readonly context: Record<string, unknown>,
  ) {}

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private next(): Token {
    return this.tokens[this.pos++];
  }

  private expectOp(op: string): void {
    const t = this.next();
    if (t.type !== 'op' || t.value !== op) {
      throw new Error(`safe-eval: esperado "${op}", encontrado "${t.value || t.type}"`);
    }
  }

  parse(): unknown {
    const value = this.parseOr();
    if (this.peek().type !== 'eof') {
      throw new Error(`safe-eval: token inesperado "${this.peek().value}"`);
    }
    return value;
  }

  private parseOr(): unknown {
    let left = this.parseAnd();
    while (this.peek().type === 'op' && this.peek().value === '||') {
      this.next();
      const right = this.parseAnd();
      left = Boolean(left) || Boolean(right);
    }
    return left;
  }

  private parseAnd(): unknown {
    let left = this.parseEquality();
    while (this.peek().type === 'op' && this.peek().value === '&&') {
      this.next();
      const right = this.parseEquality();
      left = Boolean(left) && Boolean(right);
    }
    return left;
  }

  private parseEquality(): unknown {
    let left = this.parseRelational();
    while (this.peek().type === 'op' && ['===', '!==', '==', '!='].includes(this.peek().value)) {
      const op = this.next().value;
      const right = this.parseRelational();
      if (op === '===') left = left === right;
      else if (op === '!==') left = left !== right;
      else if (op === '==') left = left == right; // eslint-disable-line eqeqeq
      else left = left != right; // eslint-disable-line eqeqeq
    }
    return left;
  }

  private parseRelational(): unknown {
    let left = this.parseUnary();
    while (this.peek().type === 'op' && ['<=', '>=', '<', '>'].includes(this.peek().value)) {
      const op = this.next().value;
      const right = this.parseUnary();
      if (typeof left !== 'number' || typeof right !== 'number') {
        throw new Error('safe-eval: comparação relacional requer números');
      }
      if (op === '<=') left = left <= right;
      else if (op === '>=') left = left >= right;
      else if (op === '<') left = left < right;
      else left = left > right;
    }
    return left;
  }

  private parseUnary(): unknown {
    if (this.peek().type === 'op' && this.peek().value === '!') {
      this.next();
      return !this.parseUnary();
    }
    return this.parsePostfix();
  }

  private parsePostfix(): unknown {
    let value = this.parsePrimary();
    while (this.peek().type === 'op' && this.peek().value === '.') {
      this.next();
      const member = this.next();
      if (member.type !== 'ident') throw new Error('safe-eval: nome de membro inválido');
      if (BLOCKED_MEMBERS.has(member.value)) {
        throw new Error(`safe-eval: acesso a "${member.value}" é bloqueado`);
      }
      if (this.peek().type === 'op' && this.peek().value === '(') {
        this.next();
        const args: unknown[] = [];
        if (!(this.peek().type === 'op' && this.peek().value === ')')) {
          args.push(this.parseOr());
          while (this.peek().type === 'op' && this.peek().value === ',') {
            this.next();
            args.push(this.parseOr());
          }
        }
        this.expectOp(')');
        value = this.callMethod(value, member.value, args);
      } else {
        value = this.getMember(value, member.value);
      }
    }
    return value;
  }

  private callMethod(receiver: unknown, name: string, args: unknown[]): unknown {
    if (typeof receiver !== 'string' || !STRING_METHODS.has(name)) {
      throw new Error(`safe-eval: método "${name}" não permitido`);
    }
    switch (name) {
      case 'includes':
        return receiver.includes(String(args[0] ?? ''));
      case 'startsWith':
        return receiver.startsWith(String(args[0] ?? ''));
      case 'endsWith':
        return receiver.endsWith(String(args[0] ?? ''));
      case 'toLowerCase':
        return receiver.toLowerCase();
      case 'toUpperCase':
        return receiver.toUpperCase();
      case 'trim':
        return receiver.trim();
      default:
        throw new Error(`safe-eval: método "${name}" não implementado`);
    }
  }

  private getMember(receiver: unknown, name: string): unknown {
    if (name === 'length' && (typeof receiver === 'string' || Array.isArray(receiver))) {
      return receiver.length;
    }
    if (receiver !== null && typeof receiver === 'object' && !Array.isArray(receiver)) {
      return (receiver as Record<string, unknown>)[name];
    }
    return undefined;
  }

  private parsePrimary(): unknown {
    const t = this.next();
    if (t.type === 'num') return Number(t.value);
    if (t.type === 'str') return t.value;
    if (t.type === 'ident') {
      if (t.value === 'true') return true;
      if (t.value === 'false') return false;
      if (BLOCKED_MEMBERS.has(t.value)) throw new Error(`safe-eval: acesso a "${t.value}" é bloqueado`);
      return this.context[t.value];
    }
    if (t.type === 'op' && t.value === '(') {
      const value = this.parseOr();
      this.expectOp(')');
      return value;
    }
    throw new Error(`safe-eval: token inesperado "${t.value || t.type}"`);
  }
}

/**
 * Avalia uma expressão restrita contra um contexto de variáveis.
 * Nunca gera nem executa código JS — apenas interpreta o AST.
 */
export function safeEvaluate(expr: string, context: Record<string, unknown>): unknown {
  const tokens = tokenize(expr);
  return new Parser(tokens, context).parse();
}
