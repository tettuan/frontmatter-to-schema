# 要求事項

1. マークダウンのフロントマターを抽出し、解析する
2. 解析した結果をSchemaに基づいてテンプレートフォーマットへ当て込み、書き出す
3. フロントマターの柔軟性のために、TypeScriptによる構造化処理を使う

## 目的

Markdownファイルの索引(Index)を作るためである。
様々な形式の、様々な用途のMarkdownファイルがあり、多様なフロントマター定義が存在する。
厳格なSchema定義を用いて運用されていない中で、索引作りは難しい。
そこで、AIを用いて、事後的に（入力時Validationや事前定義ではなく、作成されたMarkdownに対し）、索引のための型定義を行い、索引化する。

## 背景

その時々で、柔軟に運用できるメリットが、Markdownやフロントマターには存在する。
一方、厳格な型定義を通すことなく作成されるため、入力方法や名称も運用者依存になりがちである。
さらに、蓄積された過去のMarkdownを含めると、全てを事前定義して運用することは難しい。
こうした課題に対応する。

## 柔軟性の理由

特定のパターンのみに対応するアプリケーションでは、Schema変更に対応できない。
そのため、アプリケーションはSchemaとテンプレートを外部から読み込み、差し代え前提でSchema定義を用い、テンプレートへ出力する。

これにより、索引の仕様が変わっても **Markdown側の変更を伴うこと無く**
、索引側だけ定義を変えられる。

また、プロンプト集の索引を作るケース、記事の索引を作るケースなども、Schemaとテンプレートのセットを差し替え、Markdownのファイルが置かれたPathや索引出力先を切り替えるだけで、同じアプリケーションで多様な索引作りが可能となる。

これが柔軟性確保の理由であり、「差し替え可能なSchemaとテンプレートにすることが、重要な要求事項である」ことの理由である。

# 成果物

1. 要求の整理と要件化
2. 機能要件、非機能要件の分離
3. ドメイン境界線の設計資料の作成
4. 実装された解析のスクリプトと堅牢なテスト
5. TypeScript処理ロジック（2段階解析）
6. examples/ に実例を使った実行例が存在する

# 解析の手順

一覧： まず、プロンプト一覧を作る。(成果A)
また、最終成果物を空の状態でつくる（最終成果物Z）

各コマンド： 成果Aに対し、ループ処理する。全件実施する。
各ループ内では、プロンプト1つずつを処理する。
最初にフロントマター部分を抽出する。これはDenoで実施する。(成果B)
成果Bから、TypeScriptで解析する（成果C）
成果Cを元にTypeScriptで構造データへ当てこむ（成果D） 成果Dを 最終成果物Z
へ統合する 成最終成果物Zを保存する。

## 一覧の整形

availableConfigs を利用可能なコマンドの c1 の集合体で構築する。

利用するSchemaとテンプレート:　 registry_template.json registry_schema.json

## 個別コマンドの整形

以下の2種類を使い分ける。

a. プロンプトとフロントマターと「解析結果のSchema」を使って情報を抽出する
b.抽出した情報を、「解析結果のSchema」を使って、解析テンプレートへ当て込む

抽出のための処理は、TypeScriptで行う。

詳しくは `docs/architecture/schema_matching_architecture.ja.md`
へ記載したため、必ず読むこと。

利用するSchemaとテンプレート:　 registry_command_schema.json
registry_command_template.json

## 抽象化レベル

ルール:

1. 実装に具体的な実例1-実例2のパターンを混入しない
2. 実例1-実例2のSchema例とテンプレート例が変更されても、アプリケーションコードに影響がない
3. 実例1-実例2の階層情報が変わっても、アプリケーションコードに影響がない
4. 上記2と3が、設定あるいは引数で解決できている
5. 最終成果物Zは、TypeScript処理による成果物を結合した結果とイコールである。

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
          "description": "Tool names array - each becomes available as climpt-{name}",
          "items": {
            "type": "string",
            "enum": ["git", "spec", "test", "code", "docs", "meta"]
          }
        },
        "commands": {
          "type": "array",
          "description": "Command registry - defines all available C3L commands",
          "items": { "$ref": "command.schema.json" }
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
      "description": "Domain/category (git, spec, test, code, docs, meta)",
      "enum": ["git", "spec", "test", "code", "docs", "meta"]
    },
    "c2": {
      "type": "string",
      "description": "Action/directive (create, analyze, execute, etc.)"
    },
    "c3": {
      "type": "string",
      "description": "Target/layer (refinement-issue, quality-metrics, etc.)"
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
      { "$ref": "registry_command_template.json" }
    ]
  }
}
```

```json:registry_command_template.json
{
  "c1": "{c1}",
  "c2": "{c2}",
  "c3": "{c3}",
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
