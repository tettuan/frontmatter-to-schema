# Implementation Documentation

## 実装表現ドキュメント

このディレクトリは現在の実装状況を表現するドキュメント群です。設計文書ではなく、実装された機能の動作と構造を明示的に表現しています。

## Template Format Feature Implementation

### x-template-format 機能の実装ドキュメント

| File | Description | Format |
|------|-------------|---------|
| `template-format-flow.dot` | コンポーネント間の関係とデータフロー | Graphviz DOT |
| `template-format-modules.dot` | モジュール依存関係図 | Graphviz DOT |
| `template-format-sequence.md` | 詳細シーケンス図とデータフロー | Markdown + Mermaid |
| `template-format-examples.md` | 具体的使用例とフロー | Markdown |

### 実装された機能概要

**x-template-format**: スキーマにて出力フォーマット（JSON/YAML/TOML/Markdown）を指定する機能

#### 責務分離の実装

- **Schema Layer**: x-template-format拡張の抽出・検証
- **Template Layer**: フォーマット解決（指定 or 自動検出）
- **Application Layer**: フォーマット情報の統合・受け渡し
- **Output Layer**: フォーマッター利用での実際の出力生成

#### データフロー

```
Schema拡張 → SchemaPropertyUtils → SchemaDefinition → Schema → TemplatePathResolver → PipelineOrchestrator → OutputRenderingService → FormatterFactory → 各種Formatter → 出力ファイル
```

### 図の生成方法

#### Graphviz DOT図のSVG生成
```bash
# フロー図
dot -Tsvg docs/implementation/template-format-flow.dot -o tmp/template-format-flow.svg

# モジュール図
dot -Tsvg docs/implementation/template-format-modules.dot -o tmp/template-format-modules.svg
```

#### Mermaidシーケンス図の表示
Mermaid対応エディタまたはmermaid-cliで`template-format-sequence.md`内の図を表示

### 実装状況

✅ **完了済み**:
- スキーマ拡張の追加
- 出力フォーマッター群（JSON/YAML/TOML/Markdown）
- パス解決での自動検出機能
- パイプライン統合
- 責務分離の改善

### 注意事項

- このドキュメントは実装の現状を表現するものです
- 設計変更時は対応する実装ドキュメントも更新してください
- 実装と乖離した場合は実装を正として修正してください