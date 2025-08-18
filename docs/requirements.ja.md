# 要求事項

1. マークダウンのフロントマターを抽出し、解析する
2. 解析した結果をSchemaに基づいてテンプレートフォーマットへ当て込み、書き出す
3. フロントマターの柔軟性のために、解析は `claude -p` を使う

# 成果物

1. 要求の整理と要件化
2. 機能要件、非機能要件の分離
3. ドメイン境界線の設計資料の作成
4. 実装された解析のスクリプト
5. 'claude -p' 用のプロンプト2つ

# 解析の手順

まず、プロンプト一覧を作る。(成果A)

成果Aに対し、ループ処理する。全件実施する。
各ループ内では、プロンプト1つずつを処理する。
最初にフロントマター部分を抽出する。これはDenoで実施する。(成果B)
成果Bから、`claude -p` で解析する（成果C）
成果Cを元に`claude -p`で構造データへ当てこむ（成果D）
成果Dを全体の解析結果へ統合する（成果E） 成果Eを解析結果として保存する。

## claude -p

以下の2種類を使い分ける。

a. プロンプトとフロントマターと解析結果のSchemaを使って情報を抽出する b.
抽出した情報を、解析結果のSchemaを使って、解析テンプレートへ当て込む

TypeScript内部へ埋め込む。

# 参照すべき情報

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
