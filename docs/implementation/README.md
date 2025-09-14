# Implementation Documentation

## 実装表現ドキュメント

このディレクトリは現在の実装状況を表現するドキュメント群です。設計文書ではなく、実装された機能の動作と構造を明示的に表現しています。

## Feature Implementation Documentation

### 1. Template Format Feature (x-template-format)

| File                          | Description                          | Format             |
| ----------------------------- | ------------------------------------ | ------------------ |
| `template-format-flow.dot`    | コンポーネント間の関係とデータフロー | Graphviz DOT       |
| `template-format-modules.dot` | モジュール依存関係図                 | Graphviz DOT       |
| `template-format-sequence.md` | 詳細シーケンス図とデータフロー       | Markdown + Mermaid |
| `template-format-examples.md` | 具体的使用例とフロー                 | Markdown           |

**x-template-format**:
スキーマにて出力フォーマット（JSON/YAML/TOML/Markdown）を指定する機能

### 2. Data Derivation Feature (x-derived-from, x-derived-unique)

| File                             | Description                          | Format             |
| -------------------------------- | ------------------------------------ | ------------------ |
| `derivation-processing-flow.dot` | データ集約処理のコンポーネントフロー | Graphviz DOT       |
| `derivation-processing-flow.md`  | x-derived ディレクティブの処理詳細   | Markdown + Mermaid |

**x-derived-from**: 配列要素から特定プロパティを抽出して新しいフィールドを生成
**x-derived-unique**: 抽出した値を一意化（重複除去）

### 実装された機能の統合フロー

#### 全体処理パイプライン

```
1. Schema Loading (x-* directives detection)
   ├─ x-template, x-template-items
   ├─ x-frontmatter-part
   ├─ x-derived-from, x-derived-unique
   └─ x-template-format

2. Document Processing
   ├─ Frontmatter extraction
   ├─ Validation against schema
   └─ Base property population

3. Data Aggregation (x-derived-* processing)
   ├─ DerivationRule extraction from schema
   ├─ Aggregator applies rules
   └─ Unique value filtering if specified

4. Template Rendering
   ├─ Template path resolution
   ├─ Variable replacement
   └─ Format output (x-template-format)
```

#### 責務分離の実装

- **Schema Layer**: 全x-*拡張の抽出・検証（SchemaDefinition,
  SchemaPropertyUtils）
- **Aggregation Layer**: x-derived-*の処理（DerivationRule, Aggregator）
- **Transformation Layer**: データ変換の統合（FrontmatterTransformationService）
- **Template Layer**: テンプレート処理とフォーマット解決
- **Application Layer**: 全体のオーケストレーション（PipelineOrchestrator）

### 図の生成方法

#### Graphviz DOT図のSVG生成

```bash
# Template format フロー図
dot -Tsvg docs/implementation/template-format-flow.dot -o tmp/template-format-flow.svg

# Template format モジュール図
dot -Tsvg docs/implementation/template-format-modules.dot -o tmp/template-format-modules.svg

# Derivation processing フロー図
dot -Tsvg docs/implementation/derivation-processing-flow.dot -o tmp/derivation-processing-flow.svg
```

#### Mermaidシーケンス図の表示

Mermaid対応エディタまたはmermaid-cliで`template-format-sequence.md`内の図を表示

### 実装状況

✅ **完了済み**:

- スキーマ拡張の追加
- 出力フォーマッター群（JSON/YAML/TOML/Markdown）
- パス解決での自動検出機能
- パイプライン統合
- 責務分離の改善

### 注意事項

- このドキュメントは実装の現状を表現するものです
- 設計変更時は対応する実装ドキュメントも更新してください
- 実装と乖離した場合は実装を正として修正してください
