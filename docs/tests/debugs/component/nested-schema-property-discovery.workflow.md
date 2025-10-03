---
# XML変換メタデータ
workflow:
  id: "issue-1259-nested-schema-property-discovery"
  type: "debug"
  scope: "component"
  version: "1.0"
  xml_convertible: true
  related_issue: "https://github.com/tettuan/frontmatter-to-schema/issues/1259"
dependencies:
  - breakdownlogger: "@tettuan/breakdownlogger@^1.0.0"
  - environment_vars: ["LOG_KEY", "LOG_LENGTH", "LOG_LEVEL"]
outputs:
  - debug_logs: "tmp/debug-schema-discovery-{timestamp}.log"
  - evidence: "tmp/evidence-schema-discovery.json"
---

# Issue #1259: Nested x-frontmatter-part Discovery Workflow

## 目的

`DocumentAggregationService.getSchemaPropertyNames`がネストされた`x-frontmatter-part`ディレクティブを発見できない問題をデバッグし、再帰的探索実装の検証を行う。

## 前提条件

- [ ] 条件1: Deno実行環境が整っている
- [ ] 条件2: examples/0.basic/, examples/2.climpt/ ディレクトリが存在する
- [ ] 条件3: BreakdownLoggerが利用可能
- [ ] 条件4: Issue #1259の内容を理解している

## 入力

- **対象**:
  `src/domain/aggregation/services/document-aggregation-service.ts:205-264`
- **症状**:
  ネストされた`x-frontmatter-part`（例：`tools.commands`）が発見されず、エラー発生
- **コンテキスト**:
  `examples/0.basic`と`examples/2.climpt`で失敗、`examples/1.articles`（トップレベル）では成功

## ワークフロー手順

### ステップ1: 問題の再現確認

{xml:step id="step1" type="verification"}

1. 現在の実装でエラーを再現:
   ```bash
   # ❌ 失敗ケース（ネストされたx-frontmatter-part）
   ./cli.ts examples/0.basic/registry_schema.json examples/0.basic/ /tmp/test-basic.json

   # ❌ 失敗ケース（ネストされたx-frontmatter-part）
   ./cli.ts examples/2.climpt/registry_schema.json examples/2.climpt/ /tmp/test-climpt.json

   # ✅ 成功ケース（トップレベルx-frontmatter-part）
   ./cli.ts examples/1.articles/articles_schema.json examples/1.articles/docs/ /tmp/test-articles.yml
   ```

2. 期待されるエラー: `Schema must specify x-frontmatter-part properties`

3. スキーマ構造確認:
   ```bash
   # examples/0.basic/registry_schema.json の構造確認
   cat examples/0.basic/registry_schema.json | jq '.properties.tools.properties.commands."x-frontmatter-part"'
   # 結果: true (ネストされている)

   # examples/1.articles/articles_schema.json の構造確認
   cat examples/1.articles/articles_schema.json | jq '.properties.articles."x-frontmatter-part"'
   # 結果: true (トップレベル)
   ```

{/xml:step}

### ステップ2: デバッグ環境設定

{xml:step id="step2" type="setup"}

1. 環境変数設定:
   ```bash
   export LOG_KEY="schema-property-discovery"
   export LOG_LEVEL="debug"
   export LOG_LENGTH="L"
   ```

2. BreakdownLogger有効化確認:
   ```bash
   echo "BreakdownLogger enabled: LOG_KEY=${LOG_KEY}"
   ```

3. 出力先ディレクトリ確認:
   ```bash
   mkdir -p tmp/
   ```

{/xml:step}

### ステップ3: 実装コード分析

{xml:step id="step3" type="investigation"}

1. 現在の実装確認（line 233-241）:
   - トップレベルプロパティのみをイテレート
   - 再帰的探索なし
   - ネストされたプロパティを検出できない

2. 仕様要件確認（`docs/architecture/schema-directives-specification.md:96`）:
   - "スキーマ内に複数指定がある場合は、ツリーの最上位かつ最初に現れる宣言のみが有効"
   - 再帰的探索が必要

3. テンプレート構造分析（`examples/0.basic/registry_template.json`）:
   ```json
   {
     "tools": {
       "commands": "{@items}" // ← ネストされた構造を期待
     }
   }
   ```

{/xml:step}

### ステップ4: テスト追加による問題特定

{xml:step id="step4" type="diagnosis"}

1. 現在のテストカバレッジ確認:
   ```bash
   # 既存テストの確認
   grep -A 30 "property name mapping with schema x-frontmatter-part" \
     tests/unit/domain/aggregation/services/document-aggregation-service_test.ts
   ```

2. ネストされたケースのテスト追加:
   ```typescript
   // 新規テスト: ネストされたx-frontmatter-part
   Deno.test("DocumentAggregationService - nested x-frontmatter-part discovery", () => {
     const service = DocumentAggregationService.create().unwrap();
     const documents = [
       createMockDocument("/test/doc1.md", { id: "1", name: "Test" }),
     ];

     const schema = {
       type: "object",
       properties: {
         tools: {
           type: "object",
           properties: {
             commands: {
               type: "array",
               "x-frontmatter-part": true,
             },
           },
         },
       },
     };

     const result = service.transformDocuments(documents, null, schema);

     // 現在は失敗するが、修正後は成功すべき
     assertEquals(result.isOk(), true);
     const transformed = result.unwrap();
     // ネストされた構造を期待
     assertEquals(transformed.tools?.commands !== undefined, true);
   });
   ```

3. テスト実行と失敗確認:
   ```bash
   deno test --allow-all --filter="nested x-frontmatter-part" \
     tests/unit/domain/aggregation/services/document-aggregation-service_test.ts
   ```

{/xml:step}

### ステップ5: 修正実装の設計

{xml:step id="step5" type="resolution"}

1. 再帰的探索アルゴリズムの設計:
   ```typescript
   // 概念的実装
   private getSchemaPropertyNames(
     schema?: Record<string, unknown>,
   ): Result<string[], ProcessingError> {
     // 1. 再帰的にスキーマを探索
     // 2. x-frontmatter-part: true を発見
     // 3. 完全なプロパティパス（例："tools.commands"）を返す
     // 4. 最も浅い階層を優先（depth-first search）
   }
   ```

2. データ構造構築の設計:
   ```typescript
   // createAggregatedData での処理
   // ネストされたパス（"tools.commands"）を扱う
   // 例: "tools.commands" → { tools: { commands: [...] } }
   ```

3. 検証項目:
   - ✅ examples/0.basic が成功する
   - ✅ examples/2.climpt が成功する
   - ✅ examples/1.articles が引き続き成功する（後方互換性）
   - ✅ 新規テストケースがパスする

{/xml:step}

### ステップ6: 実装後の検証

{xml:step id="step6" type="verification"}

1. 全テストの実行:
   ```bash
   deno task test:coverage
   ```

2. 実例での検証:
   ```bash
   # すべてのexamplesが成功することを確認
   ./cli.ts examples/0.basic/registry_schema.json examples/0.basic/ tmp/test-basic.json
   ./cli.ts examples/2.climpt/registry_schema.json examples/2.climpt/ tmp/test-climpt.json
   ./cli.ts examples/1.articles/articles_schema.json examples/1.articles/docs/ tmp/test-articles.yml
   ```

3. 出力ファイルの検証:
   ```bash
   # ネストされた構造が正しく生成されているか確認
   cat tmp/test-basic.json | jq '.tools.commands | length'
   cat tmp/test-climpt.json | jq '.tools.commands | length'
   ```

{/xml:step}

## 出力

- **ログファイル**: `tmp/debug-schema-discovery-{timestamp}.log`
- **証跡データ**: `tmp/evidence-schema-discovery.json`
- **解決策**: 再帰的スキーマ探索とネストされたパス処理の実装

## 成功基準

- [ ] ネストされた`x-frontmatter-part`が正しく発見される
- [ ] 完全なプロパティパス（例："tools.commands"）が返される
- [ ] examples/0.basic と examples/2.climpt が成功する
- [ ] 既存の examples/1.articles が引き続き動作する（後方互換性）
- [ ] 新規テストケースがすべてパスする
- [ ] カバレッジが80%以上を維持する

## 関連ワークフロー

- [Schema Directive Processing](./component/directive-processor-comprehensive.workflow.md)
- [Requirement Implementation Gap Analysis](./02-architecture/07-requirement-implementation-gap.workflow.md)
- [Test Coverage Improvement](./02-architecture/test-coverage-improvement.workflow.md)

## トラブルシューティング

### よくある問題

#### 問題1: 再帰探索が深すぎて循環参照エラー

- **症状**: Stack overflow または無限ループ
- **原因**: `$ref`による循環参照の未処理
- **解決策**: 訪問済みパスのトラッキング、最大深度制限

#### 問題2: ネストされたパスのデータ構造構築失敗

- **症状**: `transformed.tools.commands`が`undefined`
- **原因**: ドット記法パスからネストされたオブジェクトへの変換が不完全
- **解決策**: パス分割と再帰的オブジェクト構築ユーティリティの実装

#### 問題3: 複数の`x-frontmatter-part`が存在する場合の優先順位

- **症状**: 誤った階層の`x-frontmatter-part`が選択される
- **原因**: 深度優先探索の順序が不適切
- **解決策**: 最浅層優先のBFS（幅優先探索）アルゴリズムの実装

## 参照資料

### 仕様書

- `docs/architecture/schema-directives-specification.md` (line 89-109)
- `docs/architecture/mapping-hierarchy-rules.md`
- `docs/requirements.ja.md` (line 115-141)

### 実装ファイル

- `src/domain/aggregation/services/document-aggregation-service.ts:205-264`
- `src/domain/aggregation/services/document-aggregation-service.ts:149-199`

### テストファイル

- `tests/unit/domain/aggregation/services/document-aggregation-service_test.ts:498-548`

### 関連Issue

- Issue #1259: https://github.com/tettuan/frontmatter-to-schema/issues/1259
- Issue #1242 (Closed): Aggregation Service Hardcodes Metadata Properties
- Issue #1234 (Closed): Property Name Mapping Gap
