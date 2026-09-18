/**
 * Catálogo de stacks de destino para artefatos gerados (Agent/Skill Factory).
 *
 * Quando um agente ou skill nasce com `stack` definida, ele carrega:
 * - capabilities específicas da stack (genome do agente);
 * - validação empírica obrigatória (ex.: `cargo clippy + cargo test`);
 * - guardrail anti-entrega-sem-verificação (RULES.md — evidência > afirmação).
 *
 * `all` é o default: artefato agnóstico de stack (vale para qualquer projeto).
 */

import type { Stack } from '../types.js';
import { STACKS } from '../types.js';

export interface StackMeta {
  label: string;
  /** Capacidades que a stack adiciona ao genome do agente. */
  capabilities: string[];
  /** Comando(s) de validação empírica exibidos no artefato gerado. */
  validation: string;
}

export const STACK_META: Record<Stack, StackMeta> = {
  ts: {
    label: 'TypeScript',
    capabilities: ['TypeScript estrito', 'Node/React/Next.js'],
    validation: 'npm run build + testes da stack',
  },
  go: {
    label: 'Go',
    capabilities: ['Go (goroutines, stdlib, interfaces)', 'go vet + go test'],
    validation: 'go vet ./... + go test ./...',
  },
  rust: {
    label: 'Rust',
    capabilities: ['Rust (ownership/borrow checker, cargo)', 'cargo clippy + cargo test'],
    validation: 'cargo clippy + cargo test',
  },
  python: {
    label: 'Python',
    capabilities: ['Python 3.10+', 'pytest + type hints'],
    validation: 'pytest + type check da stack',
  },
  all: {
    label: 'Todas (TS/Go/Rust/Python)',
    capabilities: ['Arquitetura poliglota (TS/Go/Rust/Python)', 'validação na stack do projeto'],
    validation: 'build/testes da stack do projeto',
  },
};

export function isValidStack(value: string): value is Stack {
  return (STACKS as readonly string[]).includes(value);
}

/** Capacidades extra de uma stack para enriquecer o genome do agente. */
export function stackCapabilities(stack?: Stack): string[] {
  if (!stack) return [];
  return STACK_META[stack].capabilities;
}

/** Validação empírica da stack (ex.: "cargo clippy + cargo test"). */
export function stackValidation(stack?: Stack): string {
  if (!stack) return '';
  return STACK_META[stack].validation;
}

/** Guardrails de validação para o genome do agente (anti-entrega-sem-evidência). */
export function stackGuardrails(stack?: Stack): string[] {
  if (!stack || stack === 'all') return [];
  return [`Entregar código ${STACK_META[stack].label} sem passar por ${STACK_META[stack].validation}`];
}