---
# XML変換メタデータ
workflow:
  id: "template-variable-resolution"
  type: "debug"
  scope: "component"
  version: "1.0"
  xml_convertible: true
dependencies:
  - breakdownlogger: "@tettuan/breakdownlogger@^1.0.0"
  - environment_vars: ["LOG_KEY", "LOG_LENGTH", "LOG_LEVEL"]
outputs:
  - debug_logs: "tmp/debug-template-var-{timestamp}.log"
  - evidence: "tmp/evidence-template-var.json"
  - issue_tracking: "GitHub Issue #1071"
---

# Template Variable Resolution Debug Workflow

## 目的

x-flatten-arrays
ディレクティブ処理後のデータが、テンプレート変数解決段階で失われる問題を特定し、修正する。

## 前提条件

- [ ] 条件1: x-flatten-arrays-value-relay_test.ts が成功すること
- [ ] 条件2: examples/3.docs のテストデータが存在すること
- [ ] 条件3: BreakdownLogger環境変数が設定可能であること

## 入力

- **対象**: OutputRenderingService, TemplateVariableResolver
- **症状**: フラット化された配列データがテンプレート変数マッピング時に消失
- **コンテキスト**: examples/3.docs での複雑なネスト構造処理

## ワークフロー手順

### ステップ1: 初期確認

{xml:step id="step1" type="verification"}

1. x-flatten-arrays テストの確認
   ```bash
   deno test tests/integration/x-flatten-arrays-value-relay_test.ts
   ```

2. examples/3.docs のデータ確認
   ```bash
   ls -la examples/3.docs/
   cat examples/3.docs/req_level_template.json
   ```

3. 期待される結果: x-flatten-arrays は成功、テンプレート処理で失敗

{/xml:step}

### ステップ2: デバッグ環境設定

{xml:step id="step2" type="setup"}

1. 環境変数設定
   ```bash
   export LOG_KEY=template-variable-resolution
   export LOG_LEVEL=debug
   export LOG_LENGTH=W
   ```

2. BreakdownLogger有効化確認
   ```bash
   grep -r "BreakdownLogger" src/domain/template/
   ```

3. 出力先ディレクトリ確認
   ```bash
   mkdir -p tmp/
   ```

{/xml:step}

### ステップ3: 段階的調査

{xml:step id="step3" type="investigation"}

1. DirectiveProcessor出力の確認
   ```bash
   LOG_KEY=directive-processing deno run --allow-all cli.ts \
     examples/3.docs/req_level_schema.json \
     "examples/3.docs/requirements/*.md" \
     tmp/directive-output.json --verbose
   ```
   - 確認ポイント: flattened arrays の存在、データ構造の確認

2. TemplateVariableResolver のトレース
   ```bash
   LOG_KEY=template-variable-resolution deno test \
     tests/unit/domain/template/services/template-variable-resolver_test.ts
   ```
   - 確認ポイント: ネストパス解決の成功/失敗パターン

3. OutputRenderingService の変数マッピング追跡
   ```bash
   LOG_KEY=output-rendering deno run --allow-all cli.ts \
     examples/3.docs/req_level_schema.json \
     "examples/3.docs/requirements/*.md" \
     tmp/template-output.json --verbose
   ```
   - 確認ポイント: データ受け渡し時点での値の存在

{/xml:step}

### ステップ4: 問題特定

{xml:step id="step4" type="diagnosis"}

1. ログ分析
   ```bash
   grep -n "template-variable" tmp/debug-*.log | tail -50
   grep -n "undefined\|null\|empty" tmp/debug-*.log
   ```

2. 症状パターン確認
   - パターンA: ネストパス `{id.full}` の解決失敗
   - パターンB: 配列展開 `{@items}` 時のコンテキスト喪失
   - パターンC: FrontmatterData → Template 間の型不一致

3. 根本原因仮説
   - 仮説1: TemplateVariableResolver が深いパスを解決できない
   - 仮説2: 配列要素のプロパティアクセスが正しく実装されていない
   - 仮説3: 中間表現層の欠如による構造不一致

{/xml:step}

### ステップ5: 検証・解決

{xml:step id="step5" type="resolution"}

1. 仮説検証
   ```typescript
   // テストケース追加
   const testData = {
     items: [
       { id: { full: "REQ-001", level: "REQ" } },
       { id: { full: "REQ-002", level: "REQ" } },
     ],
   };
   const template = "{items[0].id.full}";
   // 期待: "REQ-001"、実際: undefined?
   ```

2. 解決策適用
   - TemplateVariableResolver.resolve() の改修
   - 深いパス解決ロジックの追加
   - 配列要素プロパティアクセスの修正

3. 結果確認
   ```bash
   deno test tests/integration/x-flatten-arrays-value-relay_test.ts
   deno run --allow-all cli.ts examples/3.docs/req_level_schema.json \
     "examples/3.docs/requirements/*.md" \
     examples/3.docs/output.json
   ```

{/xml:step}

## 出力

- **ログファイル**: `tmp/debug-template-var-*.log`
- **証跡データ**: `tmp/evidence-template-var.json`
- **解決策**: TemplateVariableResolver の改修による深いパス解決

## 成功基準

- [ ] フラット化されたデータがテンプレート出力に正しく反映される
- [ ] examples/3.docs の期待される出力が生成される
- [ ] 深いネストパス（例: `{items[].id.full}`）が解決される
- [ ] 再現手順が他者によって実行可能

## 関連ワークフロー

- [x-flatten-arrays Debug](../integration/x-flatten-arrays-debugging.workflow.md)
- [DirectiveProcessor Analysis](./directive-processor-comprehensive.workflow.md)
- [Template Variable Defaults](./template-variable-defaults.workflow.md)

## トラブルシューティング

### よくある問題

#### 問題1: TemplateVariableResolver がネストパスを解決できない

- **症状**: `{id.full}` などの深いパスが undefined になる
- **原因**: ドット記法パーサーの実装不足
- **解決策**: 再帰的なプロパティアクセス実装の追加

#### 問題2: 配列展開時のコンテキスト喪失

- **症状**: `{@items}` 展開後、個々の要素のプロパティが取得できない
- **原因**: 配列要素ごとのスコープ管理不足
- **解決策**: TemplateContext にスコープスタック機構を追加

#### 問題3: FrontmatterData と Template の型不一致

- **症状**: データは存在するが、テンプレート変数が解決されない
- **原因**: FrontmatterData の内部構造とテンプレートが期待する構造の相違
- **解決策**: 中間表現層（IntermediateRepresentation）の導入
