# フロントマター解析プロンプト

以下のClimptプロンプトファイルを解析し、JSON形式で情報を抽出してください。

## 解析対象

1. **フロントマター（---で囲まれたYAML部分）の抽出**
   - title
   - description
   - usage
   - その他のフィールド

2. **テンプレート変数の識別**
   - {variable_name} 形式の変数をすべて検出
   - 以下の標準オプションに対応する変数を分類:
     - {input_text} → STDIN入力
     - {input_file} や類似変数 → -f/--from オプション
     - {destination_path} → -o/--destination オプション
     - {uv-_} → --uv-_ ユーザー定義変数

3. **ファイルパス解析による コマンド構造抽出**
   - ファイルパス:
     .agent/climpt/prompts/{c1}/{c2}/{c3}/f_{input}_{adaptation}.md
   - c1: コマンドカテゴリ（domain）
   - c2: ディレクティブ（action）
   - c3: レイヤー（target）
   - input: 入力タイプ
   - adaptation: 適応モード（存在しない場合はnull）

## 出力形式

以下のJSON形式で正確に出力してください：

```json
{
  "has_frontmatter": boolean,
  "frontmatter": {
    "title": "string または null",
    "description": "string または null",
    "usage": "string または null"
  },
  "template_variables": ["変数名のリスト"],
  "command_structure": {
    "c1": "コマンドカテゴリ",
    "c2": "ディレクティブ", 
    "c3": "レイヤー",
    "input": "入力タイプ",
    "adaptation": "適応モード または null"
  },
  "detected_options": {
    "has_input_file": boolean,
    "has_stdin": boolean,
    "has_destination": boolean,
    "user_variables": ["uv-*変数のリスト"]
  }
}
```

## 解析対象ファイル

ファイルパス: {file_path}

ファイル内容: {file_content}
