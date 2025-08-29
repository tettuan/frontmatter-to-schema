---
c1: git
c2: merge-cleanup
c3: develop-branches
title: Merge to Develop and Clean Up Unnecessary Branches
description: Merges all unmerged branches into develop and deletes them after successful merge operations.
usage: climpt-git merge-cleanup develop-branches -o cleanup_report.md
options:
  destination: [true]
---

# 指示: developにマージして不要なブランチを掃除する

以下の指示に従って。

mergeされていないブランチを全てdevelopへ統合し、マージ後に削除して。

マージ:

1. developブランチから派生したブランチの全てをリスト化する
2. ブランチの作成順序や、進捗状況を見て、順番を決める
3. stashも全て取り込んで、削除する
4. コンフリクトする場合は、マージしてから解消する
5. マージ後、ブランチを削除する
6. docs ブランチだけはマージしない
7. PR のうち、main へマージしようとしているものは削除する

main,develop ブランチだけになったら、 develop
ブランチを起点に、CIが通るまで修正を重ねる。
