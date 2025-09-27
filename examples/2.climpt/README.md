# 2.climpt - コマンドレジストリシステム

CLIツールのコマンド階層とドキュメントを管理し、コマンドレジストリを生成する実用的な例です。

## 概要

31個のコマンドプロンプトMarkdownファイルから階層的なコマンドレジストリを生成します。

## 成功の定義

### 1. フロントマター抽出の成功

#### 必須フィールド

- `c1`: ドメイン/カテゴリ（git, spec, test, code, docs,
  meta）が全コマンドで抽出される
- `c2`: アクション/ディレクティブ（create, analyze,
  execute等）が全コマンドで抽出される
- `c3`: ターゲット/レイヤー（refinement-issue,
  quality-metrics等）が全コマンドで抽出される
- `description`: コマンドの説明が全コマンドで抽出される
- `usage`: 使用方法の説明が全コマンドで抽出される
- `options`: オプション設定が正しく抽出される

#### オプションフィールド

- `title`: コマンドのタイトル（存在する場合）
- `options.input`: 入力形式の配列
- `options.adaptation`: 処理モードの配列
- `options.input_file`: ファイル入力サポート（boolean）
- `options.stdin`: 標準入力サポート（boolean）
- `options.destination`: 出力先サポート（boolean）

### 2. スキーマ検証の成功

- 全31コマンドが`registry_command_schema.json`の定義に準拠する
- 必須フィールド（c1, c2, c3, description, usage,
  options）が全コマンドに存在する
- c1が定義されたカテゴリ（git, spec, test, code, docs, meta）のいずれかである

### 3. x-frontmatter-part処理の成功

- `tools.commands`配列に31個のコマンドオブジェクトが収集される
- 各プロンプトファイルのフロントマターが個別のコマンドとして処理される
- ファイル名のアルファベット順で処理される

### 4. x-derived-from処理の成功

#### availableConfigs配列

- 全コマンドの`c1`フィールドから値が収集される
- `x-derived-unique: true`により重複が削除される
- 結果として`["build", "debug", "design", "docs", "git", "meta", "spec", "test"]`のような配列となる
- 各値が`climpt-{name}`として利用可能なツール名を表す

### 5. テンプレート展開の成功

- `{version}`: "1.0.0"に置換される
- `{description}`: "Command Registry"に置換される
- `{tools.availableConfigs}`: 集約されたユニークなc1値の配列
- `{@items}`: commands配列の各要素が`registry_command_template.json`で展開される

## 期待される出力

```json
{
  "version": "1.0.0",
  "description": "Command Registry",
  "tools": {
    "availableConfigs": [
      "build",
      "debug",
      "design",
      "docs",
      "git",
      "meta",
      "spec",
      "test"
    ],
    "commands": [
      {
        "c1": "git",
        "c2": "create",
        "c3": "branch",
        "title": "Create Git Branch",
        "description": "Create a new git branch for feature development",
        "usage": "climpt-git create branch --name=feature-name",
        "options": {
          "input": ["string"],
          "adaptation": ["default"],
          "input_file": false,
          "stdin": false,
          "destination": false
        }
      },
      {
        "c1": "spec",
        "c2": "analyze",
        "c3": "quality-metrics",
        "title": "Analyze Quality Metrics",
        "description": "Analyze code quality metrics from specifications",
        "usage": "climpt-spec analyze quality-metrics --input=spec.md",
        "options": {
          "input": ["file", "stdin"],
          "adaptation": ["default", "detailed"],
          "input_file": true,
          "stdin": true,
          "destination": true
        }
      }
      // ... 他の29コマンド
    ]
  }
}
```

## 成功指標

### 数値基準

- **コマンド数**: 31個のコマンドが処理される
- **カテゴリ数**: 8種類のユニークなc1値（build, debug, design, docs, git, meta,
  spec, test）
- **必須フィールド充足率**: 100%

### 処理の正確性

- コマンドの階層構造（c1/c2/c3）が正しく保持される
- optionsオブジェクトの構造が維持される
- 配列フィールドが正しく処理される
- x-derived-fromによる集約が正しく動作する

### コマンド体系の一貫性

- 全コマンドがC3L（Category/Command/Layer）構造に従う
- 利用可能なツール名（climpt-{c1}）が正しく導出される

## 実行コマンド

```bash
# プロジェクトルートから
bash examples/2.climpt/run.sh

# または直接実行
./cli.ts \
  examples/2.climpt/registry_schema.json \
  "examples/2.climpt/prompts/**/*.md" \
  examples/2.climpt/climpt-registry-output.json
```

## この例が実証すること

- 階層的なコマンド体系の管理
- 複数ディレクトリからのファイル収集（prompts/**/*.md）
- x-derived-fromによる動的な設定値生成
- CLIツールのコマンドレジストリとしての実用性
