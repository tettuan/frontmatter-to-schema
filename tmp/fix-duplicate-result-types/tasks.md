# リファクタリングタスク

## 現在の問題点

1. Result型の重複定義 (src/domain/core/result.ts と src/domain/shared/types.ts)
2. console.log文の残存 (100箇所以上)
3. Factoryクラスの散在と責務不明確

## タスク一覧

### 1. Result型の統合

- [ ] src/domain/core/result.ts を正規の定義として確定
- [ ] src/domain/shared/types.ts から重複定義を削除
- [ ] 全ファイルのインポートパスを統一
- [ ] テストを実行して動作確認

### 2. console.log文の削除とロガー実装

- [ ] ロガーインターフェースの設計
- [ ] 環境変数によるログレベル制御の実装
- [ ] 全console.log文の調査とリスト化
- [ ] console.logをロガーに置換
- [ ] テストコードのconsole.logは保持

### 3. Factoryパターンのリファクタリング

- [ ] 各Factoryクラスの責務分析
- [ ] ドメイン境界に基づく整理
- [ ] Abstract Factoryパターンの適用検討
- [ ] 依存性注入の改善

### 4. 品質確認

- [ ] deno task test の実行
- [ ] deno task ci の実行
- [ ] リファクタリング後のエントロピー測定

## 優先順位

1. Result型の統合 (最優先 - 型の一貫性)
2. console.log文の削除 (高優先 - 本番環境への影響)
3. Factoryパターンのリファクタリング (中優先 - 保守性向上)
