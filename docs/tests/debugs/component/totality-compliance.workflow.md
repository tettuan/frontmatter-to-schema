---
# XML変換メタデータ
workflow:
  id: "totality-compliance-debug"
  type: "debug"
  scope: "component"
  version: "1.0"
  xml_convertible: true
dependencies:
  - breakdownlogger: "@tettuan/breakdownlogger@^1.0.0"
  - environment_vars: ["LOG_KEY", "LOG_LENGTH", "LOG_LEVEL"]
outputs:
  - debug_logs: "tmp/debug-totality-compliance-{timestamp}.log"
  - evidence: "tmp/evidence-totality-compliance.json"
---

# Totality Principle Compliance Debug Workflow

## 目的

Issue #937で特定されたTotality Principle違反（throw new
Error使用）を体系的に調査し、Result<T,E>パターンの適用状況を検証する。

## 前提条件

- [ ] 条件1: プロジェクトルートディレクトリで実行
- [ ] 条件2: ripgrep (rg) が利用可能
- [ ] 条件3: docs/development/totality.ja.md が参照可能
- [ ] 条件4: BreakdownLogger統合済み環境

## 入力

- **対象**: 全ソースコード内のthrow new Error使用箇所
- **症状**: Totality原則違反により型安全性が損なわれている
- **コンテキスト**: Issue #937で570+箇所の大量違反が特定済み

## ワークフロー手順

### ステップ1: 違反箇所の現状確認

{xml:step id="step1" type="verification"}

1. Source code違反数確認
   - 実行コマンド: `rg "throw new Error" src/ --count`
   - 期待される結果: 違反箇所数の把握
2. Test code違反数確認
   - 実行コマンド: `rg "throw new Error" tests/ --count`
   - 期待される結果: テストコード内の違反箇所数
3. 全体違反分布の確認
   - 実行コマンド: `rg "throw new Error" . --stats`
   - 期待される結果: ファイル別違反分布の把握 {/xml:step}

### ステップ2: デバッグ環境設定

{xml:step id="step2" type="setup"}

1. 環境変数設定:
   `export LOG_KEY=workflow-debug-totality-compliance LOG_LEVEL=debug`
2. BreakdownLogger有効化確認: `echo "Debug session: $LOG_KEY"`
3. 出力先ディレクトリ確認: `mkdir -p tmp/`
4. Totality原則ドキュメント確認: `head -30 docs/development/totality.ja.md`
   {/xml:step}

### ステップ3: 重要度別違反分析

{xml:step id="step3" type="investigation"}

1. ドメインロジック内の違反確認
   - 実行コマンド: `rg "throw new Error" src/domain/ -A 2 -B 2 --no-heading`
   - 確認ポイント: ビジネスロジック層での例外使用
2. アプリケーション層の違反確認
   - 実行コマンド:
     `rg "throw new Error" src/application/ -A 2 -B 2 --no-heading`
   - 確認ポイント: ユースケース層での例外使用
3. インフラ層の違反確認
   - 実行コマンド:
     `rg "throw new Error" src/infrastructure/ -A 2 -B 2 --no-heading`
   - 確認ポイント: 外部I/O層での例外使用
4. テストヘルパー層の違反確認
   - 実行コマンド: `rg "throw new Error" src/testing/ -A 2 -B 2 --no-heading`
   - 確認ポイント: テスト支援コードでの例外使用 {/xml:step}

### ステップ4: Result<T,E>パターン適用状況確認

{xml:step id="step4" type="diagnosis"}

1. 正しいResult型使用例の確認
   - 実行コマンド: `rg "return (ok|err)\\(" src/ -C 1 | head -20`
   - 確認ポイント: 適切なResult型使用パターン
2. 型定義の確認
   - 実行コマンド:
     `cat src/domain/shared/types/result.ts | grep -A 10 "export.*Result"`
   - 確認ポイント: Result型の定義内容
3. エラー型定義の確認
   - 実行コマンド:
     `cat src/domain/shared/types/errors.ts | grep -A 5 "export.*Error"`
   - 確認ポイント: DomainError型の定義 {/xml:step}

### ステップ5: 修正優先度の決定

{xml:step id="step5" type="resolution"}

1. クリティカル箇所の特定（ドメイン層優先）
   - 実行コマンド: `rg "throw new Error" src/domain/ --files-with-matches`
   - 確認ポイント: ビジネスロジックへの影響度
2. テストヘルパー修正の検討
   - 実行コマンド: `rg "throw new Error" src/testing/ --files-with-matches`
   - 確認ポイント: テスト実行への影響度
3. 段階的修正計画の策定
   - 優先度1: ドメイン層 → アプリケーション層
   - 優先度2: テストヘルパー層
   - 優先度3: テストコード全体 {/xml:step}

## 出力

- **ログファイル**: `tmp/debug-totality-compliance-{timestamp}.log`
- **証跡データ**: `tmp/evidence-totality-compliance.json`
- **解決策**: 段階的Result<T,E>パターン適用計画

## 成功基準

- [ ] 全違反箇所が正確にカウントされている
- [ ] 層別の違反分布が把握されている
- [ ] Result<T,E>パターンの適用状況が確認されている
- [ ] 修正優先度が明確化されている
- [ ] 段階的修正計画が策定されている

## 関連ワークフロー

- [Domain Specifications Debug](./domain-specifications.workflow.md)
- [Error Handling Patterns](./error-handling-patterns.workflow.md)
- [Issue #937 Resolution](../integration/issue-937-resolution.workflow.md)

## トラブルシューティング

### よくある問題

#### 問題1: ripgrepコマンドが見つからない

- **症状**: `rg: command not found`
- **原因**: ripgrepがインストールされていない
- **解決策**: `brew install ripgrep` または `cargo install ripgrep`

#### 問題2: Result型の理解が不十分

- **症状**: ok()とerr()の使い分けが不明
- **原因**: Totality原則の理解不足
- **解決策**:
  `docs/development/totality.ja.md`の熟読、特に219行目のエラー処理圧縮テクニック

#### 問題3: テスト実行で大量のエラー

- **症状**: deno testで570+のthrow new Errorによるテスト失敗
- **原因**: テストヘルパー層の例外使用
- **解決策**: assert()関数への置き換えを段階的に実施
