# 用語集 (Glossary)

このドキュメントは、frontmatter-to-schemaプロジェクトで使用される技術用語を整理し、関連ドキュメントへのリンクを提供します。

---

## 目次

- [配列処理関連](#配列処理関連)
- [ディレクティブ関連](#ディレクティブ関連)
- [テンプレート関連](#テンプレート関連)
- [Schema関連](#schema関連)
- [処理フェーズ関連](#処理フェーズ関連)
- [アーキテクチャ関連](#アーキテクチャ関連)
- [データ構造関連](#データ構造関連)

---

## 配列処理関連

### `items[]` 記法 (Array Expansion Notation)

| 項目             | 説明                                                     |
| ---------------- | -------------------------------------------------------- |
| **定義**         | Schema内のパス式で配列の各要素にアクセスするための記法   |
| **用途**         | `x-derived-from`ディレクティブ内でデータ抽出と集約に使用 |
| **処理フェーズ** | Phase 2 (Aggregation)                                    |
| **例**           | `"x-derived-from": "commands[].c1"`                      |
| **動作**         | 配列`commands`の各要素から`c1`プロパティを抽出           |
| **構文種別**     | JMESPath互換パス式                                       |

**関連ドキュメント**:

- [requirements.ja.md](./requirements.ja.md#L393-427) - パス記法の詳細
- [flow.ja.md](./flow.ja.md#L19-25) - 解析結果データの処理指示
- [architecture/schema-directives-specification.md](./architecture/schema-directives-specification.md) -
  ディレクティブ仕様

**関連用語**: [`{@items}`](#items-記法-template-array-expansion),
[`x-derived-from`](#x-derived-from), [`x-flatten-arrays`](#x-flatten-arrays)

---

### `{@items}` 記法 (Template Array Expansion)

| 項目             | 説明                                                                   |
| ---------------- | ---------------------------------------------------------------------- |
| **定義**         | テンプレート内で配列データをレンダリングするための特殊プレースホルダー |
| **用途**         | テンプレートファイル内で配列を展開・レンダリング                       |
| **処理フェーズ** | Phase 3 (Template)                                                     |
| **例**           | `{"commands": ["{@items}"]}`                                           |
| **動作**         | `x-template-items`で指定されたテンプレートを各配列要素に適用し展開     |
| **連携**         | `x-frontmatter-part: true`配列と`x-template-items`ディレクティブが必須 |

**関連ドキュメント**:

- [requirements.ja.md](./requirements.ja.md#L53-78) -
  `{@items}`展開の確定タイミング
- [flow.ja.md](./flow.ja.md#L68) - `{@items}`の特別な要求処理
- [architecture/template-processing-specification.md](./architecture/template-processing-specification.md) -
  テンプレート処理仕様
- [architecture/x-template-items-specification.md](./architecture/x-template-items-specification.md) -
  x-template-items詳細仕様

**関連用語**: [`items[]`](#items-記法-array-expansion-notation),
[`x-template-items`](#x-template-items),
[`x-frontmatter-part`](#x-frontmatter-part)

---

### `items[].prop[]` 記法 (Double Array Expansion)

| 項目             | 説明                                                   |
| ---------------- | ------------------------------------------------------ |
| **定義**         | ネストした配列を完全にフラット化するための二重展開記法 |
| **用途**         | `x-derived-from`でネスト配列を一次元配列に変換         |
| **処理フェーズ** | Phase 2 (Aggregation)                                  |
| **例**           | `"x-derived-from": "articles[].topics[]"`              |
| **動作**         | `articles`配列の各要素の`topics`配列をすべてフラット化 |
| **入力例**       | `articles: [{topics: ["A", "B"]}, {topics: ["C"]}]`    |
| **出力例**       | `["A", "B", "C"]`                                      |

**関連ドキュメント**:

- [requirements.ja.md](./requirements.ja.md#L143-153) - フラット化の動作原理

**関連用語**: [`items[]`](#items-記法-array-expansion-notation),
[`x-flatten-arrays`](#x-flatten-arrays), [`x-derived-from`](#x-derived-from)

---

## ディレクティブ関連

### `x-frontmatter-part`

| 項目             | 説明                                                             |
| ---------------- | ---------------------------------------------------------------- |
| **定義**         | 各Markdownファイルのフロントマター処理の起点を示すディレクティブ |
| **型**           | `boolean`                                                        |
| **適用対象**     | Schema内の配列プロパティ                                         |
| **処理フェーズ** | Phase 1 (Extraction)                                             |
| **例**           | `"x-frontmatter-part": true`                                     |
| **動作**         | この配列が複数Markdownファイルから統合されることを示す           |

**関連ドキュメント**:

- [requirements.ja.md](./requirements.ja.md#L124-126) - 基本ディレクティブ
- [flow.ja.md](./flow.ja.md#L10-11) - フロントマター解析の構造
- [architecture/schema-directives-specification.md](./architecture/schema-directives-specification.md) -
  ディレクティブ仕様

**関連用語**: [`{@items}`](#items-記法-template-array-expansion),
[`x-template-items`](#x-template-items)

---

### `x-flatten-arrays`

| 項目             | 説明                                                                     |
| ---------------- | ------------------------------------------------------------------------ |
| **定義**         | フロントマター内のネスト配列をフラット化するディレクティブ（オプション） |
| **型**           | `string` (フラット化対象のプロパティ名)                                  |
| **適用対象**     | Schema内の配列プロパティ                                                 |
| **処理フェーズ** | Phase 1 (Extraction) - 個別ファイル処理時                                |
| **例**           | `"x-flatten-arrays": "traceability"`                                     |
| **動作**         | 指定されたプロパティの配列をフラット化（未指定時は構造維持）             |

**関連ドキュメント**:

- [requirements.ja.md](./requirements.ja.md#L128-161) - フラット化機能と動作原理
- [implementation/derivation-processing-flow.md](./implementation/derivation-processing-flow.md) -
  派生処理フロー

**関連用語**: [`items[]`](#items-記法-array-expansion-notation),
[`items[].prop[]`](#itemsprop-記法-double-array-expansion)

---

### `x-derived-from`

| 項目             | 説明                                                   |
| ---------------- | ------------------------------------------------------ |
| **定義**         | 他のプロパティから値を集約・派生するディレクティブ     |
| **型**           | `string` または `string[]` (パス式)                    |
| **適用対象**     | 任意のSchemaプロパティ                                 |
| **処理フェーズ** | Phase 2 (Aggregation) - 全ファイル処理完了後           |
| **例**           | `"x-derived-from": "commands[].c1"`                    |
| **動作**         | 指定されたパス式から値を抽出し、新しいプロパティに集約 |

**関連ドキュメント**:

- [requirements.ja.md](./requirements.ja.md#L393-427) - パス記法の詳細と集約機能
- [architecture/schema-directives-specification.md](./architecture/schema-directives-specification.md) -
  ディレクティブ仕様
- [implementation/derivation-processing-flow.md](./implementation/derivation-processing-flow.md) -
  派生処理フロー

**関連用語**: [`items[]`](#items-記法-array-expansion-notation),
[`x-derived-unique`](#x-derived-unique),
[`x-jmespath-filter`](#x-jmespath-filter)

---

### `x-derived-unique`

| 項目             | 説明                                           |
| ---------------- | ---------------------------------------------- |
| **定義**         | 集約された配列から重複を削除するディレクティブ |
| **型**           | `boolean`                                      |
| **適用対象**     | 配列プロパティ（`x-derived-from`と併用）       |
| **処理フェーズ** | Phase 2 (Aggregation)                          |
| **例**           | `"x-derived-unique": true`                     |
| **動作**         | `x-derived-from`で集約した配列の重複要素を削除 |
| **依存関係**     | `x-derived-from`の実行後に処理される           |

**関連ドキュメント**:

- [requirements.ja.md](./requirements.ja.md#L359-363) - データ変換ディレクティブ
- [implementation/derivation-processing-flow.md](./implementation/derivation-processing-flow.md) -
  派生処理フロー

**関連用語**: [`x-derived-from`](#x-derived-from)

---

### `x-jmespath-filter`

| 項目             | 説明                                                     |
| ---------------- | -------------------------------------------------------- |
| **定義**         | JMESPath式によるデータの動的フィルタリングディレクティブ |
| **型**           | `string` (JMESPath式)                                    |
| **適用対象**     | 配列プロパティ                                           |
| **処理フェーズ** | Phase 1 (Extraction) - 個別ファイル処理時                |
| **例**           | `"x-jmespath-filter": "commands[?c1 == 'git']"`          |
| **動作**         | JMESPath式を評価し、条件に合うデータのみを抽出           |

**関連ドキュメント**:

- [requirements.ja.md](./requirements.ja.md#L359-363) - データ変換ディレクティブ
- [requirements.ja.md](./requirements.ja.md#L411-413) -
  JMESPathフィルタリング詳細

**関連用語**: [`x-derived-from`](#x-derived-from)

---

### `x-template`

| 項目             | 説明                                                     |
| ---------------- | -------------------------------------------------------- |
| **定義**         | コンテナテンプレートファイルを指定するディレクティブ     |
| **型**           | `string` (テンプレートファイルパス)                      |
| **適用対象**     | ルートSchema                                             |
| **処理フェーズ** | Phase 3 (Template)                                       |
| **例**           | `"x-template": "registry_template.json"`                 |
| **動作**         | メインのコンテナ構造を定義するテンプレートファイルを指定 |

**関連ドキュメント**:

- [requirements.ja.md](./requirements.ja.md#L256-264) - テンプレート指定機能
- [flow.ja.md](./flow.ja.md#L64-67) - テンプレート処理フロー
- [architecture/template-processing-specification.md](./architecture/template-processing-specification.md) -
  テンプレート処理仕様

**関連用語**: [`x-template-items`](#x-template-items),
[`x-template-format`](#x-template-format)

---

### `x-template-items`

| 項目             | 説明                                                                           |
| ---------------- | ------------------------------------------------------------------------------ |
| **定義**         | `{@items}`展開時に使用するアイテムテンプレートファイルを指定するディレクティブ |
| **型**           | `string` (テンプレートファイルパス)                                            |
| **適用対象**     | ルートSchema                                                                   |
| **処理フェーズ** | Phase 3 (Template)                                                             |
| **例**           | `"x-template-items": "registry_command_template.json"`                         |
| **動作**         | 各配列要素に適用されるテンプレートファイルを指定                               |
| **連携**         | `{@items}`プレースホルダーと`x-frontmatter-part`配列が必要                     |

**関連ドキュメント**:

- [requirements.ja.md](./requirements.ja.md#L267-271) - アイテムテンプレート指定
- [requirements.ja.md](./requirements.ja.md#L294-330) -
  json-templateモジュール使用
- [flow.ja.md](./flow.ja.md#L91-137) - json-templateの役割
- [architecture/x-template-items-specification.md](./architecture/x-template-items-specification.md) -
  x-template-items詳細仕様

**関連用語**: [`{@items}`](#items-記法-template-array-expansion),
[`x-template`](#x-template), [`x-frontmatter-part`](#x-frontmatter-part)

---

### `x-template-format`

| 項目             | 説明                                                       |
| ---------------- | ---------------------------------------------------------- |
| **定義**         | 出力フォーマットを指定するディレクティブ                   |
| **型**           | `string` (`"json"` \| `"yaml"` \| `"xml"` \| `"markdown"`) |
| **適用対象**     | ルートSchema                                               |
| **処理フェーズ** | Phase 3 (Template) - 出力時                                |
| **例**           | `"x-template-format": "yaml"`                              |
| **動作**         | テンプレート処理後の最終出力フォーマットを決定             |

**関連ドキュメント**:

- [requirements.ja.md](./requirements.ja.md#L80-87) - 対応出力フォーマット
- [implementation/template-format-sequence.md](./implementation/template-format-sequence.md) -
  テンプレートフォーマット処理シーケンス
- [implementation/template-format-examples.md](./implementation/template-format-examples.md) -
  テンプレートフォーマット実例

**関連用語**: [`x-template`](#x-template)

---

## テンプレート関連

### `{variable.path}` 記法 (Variable Substitution)

| 項目             | 説明                                                       |
| ---------------- | ---------------------------------------------------------- |
| **定義**         | テンプレート内で変数を参照し、実際の値に置換するための記法 |
| **用途**         | テンプレートファイル内でSchemaデータを参照                 |
| **処理フェーズ** | Phase 3 (Template)                                         |
| **例**           | `{id.full}`, `{options.input}`, `{user.profile.name}`      |
| **動作**         | ドット記法でネストされたプロパティにアクセスし値を置換     |
| **実装**         | `sub_modules/json-template`モジュールで処理（要求仕様）    |

**関連ドキュメント**:

- [requirements.ja.md](./requirements.ja.md#L273-289) -
  テンプレート変数の参照方法
- [requirements.ja.md](./requirements.ja.md#L294-330) -
  json-templateモジュール使用
- [flow.ja.md](./flow.ja.md#L69-71) - 変数処理フロー
- [architecture/template-variable-resolution-roadmap.md](./architecture/template-variable-resolution-roadmap.md) -
  変数解決ロードマップ

**関連用語**: [`{@items}`](#items-記法-template-array-expansion),
[json-template](#json-template-モジュール)

---

### Container Template (コンテナテンプレート)

| 項目         | 説明                                                           |
| ------------ | -------------------------------------------------------------- |
| **定義**     | 全体の出力構造を定義するメインテンプレート                     |
| **指定方法** | `x-template`ディレクティブで指定                               |
| **役割**     | 出力フォーマットの骨格を定義、`{@items}`プレースホルダーを含む |
| **例**       | `registry_template.json`                                       |
| **特徴**     | 一つのSchemaに対して一つのコンテナテンプレート                 |

**関連ドキュメント**:

- [requirements.ja.md](./requirements.ja.md#L260-264) - コンテナテンプレート指定
- [architecture/list-container-vs-list-items-separation.md](./architecture/list-container-vs-list-items-separation.md) -
  コンテナとアイテムの分離

**関連用語**: [Items Template](#items-template-アイテムテンプレート),
[`x-template`](#x-template)

---

### Items Template (アイテムテンプレート)

| 項目         | 説明                                                   |
| ------------ | ------------------------------------------------------ |
| **定義**     | 配列の各要素をレンダリングするためのテンプレート       |
| **指定方法** | `x-template-items`ディレクティブで指定                 |
| **役割**     | `{@items}`展開時に各要素に適用されるフォーマットを定義 |
| **例**       | `registry_command_template.json`                       |
| **特徴**     | 各配列要素のデータ構造に対応した変数参照を含む         |

**関連ドキュメント**:

- [requirements.ja.md](./requirements.ja.md#L267-271) - アイテムテンプレート指定
- [architecture/list-container-vs-list-items-separation.md](./architecture/list-container-vs-list-items-separation.md) -
  コンテナとアイテムの分離
- [architecture/x-template-items-specification.md](./architecture/x-template-items-specification.md) -
  x-template-items詳細仕様

**関連用語**: [Container Template](#container-template-コンテナテンプレート),
[`x-template-items`](#x-template-items),
[`{@items}`](#items-記法-template-array-expansion)

---

## Schema関連

### Schema (スキーマ)

| 項目     | 説明                                                                        |
| -------- | --------------------------------------------------------------------------- |
| **定義** | フロントマターの解析構造とテンプレート指定を定義するJSON Schema拡張ファイル |
| **標準** | JSON Schema Draft-07準拠 + x-ディレクティブ拡張                             |
| **役割** | データ構造定義、バリデーション、ディレクティブによる処理指示                |
| **例**   | `registry_schema.json`, `articles_schema.json`                              |
| **特徴** | `$ref`によるSchema再利用、`properties`による階層定義                        |

**関連ドキュメント**:

- [requirements.ja.md](./requirements.ja.md#L33-44) - Schemaとテンプレートの役割
- [flow.ja.md](./flow.ja.md#L1-61) - Schema処理フロー
- [architecture/schema-directives-specification.md](./architecture/schema-directives-specification.md) -
  ディレクティブ仕様
- [domain/schema-domain.md](./domain/schema-domain.md) - Schemaドメイン

**関連用語**: [Template](#template-テンプレート), [`$ref`](#ref),
[x-ディレクティブ](#x-ディレクティブ)

---

### `$ref`

| 項目             | 説明                                                       |
| ---------------- | ---------------------------------------------------------- |
| **定義**         | JSON Schemaの標準機能でスキーマ構造を再利用する参照記法    |
| **用途**         | Schema構造の再利用にのみ使用                               |
| **処理フェーズ** | Schema解析時                                               |
| **例**           | `"items": {"$ref": "registry_command_schema.json"}`        |
| **重要**         | テンプレート処理とは独立（テンプレート指定には影響しない） |

**関連ドキュメント**:

- [requirements.ja.md](./requirements.ja.md#L40-44) - $refの重要な分離原則
- [requirements.ja.md](./requirements.ja.md#L110-112) -
  $refとテンプレート処理の独立性

**関連用語**: [Schema](#schema-スキーマ), [`x-template`](#x-template)

---

### x-ディレクティブ

| 項目         | 説明                                                           |
| ------------ | -------------------------------------------------------------- |
| **定義**     | JSON Schema標準を拡張した、frontmatter-to-schema固有の処理指示 |
| **命名規則** | すべて`x-`プレフィックスで始まる                               |
| **カテゴリ** | データ抽出、データ変換、テンプレート処理の3種類                |
| **特徴**     | 宣言的であり、処理順序は自動決定される                         |
| **例**       | `x-frontmatter-part`, `x-derived-from`, `x-template`           |

**関連ドキュメント**:

- [requirements.ja.md](./requirements.ja.md#L332-428) -
  データ抽出・変換ディレクティブ完全リファレンス
- [architecture/schema-directives-specification.md](./architecture/schema-directives-specification.md) -
  ディレクティブ仕様

**関連用語**: 各種ディレクティブ（[`x-frontmatter-part`](#x-frontmatter-part),
[`x-derived-from`](#x-derived-from), [`x-template`](#x-template)等）

---

## 処理フェーズ関連

### Phase 1: Individual File Processing (個別ファイル処理)

| 項目         | 説明                                                                |
| ------------ | ------------------------------------------------------------------- |
| **定義**     | 各Markdownファイルを個別に処理するフェーズ                          |
| **処理内容** | フロントマター抽出、`x-flatten-arrays`適用、`x-jmespath-filter`適用 |
| **出力**     | ファイル単位の処理済みフロントマターデータ                          |
| **特徴**     | ファイル間の情報は参照しない                                        |

**関連ドキュメント**:

- [requirements.ja.md](./requirements.ja.md#L370-377) - フェーズ1:
  個別ファイル処理
- [flow.ja.md](./flow.ja.md#L7-8) - フロントマター解析の構造

**関連用語**: [Phase 2](#phase-2-aggregation-全体統合),
[`x-flatten-arrays`](#x-flatten-arrays),
[`x-jmespath-filter`](#x-jmespath-filter)

---

### Phase 2: Aggregation (全体統合)

| 項目         | 説明                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------- |
| **定義**     | 全Markdownファイルの処理完了後にデータを統合するフェーズ                                           |
| **処理内容** | `x-frontmatter-part`配列統合、`x-derived-from`集約、`x-derived-unique`重複削除、`{@items}`配列確定 |
| **出力**     | 統合された完全なデータ構造                                                                         |
| **特徴**     | ファイル間の情報を集約・変換                                                                       |

**関連ドキュメント**:

- [requirements.ja.md](./requirements.ja.md#L379-384) - フェーズ2: 全体統合
- [implementation/derivation-processing-flow.md](./implementation/derivation-processing-flow.md) -
  派生処理フロー

**関連用語**: [Phase 1](#phase-1-individual-file-processing-個別ファイル処理),
[Phase 3](#phase-3-template-expansion-テンプレート展開),
[`x-derived-from`](#x-derived-from)

---

### Phase 3: Template Expansion (テンプレート展開)

| 項目         | 説明                                                                  |
| ------------ | --------------------------------------------------------------------- |
| **定義**     | 統合されたデータをテンプレートでレンダリングするフェーズ              |
| **処理内容** | `x-template`適用、`{@items}`展開、`{variable.path}`変数置換、最終出力 |
| **出力**     | 指定されたフォーマット（JSON/YAML/XML/Markdown）の最終成果物          |
| **特徴**     | json-templateモジュールを使用した変数置換                             |

**関連ドキュメント**:

- [requirements.ja.md](./requirements.ja.md#L386-391) - フェーズ3:
  テンプレート展開
- [flow.ja.md](./flow.ja.md#L63-89) - テンプレート処理フロー
- [architecture/template-processing-specification.md](./architecture/template-processing-specification.md) -
  テンプレート処理仕様

**関連用語**: [Phase 2](#phase-2-aggregation-全体統合),
[`x-template`](#x-template), [`{@items}`](#items-記法-template-array-expansion)

---

## アーキテクチャ関連

### DDD (Domain-Driven Design)

| 項目         | 説明                                                    |
| ------------ | ------------------------------------------------------- |
| **定義**     | ドメイン駆動設計 - ビジネスロジックを中心とした設計手法 |
| **適用箇所** | プロジェクト全体のアーキテクチャ                        |
| **主要概念** | Entity, Value Object, Repository, Service, Aggregate    |
| **ドメイン** | Schema, Frontmatter, Template, Aggregation, Shared      |

**関連ドキュメント**:

- [architecture/README.md](./architecture/README.md) - アーキテクチャ概要
- [domain/domain-boundary.md](./domain/domain-boundary.md) - ドメイン境界
- [domain/architecture/domain-architecture-core.md](./domain/architecture/domain-architecture-core.md) -
  コアドメイン

**関連用語**: [Totality Principle](#totality-principle-全域性原則),
[TDD](#tdd-test-driven-development)

---

### Totality Principle (全域性原則)

| 項目         | 説明                                                                     |
| ------------ | ------------------------------------------------------------------------ |
| **定義**     | すべての関数が定義域のすべての入力に対して値を返すことを保証する設計原則 |
| **実装**     | `Result<T, E>` 型による例外のない全域関数                                |
| **目的**     | 実行時エラーの防止、予測可能なコードの実現                               |
| **禁止事項** | ドメイン層での直接的な例外スロー                                         |

**関連ドキュメント**:

- [development/totality.md](./development/totality.md) - 全域性原則（英語）
- [development/totality.ja.md](./development/totality.ja.md) -
  全域性原則（日本語）
- [tests/debugs/02-architecture/01-totality-verification.workflow.md](./tests/debugs/02-architecture/01-totality-verification.workflow.md) -
  全域性検証ワークフロー

**関連用語**: [`Result<T, E>`](#resultt-e), [DDD](#ddd-domain-driven-design)

---

### TDD (Test-Driven Development)

| 項目               | 説明                                                                     |
| ------------------ | ------------------------------------------------------------------------ |
| **定義**           | テスト駆動開発 - テストを先に書いてから実装を行う開発手法                |
| **プロセス**       | Red（失敗するテスト作成） → Green（実装） → Refactor（リファクタリング） |
| **カバレッジ目標** | 80%以上（line coverage, branch coverage）                                |
| **テスト種別**     | Unit, Integration, E2E                                                   |

**関連ドキュメント**:

- [tests/README.md](./tests/README.md) - テスト戦略概要
- [tests/test-execution.ja.md](./tests/test-execution.ja.md) - テスト実行ガイド

**関連用語**: [DDD](#ddd-domain-driven-design),
[Totality Principle](#totality-principle-全域性原則)

---

### json-template モジュール

| 項目         | 説明                                                         |
| ------------ | ------------------------------------------------------------ |
| **定義**     | テンプレート変数置換を担当する専用サブモジュール             |
| **場所**     | `sub_modules/json-template/`                                 |
| **機能**     | `{variable.path}` 形式の変数置換、ドット記法、配列アクセス   |
| **要求仕様** | `x-template-items`処理で使用必須                             |
| **制約**     | `{@items}`記法は非サポート（フロントマターシステム側で実装） |

**関連ドキュメント**:

- [requirements.ja.md](./requirements.ja.md#L294-330) -
  json-templateモジュール使用
- [flow.ja.md](./flow.ja.md#L91-137) - json-templateの役割

**関連用語**: [`x-template-items`](#x-template-items),
[`{variable.path}`](#variablepath-記法-variable-substitution)

---

## データ構造関連

### Frontmatter (フロントマター)

| 項目     | 説明                                             |
| -------- | ------------------------------------------------ |
| **定義** | Markdownファイル冒頭のYAML形式メタデータブロック |
| **形式** | `---`で囲まれたYAML                              |
| **用途** | 記事のメタデータ（タイトル、タグ、日付等）を定義 |
| **特徴** | 柔軟な構造（厳格なバリデーションなし）           |

**関連ドキュメント**:

- [requirements.ja.md](./requirements.ja.md#L9-19) - 目的と背景
- [domain/architecture/domain-architecture-frontmatter.md](./domain/architecture/domain-architecture-frontmatter.md) -
  フロントマタードメイン

**関連用語**: [Schema](#schema-スキーマ),
[`x-frontmatter-part`](#x-frontmatter-part)

---

### `Result<T, E>`

| 項目         | 説明                                               |
| ------------ | -------------------------------------------------- |
| **定義**     | 成功または失敗を表現する型安全な結果型             |
| **実装**     | Rust風のResult型パターン                           |
| **メソッド** | `isOk()`, `isError()`, `unwrap()`, `unwrapError()` |
| **目的**     | 全域性原則の実装、例外のない関数設計               |

**関連ドキュメント**:

- [development/totality.md](./development/totality.md) - 全域性原則
- [domain/shared-types.md](./domain/shared-types.md) - 共有型定義

**関連用語**: [Totality Principle](#totality-principle-全域性原則)

---

### Template (テンプレート)

| 項目     | 説明                                                    |
| -------- | ------------------------------------------------------- |
| **定義** | フロントマターデータの出力形式を定義するファイル        |
| **形式** | JSON（内部処理用）、最終出力はYAML/XML/Markdown等も可能 |
| **種類** | Container Template, Items Template                      |
| **変数** | `{variable.path}` 形式、`{@items}` 特殊プレースホルダー |

**関連ドキュメント**:

- [requirements.ja.md](./requirements.ja.md#L46-55) - テンプレート処理の基本原則
- [architecture/template-processing-specification.md](./architecture/template-processing-specification.md) -
  テンプレート処理仕様
- [domain/architecture/domain-architecture-template.md](./domain/architecture/domain-architecture-template.md) -
  テンプレートドメイン

**関連用語**: [Container Template](#container-template-コンテナテンプレート),
[Items Template](#items-template-アイテムテンプレート),
[Schema](#schema-スキーマ)

---

## 参考資料

### 主要ドキュメント

- [requirements.ja.md](./requirements.ja.md) - プロジェクト要求仕様書
- [flow.ja.md](./flow.ja.md) - 処理フロー詳細
- [architecture/README.md](./architecture/README.md) - アーキテクチャ概要

### 開発ガイドライン

- [development/totality.ja.md](./development/totality.ja.md) - 全域性原則
- [development/prohibit-hardcoding.ja.md](./development/prohibit-hardcoding.ja.md) -
  ハードコーディング禁止
- [development/ai-complexity-control.ja.md](./development/ai-complexity-control.ja.md) -
  AI複雑度制御

### テスト関連

- [tests/README.md](./tests/README.md) - テスト戦略
- [tests/test-execution.ja.md](./tests/test-execution.ja.md) - テスト実行ガイド
- [tests/checklist-based-on-gh-issue.md](./tests/checklist-based-on-gh-issue.md) -
  チェックリスト

---

## 更新履歴

| 日付       | 変更内容                                                                      |
| ---------- | ----------------------------------------------------------------------------- |
| 2025-10-01 | 初版作成 - 配列処理、ディレクティブ、テンプレート、処理フェーズ関連用語を整理 |
