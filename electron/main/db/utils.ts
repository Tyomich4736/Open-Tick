import { randomUUID } from 'crypto'

export function nowIso(): string {
  return new Date().toISOString()
}

export function newId(): string {
  return randomUUID()
}

export function asBool(value: number | boolean | null | undefined): boolean {
  return value === 1 || value === true
}

export function toInt(value: boolean): number {
  return value ? 1 : 0
}
