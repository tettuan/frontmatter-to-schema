/**
 * Template Management Domain
 *
 * Public API for the template bounded context
 */

// Core exports
export { TemplateAggregate } from "./aggregate.ts";
export type { TemplateApplicationContext } from "./aggregate.ts";

// Repository exports
export type { TemplateRepository } from "./repository.ts";
export { TemplatePath } from "./repository.ts";

// Event exports
export {
  TemplateAppliedEvent,
  TemplateLoadedEvent,
  TemplateProcessingFailedEvent,
} from "./events.ts";
export type {
  DomainEvent,
  EventStore,
  TemplateEventHandler,
} from "./events.ts";

// Strategy exports
export {
  AITemplateStrategy,
  CompositeTemplateStrategy,
  NativeTemplateStrategy,
} from "./strategies.ts";
export type { TemplateProcessingStrategy } from "./strategies.ts";

// Service exports
export { createTemplateService, TemplateProcessingService } from "./service.ts";
export type { TemplateServiceConfig } from "./service.ts";
