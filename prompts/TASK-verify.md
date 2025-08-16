[PLAN FIRST]
以下の手順でビルドと動作確認を行ってください。

1) npx tsc -p tsconfig.json
2) sample.csv をプロジェクト直下に作成（ヘッダ＋2行程度）
3) node dist/cli/index.js analyze sample.csv --http-check
4) 実行結果ログを表示

完了したら /diff で差分と生成物の一覧を表示。
