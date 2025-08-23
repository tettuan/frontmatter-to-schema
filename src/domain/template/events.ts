/**
 * Domain Events for Template Management Domain
 *
 * Following event-driven architecture from docs/domain/domain-boundary.md
 * These events enable loose coupling between domains
 */

import type { Template } from "../models/template.ts";
import type { TemplateApplicationContext } from "./aggregate.ts";

/**
 * Base interface for all domain events
 */
export interface DomainEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  occurredAt: Date;
}

/**
 * Event emitted when a template is loaded
 */
export class TemplateLoadedEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType = "TemplateLoaded";
  readonly aggregateId: string;
  readonly occurredAt: Date;

  constructor(
    public readonly templateId: string,
    public readonly template: Template,
  ) {
    this.eventId = crypto.randomUUID();
    this.aggregateId = templateId;
    this.occurredAt = new Date();
  }

  getPayload() {
    return {
      templateId: this.templateId,
      format: this.template.getDefinition().getFormat(),
      description: this.template.getDescription(),
    };
  }
}

/**
 * Event emitted when a template is successfully applied
 */
export class TemplateAppliedEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType = "TemplateApplied";
  readonly aggregateId: string;
  readonly occurredAt: Date;

  constructor(
    public readonly templateId: string,
    public readonly context: TemplateApplicationContext,
    public readonly result: string,
  ) {
    this.eventId = crypto.randomUUID();
    this.aggregateId = templateId;
    this.occurredAt = new Date();
  }

  getPayload() {
    return {
      templateId: this.templateId,
      format: this.context.format,
      resultLength: this.result.length,
      hasSchema: !!this.context.schema,
    };
  }
}

/**
 * Event emitted when template processing fails
 */
export class TemplateProcessingFailedEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType = "TemplateProcessingFailed";
  readonly aggregateId: string;
  readonly occurredAt: Date;

  constructor(
    public readonly templateId: string,
    public readonly error: string,
    public readonly context?: TemplateApplicationContext,
  ) {
    this.eventId = crypto.randomUUID();
    this.aggregateId = templateId;
    this.occurredAt = new Date();
  }

  getPayload() {
    return {
      templateId: this.templateId,
      error: this.error,
      format: this.context?.format,
    };
  }
}

/**
 * Event handler interface for template events
 */
export type TemplateEventHandler = (
  event:
    | TemplateLoadedEvent
    | TemplateAppliedEvent
    | TemplateProcessingFailedEvent,
) => void | Promise<void>;

/**
 * Event store interface for publishing and subscribing to events
 */
export interface EventStore {
  publish(event: DomainEvent): void;
  subscribe(eventType: string, handler: TemplateEventHandler): void;
  unsubscribe(eventType: string, handler: TemplateEventHandler): void;
}
