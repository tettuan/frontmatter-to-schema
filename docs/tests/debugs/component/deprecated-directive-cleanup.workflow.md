---
# XML変換メタデータ
workflow:
  id: "deprecated-directive-cleanup"
  type: "component"
  scope: "directive-cleanup"
  version: "1.0"
  xml_convertible: true
dependencies:
  - breakdownlogger: "@tettuan/breakdownlogger@^1.0.0"
  - environment_vars: ["LOG_KEY", "LOG_LENGTH", "LOG_LEVEL"]
outputs:
  - debug_logs: "tmp/debug-directive-cleanup-{timestamp}.log"
  - evidence: "tmp/evidence-directive-cleanup.json"
  - cleanup_report: "tmp/directive-cleanup-report.md"
---

# サポートされているディレクティブのテスト強化ワークフロー

## 目的

Issue #995で特定された要件と実装の矛盾を解決し、現在サポートされているディレクティブ（x-frontmatter-part, x-derived-from, x-template等）のテストカバレッジを強化する。

## 前提条件

- [ ] 条件1: Issue #995の内容が理解されている
- [ ] 条件2: 現在サポートされているディレクティブのテストカバレッジが不十分であることが確認済み
- [ ] 条件3: 要求仕様書で現在サポートされているディレクティブが明確に定義されていることが確認済み
- [ ] 条件4: BreakdownLoggerが利用可能

## 入力

- **対象**: x-frontmatter-part, x-derived-from, x-template, x-template-items, x-template-format, x-jmespath-filter ディレクティブ
- **症状**: サポートされている機能のテストカバレッジ不足
- **コンテキスト**: 要件-実装適合の強化

## ワークフロー手順

### ステップ1: サポートされているディレクティブの完全調査

{xml:step id="step1" type="investigation"}

1. 現在サポートされているディレクティブの実装状況の詳細調査
   - 実行コマンド: `find . -name "*.ts" -not -path "./node_modules/*" | xargs grep -l "x-frontmatter-part\|x-derived-from\|x-template"`
   - 確認ポイント: 実装ファイル数の現状確認と使用パターン分析
2. 各ディレクティブの使用詳細の分析
   - 実行コマンド: `grep -n "x-frontmatter-part\|x-derived-from\|x-template\|x-jmespath-filter" $(find . -name "*.ts" -not -path "./node_modules/*") > tmp/supported-directive-usage-detailed.log`
   - 確認ポイント: 実装箇所と使用方法の特定

{/xml:step}

### ステップ2: ディレクティブテストカバレッジ分析

{xml:step id="step2" type="analysis"}

1. サポートされているディレクティブのテストカバレッジ調査
   - 実行コマンド: `grep -A 10 -B 10 "x-frontmatter-part\|x-derived-from\|x-template" src/domain/schema/services/directive-processor.ts`
   - 確認ポイント: DirectiveProcessorでの処理ロジックの完全性
2. テストファイルでのディレクティブテスト状況確認
   - 実行コマンド: `grep -A 5 -B 5 "x-frontmatter-part\|x-derived-from\|x-template" tests/**/*_test.ts`
   - 確認ポイント: 各ディレクティブのテストカバレッジ状況

{/xml:step}

### ステップ3: テスト強化計画の策定

{xml:step id="step3" type="planning"}

1. テスト強化順序の決定（効果的な強化シーケンス）
   - フェーズ1: 既存テストファイルの強化
   - フェーズ2: 新規テストケースの追加
   - フェーズ3: ドキュメントとの整合性確保
2. 各フェーズでの品質向上分析
   - ログ分析: `LOG_KEY=directive-test-enhancement LOG_LEVEL=info`
   - 影響範囲: 各強化による品質向上効果予測

{/xml:step}

### ステップ4: フェーズ1 - テストファイル強化

{xml:step id="step4" type="enhance-tests"}

1. 既存テストファイルのサポートされているディレクティブテスト強化
   - 実行前確認: `deno test --allow-all 2>&1 | tail -5`（現在の通過状況）
   - 強化実行: 段階的にテストケースを追加・改善
   - 実行後確認: 各修正後のテスト実行結果確認
2. テスト強化時のBreakdownLogger活用
   - 環境変数設定: `export LOG_KEY=test-enhancement LOG_LEVEL=debug`
   - デバッグ出力: 強化内容の詳細ログ取得

{/xml:step}

### ステップ5: フェーズ2 - 新規テストケース追加

{xml:step id="step5" type="add-test-cases"}

1. DirectiveProcessorでサポートされている機能の網羅的テスト追加
   - 対象ファイル: `tests/unit/domain/schema/services/directive-processor_test.ts`
   - 追加内容: x-frontmatter-part, x-derived-from, x-template等の全ディレクティブテスト
   - 確認方法: TypeScriptコンパイルエラーの有無確認とテスト実行
2. 関連サービスでのディレクティブテスト追加
   - 対象範囲: FrontmatterTransformationService等の関連サービステスト
   - 実行コマンド: `grep -r "x-frontmatter-part\|x-derived-from" tests/unit/domain/`
   - 確認ポイント: すべてのサポート機能のテストカバレッジ確保

{/xml:step}

### ステップ6: フェーズ3 - ドキュメント・設定ファイル更新

{xml:step id="step6" type="update-docs"}

1. ドキュメントでのサポートされているディレクティブの説明強化
   - 対象ファイル: README.md, docs/**/*.md
   - 実行コマンド: `grep -r "x-frontmatter-part\|x-derived-from\|x-template" docs/`
   - 更新内容: サポートされているディレクティブの詳細説明・例の追加
2. 設定ファイル・例でのディレクティブ使用例の充実
   - 対象範囲: examples/, schemas/, templates/
   - 確認方法: 全例が正常に動作し、現在の機能を適切に示していることの確認

{/xml:step}

### ステップ7: 最終検証

{xml:step id="step7" type="verification"}

1. テストカバレッジの確認
   - 検証コマンド: `find . -type f -name "*_test.ts" | xargs grep -l "x-frontmatter-part\|x-derived-from\|x-template" | wc -l`
   - 期待結果: サポートされているディレクティブの網羅的テストカバレッジ確保
2. システム全体の動作確認
   - テスト実行: `deno test --allow-all`
   - 期待結果: 385 passed / 0 failed 維持
   - コンパイル確認: `deno task check`
   - 期待結果: エラーなし

{/xml:step}

## 出力

- **ログファイル**: `tmp/debug-directive-cleanup-{timestamp}.log`
- **証跡データ**: `tmp/evidence-directive-cleanup.json`
- **クリーンアップレポート**: `tmp/directive-cleanup-report.md`
- **削除前後比較**: `tmp/before-after-comparison.md`

## 成功基準

- [ ] サポートされているディレクティブ（x-frontmatter-part, x-derived-from, x-template等）のテストカバレッジが充実している
- [ ] 全テストが通過している（385 passed / 0 failed）
- [ ] TypeScriptコンパイルエラーが発生していない
- [ ] Issue #995の要件-実装適合が強化されている
- [ ] システムの主要機能が正常に動作している
- [ ] ドキュメントが最新の仕様と整合している

## 関連ワークフロー

- [要件整合性検証](../integration/requirement-alignment.workflow.md)
- [テスト設計不整合デバッグ](../integration/test-design-misalignment.workflow.md)
- [システム品質検証](../e2e/system-quality-verification.workflow.md)

## トラブルシューティング

### よくある問題

#### 問題1: テスト強化後にテストが失敗

- **症状**: 新規テスト追加後に既存テストが失敗
- **原因**: テスト間の干渉や隠れた依存関係の存在
- **解決策**:
  1. 失敗テストの詳細分析: `LOG_KEY=test-failure LOG_LEVEL=trace`
  2. 段階的ロールバック: 最後に追加したテストの一時的な無効化
  3. より細かい段階でのテスト追加実行

#### 問題2: DirectiveProcessorでのテスト追加が複雑

- **症状**: DirectiveProcessorのテスト追加が他のテストに影響
- **原因**: ディレクティブ処理の複雑な相互作用
- **解決策**:
  1. 処理フローの詳細分析: BreakdownLoggerで処理順序を確認
  2. テスト分離: 各ディレクティブのテストを独立して実行可能にする
  3. 段階的テスト追加: 一つずつディレクティブのテストを追加して動作確認

#### 問題3: テストカバレッジの不足箇所の特定

- **症状**: 一部のディレクティブ機能がテストされていない
- **原因**: 動的な処理パスや条件分岐の見落とし
- **解決策**:
  1. より包括的な検索: `grep -r "x-[a-zA-Z-]+" src/`
  2. TypeScriptコンパイラーの活用: 未使用変数やパスの警告確認
  3. ランタイムテストでの確認: 全ディレクティブ機能の動作テスト

## 実行例

```bash
# 環境設定
export LOG_KEY=directive-cleanup
export LOG_LEVEL=debug
export LOG_LENGTH=L

# ステップ1: 現状調査
echo "=== サポートされているディレクティブ現状調査 ==="
find . -name "*.ts" -not -path "./node_modules/*" | xargs grep -l "x-frontmatter-part\|x-derived-from\|x-template" | tee tmp/supported-directive-files.log
echo "対象ファイル数: $(cat tmp/supported-directive-files.log | wc -l)"

# ステップ2: 詳細分析
echo "=== 詳細使用状況分析 ==="
grep -n "x-frontmatter-part\|x-derived-from\|x-template" $(cat tmp/supported-directive-files.log) > tmp/supported-directive-usage-detailed.log
cat tmp/supported-directive-usage-detailed.log

# ステップ3-7: 段階的テスト強化実行
# （実際のテスト強化は手動で慎重に実行）

# 最終確認
echo "=== 最終確認 ==="
deno test --allow-all
deno task check
find . -type f -name "*_test.ts" | xargs grep -l "x-frontmatter-part\|x-derived-from\|x-template" | wc -l
```

## 品質検証

- **完全性**: サポートされているディレクティブの100%テストカバレッジ
- **安全性**: システム機能の完全維持
- **再現性**: ワークフロー実行の95%以上成功率
- **文書化**: テスト強化プロセスの完全記録