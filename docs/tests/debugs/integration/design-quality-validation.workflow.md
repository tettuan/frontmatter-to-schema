---
# XML変換メタデータ
workflow:
  id: "design-quality-validation"
  type: "validation"
  scope: "integration"
  version: "1.0"
  xml_convertible: true
dependencies:
  - breakdownlogger: "@tettuan/breakdownlogger@^1.0.0"
  - environment_vars: ["LOG_KEY", "LOG_LENGTH", "LOG_LEVEL"]
outputs:
  - debug_logs: "tmp/debug-design-quality-validation-{timestamp}.log"
  - evidence: "tmp/evidence-design-quality-validation.json"
---

# Design Quality Validation Workflow

## 目的

要求事項（特に要求23行目「特定のパターンのみでハードコーディング禁止」）への適合性を検証し、抽象化レベルの設計品質を評価する。概念的設計vs実装の乖離を定量化し、設計品質の改善点を特定する。

## 前提条件

- [ ] 条件1: プロジェクトルートディレクトリで実行
- [ ] 条件2: `docs/requirements.ja.md` が存在し、要求事項が理解済み
- [ ] 条件3: ProcessingCoordinator実装が存在
- [ ] 条件4: 概念的設計（ProcessingPipeline抽象化）が定義済み

## 入力

- **対象**: プロジェクト全体の設計品質
- **症状**: 特殊解実装による要求違反
- **コンテキスト**: Schema駆動システムの汎用性要求

## ワークフロー手順

### ステップ1: 要求事項適合性検証

{xml:step id="step1" type="verification"}

1. ハードコーディング禁止要求の確認:
   `grep -n "特定のパターンのみでハードコーディング" docs/requirements.ja.md`
2. ProcessingCoordinatorの特殊解実装確認:
   `grep -n "async.*process.*(" src/application/coordinators/processing-coordinator.ts`
3. 期待される結果: 7つの特殊化メソッドが要求に違反していることを確認 {/xml:step}

### ステップ2: デバッグ環境設定

{xml:step id="step2" type="setup"}

1. 環境変数設定:
   `export LOG_KEY=workflow-validation-design-quality LOG_LEVEL=debug`
2. BreakdownLogger有効化確認: `echo "Design quality validation: $LOG_KEY"`
3. 出力先ディレクトリ確認: `mkdir -p tmp/design-quality/`
4. 概念的設計ドキュメント準備: 一般解の期待仕様を明文化 {/xml:step}

### ステップ3: 抽象化レベル分析

{xml:step id="step3" type="investigation"}

1. 概念的設計（一般解）の定義:
   - 期待: `SchemaProcessingPipeline<TInput, TOutput>`
   - 汎用性: Schema駆動の統一処理フロー
2. 実装（特殊解）の分析:
   - 実態: ProcessingCoordinatorの7メソッド
   - 特殊化: 各メソッドが個別のケースに対応
3. 乖離度測定:
   - 実行コマンド:
     `wc -l src/application/coordinators/processing-coordinator.ts`
   - 確認ポイント: 1208行の大規模クラス、80%共通ロジック {/xml:step}

### ステップ4: Schema変更影響範囲評価

{xml:step id="step4" type="diagnosis"}

1. Schema変更シミュレーション:
   - 仮想的な新ディレクティブ追加
   - 既存処理メソッドへの影響評価
2. 汎用性テスト:
   - 実行コマンド: `grep -r "x-" src/application/coordinators/`
   - 確認ポイント: ディレクティブのハードコーディング状況
3. 拡張性評価:
   - 新機能追加時の変更箇所数
   - アプリケーション変更の必要性 {/xml:step}

### ステップ5: 設計品質指標測定

{xml:step id="step5" type="metrics"}

1. DRY違反定量化:
   - エラーハンドリング重複: `rg "if \(!.*\.ok\)" src/ --count-matches | wc -l`
   - Smart Constructor重複: `rg "static create\(" src/ --count-matches | wc -l`
2. 特殊解実装の定量化:
   - ProcessingCoordinatorメソッド数: 7つ
   - 共通ロジック率: 80%
3. 抽象化度スコア算出:
   - 一般解適合度: 0% (特殊解実装のため)
   - 拡張性スコア: 低 (アプリケーション変更必要) {/xml:step}

### ステップ6: 改善提案生成

{xml:step id="step6" type="resolution"}

1. ProcessingPipeline抽象化設計:
   ```typescript
   interface SchemaProcessingPipeline<TInput, TOutput> {
     process(input: TInput, schema: Schema): Result<TOutput, DomainError>;
   }
   ```
2. 実装戦略:
   - 単一の汎用処理メソッド
   - Schema駆動の動的処理選択
   - ディレクティブベースの処理制御
3. 品質向上効果予測:
   - DRY違反削減: 60-80%
   - 保守性向上: Schema変更時のアプリケーション変更不要
   - 拡張性向上: 新ディレクティブ対応の自動化 {/xml:step}

## 出力

- **ログファイル**: `tmp/debug-design-quality-validation-{timestamp}.log`
- **品質評価レポート**: `tmp/design-quality/quality-assessment.json`
- **改善提案書**: `tmp/design-quality/improvement-proposal.md`
- **抽象化設計**: ProcessingPipeline概念実装案

## 成功基準

- [ ] 要求事項違反が定量的に特定されている
- [ ] 概念的設計と実装の乖離が明確化されている
- [ ] Schema変更影響範囲が評価されている
- [ ] ProcessingPipeline抽象化による改善効果が算出されている
- [ ] 具体的な実装戦略が提案されている

## 関連ワークフロー

- [ProcessingCoordinator Variance Debug](../component/processing-coordinator-variance.workflow.md)
- [DRY Principle Analysis](./dry-principle-analysis.workflow.md)
- [Issue #941 Investigation](../meta/issue-941-investigation.workflow.md)

## トラブルシューティング

### よくある問題

#### 問題1: 概念的設計の定義が曖昧

- **症状**: 抽象化レベルの評価ができない
- **原因**: 一般解の期待仕様が不明確
- **解決策**:
  `docs/requirements.ja.md`の「抽象度に即して一般解として設計」要求を基準とする

#### 問題2: 設計品質指標の定量化が困難

- **症状**: 改善効果の予測ができない
- **原因**: 現在の実装の問題点が数値化されていない
- **解決策**: DRY違反パターン数、コード行数、変更影響箇所数で定量評価

#### 問題3: 改善提案の実現可能性が不明

- **症状**: ProcessingPipeline抽象化の実装戦略が具体性に欠ける
- **原因**: 既存のアーキテクチャとの整合性が検討されていない
- **解決策**: DDD原則、Totality原則との適合性を考慮した段階的移行計画を策定
