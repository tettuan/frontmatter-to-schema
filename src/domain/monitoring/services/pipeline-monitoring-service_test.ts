import { assertEquals, assertExists } from "jsr:@std/assert";
import { PipelineMonitoringService } from "./pipeline-monitoring-service.ts";
import { PipelineStrategyConfig } from "../../../application/value-objects/pipeline-strategy-config.ts";

Deno.test("PipelineMonitoringService - Smart Constructor", () => {
  const result = PipelineMonitoringService.create();

  assertEquals(result.ok, true);
  if (result.ok) {
    assertExists(result.data);
    assertEquals(result.data.getCurrentState().kind, "initializing");
  }
});

Deno.test("PipelineMonitoringService - Complete Monitoring Flow", () => {
  const serviceResult = PipelineMonitoringService.create();
  assertEquals(serviceResult.ok, true);

  if (!serviceResult.ok) return;

  const service = serviceResult.data;
  const strategyConfig = PipelineStrategyConfig.forBalanced();

  // Start monitoring
  const startResult = service.startMonitoring(strategyConfig);
  assertEquals(startResult.ok, true);
  assertEquals(service.getCurrentState().kind, "collecting");

  // Analyze variance
  const analyzeResult = service.analyzeVariance(strategyConfig);
  assertEquals(analyzeResult.ok, true);
  assertEquals(service.getCurrentState().kind, "analyzing");

  // Generate report
  const reportResult = service.generateReport();
  assertEquals(reportResult.ok, true);
  assertEquals(service.getCurrentState().kind, "reporting");

  if (reportResult.ok) {
    const report = reportResult.data;
    assertExists(report.id);
    assertExists(report.timestamp);
    assertEquals(typeof report.executionTimeMs, "number");
    assertEquals(typeof report.getTotalMemoryUsageMB(), "number");
  }
});

Deno.test("PipelineMonitoringService - State Transition Validation", () => {
  const serviceResult = PipelineMonitoringService.create();
  assertEquals(serviceResult.ok, true);

  if (!serviceResult.ok) return;

  const service = serviceResult.data;
  const strategyConfig = PipelineStrategyConfig.forBalanced();

  // Try to analyze variance without starting monitoring
  const analyzeResult = service.analyzeVariance(strategyConfig);
  assertEquals(analyzeResult.ok, false);
  if (!analyzeResult.ok) {
    assertEquals(analyzeResult.error.kind, "ConfigurationError");
  }

  // Try to generate report without analyzing
  const reportResult = service.generateReport();
  assertEquals(reportResult.ok, false);
  if (!reportResult.ok) {
    assertEquals(reportResult.error.kind, "ConfigurationError");
  }
});

Deno.test("PipelineMonitoringService - Monitoring Summary", () => {
  const serviceResult = PipelineMonitoringService.create();
  assertEquals(serviceResult.ok, true);

  if (!serviceResult.ok) return;

  const service = serviceResult.data;

  // Test initial summary
  const initialSummary = service.getMonitoringSummary();
  assertEquals(initialSummary.state, "initializing");
  assertExists(initialSummary.startTime);
  assertExists(initialSummary.initialMemoryMB);

  // Test collecting summary
  const strategyConfig = PipelineStrategyConfig.forBalanced();
  service.startMonitoring(strategyConfig);

  const collectingSummary = service.getMonitoringSummary();
  assertEquals(collectingSummary.state, "collecting");
  assertExists(collectingSummary.performance);
  assertExists(collectingSummary.elapsedMs);
});
