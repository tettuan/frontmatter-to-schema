---
# XML変換メタデータ
workflow:
  id: "x-flatten-arrays-debugging-2025-09-23"
  type: "integration-debug"
  scope: "directive-processor"
  version: "1.0"
  xml_convertible: true
dependencies:
  - breakdownlogger: "@tettuan/breakdownlogger@^1.0.0"
  - environment_vars: ["LOG_KEY", "LOG_LENGTH", "LOG_LEVEL"]
outputs:
  - debug_logs: "tmp/debug-x-flatten-arrays-{timestamp}.log"
  - evidence: "tmp/evidence-x-flatten-arrays.json"
  - solution: "tmp/solution-x-flatten-arrays.md"
related_issues:
  - github_issue: "#1010"
  - test_failures: 3
  - passing_tests: 384
---

# x-flatten-arrays Directive Implementation Debugging Workflow

## 目的

Issue #1010で特定されたx-flatten-arrays
directive実装の3つの失敗テストを体系的にデバッグし、根本原因を特定して修正する。

## 前提条件

- [x] TypeScript型チェック成功確認済み (`deno check src/**/*.ts`)
- [ ] BreakdownLogger依存関係確認
- [ ] テスト実行環境準備完了
- [ ] 失敗テスト特定済み（3件）

## 入力

- **対象**: x-flatten-arrays directive processing logic
- **症状**:
  配列のフラット化が期待通りに動作せず、複雑なネストオブジェクト構造を返す
- **コンテキスト**: Integration test failures with correct type checking

## ワークフロー手順

### ステップ1: 初期確認と現状把握

{xml:step id="step1" type="verification"}

1. 現在のテスト失敗状況確認
   ```bash
   deno test --allow-all tests/integration/x-flatten-arrays-directive-integration_test.ts
   ```
2. 型チェック状況再確認
   ```bash
   deno check src/**/*.ts
   ```
3. 失敗テストの詳細分析
   - Expected: フラット化された配列
     `["REQ-001", "REQ-002", "REQ-003", "REQ-004", "REQ-005", "REQ-006"]`
   - Actual: 複雑なネストオブジェクト構造

{/xml:step}

### ステップ2: BreakdownLoggerデバッグ環境設定

{xml:step id="step2" type="setup"}

1. 環境変数設定
   ```bash
   export LOG_KEY=x-flatten-arrays-debug
   export LOG_LEVEL=debug
   export LOG_LENGTH=L
   ```
2. デバッグ出力先ディレクトリ確認
   ```bash
   mkdir -p tmp/
   ```
3. BreakdownLogger統合対象ファイル特定
   - `src/domain/schema/services/directive-processor.ts` (主要実装)
   - `tests/integration/x-flatten-arrays-directive-integration_test.ts`
     (失敗テスト)

{/xml:step}

### ステップ3: 段階的問題分析

{xml:step id="step3" type="investigation"}

#### 3.1 実装ロジック分析

1. `DirectiveProcessor.processFlattenArraysDirective()` メソッド詳細調査
   - Line 549-590: 実装場所確認済み
   - `applyFlattenArraysToData()` メソッドのデータフロー分析
   - `collectFlattenDirectives()` のスキーマ解析動作確認

2. テストケースとの期待値差異分析
   ```typescript
   // Expected input: ["REQ-001", ["REQ-002", "REQ-003"], "REQ-004", [["REQ-005"], "REQ-006"]]
   // Expected output: ["REQ-001", "REQ-002", "REQ-003", "REQ-004", "REQ-005", "REQ-006"]
   // Actual output: Complex nested object
   ```

#### 3.2 データフロー追跡

1. `getNestedProperty()` メソッドの動作確認
   - ドット記法パス解決の正確性
   - `directive.target` の値と実際のデータ構造のマッピング

2. `setNestedProperty()` メソッドの動作確認
   - フラット化後の配列の正しい配置
   - オブジェクト構造の保持と変更

{/xml:step}

### ステップ4: 根本原因特定

{xml:step id="step4" type="diagnosis"}

#### 4.1 仮説1: スキーマディレクティブ解析の問題

**症状分析**: `x-flatten-arrays: "traceability"` の解析が不正確

- `collectFlattenDirectives()` の戻り値確認
- スキーマ構造とディレクティブターゲットの不一致

#### 4.2 仮説2: データ適用ロジックの問題

**症状分析**: `applyFlattenArraysToData()` の実装バグ

- `getNestedProperty()` が正しい配列を取得していない
- `setNestedProperty()` が間違った構造を作成している

#### 4.3 仮説3: フラット化アルゴリズムの問題

**症状分析**: `flattenArray()` の再帰処理

- ネストした配列の正しい展開ができていない
- 結果配列の構造が期待と異なる

{/xml:step}

### ステップ5: 問題解決と検証

{xml:step id="step5" type="resolution"}

#### 5.1 実装修正

1. 根本原因に基づく修正実装
2. テスト駆動での段階的修正
3. エッジケースの考慮

#### 5.2 検証テスト

1. 修正後の失敗テスト再実行
   ```bash
   deno test --allow-all tests/integration/x-flatten-arrays-directive-integration_test.ts
   ```
2. 全テストスイート実行（回帰確認）
   ```bash
   deno test --allow-all
   ```
3. 型チェック確認（継続成功確認）
   ```bash
   deno check src/**/*.ts
   ```

{/xml:step}

## 出力

- **ログファイル**: `tmp/debug-x-flatten-arrays-{timestamp}.log`
- **証跡データ**: `tmp/evidence-x-flatten-arrays.json`
- **解決策ドキュメント**: `tmp/solution-x-flatten-arrays.md`
- **修正されたコード**: `src/domain/schema/services/directive-processor.ts`

## 成功基準

- [ ] 3つの失敗テストがすべて成功
- [ ] 384の既存テストが継続して成功
- [ ] TypeScript型チェックが継続して成功
- [ ] x-flatten-arrays directivesが期待通りに動作
- [ ] デバッグプロセスが完全に記録されている

## 関連ワークフロー

- [基本デバッグテンプレート](../meta/workflow-template.workflow.md)
- [DirectiveProcessor分析](../component/directive-processor-comprehensive.workflow.md)
- [テンプレート変数解決](../component/template-variable-resolution.workflow.md)

## トラブルシューティング

### よくある問題

#### 問題1: BreakdownLoggerが出力されない

- **症状**: ログファイルが生成されない
- **原因**: 環境変数設定の不備
- **解決策**: `export LOG_KEY=x-flatten-arrays-debug LOG_LEVEL=debug` を再実行

#### 問題2: テストが予期しない方法で失敗する

- **症状**: 修正後も異なるエラーが発生
- **原因**: 副作用や依存関係の問題
- **解決策**: 段階的なコミットと部分テスト実行

#### 問題3: 型チェックエラーの発生

- **症状**: 修正後に型エラーが発生
- **原因**: TypeScript型定義との不整合
- **解決策**: `deno check` での段階的確認と型修正

## 実行スクリプト

```bash
#!/bin/bash
# scripts/debug-x-flatten-arrays.sh

echo "=== x-flatten-arrays Debugging Workflow ==="

# Step 1: Environment setup
export LOG_KEY=x-flatten-arrays-debug
export LOG_LEVEL=debug
export LOG_LENGTH=L
mkdir -p tmp/

echo "Environment configured: LOG_KEY=$LOG_KEY"

# Step 2: Current status verification
echo "=== Current Test Status ==="
deno test --allow-all tests/integration/x-flatten-arrays-directive-integration_test.ts

# Step 3: Type check verification
echo "=== Type Check Status ==="
deno check src/**/*.ts

# Step 4: Detailed analysis with logging
echo "=== Detailed Analysis ==="
echo "Analyzing directive-processor.ts implementation..."

# Output debug information
echo "Debug logs will be saved to: tmp/debug-x-flatten-arrays-$(date +%Y%m%d-%H%M%S).log"
```
