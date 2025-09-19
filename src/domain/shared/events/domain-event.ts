import { Result } from "../types/result.ts";
import { DomainError } from "../types/errors.ts";

/**
 * Domain Event Base Types - DDD Event System
 *
 * Implements domain event infrastructure following DDD principles for
 * cross-context communication as designed in domain-boundary.md
 */

export interface DomainEvent {
  readonly aggregateId: string;
  readonly eventId: string;
  readonly eventType: string;
  readonly occurredAt: Date;
  readonly payload: Record<string, unknown>;
  readonly version: number;
}

export interface EventHandler<T extends DomainEvent> {
  handle(event: T): Promise<Result<void, DomainError>>;
  canHandle(eventType: string): boolean;
}

export interface EventPublisher {
  publish<T extends DomainEvent>(event: T): Promise<Result<void, DomainError>>;
  publishAll(events: DomainEvent[]): Promise<Result<void, DomainError>>;
}

export interface EventSubscriber {
  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>,
  ): Promise<Result<void, DomainError>>;
  unsubscribe(
    eventType: string,
    handlerId: string,
  ): Promise<Result<void, DomainError>>;
}

/**
 * Domain Event Bus - Central event coordination
 *
 * Following the event-driven architecture principle from domain-boundary.md:
 * "コンテキスト間の協調はイベントベースで行う"
 */
export interface DomainEventBus extends EventPublisher, EventSubscriber {
  start(): Promise<Result<void, DomainError>>;
  stop(): Promise<Result<void, DomainError>>;
  getEventHistory(
    aggregateId: string,
  ): Promise<Result<DomainEvent[], DomainError>>;
}

/**
 * Event Factory for creating properly structured domain events
 */
export class DomainEventFactory {
  static create<T extends Record<string, unknown>>(
    aggregateId: string,
    eventType: string,
    payload: T,
    version: number = 1,
  ): DomainEvent {
    return {
      aggregateId,
      eventId: crypto.randomUUID(),
      eventType,
      occurredAt: new Date(),
      payload,
      version,
    };
  }
}

/**
 * Event Types Registry
 *
 * Centralized registry for all domain event types to prevent typos
 * and ensure consistency across contexts
 */
export const EventTypes = {
  // Schema Context Events
  SCHEMA_LOADED: "schema.loaded",
  VALIDATION_RULES_AVAILABLE: "schema.validation-rules-available",
  SCHEMA_RESOLUTION_FAILED: "schema.resolution-failed",

  // Frontmatter Context Events
  DATA_VALIDATED: "frontmatter.data-validated",
  READY_FOR_RENDERING: "frontmatter.ready-for-rendering",
  FRONTMATTER_EXTRACTION_FAILED: "frontmatter.extraction-failed",

  // Template Context Events
  TEMPLATE_LOADED: "template.loaded",
  RENDERING_COMPLETED: "template.rendering-completed",
  TEMPLATE_RENDER_FAILED: "template.render-failed",

  // Aggregation Context Events
  ALL_DATA_PROCESSED: "aggregation.all-data-processed",
  READY_FOR_AGGREGATION: "aggregation.ready-for-aggregation",
  AGGREGATION_COMPLETE: "aggregation.complete",
  FINAL_RENDERING_READY: "aggregation.final-rendering-ready",

  // Pipeline Events
  PIPELINE_STARTED: "pipeline.started",
  PIPELINE_COMPLETED: "pipeline.completed",
  PIPELINE_FAILED: "pipeline.failed",
} as const;

export type EventType = typeof EventTypes[keyof typeof EventTypes];
