import { assertEquals } from "jsr:@std/assert";
import {
  StructureTypeFactory,
  StructureTypeUtils,
} from "../../../../../src/domain/schema/value-objects/structure-type.ts";

/**
 * Comprehensive tests for StructureType value object and factory.
 * Tests the Totality principle implementation and smart constructor patterns.
 */
Deno.test("StructureType Value Object", async (t) => {
  await t.step("Registry structure type creation", () => {
    // Act
    const registryType = StructureTypeFactory.registry();

    // Assert
    assertEquals(registryType.kind, "registry");
    assertEquals(registryType.path, "tools.commands");
    assertEquals(registryType.description, "CLI command registry structure");
    assertEquals(StructureTypeUtils.isRegistry(registryType), true);
    assertEquals(StructureTypeUtils.isCollection(registryType), false);
    assertEquals(StructureTypeUtils.isCustom(registryType), false);
  });

  await t.step("Collection structure type creation - valid cases", () => {
    // Act
    const booksResult = StructureTypeFactory.collection(
      "books",
      "Books collection",
    );
    const articlesResult = StructureTypeFactory.collection("articles");

    // Assert
    assertEquals(booksResult.ok, true);
    if (!booksResult.ok) return;

    assertEquals(booksResult.data.kind, "collection");
    assertEquals(booksResult.data.path, "books");
    assertEquals(booksResult.data.description, "Books collection");
    assertEquals(StructureTypeUtils.isCollection(booksResult.data), true);

    assertEquals(articlesResult.ok, true);
    if (!articlesResult.ok) return;

    assertEquals(articlesResult.data.kind, "collection");
    assertEquals(articlesResult.data.path, "articles");
    assertEquals(
      articlesResult.data.description,
      "articles collection structure",
    );
  });

  await t.step("Collection structure type creation - invalid cases", () => {
    // Act
    const emptyResult = StructureTypeFactory.collection("");
    const invalidCharsResult = StructureTypeFactory.collection("books-list");
    const startWithNumberResult = StructureTypeFactory.collection("1books");

    // Assert
    assertEquals(emptyResult.ok, false);
    assertEquals(invalidCharsResult.ok, false);
    assertEquals(startWithNumberResult.ok, false);

    if (!emptyResult.ok) {
      assertEquals(emptyResult.error.kind, "InvalidSchema");
      assertEquals(
        emptyResult.error.message,
        "Invalid schema: Collection path cannot be empty",
      );
    }

    if (!invalidCharsResult.ok) {
      assertEquals(invalidCharsResult.error.kind, "InvalidSchema");
      assertEquals(
        invalidCharsResult.error.message.includes(
          "Invalid collection path format",
        ),
        true,
      );
    }
  });

  await t.step("Custom structure type creation - valid cases", () => {
    // Act
    const simpleResult = StructureTypeFactory.custom(
      "data",
      "Custom data structure",
    );
    const nestedResult = StructureTypeFactory.custom("content.items");

    // Assert
    assertEquals(simpleResult.ok, true);
    if (!simpleResult.ok) return;

    assertEquals(simpleResult.data.kind, "custom");
    assertEquals(simpleResult.data.path, "data");
    assertEquals(simpleResult.data.description, "Custom data structure");
    assertEquals(StructureTypeUtils.isCustom(simpleResult.data), true);

    assertEquals(nestedResult.ok, true);
    if (!nestedResult.ok) return;

    assertEquals(nestedResult.data.kind, "custom");
    assertEquals(nestedResult.data.path, "content.items");
    assertEquals(
      nestedResult.data.description,
      "Custom structure at content.items",
    );
  });

  await t.step("Custom structure type creation - invalid cases", () => {
    // Act
    const emptyResult = StructureTypeFactory.custom("");
    const invalidResult = StructureTypeFactory.custom("data.123invalid");

    // Assert
    assertEquals(emptyResult.ok, false);
    assertEquals(invalidResult.ok, false);

    if (!emptyResult.ok) {
      assertEquals(emptyResult.error.kind, "InvalidSchema");
      assertEquals(
        emptyResult.error.message,
        "Invalid schema: Custom path cannot be empty",
      );
    }
  });

  await t.step("Auto-detection from path", () => {
    // Act
    const registryResult = StructureTypeFactory.fromPath("tools.commands");
    const commandsResult = StructureTypeFactory.fromPath("commands");
    const booksResult = StructureTypeFactory.fromPath("books");
    const customResult = StructureTypeFactory.fromPath("data.content.items");

    // Assert
    assertEquals(registryResult.ok, true);
    if (registryResult.ok) {
      assertEquals(registryResult.data.kind, "registry");
    }

    assertEquals(commandsResult.ok, true);
    if (commandsResult.ok) {
      assertEquals(commandsResult.data.kind, "registry");
    }

    assertEquals(booksResult.ok, true);
    if (booksResult.ok) {
      assertEquals(booksResult.data.kind, "collection");
      assertEquals(booksResult.data.path, "books");
    }

    assertEquals(customResult.ok, true);
    if (customResult.ok) {
      assertEquals(customResult.data.kind, "custom");
      assertEquals(customResult.data.path, "data.content.items");
    }
  });

  await t.step("Utility functions", () => {
    // Arrange
    const registryType = StructureTypeFactory.registry();
    const booksResult = StructureTypeFactory.collection("books");
    const customResult = StructureTypeFactory.custom("data.items");

    if (!booksResult.ok || !customResult.ok) return;

    const booksType = booksResult.data;
    const customType = customResult.data;

    // Test path extraction
    assertEquals(StructureTypeUtils.getPath(registryType), "tools.commands");
    assertEquals(StructureTypeUtils.getPath(booksType), "books");
    assertEquals(StructureTypeUtils.getPath(customType), "data.items");

    // Test description extraction
    assertEquals(
      StructureTypeUtils.getDescription(registryType),
      "CLI command registry structure",
    );
    assertEquals(
      StructureTypeUtils.getDescription(booksType),
      "books collection structure",
    );

    // Test equality
    const anotherRegistry = StructureTypeFactory.registry();
    assertEquals(
      StructureTypeUtils.equals(registryType, anotherRegistry),
      true,
    );
    assertEquals(StructureTypeUtils.equals(registryType, booksType), false);

    // Test string representation
    const registryStr = StructureTypeUtils.toString(registryType);
    assertEquals(registryStr, "StructureType(registry:tools.commands)");

    const booksStr = StructureTypeUtils.toString(booksType);
    assertEquals(booksStr, "StructureType(collection:books)");
  });

  await t.step("Error path validation - empty path detection", () => {
    // Act
    const emptyPathResult = StructureTypeFactory.fromPath("");
    const whitespaceResult = StructureTypeFactory.fromPath("   ");

    // Assert
    assertEquals(emptyPathResult.ok, false);
    assertEquals(whitespaceResult.ok, false);

    if (!emptyPathResult.ok) {
      assertEquals(emptyPathResult.error.kind, "InvalidSchema");
      assertEquals(
        emptyPathResult.error.message,
        "Invalid schema: Path cannot be empty for structure type detection",
      );
    }
  });
});
