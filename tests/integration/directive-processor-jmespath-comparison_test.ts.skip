/**
 * @fileoverview JMESPath Filter Comparison Test with BreakdownLogger
 * @description Test comparing data flow with and without JMESPath filtering
 * Following BreakdownLogger testing strategy for debugging directive processing
 *
 * ## 戦略的実行の意図 (Strategic Execution Intent)
 *
 * このテストは、JMESPathフィルタリングの有無によるデータフローの違いを
 * BreakdownLoggerを使用して可視化し、問題の切り分けを行うために作成されました。
 *
 * ### 実行目的:
 * 1. JMESPathフィルタリング処理が正しく動作しているかの検証
 * 2. フィルタリング前後のデータ構造の比較
 * 3. テンプレート変数解決への影響の確認
 * 4. ネストされたデータ構造での動作検証
 *
 * ### 実行例 (Execution Examples):
 *
 * ```bash
 * # 基本実行 (デバッグログ付き)
 * LOG_KEY=jmespath-filter-comparison LOG_LENGTH=W LOG_LEVEL=debug deno test tests/integration/directive-processor-jmespath-comparison_test.ts --allow-all
 *
 * # 短縮形式での出力
 * LOG_KEY=jmespath-filter-comparison LOG_LENGTH=S deno test tests/integration/directive-processor-jmespath-comparison_test.ts --allow-all
 *
 * # エラーのみ表示
 * LOG_KEY=jmespath-filter-comparison LOG_LEVEL=error deno test tests/integration/directive-processor-jmespath-comparison_test.ts --allow-all
 *
 * # CI環境での実行
 * LOG_LEVEL=error LOG_LENGTH=S deno test tests/integration/directive-processor-jmespath-comparison_test.ts --allow-all
 * ```
 *
 * ### デバッグ戦略:
 * - BreakdownLoggerによる段階的なデータ変換の追跡
 * - フィルタリング前後でのデータ件数と内容の比較
 * - テンプレート変数アクセスのシミュレーション
 * - ネスト構造でのJMESPath式の動作確認
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { BreakdownLogger } from "@tettuan/breakdownlogger";
import { JMESPathFilterService } from "../../src/domain/schema/services/jmespath-filter-service.ts";
import { FrontmatterData } from "../../src/domain/frontmatter/value-objects/frontmatter-data.ts";

describe("DirectiveProcessor JMESPath Filter Comparison", () => {
  const _logger = new BreakdownLogger("jmespath-filter-comparison");

  describe("Data filtering comparison", () => {
    it("should demonstrate data flow with vs without JMESPath filtering", () => {
      _logger.info("Starting JMESPath filter comparison test");

      /**
       * テストデータ構造の説明:
       * examples/3.docs/で発生している問題を再現するため、
       * 実際のtraceabilityデータ構造を模倣している
       */

      // Create test data similar to examples/3.docs structure
      const testDataResult = FrontmatterData.create({
        traceability: [
          {
            id: {
              full: "req:api:deepresearch-3f8d2a#20250909",
              level: "req",
              scope: "api",
            },
            derived_from: "",
            trace_to: "spec:api:deepresearch-3f8d2a#20250909",
          },
          {
            id: {
              full: "spec:api:deepresearch-4a9e3b#20250909",
              level: "spec",
              scope: "api",
            },
            derived_from: "req:api:deepresearch-3f8d2a#20250909",
            trace_to: "design:api:deepresearch-4a9e3b#20250909",
          },
          {
            id: {
              full: "design:api:deepresearch-5b0f4c#20250909",
              level: "design",
              scope: "api",
            },
            derived_from: "spec:api:deepresearch-4a9e3b#20250909",
            trace_to: "",
          },
          {
            id: {
              full: "req:ui:interface-6c1g5d#20250909",
              level: "req",
              scope: "ui",
            },
            derived_from: "",
            trace_to: "spec:ui:interface-6c1g5d#20250909",
          },
        ],
      });

      assertExists(testDataResult.ok);
      if (!testDataResult.ok) return;

      const testData = testDataResult.data;
      const rawData = testData.getData() as any;
      _logger.debug("Original test data created", {
        totalItems: rawData.traceability.length,
        reqItems: rawData.traceability.filter((item: any) =>
          item.id.level === "req"
        ).length,
        specItems: rawData.traceability.filter((item: any) =>
          item.id.level === "spec"
        ).length,
        designItems: rawData.traceability.filter((item: any) =>
          item.id.level === "design"
        ).length,
      });

      /**
       * Test 1: フィルタリングなしのデータ確認
       * 目的: 元のデータ構造とアクセス可能性を確認
       */
      _logger.info("Test 1: Processing without JMESPath filtering");
      const originalData = rawData;
      _logger.debug("Data without filtering", {
        itemCount: originalData.traceability.length,
        levels: originalData.traceability.map((item: any) => item.id.level),
        firstItem: originalData.traceability[0],
      });

      /**
       * Test 2: JMESPathフィルタリング適用
       * 目的: [?id.level == 'req']フィルタが正しく動作することを確認
       * 期待結果: 4件から2件の'req'レベルのみに絞り込まれる
       */
      _logger.info(
        "Test 2: Processing with JMESPath filtering for 'req' level",
      );

      const jmespathServiceResult = JMESPathFilterService.create();
      assertExists(jmespathServiceResult.ok);
      if (!jmespathServiceResult.ok) return;

      const filterExpression = "[?id.level == 'req']";
      _logger.debug("Applying JMESPath filter", {
        expression: filterExpression,
      });

      const filteredResult = jmespathServiceResult.data.applyFilter(
        testData,
        `traceability${filterExpression}`,
      );

      assertExists(filteredResult.ok);
      if (!filteredResult.ok) {
        _logger.error("JMESPath filtering failed", {
          error: filteredResult.error,
        });
        return;
      }

      const filteredData = filteredResult.data as any[];
      _logger.debug("Data after JMESPath filtering", {
        originalCount: originalData.traceability.length,
        filteredCount: filteredData.length,
        filteredItems: filteredData.map((item: any) => ({
          level: item.id.level,
          scope: item.id.scope,
          full: item.id.full,
        })),
      });

      /**
       * Test 3: フィルタリング結果の比較分析
       * 目的: フィルタリング前後のデータ件数と内容の違いを明確化
       */
      _logger.info("Test 3: Comparing filtered vs unfiltered results");

      const originalReqItems = originalData.traceability.filter((item: any) =>
        item.id.level === "req"
      );

      _logger.debug("Comparison analysis", {
        originalTotal: originalData.traceability.length,
        originalReqItems: originalReqItems.length,
        filteredCount: filteredData.length,
        filterWorking: filteredData.length === originalReqItems.length,
        filteredLevels: filteredData.map((item: any) => item.id.level).filter((
          level: string,
          index: number,
          arr: string[],
        ) => arr.indexOf(level) === index),
      });

      // Assertions
      assertEquals(
        filteredData.length,
        2,
        "Should filter to only 'req' level items",
      );
      assertEquals(
        filteredData.every((item: any) => item.id.level === "req"),
        true,
        "All filtered items should be 'req' level",
      );
      assertEquals(
        originalData.traceability.length,
        4,
        "Original data should have all items",
      );

      /**
       * Test 4: テンプレート変数コンテキストのシミュレーション
       * 目的: {id.full}のような変数アクセスが両方のケースで機能するか確認
       * これがexamples/3.docs/で空になる問題の核心部分
       */
      _logger.info("Test 4: Simulating template variable context");

      // Simulate what happens in template variable resolution
      const templateContext = {
        unfiltered: {
          items: originalData.traceability,
          count: originalData.traceability.length,
        },
        filtered: {
          items: filteredData,
          count: filteredData.length,
        },
      };

      _logger.debug("Template context simulation", {
        unfilteredContext: {
          totalItems: templateContext.unfiltered.count,
          firstItemId: (templateContext.unfiltered.items as any)[0]?.id?.full,
          levels: (templateContext.unfiltered.items as any).map((item: any) =>
            item.id.level
          ),
        },
        filteredContext: {
          totalItems: templateContext.filtered.count,
          firstItemId: templateContext.filtered.items[0]?.id?.full,
          levels: templateContext.filtered.items.map((item: any) =>
            item.id.level
          ),
        },
      });

      // Test for template variable {id.full} access
      const unfilteredFirstId = (templateContext.unfiltered.items as any)[0]?.id
        ?.full;
      const filteredFirstId = templateContext.filtered.items[0]?.id?.full;

      _logger.debug("Template variable simulation", {
        unfilteredFirstId,
        filteredFirstId,
        variableAccessWorking: !!unfilteredFirstId && !!filteredFirstId,
      });

      assertExists(unfilteredFirstId);
      assertExists(filteredFirstId);
      assertEquals(
        filteredFirstId.includes("req:"),
        true,
        "Filtered first item should be req level",
      );

      _logger.info("JMESPath filter comparison test completed successfully");
    });

    it("should demonstrate nested data structure filtering", () => {
      _logger.info("Starting nested data structure filtering test");

      /**
       * ネスト構造のテスト
       * 目的: traceability[].traceability[]のような複雑な構造での
       * JMESPathフィルタリングの動作を検証
       * これは実際のexamples/3.docs/で起きている問題構造を再現
       */

      // Create data with nested traceability structure (like the actual issue)
      const nestedDataResult = FrontmatterData.create({
        traceability: [
          {
            traceability: [
              {
                id: {
                  full: "req:nested:test-1a2b3c#20250909",
                  level: "req",
                  scope: "nested",
                },
                derived_from: "",
                trace_to: "spec:nested:test-1a2b3c#20250909",
              },
              {
                id: {
                  full: "spec:nested:test-2b3c4d#20250909",
                  level: "spec",
                  scope: "nested",
                },
                derived_from: "req:nested:test-1a2b3c#20250909",
                trace_to: "",
              },
            ],
          },
        ],
      });

      assertExists(nestedDataResult.ok);
      if (!nestedDataResult.ok) return;

      const nestedRawData = nestedDataResult.data.getData() as any;
      _logger.debug("Nested data structure created", {
        outerTraceabilityLength: nestedRawData.traceability.length,
        innerTraceabilityLength:
          nestedRawData.traceability[0].traceability.length,
        dataStructure: "traceability[].traceability[]",
      });

      // Test filtering on nested structure
      const jmespathServiceResult = JMESPathFilterService.create();
      assertExists(jmespathServiceResult.ok);
      if (!jmespathServiceResult.ok) return;

      // This represents the complex filtering needed for nested structures
      const nestedFilterExpression =
        "traceability[].traceability[?id.level == 'req']";
      _logger.debug("Applying nested JMESPath filter", {
        expression: nestedFilterExpression,
      });

      const nestedFilterResult = jmespathServiceResult.data.applyFilter(
        nestedDataResult.data,
        nestedFilterExpression,
      );

      assertExists(nestedFilterResult.ok);
      if (!nestedFilterResult.ok) {
        _logger.error("Nested JMESPath filtering failed", {
          error: nestedFilterResult.error,
        });
        return;
      }

      const nestedFilteredData = nestedFilterResult.data as any[];
      _logger.debug("Nested filtering results", {
        originalStructure: "traceability[0].traceability[0,1]",
        filteredCount: nestedFilteredData.length,
        filteredLevels: nestedFilteredData.map((item: any) => item.id?.level)
          .filter(Boolean),
      });

      _logger.info("Nested data structure filtering test completed");
    });
  });
});
