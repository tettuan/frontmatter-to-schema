---
c1: git
c2: decide-branch
c3: working-branch
title: Git Branch Creation Decision and New Branch Setup
description: Determines appropriate Git branch strategy and creates new branches based on work similarity analysis.
usage: climpt-git decide-branch working-branch -i="work description within 30 chars"
options:
  stdin: true
---

指示「採用ステップ」に基づき、どのGitブランチ名を採用するか、定める。採用ステップを実行した後に、ブランチの作成判断と移動を行うこと。そのまま現在のブランチを採用する可能性もある。

# Git ブランチ戦略

まず最初に、 `docs/claude/git-workflow.md` を読んで把握すること。

# 採用ステップ

1. 現在のブランチ名を取得する(branch-A)
2. 「今回の作業内容」に相応しいブランチ名を考える(branch-B)
3. [branch-A]が `main`,`develop` であれば、必ずbranch-Bを採用する
4. 「近さ基準」に基づき、branch-A or branch-B を決める
5. 決めたブランチへ移動する 5-1. branch-Bの派生元は、必ずbranch-Aとする

# 今回の作業内容

{input_text}

# 類似度判定

以下のスクリプトで実行：

```bash
./scripts/git-branch-similarity.sh "<branch-A>" "<branch-B>"
```

- **閾値: 0.7**
- `similarity_score < 0.7` → 派生元branch-Aから新ブランチ作成(branch-B)
- `similarity_score >= 0.7` → 現在のブランチで継続(branch-A)
