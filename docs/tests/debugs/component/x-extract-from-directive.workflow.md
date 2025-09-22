---
workflow:
  id: "x-extract-from-directive-debug"
  type: "debug"
  scope: "component"
  version: "1.0"
  xml_convertible: true
dependencies:
  - breakdownlogger: "@tettuan/breakdownlogger@^1.0.0"
  - environment_vars: ["LOG_KEY", "LOG_LENGTH", "LOG_LEVEL"]
outputs:
  - debug_logs: "tmp/debug-x-extract-from-{timestamp}.log"
  - evidence: "tmp/evidence-x-extract-from.json"
---

# x-extract-from Directive Processing Debug Workflow

## 目的

Issue #966: x-extract-from ディレクティブが空IDを生成する問題の根本原因特定とデバッグ。

## 前提条件

- [ ] 条件1: BreakdownLogger が利用可能
- [ ] 条件2: 環境変数 LOG_KEY, LOG_LEVEL が設定可能
- [ ] 条件3: examples/3.docs ディレクトリが存在

## 入力

- **対象**: FrontmatterTransformationService.processFrontmatterParts()
- **症状**: x-extract-from "traceability[]" → 空ID生成
- **コンテキスト**: Issue #966、テンプレート変数 {id.full} が空文字列

## ワークフロー手順

### ステップ1: 初期確認

{xml:step id="step1" type="verification"}

1. Schema にディレクティブが存在することを確認:
   ```bash
   grep -n "x-extract-from\|x-jmespath-filter" examples/3.docs/index_req_schema.json
   ```
2. 実際のフロントマターデータを確認:
   ```bash
   head -20 examples/3.docs/docs/user-auth-management.md
   ```
3. 期待される結果: x-extract-from "traceability[]" と実際のtraceabilityデータが存在
{/xml:step}

### ステップ2: デバッグ環境設定

{xml:step id="step2" type="setup"}

1. 環境変数設定:
   ```bash
   export LOG_KEY=frontmatter-part-directive-processing LOG_LEVEL=debug LOG_LENGTH=L
   ```
2. BreakdownLogger有効化確認
3. 出力先ディレクトリ確認:
   ```bash
   mkdir -p tmp/
   ```
{/xml:step}

### ステップ3: 段階的調査

{xml:step id="step3" type="investigation"}

1. Schema.hasExtractFromDirectives() の動作確認:
   - 実行コマンド: デバッグ出力で hasExtractFromDirectives() の戻り値を確認
   - 確認ポイント: メソッドが true を返すか

2. Schema.getExtractFromDirectives() の動作確認:
   - 実行コマンド: ディレクティブが正しく取得されるか確認
   - 確認ポイント: traceability[] ディレクティブが存在するか

3. ExtractFromProcessor.processDirectives() の実行:
   - 実行コマンド: ディレクティブ処理が実際に実行されるか
   - 確認ポイント: 処理前後のFrontmatterDataの変化
{/xml:step}

### ステップ4: 問題特定

{xml:step id="step4" type="diagnosis"}

1. ログ分析:
   ```bash
   grep "Processing x-extract-from\|hasExtractFromDirectives\|getExtractFromDirectives" tmp/debug-x-extract-from-*.log
   ```
2. 症状パターン確認:
   - 安全呼び出し (&&) が使われている → メソッドが undefined の可能性
   - directivesResult.ok が false → ディレクティブ取得失敗
3. 根本原因仮説:
   - Schema インスタンスがディレクティブメソッドを持たない
   - または、ディレクティブ処理のタイミングが間違っている
{/xml:step}

### ステップ5: 検証・解決

{xml:step id="step5" type="resolution"}

1. 仮説検証:
   ```bash
   # Schema インスタンスの型と利用可能メソッドを確認
   LOG_KEY=schema-method-check LOG_LEVEL=debug ./cli.ts examples/3.docs/index_req_schema.json "examples/3.docs/docs/**/*.md" /tmp/debug-schema.json --verbose
   ```

2. ディレクティブ処理フローの確認:
   - x-frontmatter-part → 個別ファイル処理 → ディレクティブ適用のフロー
   - メインスキーマ vs 個別アイテムスキーマでのディレクティブ存在確認

3. 結果確認: 修正後、{id.full} テンプレート変数が正しく値を持つことを確認
{/xml:step}

## 出力

- **ログファイル**: `tmp/debug-x-extract-from-{timestamp}.log`
- **証跡データ**: `tmp/evidence-x-extract-from.json`
- **解決策**: ディレクティブ処理の実行タイミングと対象スキーマの修正

## 成功基準

- [ ] 問題の根本原因が特定されている（ディレクティブ処理の実行失敗）
- [ ] 解決策が実装され、検証されている
- [ ] examples/3.docs で正しいIDが抽出されることを確認
- [ ] デバッグプロセスが完全に記録されている

## 関連ワークフロー

- [Schema validation debug](./schema-validation.workflow.md)
- [Template rendering debug](./template-rendering.workflow.md)

## トラブルシューティング

### よくある問題

#### 問題1: hasExtractFromDirectives() が undefined

- **症状**: 安全呼び出し (&&) でメソッドが呼ばれない
- **原因**: Schema インスタンスが正しく作成されていない、または型が異なる
- **解決策**: Schema.create() の呼び出し確認とインスタンス検証

#### 問題2: ディレクティブが取得されるが処理されない

- **症状**: getExtractFromDirectives() は成功するが、processDirectives() で空結果
- **原因**: x-extract-from パス "traceability[]" が実際のデータ構造と不整合
- **解決策**: フロントマターデータ構造とディレクティブパスの整合性確認