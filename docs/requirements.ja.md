# 要求事項

1. マークダウンのフロントマターを抽出し、解析する
2. 解析した結果をSchemaに基づいてテンプレートフォーマットへ当て込み、書き出す
3. フロントマターの柔軟性のために、解析は `claude -p` を使う

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
5. 'claude -p' 用のプロンプト2つ
6. examples/ に実例を使った実行例が存在する

# 解析の手順

まず、プロンプト一覧を作る。(成果A)
また、最終成果物を空の状態でつくる（最終成果物Z）

成果Aに対し、ループ処理する。全件実施する。
各ループ内では、プロンプト1つずつを処理する。
最初にフロントマター部分を抽出する。これはDenoで実施する。(成果B)
成果Bから、`claude -p` で解析する（成果C）
成果Cを元に`claude -p`で構造データへ当てこむ（成果D）
成果Dを 最終成果物Z へ統合する
成最終成果物Zを保存する。

## claude -p

以下の2種類を使い分ける。

a. プロンプトとフロントマターと「解析結果のSchema」を使って情報を抽出する 
b. 抽出した情報を、「解析結果のSchema」を使って、解析テンプレートへ当て込む

抽出のためのプロンプトは、TypeScript内部へ埋め込む。

## 抽象化レベル

ルール:

1. 実装に具体的な実例1-実例2のパターンを混入しない
2. 実例1-実例2のSchema例とテンプレート例が変更されても、アプリケーションコードに影響がない
3. 実例1-実例2の階層情報が変わっても、アプリケーションコードに影響がない
4. 上記2と3が、設定あるいは引数で解決できている
5. 最終成果物Zは、`claude -p`の `b` による成果物を結合した結果とイコールである。

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

```json
{
  "version": string,           // Registry version (e.g., "1.0.0")
  "description": string,       // Overall registry description
  "tools": {
    // Tool names array - each becomes available as climpt-{name}
    "availableConfigs": string[],  // ["git", "spec", "test", "code", "docs", "meta"]
    
    // Command registry - defines all available C3L commands
    "commands": [
      {
        "c1": string,         // Domain/category (git, spec, test, code, docs, meta)
        "c2": string,         // Action/directive (create, analyze, execute, etc.)
        "c3": string,         // Target/layer (refinement-issue, quality-metrics, etc.)
        "description": string,// Command description
        "usage": string,      // Usage instructions and examples
        "options": {          // Available options for this command
          "input": string[],     // Supported input formats
          "adaptation": string[], // Processing modes
          "input_file": boolean[],  // File input support
          "stdin": boolean[],       // Standard input support
          "destination": boolean[]  // Output destination support
        }
      }
    ]
  }
}
```

### 解析結果のテンプレート：

```json
{
  "version": "1.0.0",
  "description": "Climpt comprehensive configuration for MCP server and command registry",
  "tools": {
    "availableConfigs": [
      "code",
      "docs",
      "git",
      "meta",
      "spec",
      "test"
    ],
    "commands": [
      // Git commands
      {
        "c1": "git",
        "c2": "create",
        "c3": "refinement-issue",
        "description": "Create a refinement issue from requirements documentation",
        "usage": "Create refinement issues from requirement documents.\nExample: climpt-git create refinement-issue -f requirements.md",
        "options": {
          "input": ["MD"],
          "adaptation": ["default", "detailed"],
          "input_file": [true],
          "stdin": [false],
          "destination": [true]
        }
      },
      {
        "c1": "git",
        "c2": "analyze",
        "c3": "commit-history",
        "description": "Analyze commit history and generate insights"
      },
      {
        "c1": "spec",
        "c2": "analyze",
        "c3": "quality-metrics",
        "description": "Analyze specification quality and completeness"
      },
      {
        "c1": "spec",
        "c2": "validate",
        "c3": "requirements",
        "description": "Validate requirements against standards"
      },
      {
        "c1": "test",
        "c2": "execute",
        "c3": "integration-suite",
        "description": "Execute integration test suite"
      }
    ]
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
