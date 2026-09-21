/**
 * Canvas Orchestration — evaluator de expressões de condição SANDBOXED.
 *
 * Segurança: NUNCA executa JavaScript arbitrário. Uma gramática mínima e
 * fechada (comparações + booleanos + caminhos de propriedade), com parser
 * recursivo descendente operando sobre um tokenizer próprio. Não há `eval`,
 * `Function`, chamadas de função, templates ou indexação dinâmica: caminhos
 * são resolvidos por acesso de propriedade simples e limitado em profundidade.
 *
 * Gramática:
 *   expr    := orExpr
 *   orExpr  := andExpr (('or'|'||') andExpr)*
 *   andExpr := cmpExpr (('and'|'&&') cmpExpr)*
 *   cmpExpr := unary (('>='|'<='|'=='|'!='|'>'|'<') unary)?
 *   unary   := ('not'|'!') unary | primary
 *   primary := number | string | 'true' | 'false' | path | '(' expr ')'
 *   path    := ident ('.' ident)*
 */

export type ConditionValue = number | string | boolean | undefined | null;

export class ConditionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConditionError';
  }
}

/* ============================ TOKENIZER ============================ */

type TokenType = 'number' | 'string' | 'ident' | 'op' | 'paren' | 'eof';

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

const OPERATORS = ['>=', '<=', '==', '!=', '&&', '||', '>', '<', '!', '.', '(', ')'];

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i += 1;
      continue;
    }
    // Strings
    if (c === "'" || c === '"') {
      const quote = c;
      let j = i + 1;
      let value = '';
      while (j < src.length && src[j] !== quote) {
        if (src[j] === '\\' && j + 1 < src.length) {
          value += src[j + 1];
          j += 2;
          continue;
        }
        value += src[j]!;
        j += 1;
      }
      if (src[j] !== quote) throw new ConditionError(`string não terminada em "${src}" na posição ${i}`);
      tokens.push({ type: 'string', value, pos: i });
      i = j + 1;
      continue;
    }
    // Números (inteiros e decimais)
    if (/[0-9]/.test(c) || (c === '-' && /[0-9]/.test(src[i + 1] ?? ''))) {
      let j = i + 1;
      while (j < src.length && /[0-9.]/.test(src[j]!)) j += 1;
      const raw = src.slice(i, j);
      if (!/^-?\d+(\.\d+)?$/.test(raw)) throw new ConditionError(`número inválido "${raw}" na posição ${i}`);
      tokens.push({ type: 'number', value: raw, pos: i });
      i = j;
      continue;
    }
    // Operadores (maiores primeiro)
    const op = OPERATORS.find((o) => src.startsWith(o, i));
    if (op) {
      tokens.push({ type: op === '(' || op === ')' ? 'paren' : 'op', value: op, pos: i });
      i += op.length;
      continue;
    }
    // Identificadores
    if (/[a-zA-Z_]/.test(c)) {
      let j = i + 1;
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j]!)) j += 1;
      tokens.push({ type: 'ident', value: src.slice(i, j), pos: i });
      i = j;
      continue;
    }
    throw new ConditionError(`caractere inesperado "${c}" na posição ${i}`);
  }
  tokens.push({ type: 'eof', value: '', pos: src.length });
  return tokens;
}

/* ============================ AST ============================ */

export type ConditionAst =
  | { kind: 'num'; value: number }
  | { kind: 'str'; value: string }
  | { kind: 'bool'; value: boolean }
  | { kind: 'path'; parts: string[] }
  | { kind: 'not'; operand: ConditionAst }
  | { kind: 'and'; left: ConditionAst; right: ConditionAst }
  | { kind: 'or'; left: ConditionAst; right: ConditionAst }
  | { kind: 'cmp'; op: '>=' | '<=' | '==' | '!=' | '>' | '<'; left: ConditionAst; right: ConditionAst };

const MAX_DEPTH = 32;

/* ============================ PARSER ============================ */

class Parser {
  private pos = 0;
  private depth = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): ConditionAst {
    const ast = this.parseOr();
    const tok = this.peek();
    if (tok.type !== 'eof') throw new ConditionError(`expressão inesperada após "${tok.value}" na posição ${tok.pos}`);
    return ast;
  }

  private peek(): Token {
    return this.tokens[this.pos]!;
  }

  private next(): Token {
    return this.tokens[this.pos++]!;
  }

  private enter(): void {
    this.depth += 1;
    if (this.depth > MAX_DEPTH) throw new ConditionError(`profundidade máxima de ${MAX_DEPTH} excedida`);
  }

  private parseOr(): ConditionAst {
    let left = this.parseAnd();
    while (this.peek().value === 'or' || this.peek().value === '||') {
      this.enter();
      this.next();
      const right = this.parseAnd();
      left = { kind: 'or', left, right };
    }
    return left;
  }

  private parseAnd(): ConditionAst {
    let left = this.parseCmp();
    while (this.peek().value === 'and' || this.peek().value === '&&') {
      this.enter();
      this.next();
      const right = this.parseCmp();
      left = { kind: 'and', left, right };
    }
    return left;
  }

  private parseCmp(): ConditionAst {
    const left = this.parseUnary();
    const op = this.peek().value;
    if (op === '>=' || op === '<=' || op === '==' || op === '!=' || op === '>' || op === '<') {
      this.next();
      const right = this.parseUnary();
      return { kind: 'cmp', op, left, right };
    }
    return left;
  }

  private parseUnary(): ConditionAst {
    const v = this.peek().value;
    if (v === 'not' || v === '!') {
      this.enter();
      this.next();
      return { kind: 'not', operand: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ConditionAst {
    const tok = this.next();
    if (tok.type === 'number') return { kind: 'num', value: parseFloat(tok.value) };
    if (tok.type === 'string') return { kind: 'str', value: tok.value };
    if (tok.type === 'paren' && tok.value === '(') {
      this.enter();
      const inner = this.parseOr();
      const close = this.next();
      if (close.type !== 'paren' || close.value !== ')') throw new ConditionError(`parêntese não fechado na posição ${close.pos}`);
      return inner;
    }
    if (tok.type === 'ident') {
      if (tok.value === 'true') return { kind: 'bool', value: true };
      if (tok.value === 'false') return { kind: 'bool', value: false };
      if (tok.value === 'and' || tok.value === 'or' || tok.value === 'not') {
        throw new ConditionError(`"${tok.value}" usado fora de posição na posição ${tok.pos}`);
      }
      const parts = [tok.value];
      while (this.peek().type === 'op' && this.peek().value === '.') {
        this.next();
        const next = this.next();
        if (next.type !== 'ident') throw new ConditionError(`esperava propriedade após "." na posição ${next.pos}`);
        if (parts.length >= 8) throw new ConditionError(`caminho de propriedade longo demais (máx 8 segmentos)`);
        parts.push(next.value);
      }
      return { kind: 'path', parts };
    }
    throw new ConditionError(`esperava valor, encontrou "${tok.value}" na posição ${tok.pos}`);
  }
}

/** Compila uma expressão de condição em AST (parser puro, sem avaliação). */
export function compileCondition(expression: string): ConditionAst {
  return new Parser(tokenize(expression)).parse();
}

/* ============================ AVALIAÇÃO ============================ */

/** Resolve um caminho com acesso de propriedade simples — sem chamadas, sem indexação dinâmica. */
function resolvePath(scope: Record<string, unknown>, parts: string[]): unknown {
  let current: unknown = scope;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    const value = (current as Record<string, unknown>)[part];
    if (typeof value === 'function') return undefined; // nunca expõe função
    current = value;
  }
  return current;
}

function isTruthy(v: ConditionValue): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  return v !== '';
}

type CmpOp = Extract<ConditionAst, { kind: 'cmp' }>['op'];

function compare(op: CmpOp, left: ConditionAst, right: ConditionAst, scope: Record<string, unknown>): boolean {
  const l = evalNode(left, scope);
  const r = evalNode(right, scope);
  // Igualdade: objetos nunca são iguais por identidade; undefined/ausência tratado explicitamente.
  if (op === '==') return l === r;
  if (op === '!=') return l !== r;
  // Ordenação com undefined → false (valor ausente não satisfaz limiar).
  if (l === undefined || r === undefined || l === null || r === null) return false;
  if (typeof l !== 'number' || typeof r !== 'number') {
    const a = String(l);
    const b = String(r);
    if (op === '>') return a > b;
    if (op === '<') return a < b;
    if (op === '>=') return a >= b;
    if (op === '<=') return a <= b;
  }
  if (op === '>') return l > r;
  if (op === '<') return l < r;
  if (op === '>=') return l >= r;
  return l <= r;
}

function evalNode(node: ConditionAst, scope: Record<string, unknown>): ConditionValue {
  switch (node.kind) {
    case 'num':
      return node.value;
    case 'str':
      return node.value;
    case 'bool':
      return node.value;
    case 'path':
      return resolvePath(scope, node.parts) as ConditionValue;
    case 'not':
      return !isTruthy(evalNode(node.operand, scope));
    case 'and':
      return isTruthy(evalNode(node.left, scope)) && isTruthy(evalNode(node.right, scope));
    case 'or':
      return isTruthy(evalNode(node.left, scope)) || isTruthy(evalNode(node.right, scope));
    case 'cmp':
      return compare(node.op, node.left, node.right, scope);
  }
}

/**
 * Avalia uma expressão de condição contra um escopo.
 * Expressão inválida (compile error) → exceção, para o validador capturar
 * como diagnóstico CAN-202. Escopo vazio para caminho inexistente → false
 * nas comparações (valor ausente não satisfaz limiar), exceto `!=`.
 */
export function evaluateCondition(expression: string, scope: Record<string, unknown>): boolean {
  const ast = compileCondition(expression);
  return isTruthy(evalNode(ast, scope));
}

/** `true` quando a expressão é sintaticamente válida (para validação estática). */
export function isValidCondition(expression: string): boolean {
  try {
    compileCondition(expression);
    return true;
  } catch {
    return false;
  }
}