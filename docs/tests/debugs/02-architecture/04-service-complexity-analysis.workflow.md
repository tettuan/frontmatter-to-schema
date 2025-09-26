---
# XML変換メタデータ
workflow:
  id: "service-complexity-analysis"
  type: "architecture-analysis"
  scope: "domain-services"
  version: "1.0"
  xml_convertible: true
dependencies:
  - breakdownlogger: "@tettuan/breakdownlogger@^1.0.0"
  - environment_vars: ["LOG_KEY", "LOG_LENGTH", "LOG_LEVEL"]
  - inspector: "inspector-debug analyze-deep project-issues"
outputs:
  - debug_logs: "tmp/debug-service-complexity-{timestamp}.log"
  - evidence: "tmp/evidence-complexity-analysis.json"
  - issue_update: "GitHub Issue #1081"
---

# サービス複雑度分析・DRY原則違反検出ワークフロー

## 目的

複数のドメインサービスにおける高複雑度（if文過多）とDRY原則違反（重複実装）を検出し、リファクタリング優先度を決定する。

## 前提条件

- [ ] 条件1: Issue #1081が作成されている
- [ ] 条件2: BreakdownLogger環境変数設定済み
- [ ] 条件3: 既存テストスイートが通過状態

## 入力

- **対象サービス**:
  - FrontmatterTransformationService (89 if文)
  - DirectiveProcessor (73 if文)
  - TemplateVariableResolver (22 if文)
- **症状**: 複雑度過多、DRY原則違反
- **コンテキスト**: Strategy/Chainパターン未適用

## ワークフロー手順

### ステップ1: 複雑度測定

{xml:step id="step1" type="verification"}

1. 全サービスのif文カウント
   ```bash
   find src/domain -name "*.ts" -type f -exec sh -c 'echo -n "$1: "; grep -c "if (" "$1"' _ {} \; | sort -t: -k2 -rn | head -20
   ```

2. 重複コード検出
   ```bash
   grep -r "extractConfig" src/domain --include="*.ts" | cut -d: -f1 | sort | uniq -c | sort -rn
   ```

3. 結果記録
   ```bash
   LOG_KEY=service-complexity LOG_LEVEL=debug deno test --allow-all tests/unit/ 2>tmp/complexity-analysis.log
   ```

{/xml:step}

### ステップ2: DRY原則違反分析

{xml:step id="step2" type="investigation"}

1. extractConfig重複確認
   ```bash
   for file in $(grep -l "extractConfig" src/domain/schema/handlers/*.ts); do
     echo "=== $file ==="
     grep -A 10 "extractConfig" "$file"
   done > tmp/dry-violations.txt
   ```

2. 共通パターン抽出
   - ハンドラー間の共通処理識別
   - 基底クラス候補の特定

3. 影響範囲評価
   ```bash
   grep -r "DirectiveHandler" src/domain --include="*.ts" | wc -l
   ```

{/xml:step}

### ステップ3: リファクタリング優先度決定

{xml:step id="step3" type="diagnosis"}

1. 複雑度スコア算出
   - if文数 × 影響範囲 = 優先度スコア
   - FrontmatterTransformationService: 89 × 高 = 最優先
   - DirectiveProcessor: 73 × 高 = 優先
   - TemplateVariableResolver: 22 × 中 = 中優先

2. DRY違反影響評価
   - extractConfig: 7ファイル影響 = 高優先

3. リファクタリング計画
   - Phase 1: extractConfig共通化
   - Phase 2: DirectiveProcessor分解
   - Phase 3: FrontmatterTransformationService分解 {/xml:step}

### ステップ4: 実装戦略策定

{xml:step id="step4" type="resolution"}

1. 共通基底クラス設計
   ```typescript
   // BaseDirectiveHandler抽象クラス
   abstract class BaseDirectiveHandler implements DirectiveHandler {
     protected extractConfig(schema: any): DirectiveConfig {
       // 共通実装
     }
   }
   ```

2. Strategyパターン適用
   - DirectiveProcessorをStrategy化
   - 各ディレクティブ処理を独立Strategy

3. テスト戦略
   - 既存テストの維持
   - リファクタリング前後の挙動一致確認 {/xml:step}

### ステップ5: 検証と品質保証

{xml:step id="step5" type="verification"}

1. 複雑度再測定
   ```bash
   # リファクタリング後
   grep -c "if (" src/domain/schema/services/directive-processor.ts
   ```

2. テスト実行
   ```bash
   deno test tests/unit/domain/schema/ --allow-all
   ```

3. カバレッジ確認
   ```bash
   deno test --coverage=tmp/cov --allow-all tests/
   deno coverage tmp/cov
   ```

{/xml:step}

## 出力

- **複雑度レポート**: `tmp/complexity-report-{timestamp}.json`
- **DRY違反リスト**: `tmp/dry-violations-{timestamp}.txt`
- **リファクタリング計画**: `tmp/refactoring-plan-{timestamp}.md`

## 成功基準

- [ ] 全サービスのif文数が目標値以下
- [ ] DRY原則違反が解消
- [ ] 既存テストが全て成功
- [ ] カバレッジ80%以上維持

## 関連ワークフロー

- [FrontmatterTransformationServiceリファクタリング](./02-frontmatter-transformation-refactoring.workflow.md)
- [Totality検証](./01-totality-verification.workflow.md)
- [レイヤードアーキテクチャ依存性分析](./03-layered-architecture-dependency-analysis.workflow.md)

## トラブルシューティング

### 問題1: テスト失敗

- **症状**: リファクタリング後のテスト失敗
- **原因**: 挙動の非互換変更
- **解決策**: git diff確認、段階的リファクタリング

### 問題2: パフォーマンス劣化

- **症状**: Strategy適用後の処理速度低下
- **原因**: 過度な抽象化
- **解決策**: プロファイリング、最適化
