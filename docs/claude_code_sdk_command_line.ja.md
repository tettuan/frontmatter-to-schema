# Claude Code SDK - Command Line Interface

## インストール

```bash
npm install -g @anthropic-ai/claude-code
```

## 基本的な使用方法

### 非対話モード

```bash
claude -p "Your prompt here"
```

### カスタムシステムプロンプト付き

```bash
claude -p "Your prompt here" \
  --append-system-prompt "Custom instructions" \
  --allowedTools "Bash,Read,WebSearch" \
  --permission-mode acceptEdits
```

## 主要なCLIオプション

| オプション               | 説明                                     |
| ------------------------ | ---------------------------------------- |
| `--print`, `-p`          | 非対話モードで実行                       |
| `--output-format`        | 出力形式を指定 (text, json, stream-json) |
| `--resume`, `-r`         | 特定のセッションを継続                   |
| `--allowedTools`         | 許可するツールを指定                     |
| `--append-system-prompt` | カスタムシステム指示を追加               |
| `--permission-mode`      | エージェントの動作を制御                 |

## 使用例

### 1. 法的文書レビュー

```bash
claude -p "Review contract terms" \
  --append-system-prompt "You are a legal assistant identifying risks"
```

### 2. セキュリティ監査

```bash
gh pr diff 123 | claude -p \
  --append-system-prompt "Analyze PR for security vulnerabilities"
```

### 3. コード生成

```bash
claude -p "Generate a React component for user authentication" \
  --allowedTools "Write,Read" \
  --output-format json
```

## 認証

環境変数を設定:

```bash
export ANTHROPIC_API_KEY="your-api-key"
```

サードパーティプロバイダーのサポート:

- Amazon Bedrock
- Google Vertex AI

## ツール権限管理

利用可能なツール:

- `Bash` - コマンド実行
- `Read` - ファイル読み取り
- `Write` - ファイル書き込み
- `Edit` - ファイル編集
- `WebSearch` - ウェブ検索
- `WebFetch` - ウェブコンテンツ取得

## 出力形式

### テキスト形式（デフォルト）

```bash
claude -p "Your prompt" --output-format text
```

### JSON形式

```bash
claude -p "Your prompt" --output-format json
```

### ストリーミングJSON形式

```bash
claude -p "Your prompt" --output-format stream-json
```

## セッション管理

### セッションの再開

```bash
claude --resume <session-id>
```

### セッション履歴の確認

```bash
claude --list-sessions
```

## 高度な使用方法

### パイプライン処理

```bash
cat file.txt | claude -p "Analyze this content"
```

### 複数ツールの組み合わせ

```bash
claude -p "Analyze and refactor this codebase" \
  --allowedTools "Read,Write,Edit,Bash" \
  --append-system-prompt "Focus on performance optimization"
```

## ベストプラクティス

1. **明確なプロンプト**: 具体的で明確な指示を提供する
2. **適切なツール権限**: 必要最小限のツールのみを許可する
3. **システムプロンプトの活用**: タスクに特化した指示を追加する
4. **出力形式の選択**: 用途に応じて適切な形式を選択する
5. **セッション管理**: 長期的なタスクではセッションを活用する
