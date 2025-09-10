import { assertEquals } from "jsr:@std/assert";
import {
  ConfigurableFormatDetector,
  FormatDetectorFactory,
} from "./file-format-detector.ts";

Deno.test("FormatDetector - Smart Constructor", () => {
  const result = ConfigurableFormatDetector.create();
  assertEquals(result.ok, true);
});

Deno.test("FormatDetector - JSON Detection", () => {
  const result = ConfigurableFormatDetector.create();
  assertEquals(result.ok, true);
  if (!result.ok) return;

  const detector = result.data;
  const formatResult = detector.detectFormat("schema.json");
  assertEquals(formatResult.ok, true);
  if (formatResult.ok) {
    assertEquals(formatResult.data, "json");
  }
});

Deno.test("FormatDetector - YAML Detection", () => {
  const result = ConfigurableFormatDetector.create();
  assertEquals(result.ok, true);
  if (!result.ok) return;

  const detector = result.data;
  const yamlResult = detector.detectFormat("template.yaml");
  assertEquals(yamlResult.ok, true);
  if (yamlResult.ok) {
    assertEquals(yamlResult.data, "yaml");
  }
});

Deno.test("FormatDetector - Default Format", () => {
  const result = ConfigurableFormatDetector.create();
  assertEquals(result.ok, true);
  if (!result.ok) return;

  const detector = result.data;
  const noExtResult = detector.detectFormat("README");
  assertEquals(noExtResult.ok, true);
  if (noExtResult.ok) {
    assertEquals(noExtResult.data, "custom");
  }
});

Deno.test("FormatDetector - Factory Default", () => {
  const result = FormatDetectorFactory.createDefault();
  assertEquals(result.ok, true);
  if (!result.ok) return;

  const jsonResult = result.data.detectFormat("test.json");
  assertEquals(jsonResult.ok, true);
  if (jsonResult.ok) {
    assertEquals(jsonResult.data, "json");
  }
});
