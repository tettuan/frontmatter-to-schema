---
# XML変換メタデータ
workflow:
  id: "test-design-misalignment-debug"
  type: "integration"
  scope: "test-design"
  version: "1.0"
  xml_convertible: true
dependencies:
  - breakdownlogger: "@tettuan/breakdownlogger@^1.0.0"
  - environment_vars: ["LOG_KEY", "LOG_LENGTH", "LOG_LEVEL"]
outputs:
  - debug_logs: "tmp/debug-test-design-{timestamp}.log"
  - evidence: "tmp/evidence-test-design.json"
  - report: "tmp/test-misalignment-report.md"
---

# テスト設計不整合デバッグワークフロー

## 目的

Issue #1003で特定されたテスト設計の問題（仕様との不整合、カバレッジ不足、現在サポートされていないディレクティブの参照）を体系的にデバッグし、解決策を導出する。

## 前提条件

- [ ] 条件1: Issue #1003の内容が理解されている
- [ ] 条件2: 全テストが実行可能な状態である（385 passed / 0 failed）
- [ ] 条件3: BreakdownLoggerが統合済み
- [ ] 条件4: `tmp/` ディレクトリが存在する

## 入力

- **対象**: テストコードの仕様整合性
- **症状**: 現在サポートされていない機能への参照、主要機能テスト不足
- **コンテキスト**: DDD/TDD/Totality原則に基づく品質向上

## ワークフロー手順

### ステップ1: 現在サポートされているディレクティブの確認

{xml:step id="step1" type="verification"}

1. 現在サポートされているディレクティブを含むテストファイルの特定
   - 実行コマンド: `grep -r "x-frontmatter-part\|x-derived-from\|x-template" tests/ --include="*_test.ts"`
   - 確認ポイント: ファイル数とテスト内容
2. 現在のディレクティブテスト状況確認
   - 実行コマンド: `grep -l "x-frontmatter-part\|x-derived-from\|x-template" tests/**/*_test.ts | wc -l`
   - 期待される結果: サポートされているディレクティブのテスト実装状況

{/xml:step}

### ステップ2: 主要機能テストカバレッジ分析

{xml:step id="step2" type="investigation"}

1. 主要処理関数のテストカバレッジ確認
   - 実行コマンド: `grep -l "transformDocuments\|processDocument" tests/**/*_test.ts`
   - 確認ポイント: 主要機能のテスト実装状況
2. 24実行パターンのテストカバレッジ評価
   - 実行コマンド: `find tests/ -name "*pattern*" -o -name "*execution*" | head -10`
   - 確認ポイント: 実行パターンテストの実装状況

{/xml:step}

### ステップ3: 仕様整合性の詳細分析

{xml:step id="step3" type="diagnosis"}

1. 要求仕様との比較分析
   - ログ分析: `LOG_KEY=test-specification-check LOG_LEVEL=debug`
   - 症状パターン確認: 要求仕様vs実装テストのギャップ特定
2. BreakdownLoggerを用いた詳細調査
   - 実行コマンド: `export LOG_KEY=test-misalignment LOG_LENGTH=L LOG_LEVEL=debug`
   - 根本原因仮説: テスト設計プロセスの問題

{/xml:step}

### ステップ4: 現在サポートされているディレクティブのテスト強化計画

{xml:step id="step4" type="planning"}

1. サポートされているディレクティブのテスト分析
   - 仮説検証: 現在サポートされているディレクティブのテストカバレッジ確認
   - 実行コマンド: `grep -A 5 -B 5 "x-frontmatter-part\|x-derived-from\|x-template" tests/**/*_test.ts`
2. テスト強化スケジュールの策定
   - 強化順序: サポートされている機能のテスト優先度設定
   - 影響分析: 新規テスト追加後のカバレッジ向上予測

{/xml:step}

### ステップ5: 新規テスト設計・実装

{xml:step id="step5" type="implementation"}

1. 24実行パターンテストの実装
   - 解決策適用: パターン別テストケース作成
   - 実行コマンド: テスト実装後の実行確認
2. BreakdownLogger戦略の統合
   - 結果確認: 新規テストでのデバッグ出力確認
   - 実行コマンド: `LOG_KEY=new-pattern-tests LOG_LEVEL=info deno test`

{/xml:step}

### ステップ6: 仕様整合性検証

{xml:step id="step6" type="verification"}

1. 要求仕様との整合性確認
   - 検証方法: 要求仕様書とテストケースの逐一照合
   - 実行コマンド: `deno test --allow-all 2>&1 | grep -E "(passed|failed)"`
2. 総合品質評価
   - 成功基準: 385テスト通過維持 + 仕様整合性100%
   - 実行コマンド: `deno task test:coverage`

{/xml:step}

## 出力

- **ログファイル**: `tmp/debug-test-design-{timestamp}.log`
- **証跡データ**: `tmp/evidence-test-design.json`
- **不整合レポート**: `tmp/test-misalignment-report.md`
- **改善計画書**: `tmp/test-improvement-plan.md`

## 成功基準

- [ ] 現在サポートされているディレクティブ（x-frontmatter-part, x-derived-from, x-template等）のテストが充実している
- [ ] 24実行パターンのテストが実装されている
- [ ] 主要機能のテストカバレッジが向上している
- [ ] 全テストが要求仕様と整合している
- [ ] BreakdownLogger戦略がテストに統合されている
- [ ] テスト通過率が維持されている（385 passed / 0 failed）

## 関連ワークフロー

- [サポートされているディレクティブのテスト強化](./deprecated-directive-cleanup.workflow.md)
- [仕様整合性検証](../component/specification-alignment.workflow.md)
- [テストカバレッジ向上](../e2e/coverage-improvement.workflow.md)

## トラブルシューティング

### よくある問題

#### 問題1: 新規ディレクティブテスト追加後にテストが失敗

- **症状**: 新規テスト追加後に関連テストが失敗する
- **原因**: テスト間の依存関係が存在する
- **解決策**:
  1. 依存関係を分析: `grep -r "import.*test" tests/`
  2. 段階的追加の実行
  3. 各段階でのテスト実行確認

#### 問題2: 新規テスト実装時のBreakdownLogger統合エラー

- **症状**: BreakdownLoggerが正常に動作しない
- **原因**: 環境変数の設定ミス
- **解決策**:
  1. 環境変数確認: `echo $LOG_KEY $LOG_LEVEL`
  2. デバッグレベル調整: `export LOG_LEVEL=trace`
  3. ログキー修正: `export LOG_KEY=test-integration`

#### 問題3: 24実行パターンテストの実装が複雑

- **症状**: パターンテストの設計が困難
- **原因**: 要求仕様の24パターンが抽象的
- **解決策**:
  1. パターンの具体化: 各パターンの詳細仕様確認
  2. 段階的実装: 基本パターンから順次実装
  3. テンプレート活用: 共通テスト構造の再利用

## 実行例

```bash
# 基本的なワークフロー実行
export LOG_KEY=test-design-debug
export LOG_LEVEL=debug
export LOG_LENGTH=L

# ステップ1: サポートされているディレクティブ特定
grep -r "x-frontmatter-part\|x-derived-from\|x-template" tests/ --include="*_test.ts" > tmp/supported-directive-tests.log

# ステップ2: テストカバレッジ分析
grep -l "transformDocuments\|processDocument" tests/**/*_test.ts > tmp/main-function-tests.log

# ステップ3: 詳細調査実行
deno test --allow-all tests/unit/ 2>&1 | tee tmp/debug-test-design-$(date +%Y%m%d_%H%M%S).log

# ステップ4-6: 改善実装と検証
# (具体的な実装は段階的に実行)
```

## 品質検証

- **再現性**: 95%以上（他者による実行成功率）
- **完全性**: 全ステップの実行可能性確認
- **有効性**: Issue #1003の問題解決確認
- **効率性**: ワークフロー実行時間の最適化