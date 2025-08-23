# テンプレートへの変数埋め込み

TypeScriptでテンプレートを解析する必要はない。 `Claude Code SDK`
へ、テンプレート当て込みプロンプトと一緒に、テンプレートを渡し、返却結果を受け取るだけである。

NG：TypeScriptでの当て込み OK： `Claude Code SDK` での変換結果を受け取るだけ

# テンプレートへの当て込みのプロンプト

プロンプトは、「Schemaで解釈されたデータ」と「テンプレート」を使い、テンプレートへ値を埋め込む指示を行う。
指示が的確になるように、「Schema」「Schemaで解釈されたデータ」「テンプレート」を使う。

# テンプレートからの変換フロー

```mermaid
graph TD
    subgraph Inputs
        A["テンプレート当て込みのprompt"]
        B["Schema"]
        C["テンプレート"]
    end

    subgraph claude -p
        P{"A"}
    end

    subgraph Output
        O["変換後テンプレート"]
    end

    A -- "入力" --> P
    B -- "入力" --> P
    C -- "入力" --> P
    P -- "処理" --> O
```

変換後テンプレートは、統合にそのまま利用する。
