[PLAN FIRST]
src/cli/commands/analyze.ts を更新して、CSVを読み込み「行数」を数えるところまで実装してください。

要件:
- fs + papaparse で CSV をストリームパース
- ヘッダあり前提でOK（1行目はヘッダとしてカウントしない）
- 最後に "rows=<件数>" を console.log
- 例外は try/catch で握り、エラーメッセージを出してプロセス終了コード1
- 既存の引数/オプションは維持
