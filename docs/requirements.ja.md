# 要求事項

1. マークダウンのフロントマターを抽出し、解析する
2. フロントマターの柔軟性を保つため、Schemaに基づきTypeScriptによる構造化処理を使う（変数名の名寄せ）
3. 解析した結果をテンプレートフォーマットへ当て込み、書き出す

## 目的

Markdownファイルの索引(Index)を作るためである。
様々な形式の、様々な用途のMarkdownファイルがあり、多様なフロントマター定義が存在する。
厳格なSchema定義を用いて運用されていない中で、索引作りは難しい。
そこで、事後的に（FrontMatter入力時Validationや事前定義ではなく、作成されたMarkdownに対し）索引化する。

## 背景

その時々で、柔軟に運用できるメリットが、Markdownやフロントマターには存在する。
一方、厳格な型定義を通すことなく作成されるため、入力方法や名称も運用者依存になりがちである。
さらに、蓄積された過去のMarkdownを含めると、全てを事前定義して運用することは難しい。
こうした課題に対応する。

## 柔軟性を確保する理由

特定のパターンのみでハードコーディングする設計では、Schema変更に対応できない。
そのため、アプリケーションはSchemaとテンプレートを外部から読み込み、差し代え前提でSchema定義を用い、テンプレートへ出力する。

これにより、索引の仕様が変わっても
アプリケーションの変更を伴うこと無く、索引定義だけ変えられる。

また、プロンプト集の索引を作るケース、記事の索引を作るケースなども、Schemaとテンプレートのセットを差し替え、Markdownのファイルが置かれたPathや索引出力先を切り替えるだけで、同じアプリケーションで多様な索引作りが可能となる。

これが柔軟性確保の理由であり、「Schema指定にすることが、重要な要求事項である」ことの理由である。

## Schemaとテンプレートの役割

Schemaはフロントマターの解析構造を決め、テンプレートはフロントマターから得られた値の出力形式を決める。Schema解析結果が、テンプレートの変数へ埋め込まれる。

Schemaは、利用すべきテンプレートファイル名を有する。
テンプレートは、フロントマターやSchema定義に依存せず、形式を決められる。

**重要な分離原則**:

- `$ref`はJSON Schemaの標準機能であり、スキーマ構造の再利用にのみ使用される
- テンプレート指定は`x-template`（コンテナ）と`x-template-items`（アイテム）でのみ行う
- 両者は完全に独立しており、`$ref`はテンプレート処理に影響しない

### テンプレート処理の基本原則

**重要**:
テンプレートは出力フォーマットを完全に定義する。テンプレートに記載されたもののみが出力される。

- テンプレートファイルに書かれた内容がそのまま出力フォーマットとなる
- {variable.path}形式の変数のみが実際の値に置換される
- {@items}形式は配列展開記法で、x-template-itemsで指定されたテンプレートを各アイテムに適用する
- Schemaによる構造の補完や追加は一切行われない
- x-frontmatter-part配列も同じルールに従う（特殊処理なし）

# 成果物

1. 要求の整理と要件化
2. 機能要件、非機能要件の分離
3. ドメイン境界線の設計資料の作成
4. 実装された解析のスクリプトと堅牢なテスト
5. TypeScript処理ロジック（Schemaの$refにも対応し、再帰的に解析する）
6. examples/ に実例を使った実行例が存在する

# 解析の手順

一覧： まず、マークダウンファイルの一覧を作る。(成果A)
また、最終成果物を空の状態でつくる（最終成果物Z）

各マークダウンファイル： 成果Aのなかの繰り返し処理に相当する。
各ループ内では、マークダウンファイル1つずつを処理する。ループ処理は、マークダウンファイル全件に対して実施する。

最初にフロントマター部分を抽出する。これはTypeScriptで実施する。(成果B)
成果Bから、TypeScriptで解析する。（成果C）
成果Cを元にTypeScriptでSchema構造データで保持する（成果D）
成果Dをテンプレートの変数へ当てこむ。（成果E）
成果Eを統合し、最終成果物Zを得る。成果物Zは、Schemaで指定されたx-templateとx-template-items
を用いて得られた成果Eを統合したものである。なお、$ref
はスキーマ構造の再利用にのみ使用され、テンプレート処理とは独立している。
最後に、成最終成果物Zを保存する。

一覧のなかで、どの配列構造が各マークダウンファイルの処理に用いれるかは、`"x-frontmatter-part": true`
で判定する。

## 配列・単一要素の統一的抽出機能

フロントマターの構造が配列か単一要素かに依存せず、統一的な記法で値を抽出する機能を提供する。

### 抽出ディレクティブ

#### `x-extract-from`
配列要素やオブジェクトから特定のプロパティパスを指定して値を抽出する。

```json
{
  "id": {
    "type": "string",
    "x-extract-from": "id.full"  // ネストされた値を抽出
  }
}
```

#### `x-frontmatter-part: true`
このディレクティブが設定された配列が、各Markdownファイルのフロントマター処理の起点となる。

#### `x-merge-arrays: true`
複数ファイルから収集した配列を1つのフラット配列に統合する。

### 抽出パス記法

#### `[]`表記による自動正規化
`x-extract-from`で指定するパスに`[]`を含めることで、対象が単一要素でも配列でも同じ処理で抽出できる。

```
traceability[].id.full
```

この記法により：
- **単一要素の場合**: 自動的に配列化して処理
- **配列の場合**: 各要素から値を抽出
- **結果**: 常に配列として正規化

### 動作原理

| フロントマター構造 | パス指定 | 抽出結果 |
|-----------------|---------|---------|
| `traceability: {id: {full: "A"}}` | `traceability[].id.full` | `["A"]` |
| `traceability: [{id: {full: "A"}}, {id: {full: "B"}}]` | `traceability[].id.full` | `["A", "B"]` |
| 混在（複数ファイル） | 同一パス | 統合された配列 |

### 実現できること

1. **構造の違いを吸収**: フロントマター作成者は配列化を意識不要
2. **Schema再利用**: 同一Schemaで多様なフロントマター構造に対応
3. **段階的移行**: 既存の単一要素を配列に移行する際もSchema変更不要
4. **一貫性**: 抽出結果は常に配列として扱え、後続処理が簡潔

### 設計思想

「**書き手の自由度を保ちながら、読み手（Schema）側で構造を正規化する**」

- フロントマター作成時：要素数に応じて自然な構造を選択
- Schema定義時：`[]`表記で構造の違いを吸収
- 処理結果：予測可能な配列形式で統一

### 完全な例：トレーサビリティID収集

#### 多様なフロントマター入力
```yaml
# ファイル1: 単一要素
traceability:
  id:
    full: req:single-001#20250909
    summary: 単一要件

# ファイル2: 配列要素
traceability:
  - id:
      full: req:array-001#20250909
    summary: 要件1
  - id:
      full: req:array-002#20250909
    summary: 要件2
```

#### 統一Schema定義
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "x-template": "trace_list_template.json",
  "properties": {
    "trace_ids": {
      "type": "array",
      "description": "全トレーサビリティIDの一覧",
      "x-frontmatter-part": true,
      "x-merge-arrays": true,
      "x-derived-unique": true,
      "items": {
        "type": "string",
        "x-extract-from": "traceability[].id.full"
      }
    },
    "trace_details": {
      "type": "array",
      "description": "ID付き要約情報",
      "x-frontmatter-part": true,
      "x-merge-arrays": true,
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "x-extract-from": "id.full"
          },
          "summary": {
            "type": "string",
            "x-extract-from": "summary"
          }
        }
      }
    }
  }
}
```

#### 出力結果
```json
{
  "trace_ids": [
    "req:single-001#20250909",
    "req:array-001#20250909",
    "req:array-002#20250909"
  ],
  "trace_details": [
    {
      "id": "req:single-001#20250909",
      "summary": "単一要件"
    },
    {
      "id": "req:array-001#20250909",
      "summary": "要件1"
    },
    {
      "id": "req:array-002#20250909",
      "summary": "要件2"
    }
  ]
}
```

この機能により、フロントマターの構造的多様性を許容しつつ、一貫性のある処理を実現する。

```text
- 一覧
  - コマンド繰り返し項目()
```

結果、以下のような構造になる。 出力:

```text
- 一覧
  - コマンド
  - コマンド
  - コマンド
```

## 一覧の整形

以下の整形処理がなされる。

### Schemaとテンプレート

利用するSchemaとテンプレート:　 registry_schema.json registry_template.json
なお、一覧1個に対し、個別マークダウンファイルn個の関係である。registry_template.json　は
registry_schema.json 内部で指定される。
（つまりregistry_schema.jsonファイルは、役割的にはidnex_schema.jsonと同じ意味である。）

### テンプレート指定機能

Schemaは、出力時に用いるテンプレートを内部的に指定できる。以下の2つの指定方法がある：

#### 1. コンテナテンプレート指定 (x-template)

`"x-template": "registry_template.json"`

メインのコンテナ構造を定義するテンプレートを指定する。

#### 2. アイテムテンプレート指定 (x-template-items)

`"x-template-items": "registry_command_template.json"`

`{@items}`
展開時に使用するテンプレートを指定する。この指定により、メインスキーマでアイテムテンプレートを集中管理でき、設定が簡素化される。

#### テンプレート変数の参照方法

テンプレートには、Schema階層を指定した変数名を記載しており、テンプレート処理は
`{id.full}` 形式で参照した変数をSchema値で置換する。 例)
`{id.full}`は、`req:api:deepresearch-3f8d2a#20250909` へ置換される。

Schemaのroot階層は、"x-template" と並列の"properties"を起点とする。 {id.full}
と記述する場合は

```json
"x-template": "registry_template.json",
"x-template-items": "registry_command_template.json",
"properties":
  "id":
    "full":
```

である。

## データ抽出・変換ディレクティブ

Schemaで使用可能な`x-*`ディレクティブの完全なリファレンス。

### テンプレート制御

| ディレクティブ | 型 | 説明 | 適用対象 |
|---|---|---|---|
| `x-template` | string | コンテナテンプレートファイル指定 | ルートスキーマ |
| `x-template-items` | string | `{@items}`展開時のアイテムテンプレート | ルートスキーマ |

### データ抽出

| ディレクティブ | 型 | 説明 | 適用対象 |
|---|---|---|---|
| `x-frontmatter-part` | boolean | 各Markdownファイル処理の起点を指定 | 配列プロパティ |
| `x-extract-from` | string | 抽出元のプロパティパス（`[]`表記で配列/単一両対応） | 任意のプロパティ |

### データ変換

| ディレクティブ | 型 | 説明 | 適用対象 |
|---|---|---|---|
| `x-merge-arrays` | boolean | 複数ファイルの配列を1つに統合 | 配列プロパティ |
| `x-derived-from` | string | 他のプロパティから値を集約 | 任意のプロパティ |
| `x-derived-unique` | boolean | 配列の重複を削除 | 配列プロパティ |
| `x-jmespath-filter` | string | JMESPath式によるフィルタリング | 配列プロパティ |

### 処理順序

ディレクティブは以下の順序で処理される：

1. **抽出フェーズ**
   - `x-frontmatter-part`による対象配列の特定
   - `x-extract-from`による値の抽出（`[]`表記で正規化）

2. **変換フェーズ**
   - `x-jmespath-filter`によるフィルタリング
   - `x-merge-arrays`による配列統合

3. **集約フェーズ**
   - `x-derived-from`による値の集約
   - `x-derived-unique`による重複削除

4. **出力フェーズ**
   - `x-template`/`x-template-items`によるテンプレート適用

### パス記法の詳細

`x-extract-from`と`x-derived-from`で使用可能なパス記法：

| 記法 | 例 | 説明 |
|---|---|---|
| ドット記法 | `id.full` | ネストされたプロパティアクセス |
| 配列展開 | `items[]` | 配列の各要素を展開（単一要素も配列化） |
| 組み合わせ | `traceability[].id.full` | 配列展開後にプロパティアクセス |
| インデックス | `items[0]` | 特定インデックスの要素（非推奨） |

### 集約機能

一覧は、集約機能を持つ。 `"x-derived-from": "commands[].c1"`
のように、特定の階層から値を集約する処理を持つ。
各マークダウンファイルの処理が完了したあとに実行される。 さらに
`x-derived-unique: true`がある場合は、ユニーク化される。

**JMESPath フィルタリング**: `"x-jmespath-filter": "commands[?c1 == 'git']"`
のように、JMESPath式でデータの動的フィルタリングが可能である。
Schema解析時にJMESPath式が評価され、条件に合うデータのみが抽出される。

例えば、以下は、availableConfigs を利用可能なコマンドの c1 の集合体で構築する。

```
"availableConfigs": {
  "type": "array",
  "description": "Tool names array - each becomes available as climpt-{name}. Derived automatically from commands[].c1",
  "x-derived-from": "commands[].c1",
  "x-derived-unique": true,
  "items": {
    "type": "string"
  }
}
```

## 個別フロントマターの整形

一覧1個に対し、個別フロントマターn個の関係である。

以下の2種類を使い分ける。

a. マークダウンファイルのフロントマターと「解析用Schema」を使って情報を抽出する
b.抽出した情報を、テンプレート変数化し、テンプレートへ当て込む

抽出のための処理は、TypeScriptで行う。

詳しくは `docs/architecture/schema_process_architecture.ja.md`
へ記載したため、必ず読むこと。

**利用するSchemaとテンプレート**:　 registry_command_schema.json
registry_command_template.json

完成したバージョンの参考例： .agent/test-climpt/registry.json
（正解の出力フォーマットではない。Schemaとテンプレートを使った出力例の参考例として、理解の補助に使うだけである。）

## 抽象化レベル

ルール:

1. 実装に具体的な実例1-実例2のパターンを混入しない
2. 実例1-実例2のSchema例とテンプレート例が変更されても、アプリケーションコードに影響がない
3. 実例1-実例2の階層情報が変わっても、アプリケーションコードに影響がない
4. 上記2と3が、設定あるいは引数で解決できている
5. 最終成果物Zは、TypeScript処理による成果物を結合した結果とイコールである。
6. フロントマターの構造（配列/単一）に依存しない抽出処理を`[]`記法で実現
7. 書き手の自由度と読み手の一貫性を両立する設計
8. すべての`x-*`ディレクティブは宣言的であり、処理順序は自動決定される
9. ディレクティブの組み合わせにより、複雑な変換を段階的に記述可能

# 参照すべき情報

以下は、実際のユースケースに該当する事例である。 成果物は、ここに挙げた
実例1-実例2
以外のケースにも対応できるように、汎用的に抽象化されたアプリケーションである。
そのアプリケーションが、以下の実例を使って、実際にSchemaからテンプレートへと当て込むことが出来るか検証する目的で例示する。

なお、実際の使用例としては、 examples/
配下に作成し、実行可能な形で再現すること。 tests/
がアプリケーションコードを強固にする役割であり、 examples/
が実例を実行して示す役割である。

## 実例1

### フロントマター解析対象のフォルダ：

`.agent/climpt/prompts`

### 解析結果の保存先：

`.agent/climpt/registry.json`

### 解析結果のSchema：

```json:registry_schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "Registry Schema",
  "x-template": "registry_template.json",
  "x-template-items": "registry_command_template.json",
  "description": "Schema for registry configuration with tools and commands",
  "properties": {
    "version": {
      "type": "string",
      "description": "Registry version (e.g., \"1.0.0\")",
      "pattern": "^\\d+\\.\\d+\\.\\d+$"
    },
    "description": {
      "type": "string",
      "description": "Overall registry description"
    },
    "tools": {
      "type": "object",
      "description": "Tool configuration and command registry",
      "properties": {
        "availableConfigs": {
          "type": "array",
          "description": "Tool names array - each becomes available as climpt-{name}. Should contain unique values from commands[].c1",
          "items": {
            "type": "string"
          }
        },
        "commands": {
          "type": "array",
          "description": "Command registry - defines all available C3L commands",
          "items": { "$ref": "registry_command_schema.json" }
        }
      },
      "required": ["availableConfigs", "commands"],
      "additionalProperties": false
    }
  },
  "required": ["version", "description", "tools"],
  "additionalProperties": false
}
```

```json:registry_command_schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "Command Schema",
  "description": "Schema for a single command definition",
  "properties": {
    "c1": {
      "type": "string",
      "description": "Domain/category (git, spec, test, code, docs, meta)"
    },
    "c2": {
      "type": "string",
      "description": "Action/directive (create, analyze, execute, etc.)"
    },
    "c3": {
      "type": "string",
      "description": "Target/layer (refinement-issue, quality-metrics, etc.)"
    },
    "title": {
      "type": "string",
      "description": "Command title"
    },
    "description": {
      "type": "string",
      "description": "Command description"
    },
    "usage": {
      "type": "string",
      "description": "Usage instructions and examples"
    },
    "options": {
      "type": "object",
      "description": "Available options for this command",
      "properties": {
        "input": {
          "type": "array",
          "description": "Supported input formats",
          "items": { "type": "string" }
        },
        "adaptation": {
          "type": "array",
          "description": "Processing modes",
          "items": { "type": "string" }
        },
        "input_file": {
          "type": "array",
          "description": "File input support",
          "items": { "type": "boolean" }
        },
        "stdin": {
          "type": "array",
          "description": "Standard input support",
          "items": { "type": "boolean" }
        },
        "destination": {
          "type": "array",
          "description": "Output destination support",
          "items": { "type": "boolean" }
        }
      },
      "additionalProperties": false
    }
  },
  "required": ["c1", "c2", "c3", "description", "usage", "options"],
  "additionalProperties": false
}
```

### 解析結果のテンプレート：

```json:registry_template.json
{
  "version": "{version}",
  "description": "{description}",
  "tools": {
    "availableConfigs": "{tools.availableConfigs}",
    "commands": [
      "{@items}"
    ]
  }
}
```

```json:registry_command_template.json
{
  "c1": "{c1}",
  "c2": "{c2}",
  "c3": "{c3}",
  "title": "{title}",
  "description": "{description}",
  "usage": "{usage}",
  "options": {
    "input": "{options.input}",
    "adaptation": "{options.adaptation}",
    "input_file": "{options.input_file}",
    "stdin": "{options.stdin}",
    "destination": "{options.destination}"
  }
}
```

## 実例2

### フロントマター解析対象のフォルダ：

`.agent/drafts/articles`

### 解析結果の保存先：

`.agent/drafts/books.yml`

### 解析結果のSchema：

```
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "books": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "emoji": { "type": "string" },
          "type": { "type": "string" },
          "topics": {
            "type": "array",
            "items": { "type": "string" }
          },
          "published": { "type": "boolean" },
          "published_at": { "type": "string", "format": "date-time" }
        },
        "required": ["title", "type", "published"],
        "additionalProperties": true
      }
    }
  },
  "required": ["books"],
  "additionalProperties": false
}
```

### 解析結果のテンプレート：

```
books:
  - title: "記事タイトル"
    emoji: "📚"
    type: "tech"
    topics:
      - "claudecode"
      - "codingagents"
    published: true
    published_at: "2025-08-01 10:00"
  # ...他の記事も同様に追加
```
