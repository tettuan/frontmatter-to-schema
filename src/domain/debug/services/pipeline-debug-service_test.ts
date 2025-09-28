import { assertEquals, assertExists } from "jsr:@std/assert";
import { PipelineDebugService } from "./pipeline-debug-service.ts";
import { TotalityMetrics } from "../value-objects/totality-compliance-report.ts";

const createTestConfig = () => ({
  entropyThreshold: 50,
  maxReductionSteps: 10,
  complianceThreshold: 0.8,
  enableDetailedAnalysis: true,
  enablePerformanceTracking: true,
});

const createTestTotalityMetrics = (): TotalityMetrics => ({
  discriminatedUnionUsage: 0.8,
  switchExhaustiveness: 0.9,
  resultTypeUsage: 0.85,
  smartConstructorUsage: 0.7,
  typeSafetyLevel: 0.8,
});

Deno.test("PipelineDebugService - complete workflow", () => {
  const config = createTestConfig();
  const serviceResult = PipelineDebugService.create(config, 30);

  assertEquals(serviceResult.ok, true);
  if (!serviceResult.ok) return;

  const service = serviceResult.data;

  // Initial state should be initializing
  assertEquals(service.getCurrentState().kind, "initializing");
  assertEquals(service.isTerminal(), false);

  // Start entropy measurement
  const measurements = { complexity: 45, coupling: 60, cohesion: 80 };
  const startResult = service.startEntropyMeasurement(measurements);
  assertEquals(startResult.ok, true);
  assertEquals(service.getCurrentState().kind, "entropy-measuring");

  // Generate entropy analysis
  const entropyResult = service.generateEntropyAnalysis(55, 8, 35);
  assertEquals(entropyResult.ok, true);
  assertEquals(service.getCurrentState().kind, "totality-analyzing");

  // Generate totality compliance
  const metrics = createTestTotalityMetrics();
  const totalityResult = service.generateTotalityCompliance(metrics, 0.85, 0.9);
  assertEquals(totalityResult.ok, true);
  assertEquals(service.getCurrentState().kind, "compliance-checking");

  // Generate final report
  const reportResult = service.generateDebugReport();
  assertEquals(reportResult.ok, true);
  assertEquals(service.getCurrentState().kind, "completed");
  assertEquals(service.isTerminal(), true);
  assertEquals(service.isCompleted(), true);

  if (reportResult.ok) {
    assertExists(reportResult.data.entropyReport);
    assertExists(reportResult.data.totalityReport);
    assertEquals(typeof reportResult.data.processingTime, "number");
  }
});

Deno.test("PipelineDebugService - invalid configuration", () => {
  const invalidConfig = {
    ...createTestConfig(),
    entropyThreshold: 150, // Invalid: > 100
  };

  const result = PipelineDebugService.create(invalidConfig);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "OutOfRange");
    if (result.error.kind === "OutOfRange") {
      assertEquals(result.error.value, 150);
    }
  }
});

Deno.test("PipelineDebugService - state transition validation", () => {
  const config = createTestConfig();
  const serviceResult = PipelineDebugService.create(config);
  assertEquals(serviceResult.ok, true);
  if (!serviceResult.ok) return;

  const service = serviceResult.data;

  // Try to generate entropy analysis before starting measurement
  const invalidResult = service.generateEntropyAnalysis(50, 5, 30);
  assertEquals(invalidResult.ok, false);
  if (!invalidResult.ok) {
    assertEquals(invalidResult.error.kind, "ConfigurationError");
  }

  // State should remain initializing
  assertEquals(service.getCurrentState().kind, "initializing");
});

Deno.test("PipelineDebugService - debug info logging", () => {
  const config = createTestConfig();
  const serviceResult = PipelineDebugService.create(config, 25);
  assertEquals(serviceResult.ok, true);
  if (!serviceResult.ok) return;

  const service = serviceResult.data;

  // Get initial debug info
  const initialInfo = service.getDebugInfo();
  assertEquals(initialInfo.state, "initializing");
  assertEquals(initialInfo.isTerminal, false);
  assertEquals(initialInfo.isCompleted, false);
  assertEquals(initialInfo.hasFailed, false);

  // Start entropy measurement and check debug info
  const measurements = { complexity: 40 };
  service.startEntropyMeasurement(measurements);

  const measuringInfo = service.getDebugInfo();
  assertEquals(measuringInfo.state, "entropy-measuring");
  assertEquals(typeof measuringInfo.config, "object");
});
