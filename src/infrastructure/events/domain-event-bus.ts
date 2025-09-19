import { err, ok, Result } from "../../domain/shared/types/result.ts";
import { DomainError } from "../../domain/shared/types/errors.ts";
import {
  DomainEvent,
  DomainEventBus,
  EventHandler,
} from "../../domain/shared/events/domain-event.ts";

/**
 * In-Memory Domain Event Bus Implementation
 *
 * Simple synchronous implementation for the frontmatter-to-schema domain events.
 * Follows DDD event-driven architecture principles while maintaining simplicity.
 */
export class InMemoryDomainEventBus implements DomainEventBus {
  private handlers = new Map<string, EventHandler<DomainEvent>[]>();
  private eventHistory = new Map<string, DomainEvent[]>();
  private isRunning = false;

  start(): Promise<Result<void, DomainError>> {
    if (this.isRunning) {
      return Promise.resolve(
        err({
          kind: "ConfigurationError",
          message: "Event bus is already running",
        }),
      );
    }

    this.isRunning = true;
    return Promise.resolve(ok(undefined));
  }

  stop(): Promise<Result<void, DomainError>> {
    if (!this.isRunning) {
      return Promise.resolve(
        err({
          kind: "ConfigurationError",
          message: "Event bus is not running",
        }),
      );
    }

    this.isRunning = false;
    this.handlers.clear();
    this.eventHistory.clear();
    return Promise.resolve(ok(undefined));
  }

  async publish<T extends DomainEvent>(
    event: T,
  ): Promise<Result<void, DomainError>> {
    if (!this.isRunning) {
      return err({
        kind: "ConfigurationError",
        message: "Event bus is not running",
      });
    }

    // Store event in history
    const aggregateEvents = this.eventHistory.get(event.aggregateId) || [];
    aggregateEvents.push(event);
    this.eventHistory.set(event.aggregateId, aggregateEvents);

    // Get handlers for this event type
    const eventHandlers = this.handlers.get(event.eventType) || [];

    // Execute all handlers synchronously
    for (const handler of eventHandlers) {
      if (handler.canHandle(event.eventType)) {
        const result = await handler.handle(event);
        if (!result.ok) {
          return err({
            kind: "InitializationError",
            message: `Event handler failed: ${JSON.stringify(result.error)}`,
          });
        }
      }
    }

    return ok(undefined);
  }

  async publishAll(events: DomainEvent[]): Promise<Result<void, DomainError>> {
    for (const event of events) {
      const result = await this.publish(event);
      if (!result.ok) {
        return result;
      }
    }

    return ok(undefined);
  }

  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>,
  ): Promise<Result<void, DomainError>> {
    if (!this.isRunning) {
      return Promise.resolve(
        err({
          kind: "ConfigurationError",
          message: "Event bus is not running",
        }),
      );
    }

    const currentHandlers = this.handlers.get(eventType) || [];
    currentHandlers.push(handler as EventHandler<DomainEvent>);
    this.handlers.set(eventType, currentHandlers);

    return Promise.resolve(ok(undefined));
  }

  unsubscribe(
    eventType: string,
    handlerId: string,
  ): Promise<Result<void, DomainError>> {
    const currentHandlers = this.handlers.get(eventType) || [];
    const filteredHandlers = currentHandlers.filter((handler) => {
      // Simple ID-based filtering - in a real implementation, this would be more sophisticated
      return (handler as any).id !== handlerId;
    });

    this.handlers.set(eventType, filteredHandlers);
    return Promise.resolve(ok(undefined));
  }

  getEventHistory(
    aggregateId: string,
  ): Promise<Result<DomainEvent[], DomainError>> {
    if (!this.isRunning) {
      return Promise.resolve(
        err({
          kind: "ConfigurationError",
          message: "Event bus is not running",
        }),
      );
    }

    const events = this.eventHistory.get(aggregateId) || [];
    return Promise.resolve(ok([...events])); // Return copy to prevent mutation
  }
}
