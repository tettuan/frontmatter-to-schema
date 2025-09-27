import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { TemplateManagementDomainService } from "../../../../../src/domain/template/services/template-management-domain-service.ts";
import { MockFileReader } from "../../../../helpers/test-fixtures.ts";

describe("TemplateManagementDomainService - Basic Tests", () => {
  describe("Domain Service Creation", () => {
    it("should create service successfully with valid file reader", () => {
      const fileReader = new MockFileReader();

      const result = TemplateManagementDomainService.create(fileReader);

      assertEquals(result.ok, true);
      assertExists(result.ok && result.data);
    });

    it("should fail creation with invalid file reader", () => {
      const result = TemplateManagementDomainService.create(null as any);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ConfigurationError");
      }
    });
  });

  describe("Configuration Summary", () => {
    it("should provide configuration status", () => {
      const fileReader = new MockFileReader();

      const serviceResult = TemplateManagementDomainService.create(fileReader);
      assertEquals(serviceResult.ok, true);

      if (serviceResult.ok) {
        const service = serviceResult.data;

        // Should not have resolved configuration initially
        assertEquals(service.hasResolvedConfiguration(), false);

        // Configuration summary should fail when not extracted
        const summaryResult = service.getConfigurationSummary();
        assertEquals(summaryResult.ok, false);
      }
    });
  });
});
