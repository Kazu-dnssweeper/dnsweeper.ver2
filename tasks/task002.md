\# TASK-002: M2: DoH リゾルバ \& キャッシュ 実装



\## 概要

DNSweeper の解析パイプラインにおける「DoH リゾルバ \& キャッシュ」機能を実装する。

Cloudflare / Google Public DNS / 任意 DoH エンドポイントに対して安全かつ高速な DNS レコード解決を行い、結果をキャッシュして再利用できるようにする。



\## ゴール

\- 指定された FQDN + QTYPE に対して DoH クエリを実行

\- 応答ステータス（NOERROR/NXDOMAIN/SERVFAIL/TIMEOUT）や TTL を含む詳細な結果を取得

\- 同一ラン内で TTL が有効な範囲の再解決をキャッシュヒットでスキップ

\- 再試行（指数バックオフ＋ジッタ）に対応

\- キャッシュは in-memory 実装で MVP 完結（将来的にはファイル永続化を拡張予定）



\## 詳細仕様



\### 入力

\- `qname`: 例 `example.com.`

\- `qtype`: `'A'|'AAAA'|'CNAME'|'TXT'|'SRV'|'CAA'|'MX'|'NS'|'PTR'`

\- オプション：

&nbsp; - `dohEndpoint`（例: `https://dns.google/dns-query`）

&nbsp; - `timeoutMs`（既定: 3000）

&nbsp; - `retries`（既定: 2）



\### 出力 (`ResolveResult`)

```ts

interface ResolveHop {

&nbsp; type: string; // A, AAAA, CNAME, etc.

&nbsp; data: string; // レコード内容

&nbsp; ttl?: number;

}



interface ResolveResult {

&nbsp; qname: string;

&nbsp; qtype: QType;

&nbsp; status: 'NOERROR'|'NXDOMAIN'|'SERVFAIL'|'TIMEOUT';

&nbsp; chain: ResolveHop\[];

&nbsp; ad?: boolean;

&nbsp; cd?: boolean;

&nbsp; elapsedMs: number;

}

````



\### 処理フロー



1\. \*\*キャッシュ確認\*\*



&nbsp;  \* キー: `${qname}|${qtype}`

&nbsp;  \* TTL 有効期間内であればキャッシュ結果を返す。

2\. \*\*DoH クエリ送信\*\*



&nbsp;  \* POST / GET 方式は固定（JSON over HTTPS）

&nbsp;  \* `application/dns-json` を利用

&nbsp;  \* クエリパラメータ: `name`, `type`, `cd`（Checking Disabled）

3\. \*\*レスポンス解析\*\*



&nbsp;  \* `Status` → `status` マッピング

&nbsp;  \* `Answer` セクションを chain に展開

&nbsp;  \* TTL 最小値を取得しキャッシュ期限に設定

4\. \*\*再試行\*\*



&nbsp;  \* DNS/HTTP エラー時に指数バックオフ（200〜1500ms ジッタ）で最大 `retries` 回

5\. \*\*キャッシュ保存\*\*



&nbsp;  \* TTL と取得時刻を合わせて保存

6\. \*\*結果返却\*\*



\### キャッシュ仕様



\* in-memory: `Map<string, { result: ResolveResult, expiresAt: number }>`

\* ヒット条件: `Date.now() < expiresAt`

\* 実行中のみ有効（プロセス終了で消える）



\### エラーハンドリング



\* タイムアウト: `status = 'TIMEOUT'`

\* ネットワークエラー: `status = 'SERVFAIL'` 扱い

\* 不正レスポンス: chain 空配列で返却し、Evidence 側で記録



\## テストケース



\* \*\*正常系\*\*



&nbsp; \* `A` レコードの解決（NOERROR, TTL > 0）

&nbsp; \* CNAME チェイン取得（複数ホップ）

\* \*\*異常系\*\*



&nbsp; \* NXDOMAIN 応答

&nbsp; \* タイムアウト（timeoutMs=1 で強制）

&nbsp; \* キャッシュ有効確認（2 回目は即時返答）



\## 成果物



\* `src/core/resolver/doh.ts` 実装

\* `src/core/resolver/cache.ts` 実装

\* 単体テスト（`tests/unit/resolver.test.ts`）



\## 完了条件



\* テストケース全通過

\* キャッシュヒット時に DoH への追加リクエストが発生しないことをログで確認

\* FR-003, FR-004 の要件を満たす



```



---



これ、`task002.md` として保存すれば、M2の実装指示書になります。  

もし希望あれば、このまま 003〜100 まで同じ粒度で自動生成できます。

```

りました。

さっきの \*\*要件定義・設計書 v1.0\*\* の M2（DoH リゾルバ \& キャッシュ）をタスク化して、

`tasks/task002.md` 用に実装粒度の詳細を書きます。



---



````markdown

\# TASK-002: M2: DoH リゾルバ \& キャッシュ 実装



\## 概要

DNSweeper の解析パイプラインにおける「DoH リゾルバ \& キャッシュ」機能を実装する。

Cloudflare / Google Public DNS / 任意 DoH エンドポイントに対して安全かつ高速な DNS レコード解決を行い、結果をキャッシュして再利用できるようにする。



\## ゴール

\- 指定された FQDN + QTYPE に対して DoH クエリを実行

\- 応答ステータス（NOERROR/NXDOMAIN/SERVFAIL/TIMEOUT）や TTL を含む詳細な結果を取得

\- 同一ラン内で TTL が有効な範囲の再解決をキャッシュヒットでスキップ

\- 再試行（指数バックオフ＋ジッタ）に対応

\- キャッシュは in-memory 実装で MVP 完結（将来的にはファイル永続化を拡張予定）



\## 詳細仕様



\### 入力

\- `qname`: 例 `example.com.`

\- `qtype`: `'A'|'AAAA'|'CNAME'|'TXT'|'SRV'|'CAA'|'MX'|'NS'|'PTR'`

\- オプション：

&nbsp; - `dohEndpoint`（例: `https://dns.google/dns-query`）

&nbsp; - `timeoutMs`（既定: 3000）

&nbsp; - `retries`（既定: 2）



\### 出力 (`ResolveResult`)

```ts

interface ResolveHop {

&nbsp; type: string; // A, AAAA, CNAME, etc.

&nbsp; data: string; // レコード内容

&nbsp; ttl?: number;

}



interface ResolveResult {

&nbsp; qname: string;

&nbsp; qtype: QType;

&nbsp; status: 'NOERROR'|'NXDOMAIN'|'SERVFAIL'|'TIMEOUT';

&nbsp; chain: ResolveHop\[];

&nbsp; ad?: boolean;

&nbsp; cd?: boolean;

&nbsp; elapsedMs: number;

}

````



\### 処理フロー



1\. \*\*キャッシュ確認\*\*



&nbsp;  \* キー: `${qname}|${qtype}`

&nbsp;  \* TTL 有効期間内であればキャッシュ結果を返す。

2\. \*\*DoH クエリ送信\*\*



&nbsp;  \* POST / GET 方式は固定（JSON over HTTPS）

&nbsp;  \* `application/dns-json` を利用

&nbsp;  \* クエリパラメータ: `name`, `type`, `cd`（Checking Disabled）

3\. \*\*レスポンス解析\*\*



&nbsp;  \* `Status` → `status` マッピング

&nbsp;  \* `Answer` セクションを chain に展開

&nbsp;  \* TTL 最小値を取得しキャッシュ期限に設定

4\. \*\*再試行\*\*



&nbsp;  \* DNS/HTTP エラー時に指数バックオフ（200〜1500ms ジッタ）で最大 `retries` 回

5\. \*\*キャッシュ保存\*\*



&nbsp;  \* TTL と取得時刻を合わせて保存

6\. \*\*結果返却\*\*



\### キャッシュ仕様



\* in-memory: `Map<string, { result: ResolveResult, expiresAt: number }>`

\* ヒット条件: `Date.now() < expiresAt`

\* 実行中のみ有効（プロセス終了で消える）



\### エラーハンドリング



\* タイムアウト: `status = 'TIMEOUT'`

\* ネットワークエラー: `status = 'SERVFAIL'` 扱い

\* 不正レスポンス: chain 空配列で返却し、Evidence 側で記録



\## テストケース



\* \*\*正常系\*\*



&nbsp; \* `A` レコードの解決（NOERROR, TTL > 0）

&nbsp; \* CNAME チェイン取得（複数ホップ）

\* \*\*異常系\*\*



&nbsp; \* NXDOMAIN 応答

&nbsp; \* タイムアウト（timeoutMs=1 で強制）

&nbsp; \* キャッシュ有効確認（2 回目は即時返答）



\## 成果物



\* `src/core/resolver/doh.ts` 実装

\* `src/core/resolver/cache.ts` 実装

\* 単体テスト（`tests/unit/resolver.test.ts`）



\## 完了条件



\* テストケース全通過

\* キャッシュヒット時に DoH への追加リクエストが発生しないことをログで確認

\* FR-003, FR-004 の要件を満たす





