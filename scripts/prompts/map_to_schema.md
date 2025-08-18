# Schema マッピングプロンプト

抽出されたフロントマター解析データをClimpt registry
schemaに適合する形式に変換してください。

## 入力データ

フロントマター解析から得られたJSON: {analysis_result}

## マッピングルール

1. **基本コマンド情報**
   - c1: command_structure.c1 をそのまま使用
   - c2: command_structure.c2 をそのまま使用
   - c3: command_structure.c3 をそのまま使用

2. **説明文の生成**
   - description: frontmatter.description を優先、なければ frontmatter.title
     から生成
   - usage: frontmatter.usage を優先、なければ description から使用例を生成

3. **オプション情報のマッピング**
   - input: command_structure.input から配列形式で設定
   - adaptation: command_structure.adaptation
     があれば配列に含める、なければ["default"]
   - input_file: detected_options.has_input_file の boolean値を配列で設定
   - stdin: detected_options.has_stdin の boolean値を配列で設定
   - destination: detected_options.has_destination の boolean値を配列で設定

## 出力形式

以下のJSON形式で正確に出力してください：

```json
{
  "c1": "string",
  "c2": "string",
  "c3": "string", 
  "description": "string",
  "usage": "string",
  "options": {
    "input": ["supported input formats"],
    "adaptation": ["processing modes"],
    "input_file": [boolean],
    "stdin": [boolean],
    "destination": [boolean]
  }
}
```

## 注意事項

- すべてのフィールドは必須です
- description と usage は空文字列にしてはいけません
- options の各配列は少なくとも1つの要素を含む必要があります
- boolean配列は [true] または [false] の形式です
