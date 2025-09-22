---
# XML変換メタデータ
workflow:
  id: "processing-coordinator-variance-debug"
  type: "debug"
  scope: "component"
  version: "1.0"
  xml_convertible: true
dependencies:
  - breakdownlogger: "@tettuan/breakdownlogger@^1.0.0"
  - environment_vars: ["LOG_KEY", "LOG_LENGTH", "LOG_LEVEL"]
outputs:
  - debug_logs: "tmp/debug-processing-coordinator-variance-{timestamp}.log"
  - evidence: "tmp/evidence-processing-coordinator-variance.json"
---

# ProcessingCoordinator Variance Debug Workflow

## 目的

ProcessingCoordinatorの処理フロー振れ幅問題（Issue #941）を特定し、DRY原則違反と特殊解実装パターンの根本原因を分析する。7つの処理メソッドの重複とprocessDocumentsWithFullExtraction()の3つの処理パス分岐による不確定性を解決する。

## 前提条件

- [ ] 条件1: プロジェクトルートディレクトリで実行
- [ ] 条件2: Deno環境が利用可能
- [ ] 条件3: Issue #941の内容を理解済み
- [ ] 条件4: `src/application/coordinators/processing-coordinator.ts` が存在
- [ ] 条件5: HIGH-VARIANCE DEBUG POINTが実装済み

## 入力

- **対象**: ProcessingCoordinator.processDocumentsWithFullExtraction()
- **症状**: 3つの処理完了パスによる結果の振れ幅
- **コンテキスト**: DRY原則違反と特殊解実装による保守性問題

## ワークフロー手順

### ステップ1: 処理パス分岐の確認

{xml:step id="step1" type="verification"}

1. ProcessingCoordinatorの7つのメソッド確認:
   `rg "async.*process.*\(" src/application/coordinators/processing-coordinator.ts -A 1`
2. HIGH-VARIANCE DEBUG POINTの実装確認:
   `rg "HIGH-VARIANCE-DETECTION" src/application/coordinators/processing-coordinator.ts -A 5 -B 5`
3. 期待される結果: 3つの処理完了パス（DirectiveProcessor/frontmatter-part only/単一パス）が確認できる {/xml:step}

### ステップ2: デバッグ環境設定

{xml:step id="step2" type="setup"}

1. 環境変数設定:
   `export LOG_KEY=workflow-debug-processing-coordinator-variance LOG_LEVEL=debug`
2. BreakdownLogger有効化確認: `echo "Debug session: $LOG_KEY"`
3. 出力先ディレクトリ確認: `mkdir -p tmp/`
4. 要求仕様確認: `grep -A 5 "特定のパターンのみでハードコーディング" docs/requirements.ja.md` {/xml:step}

### ステップ3: 重複パターン分析

{xml:step id="step3" type="investigation"}

1. 7つの処理メソッドの共通ロジック特定:
   - 実行コマンド: `rg "if \(!.*\.ok\)" src/application/coordinators/processing-coordinator.ts --count`
   - 確認ポイント: 同一エラーハンドリングパターンの出現回数
2. FrontmatterData.create()重複確認:
   - 実行コマンド: `rg "FrontmatterData\.create\(" src/application/coordinators/processing-coordinator.ts -n`
   - 確認ポイント: 同一作成パターンの重複箇所
3. ログ出力重複確認:
   - 実行コマンド: `rg "this\.logger\?\." src/application/coordinators/processing-coordinator.ts --count`
   - 確認ポイント: 類似ログパターンの分散状況 {/xml:step}

### ステップ4: 処理パス分岐実行テスト

{xml:step id="step4" type="diagnosis"}

1. 各処理パスの実行確認:
   `deno test tests/unit/application/coordinators/processing-coordinator_test.ts --filter "comprehensive" --allow-all`
2. デバッグ出力分析: HIGH-VARIANCE DEBUG POINTからの出力確認
3. 振れ幅測定: 3つの完了パス（DirectiveProcessor使用/frontmatter-part only/単一パス）の実行時間・メモリ使用量比較
4. 特殊解パターン確認: if文による条件分岐のハードコーディング調査 {/xml:step}

### ステップ5: 一般解設計検証

{xml:step id="step5" type="resolution"}

1. 概念的設計との比較:
   - 期待: ProcessingPipeline<TInput, TOutput>による抽象化
   - 実装: 7つの個別メソッドによる特殊解
2. 要求適合性検証:
   `grep -A 3 -B 3 "要求を抽象度に即して一般解として設計" docs/requirements.ja.md`
3. 改善方向性確認: Issue #941のPhase 1-4実装計画の妥当性評価 {/xml:step}

## 出力

- **ログファイル**: `tmp/debug-processing-coordinator-variance-{timestamp}.log`
- **証跡データ**: `tmp/evidence-processing-coordinator-variance.json`
- **解決策**: ProcessingPipeline抽象化とDRY原則適用による7メソッド統合

## 成功基準

- [ ] 3つの処理パス分岐が明確に特定されている
- [ ] DRY原則違反箇所（300+エラーハンドリング、15+FrontmatterData作成）が定量化されている
- [ ] 特殊解実装が要求仕様違反であることが確認されている
- [ ] ProcessingPipeline抽象化による一般解設計が具体化されている

## 関連ワークフロー

- [Totality Compliance Debug](./totality-compliance.workflow.md)
- [Schema Structure Detector Debug](./schema-structure-detector.workflow.md)
- [DRY Principle Violation Analysis](../integration/dry-principle-analysis.workflow.md)

## トラブルシューティング

### よくある問題

#### 問題1: HIGH-VARIANCE DEBUG POINTが出力されない

- **症状**: ProcessingCoordinatorのテスト実行でデバッグ出力が確認できない
- **原因**: テストがprocessDocumentsWithFullExtraction()を直接呼び出していない
- **解決策**: CLI実行またはintegration testで実際の処理フローを確認

#### 問題2: 処理パス分岐の特定が困難

- **症状**: 3つの完了パス（DirectiveProcessor/frontmatter-part only/単一パス）の区別ができない
- **原因**: ログレベルが適切に設定されていない
- **解決策**: `LOG_LEVEL=debug`を設定し、variance-debug-pointカテゴリを有効化

#### 問題3: 要求仕様との比較評価が不明確

- **症状**: 特殊解実装が要求違反かどうかの判定が曖昧
- **原因**: 要求仕様の「一般解として設計」の基準が不明確
- **解決策**: docs/requirements.ja.mdの「特定のパターンのみでハードコーディング禁止」を具体的基準として適用