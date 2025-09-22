---
# XML変換メタデータ
workflow:
  id: "dry-principle-violation-analysis"
  type: "analysis"
  scope: "integration"
  version: "1.0"
  xml_convertible: true
dependencies:
  - breakdownlogger: "@tettuan/breakdownlogger@^1.0.0"
  - environment_vars: ["LOG_KEY", "LOG_LENGTH", "LOG_LEVEL"]
outputs:
  - debug_logs: "tmp/debug-dry-analysis-{timestamp}.log"
  - evidence: "tmp/evidence-dry-violations.json"
---

# DRY Principle Violation Analysis Workflow

## 目的

Issue #941で特定されたDRY原則違反の包括的分析を実行し、300+のエラーハンドリング重複、15+のFrontmatterData作成重複、50+のログ出力重複の根本原因を特定する。リファクタリング優先度と影響範囲を定量化する。

## 前提条件

- [ ] 条件1: Issue #941の内容を理解済み
- [ ] 条件2: ripgrep (rg) が利用可能
- [ ] 条件3: `src/application`と`src/domain`ディレクトリが存在
- [ ] 条件4: プロジェクト全体のコードアクセス権限

## 入力

- **対象**: プロジェクト全体のコードベース
- **症状**: DRY原則違反による保守性・一貫性・テスト複雑性の問題
- **コンテキスト**: Issue #941で特定された4つの主要重複パターン

## ワークフロー手順

### ステップ1: エラーハンドリング重複分析

{xml:step id="step1" type="investigation"}

1. Result<T,E>パターン重複確認:
   `rg "if \(!.*\.ok\)" src/ --count-matches`
2. エラー作成パターン重複:
   `rg "return err\(createError\(" src/ --count-matches`
3. 分布分析:
   `rg "if \(!.*\.ok\)" src/ --stats`
4. 期待される結果: 300+箇所のエラーハンドリング重複の定量化 {/xml:step}

### ステップ2: デバッグ環境設定

{xml:step id="step2" type="setup"}

1. 環境変数設定:
   `export LOG_KEY=workflow-analysis-dry-violations LOG_LEVEL=info`
2. 分析結果ディレクトリ作成: `mkdir -p tmp/dry-analysis/`
3. BreakdownLogger確認: `echo "DRY analysis session: $LOG_KEY"` {/xml:step}

### ステップ3: FrontmatterData作成重複分析

{xml:step id="step3" type="investigation"}

1. FrontmatterData.create()パターン検索:
   `rg "FrontmatterData\.create\(" src/ -A 3 -B 1 --no-heading > tmp/dry-analysis/frontmatter-creation-patterns.txt`
2. 重複箇所の定量化:
   `rg "FrontmatterData\.create\(" src/ --count-matches`
3. ファイル別分布確認:
   `rg "FrontmatterData\.create\(" src/ --files-with-matches | wc -l`
4. 期待される結果: 15+箇所の作成パターン重複とファイル分散状況 {/xml:step}

### ステップ4: ログ出力重複分析

{xml:step id="step4" type="investigation"}

1. 条件付きログパターン確認:
   `rg "this\.logger\?\." src/ --count-matches`
2. ログカテゴリ重複確認:
   `rg "\.logDebug\(" src/ -o | sort | uniq -c | sort -rn > tmp/dry-analysis/log-categories.txt`
3. ログメッセージ類似度分析:
   `rg "\.logDebug\(" src/ -A 1 --no-filename > tmp/dry-analysis/log-messages.txt`
4. 期待される結果: 50+箇所のログパターン重複とカテゴリ分散状況 {/xml:step}

### ステップ5: Smart Constructor重複分析

{xml:step id="step5" type="investigation"}

1. Smart Constructorパターン検索:
   `rg "static create\(" src/ --count-matches`
2. 初期化パターン重複確認:
   `rg "static create\(" src/ -A 10 | rg "if \(!.*\)" --count-matches`
3. 検証ロジック重複分析:
   `rg "static create\(" src/ -A 15 | rg "return err\(" --count-matches`
4. 期待される結果: 20+クラスでの同一初期化パターン重複 {/xml:step}

### ステップ6: 影響範囲と優先度評価

{xml:step id="step6" type="diagnosis"}

1. コードメンテナンス影響計算:
   - エラーハンドリング変更時の影響箇所数
   - FrontmatterData変更時の影響箇所数
   - ログ仕様変更時の影響箇所数
2. テスト複雑性評価:
   `find tests/ -name "*_test.ts" -exec grep -l "FrontmatterData\.create\|if (!.*\.ok)" {} \; | wc -l`
3. バンドルサイズ影響推定:
   - 重複パターンの平均行数 × 重複箇所数
4. リファクタリング優先度マトリックス作成 {/xml:step}

### ステップ7: 解決策検証

{xml:step id="step7" type="resolution"}

1. Issue #941のPhase 1-4計画妥当性確認:
   - Phase 1: ResultValidator utility class
   - Phase 2: ProcessingCoordinator統合
   - Phase 3: Utility consolidation
   - Phase 4: Validation and testing
2. 改善効果推定:
   - 削減可能行数計算
   - 保守性向上指標
   - テスト複雑性軽減効果
3. リスク評価: 既存テスト通過率への影響 {/xml:step}

## 出力

- **ログファイル**: `tmp/debug-dry-analysis-{timestamp}.log`
- **詳細分析レポート**: `tmp/dry-analysis/violation-summary.json`
- **重複パターンファイル**: `tmp/dry-analysis/patterns/`
- **リファクタリング計画**: Issue #941への具体的アクションプラン

## 成功基準

- [ ] 4つの主要重複パターンが定量化されている
- [ ] 影響範囲（ファイル数、行数、テスト複雑性）が数値化されている
- [ ] リファクタリング優先度が評価されている
- [ ] Issue #941の実装計画が検証されている

## 関連ワークフロー

- [ProcessingCoordinator Variance Debug](../component/processing-coordinator-variance.workflow.md)
- [Totality Compliance Debug](../component/totality-compliance.workflow.md)
- [Code Quality Analysis](../meta/code-quality-analysis.workflow.md)

## トラブルシューティング

### よくある問題

#### 問題1: ripgrepでのパターンマッチングが不正確

- **症状**: 重複箇所の数が期待値と大きく異なる
- **原因**: 正規表現パターンが不適切
- **解決策**: `rg --help`で構文確認し、エスケープ文字を適切に使用

#### 問題2: 大量の出力により分析が困難

- **症状**: ログやファイル出力が膨大で分析しきれない
- **原因**: フィルタリングが不十分
- **解決策**: `head -50`や`sort | uniq -c`でサマリー化して分析

#### 問題3: Issue #941との関連付けが不明確

- **症状**: 分析結果がIssueの改善計画に直結しない
- **原因**: 具体的アクションプランが不足
- **解決策**: 各Phase（1-4）に対する具体的削減目標数値を設定