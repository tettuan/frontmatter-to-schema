export * from "./result.ts";
export * from "./errors.ts";
export * from "./error-context.ts";

export interface DomainEvent {
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly eventType: string;
  readonly payload: unknown;
}

export interface BoundaryInterface<T, U, E> {
  execute(input: T): Result<U, E>;
}

export interface ContextPort<T> {
  publish(event: DomainEvent): void;
  subscribe(handler: (event: DomainEvent) => void): void;
  query(id: string): Result<T, QueryError>;
}

export type QueryError = {
  readonly kind: "NotFound";
  readonly id: string;
} | {
  readonly kind: "QueryFailed";
  readonly message: string;
};

import type { Result } from "./result.ts";
