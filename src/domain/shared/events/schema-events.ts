import { DomainEvent, DomainEventFactory, EventTypes } from "./domain-event.ts";
import { ResolvedSchema } from "../../schema/entities/schema.ts";
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";

/**
 * Schema Context Domain Events
 *
 * Events emitted by the Schema Context following DDD event-driven architecture.
 * These events enable cross-context communication without violating domain boundaries.
 */

export interface SchemaLoadedEvent extends DomainEvent {
  readonly eventType: typeof EventTypes.SCHEMA_LOADED;
  readonly payload: {
    readonly schemaPath: string;
    readonly schema: ResolvedSchema;
  };
}

export interface ValidationRulesAvailableEvent extends DomainEvent {
  readonly eventType: typeof EventTypes.VALIDATION_RULES_AVAILABLE;
  readonly payload: {
    readonly schemaId: string;
    readonly validationRules: ValidationRules;
  };
}

export interface SchemaResolutionFailedEvent extends DomainEvent {
  readonly eventType: typeof EventTypes.SCHEMA_RESOLUTION_FAILED;
  readonly payload: {
    readonly schemaPath: string;
    readonly error: string;
  };
}

/**
 * Schema Event Factory
 *
 * Factory for creating schema-related domain events with proper typing.
 */
export class SchemaEventFactory {
  static createSchemaLoadedEvent(
    aggregateId: string,
    schemaPath: string,
    schema: ResolvedSchema,
  ): SchemaLoadedEvent {
    return DomainEventFactory.create(
      aggregateId,
      EventTypes.SCHEMA_LOADED,
      { schemaPath, schema },
    ) as SchemaLoadedEvent;
  }

  static createValidationRulesAvailableEvent(
    aggregateId: string,
    schemaId: string,
    validationRules: ValidationRules,
  ): ValidationRulesAvailableEvent {
    return DomainEventFactory.create(
      aggregateId,
      EventTypes.VALIDATION_RULES_AVAILABLE,
      { schemaId, validationRules },
    ) as ValidationRulesAvailableEvent;
  }

  static createSchemaResolutionFailedEvent(
    aggregateId: string,
    schemaPath: string,
    error: string,
  ): SchemaResolutionFailedEvent {
    return DomainEventFactory.create(
      aggregateId,
      EventTypes.SCHEMA_RESOLUTION_FAILED,
      { schemaPath, error },
    ) as SchemaResolutionFailedEvent;
  }
}
