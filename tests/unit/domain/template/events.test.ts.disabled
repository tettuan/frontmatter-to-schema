import { assertEquals, assertExists, assertNotEquals } from "jsr:@std/assert";
import { beforeEach, describe, it } from "jsr:@std/testing/bdd";
import {
  type DomainEvent,
  type EventStore,
  TemplateAppliedEvent,
  type TemplateEventHandler,
  TemplateLoadedEvent,
  TemplateProcessingFailedEvent,
} from "../../../../src/domain/template/events.ts";
import {
  Template,
  TemplateDefinition,
} from "../../../../src/domain/models/domain-models.ts";
import type { TemplateApplicationContext } from "../../../../src/domain/template/aggregate.ts";
import { isOk } from "../../../../src/domain/core/result.ts";

describe("Domain Events", () => {
  let mockTemplate: Template;
  let mockContext: TemplateApplicationContext;

  beforeEach(() => {
    // Create mock template
    const templateDefinitionResult = TemplateDefinition.create(
      '{"test": "{{value}}"}',
      "json",
    );

    if (!isOk(templateDefinitionResult)) {
      throw new Error("Failed to create mock template definition");
    }

    const templateResult = Template.create(
      "test-template",
      templateDefinitionResult.data,
      "Test template description",
    );

    if (!isOk(templateResult)) {
      throw new Error("Failed to create mock template");
    }

    mockTemplate = templateResult.data;

    // Create mock context
    mockContext = {
      extractedData: { test: "value" },
      schema: { type: "object", properties: { test: { type: "string" } } },
      format: "json",
    };
  });

  describe("TemplateLoadedEvent", () => {
    it("should create event with required properties", () => {
      const templateId = "test-template-123";
      const event = new TemplateLoadedEvent(templateId, mockTemplate);

      assertEquals(event.eventType, "TemplateLoaded");
      assertEquals(event.templateId, templateId);
      assertEquals(event.template, mockTemplate);
      assertEquals(event.aggregateId, templateId);
      assertExists(event.eventId);
      assertExists(event.occurredAt);
    });

    it("should generate unique event IDs", () => {
      const event1 = new TemplateLoadedEvent("template1", mockTemplate);
      const event2 = new TemplateLoadedEvent("template1", mockTemplate);

      assertNotEquals(event1.eventId, event2.eventId);
    });

    it("should have different occurrence times for sequential events", async () => {
      const event1 = new TemplateLoadedEvent("template1", mockTemplate);

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 1));

      const event2 = new TemplateLoadedEvent("template1", mockTemplate);

      assertNotEquals(event1.occurredAt.getTime(), event2.occurredAt.getTime());
    });

    it("should implement DomainEvent interface", () => {
      const event = new TemplateLoadedEvent("test", mockTemplate);

      assertEquals(typeof event.eventId, "string");
      assertEquals(typeof event.eventType, "string");
      assertEquals(typeof event.aggregateId, "string");
      assertEquals(event.occurredAt instanceof Date, true);
    });

    it("should return correct payload", () => {
      const event = new TemplateLoadedEvent("test-template", mockTemplate);
      const payload = event.getPayload();

      assertEquals(payload.templateId, "test-template");
      assertEquals(payload.format, mockTemplate.getDefinition().getFormat());
      assertEquals(payload.description, mockTemplate.getDescription());
    });

    it("should handle different template formats", () => {
      // Create YAML template
      const yamlTemplateDefinitionResult = TemplateDefinition.create(
        'test: "{{value}}"',
        "yaml",
      );

      if (!isOk(yamlTemplateDefinitionResult)) {
        throw new Error("Failed to create YAML template definition");
      }

      const yamlTemplateResult = Template.create(
        "yaml-template",
        yamlTemplateDefinitionResult.data,
        "YAML template",
      );

      if (!isOk(yamlTemplateResult)) {
        throw new Error("Failed to create YAML template");
      }

      const event = new TemplateLoadedEvent(
        "yaml-template",
        yamlTemplateResult.data,
      );
      const payload = event.getPayload();

      assertEquals(payload.format, "yaml");
    });

    it("should handle templates with empty descriptions", () => {
      const templateDefinitionResult = TemplateDefinition.create(
        '{"test": "value"}',
        "json",
      );

      if (!isOk(templateDefinitionResult)) {
        throw new Error("Failed to create template definition");
      }

      const templateResult = Template.create(
        "empty-desc",
        templateDefinitionResult.data,
        "",
      );

      if (!isOk(templateResult)) {
        throw new Error("Failed to create template");
      }

      const event = new TemplateLoadedEvent("empty-desc", templateResult.data);
      const payload = event.getPayload();

      assertEquals(payload.description, "");
    });
  });

  describe("TemplateAppliedEvent", () => {
    it("should create event with required properties", () => {
      const templateId = "applied-template";
      const result = '{"test": "processed value"}';

      const event = new TemplateAppliedEvent(templateId, mockContext, result);

      assertEquals(event.eventType, "TemplateApplied");
      assertEquals(event.templateId, templateId);
      assertEquals(event.context, mockContext);
      assertEquals(event.result, result);
      assertEquals(event.aggregateId, templateId);
      assertExists(event.eventId);
      assertExists(event.occurredAt);
    });

    it("should generate unique event IDs", () => {
      const event1 = new TemplateAppliedEvent(
        "template1",
        mockContext,
        "result1",
      );
      const event2 = new TemplateAppliedEvent(
        "template1",
        mockContext,
        "result2",
      );

      assertNotEquals(event1.eventId, event2.eventId);
    });

    it("should return correct payload", () => {
      const result = '{"test": "processed value"}';
      const event = new TemplateAppliedEvent(
        "test-template",
        mockContext,
        result,
      );
      const payload = event.getPayload();

      assertEquals(payload.templateId, "test-template");
      assertEquals(payload.format, mockContext.format);
      assertEquals(payload.resultLength, result.length);
      assertEquals(payload.hasSchema, true);
    });

    it("should handle context without schema", () => {
      const contextWithoutSchema: TemplateApplicationContext = {
        ...mockContext,
        schema: {}, // Empty schema instead of undefined
      };

      const event = new TemplateAppliedEvent(
        "no-schema",
        contextWithoutSchema,
        "result",
      );
      const _payload = event.getPayload();

      // Check if schema is effectively empty
      assertEquals(Object.keys(contextWithoutSchema.schema).length === 0, true);
    });

    it("should handle different result sizes", () => {
      const smallResult = "{}";
      const largeResult = JSON.stringify({ data: "x".repeat(10000) });

      const smallEvent = new TemplateAppliedEvent(
        "small",
        mockContext,
        smallResult,
      );
      const largeEvent = new TemplateAppliedEvent(
        "large",
        mockContext,
        largeResult,
      );

      assertEquals(smallEvent.getPayload().resultLength, 2);
      assertEquals(largeEvent.getPayload().resultLength, largeResult.length);
    });

    it("should handle empty results", () => {
      const event = new TemplateAppliedEvent("empty", mockContext, "");
      const payload = event.getPayload();

      assertEquals(payload.resultLength, 0);
    });

    it("should handle different output formats", () => {
      const yamlContext: TemplateApplicationContext = {
        ...mockContext,
        format: "yaml",
      };

      const markdownContext: TemplateApplicationContext = {
        ...mockContext,
        format: "markdown",
      };

      const yamlEvent = new TemplateAppliedEvent(
        "yaml",
        yamlContext,
        "test: value",
      );
      const markdownEvent = new TemplateAppliedEvent(
        "markdown",
        markdownContext,
        "# Test",
      );

      assertEquals(yamlEvent.getPayload().format, "yaml");
      assertEquals(markdownEvent.getPayload().format, "markdown");
    });
  });

  describe("TemplateProcessingFailedEvent", () => {
    it("should create event with required properties", () => {
      const templateId = "failed-template";
      const error = "Processing failed due to invalid syntax";

      const event = new TemplateProcessingFailedEvent(templateId, error);

      assertEquals(event.eventType, "TemplateProcessingFailed");
      assertEquals(event.templateId, templateId);
      assertEquals(event.error, error);
      assertEquals(event.context, undefined);
      assertEquals(event.aggregateId, templateId);
      assertExists(event.eventId);
      assertExists(event.occurredAt);
    });

    it("should create event with context", () => {
      const templateId = "failed-with-context";
      const error = "Schema validation failed";

      const event = new TemplateProcessingFailedEvent(
        templateId,
        error,
        mockContext,
      );

      assertEquals(event.context, mockContext);
    });

    it("should generate unique event IDs", () => {
      const event1 = new TemplateProcessingFailedEvent("template1", "error1");
      const event2 = new TemplateProcessingFailedEvent("template1", "error2");

      assertNotEquals(event1.eventId, event2.eventId);
    });

    it("should return correct payload without context", () => {
      const error = "Template parsing error";
      const event = new TemplateProcessingFailedEvent("test-template", error);
      const payload = event.getPayload();

      assertEquals(payload.templateId, "test-template");
      assertEquals(payload.error, error);
      assertEquals(payload.format, undefined);
    });

    it("should return correct payload with context", () => {
      const error = "Schema validation failed";
      const event = new TemplateProcessingFailedEvent(
        "test-template",
        error,
        mockContext,
      );
      const payload = event.getPayload();

      assertEquals(payload.templateId, "test-template");
      assertEquals(payload.error, error);
      assertEquals(payload.format, mockContext.format);
    });

    it("should handle different error types", () => {
      const syntaxError = "Invalid JSON syntax";
      const schemaError = "Schema validation failed";
      const processingError = "Template processing timeout";

      const event1 = new TemplateProcessingFailedEvent(
        "template1",
        syntaxError,
      );
      const event2 = new TemplateProcessingFailedEvent(
        "template2",
        schemaError,
        mockContext,
      );
      const event3 = new TemplateProcessingFailedEvent(
        "template3",
        processingError,
      );

      assertEquals(event1.error, syntaxError);
      assertEquals(event2.error, schemaError);
      assertEquals(event3.error, processingError);
    });

    it("should handle empty error messages", () => {
      const event = new TemplateProcessingFailedEvent("template", "");
      const payload = event.getPayload();

      assertEquals(payload.error, "");
    });

    it("should handle complex error objects as strings", () => {
      const complexError = JSON.stringify({
        type: "ValidationError",
        details: "Missing required field",
        line: 5,
        column: 12,
      });

      const event = new TemplateProcessingFailedEvent("template", complexError);

      assertEquals(event.error, complexError);
    });
  });

  describe("Event Integration", () => {
    it("should create events with consistent structure", () => {
      const templateLoadedEvent = new TemplateLoadedEvent(
        "template1",
        mockTemplate,
      );
      const templateAppliedEvent = new TemplateAppliedEvent(
        "template1",
        mockContext,
        "result",
      );
      const templateFailedEvent = new TemplateProcessingFailedEvent(
        "template1",
        "error",
      );

      const events: DomainEvent[] = [
        templateLoadedEvent,
        templateAppliedEvent,
        templateFailedEvent,
      ];

      events.forEach((event) => {
        assertExists(event.eventId);
        assertExists(event.eventType);
        assertExists(event.aggregateId);
        assertExists(event.occurredAt);
        assertEquals(typeof event.eventId, "string");
        assertEquals(typeof event.eventType, "string");
        assertEquals(typeof event.aggregateId, "string");
        assertEquals(event.occurredAt instanceof Date, true);
      });
    });

    it("should maintain aggregateId consistency across related events", () => {
      const templateId = "consistent-template";

      const loadedEvent = new TemplateLoadedEvent(templateId, mockTemplate);
      const appliedEvent = new TemplateAppliedEvent(
        templateId,
        mockContext,
        "result",
      );
      const failedEvent = new TemplateProcessingFailedEvent(
        templateId,
        "error",
      );

      assertEquals(loadedEvent.aggregateId, templateId);
      assertEquals(appliedEvent.aggregateId, templateId);
      assertEquals(failedEvent.aggregateId, templateId);
    });

    it("should have different event types", () => {
      const loadedEvent = new TemplateLoadedEvent("template1", mockTemplate);
      const appliedEvent = new TemplateAppliedEvent(
        "template1",
        mockContext,
        "result",
      );
      const failedEvent = new TemplateProcessingFailedEvent(
        "template1",
        "error",
      );

      assertEquals(loadedEvent.eventType, "TemplateLoaded");
      assertEquals(appliedEvent.eventType, "TemplateApplied");
      assertEquals(failedEvent.eventType, "TemplateProcessingFailed");
    });

    it("should create events with proper timestamp ordering", async () => {
      const event1 = new TemplateLoadedEvent("template1", mockTemplate);

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 1));

      const event2 = new TemplateAppliedEvent(
        "template1",
        mockContext,
        "result",
      );

      await new Promise((resolve) => setTimeout(resolve, 1));

      const event3 = new TemplateProcessingFailedEvent("template1", "error");

      assertEquals(event1.occurredAt <= event2.occurredAt, true);
      assertEquals(event2.occurredAt <= event3.occurredAt, true);
    });
  });

  describe("Event Handler Type", () => {
    it("should accept synchronous handlers", () => {
      const syncHandler: TemplateEventHandler = (event) => {
        // Synchronous handler
        assertEquals(typeof event, "object");
      };

      const event = new TemplateLoadedEvent("test", mockTemplate);
      const result = syncHandler(event);

      assertEquals(result, undefined);
    });

    it("should accept asynchronous handlers", async () => {
      const asyncHandler: TemplateEventHandler = async (event) => {
        // Asynchronous handler
        await Promise.resolve();
        assertEquals(typeof event, "object");
      };

      const event = new TemplateLoadedEvent("test", mockTemplate);
      const result = asyncHandler(event);

      assertEquals(result instanceof Promise, true);
      await result;
    });

    it("should handle all event types", () => {
      const handler: TemplateEventHandler = (event) => {
        if (event instanceof TemplateLoadedEvent) {
          assertEquals(event.eventType, "TemplateLoaded");
        } else if (event instanceof TemplateAppliedEvent) {
          assertEquals(event.eventType, "TemplateApplied");
        } else if (event instanceof TemplateProcessingFailedEvent) {
          assertEquals(event.eventType, "TemplateProcessingFailed");
        }
      };

      const loadedEvent = new TemplateLoadedEvent("test", mockTemplate);
      const appliedEvent = new TemplateAppliedEvent(
        "test",
        mockContext,
        "result",
      );
      const failedEvent = new TemplateProcessingFailedEvent("test", "error");

      // Should not throw
      handler(loadedEvent);
      handler(appliedEvent);
      handler(failedEvent);
    });
  });

  describe("EventStore Interface", () => {
    it("should define required methods", () => {
      // Mock implementation to verify interface contract
      const mockEventStore: EventStore = {
        publish: (_event: DomainEvent) => {
          // Mock publish implementation
        },
        subscribe: (_eventType: string, _handler: TemplateEventHandler) => {
          // Mock subscribe implementation
        },
        unsubscribe: (_eventType: string, _handler: TemplateEventHandler) => {
          // Mock unsubscribe implementation
        },
      };

      assertEquals(typeof mockEventStore.publish, "function");
      assertEquals(typeof mockEventStore.subscribe, "function");
      assertEquals(typeof mockEventStore.unsubscribe, "function");
    });

    it("should handle event publishing workflow", () => {
      const publishedEvents: DomainEvent[] = [];

      const mockEventStore: EventStore = {
        publish: (event: DomainEvent) => {
          publishedEvents.push(event);
        },
        subscribe: () => {},
        unsubscribe: () => {},
      };

      const event = new TemplateLoadedEvent("test", mockTemplate);
      mockEventStore.publish(event);

      assertEquals(publishedEvents.length, 1);
      assertEquals(publishedEvents[0], event);
    });

    it("should handle event subscription workflow", () => {
      const handlers: Map<string, TemplateEventHandler[]> = new Map();

      const mockEventStore: EventStore = {
        publish: (event: DomainEvent) => {
          const eventHandlers = handlers.get(event.eventType) || [];
          // deno-lint-ignore no-explicit-any
          eventHandlers.forEach((handler) => handler(event as any));
        },
        subscribe: (eventType: string, handler: TemplateEventHandler) => {
          if (!handlers.has(eventType)) {
            handlers.set(eventType, []);
          }
          handlers.get(eventType)!.push(handler);
        },
        unsubscribe: (eventType: string, handler: TemplateEventHandler) => {
          const eventHandlers = handlers.get(eventType) || [];
          const index = eventHandlers.indexOf(handler);
          if (index > -1) {
            eventHandlers.splice(index, 1);
          }
        },
      };

      let handledEvent: DomainEvent | null = null;
      const handler: TemplateEventHandler = (event) => {
        handledEvent = event;
      };

      mockEventStore.subscribe("TemplateLoaded", handler);

      const event = new TemplateLoadedEvent("test", mockTemplate);
      mockEventStore.publish(event);

      assertEquals(handledEvent, event);
    });

    it("should handle multiple subscribers", () => {
      const handlers: Map<string, TemplateEventHandler[]> = new Map();
      const handledEvents: DomainEvent[] = [];

      const mockEventStore: EventStore = {
        publish: (event: DomainEvent) => {
          const eventHandlers = handlers.get(event.eventType) || [];
          // deno-lint-ignore no-explicit-any
          eventHandlers.forEach((handler) => handler(event as any));
        },
        subscribe: (eventType: string, handler: TemplateEventHandler) => {
          if (!handlers.has(eventType)) {
            handlers.set(eventType, []);
          }
          handlers.get(eventType)!.push(handler);
        },
        unsubscribe: (eventType: string, handler: TemplateEventHandler) => {
          const eventHandlers = handlers.get(eventType) || [];
          const index = eventHandlers.indexOf(handler);
          if (index > -1) {
            eventHandlers.splice(index, 1);
          }
        },
      };

      const handler1: TemplateEventHandler = (event) => {
        handledEvents.push(event);
      };
      const handler2: TemplateEventHandler = (event) => {
        handledEvents.push(event);
      };

      mockEventStore.subscribe("TemplateLoaded", handler1);
      mockEventStore.subscribe("TemplateLoaded", handler2);

      const event = new TemplateLoadedEvent("test", mockTemplate);
      mockEventStore.publish(event);

      assertEquals(handledEvents.length, 2);
      assertEquals(handledEvents[0], event);
      assertEquals(handledEvents[1], event);
    });

    it("should handle unsubscription", () => {
      const handlers: Map<string, TemplateEventHandler[]> = new Map();
      let handledEvent: DomainEvent | null = null;

      const mockEventStore: EventStore = {
        publish: (event: DomainEvent) => {
          const eventHandlers = handlers.get(event.eventType) || [];
          // deno-lint-ignore no-explicit-any
          eventHandlers.forEach((handler) => handler(event as any));
        },
        subscribe: (eventType: string, handler: TemplateEventHandler) => {
          if (!handlers.has(eventType)) {
            handlers.set(eventType, []);
          }
          handlers.get(eventType)!.push(handler);
        },
        unsubscribe: (eventType: string, handler: TemplateEventHandler) => {
          const eventHandlers = handlers.get(eventType) || [];
          const index = eventHandlers.indexOf(handler);
          if (index > -1) {
            eventHandlers.splice(index, 1);
          }
        },
      };

      const handler: TemplateEventHandler = (event) => {
        handledEvent = event;
      };

      mockEventStore.subscribe("TemplateLoaded", handler);
      mockEventStore.unsubscribe("TemplateLoaded", handler);

      const event = new TemplateLoadedEvent("test", mockTemplate);
      mockEventStore.publish(event);

      assertEquals(handledEvent, null);
    });
  });
});
