#!/bin/bash

SESSION="0:0.0"
MESSAGE="新たな問題が生じていないか、gh issueの進捗状況をみながら、codebaseの修正状況を確認して。"

# tmux に文字列を送信
tmux send-keys -t "$SESSION" "$MESSAGE" C-m
