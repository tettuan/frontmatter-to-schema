import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { FrontmatterAnalysisDomainService } from "../../src/domain/frontmatter/services/frontmatter-analysis-domain-service.ts";
import { DataProcessingInstructionDomainService } from "../../src/domain/data-processing/services/data-processing-instruction-domain-service.ts";
import { TemplateManagementDomainService } from "../../src/domain/template/services/template-management-domain-service.ts";
import {
  createBasicSchema,
  MockFileLister,
  MockFileReader,
} from "../helpers/test-fixtures.ts";

describe("Basic Service Integration Tests", () => {
  describe("Service Creation Integration", () => {
    it("should create all domain services successfully", () => {
      const fileReader = new MockFileReader();
      const fileLister = new MockFileLister();

      // Create all three domain services
      const frontmatterService = FrontmatterAnalysisDomainService.create(
        fileReader,
        fileLister,
      );
      const dataProcessingService = DataProcessingInstructionDomainService
        .create();
      const templateService = TemplateManagementDomainService.create(
        fileReader,
      );

      assertEquals(frontmatterService.ok, true);
      assertEquals(dataProcessingService.ok, true);
      assertEquals(templateService.ok, true);

      // Verify services are properly instantiated
      assertExists(frontmatterService.ok && frontmatterService.data);
      assertExists(dataProcessingService.ok && dataProcessingService.data);
      assertExists(templateService.ok && templateService.data);
    });

    it("should handle schema creation and validation", () => {
      const schemaResult = createBasicSchema();

      assertEquals(schemaResult.ok, true);
      assertExists(schemaResult.ok && schemaResult.data);

      if (schemaResult.ok) {
        const schema = schemaResult.data;

        // Verify schema has required methods
        assertExists(schema.getRawSchema);

        // Verify schema data structure
        const rawSchema = schema.getRawSchema();
        assertExists(rawSchema);
      }
    });
  });

  describe("Simple Domain Boundary Validation", () => {
    it("should maintain service isolation", () => {
      const fileReader = new MockFileReader();
      const fileLister = new MockFileLister();

      const frontmatterService = FrontmatterAnalysisDomainService.create(
        fileReader,
        fileLister,
      );
      const dataProcessingService = DataProcessingInstructionDomainService
        .create();

      assertEquals(frontmatterService.ok, true);
      assertEquals(dataProcessingService.ok, true);

      if (frontmatterService.ok && dataProcessingService.ok) {
        // Services should be independent instances
        assertEquals(typeof frontmatterService.data, "object");
        assertEquals(typeof dataProcessingService.data, "object");

        // Each service should maintain its own state
        assertEquals(frontmatterService.data.hasExtractedData(), false);
        // Data processing service starts without initialized data
        const testDataAccess = dataProcessingService.data.getProcessedData(
          "test",
        );
        assertEquals(testDataAccess.ok, false);
      }
    });
  });
});
