# Calendar Slack Bot API仕様書

このドキュメントでは、Calendar Slack Botの内部APIとその機能について説明します。

## 1. 概要

Calendar Slack Botは、Slack上でカレンダー関連の絵文字リアクションが付けられたメッセージから予定情報を抽出し、Googleカレンダーへのリンクを生成するサービスです。

## 2. システムアーキテクチャ

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│   Slack API  │◄───►│ Calendar Bot │◄───►│   Gemini API  │
└─────────────┘     └──────────────┘     └───────────────┘
                           │
                           ├────────────►┌───────────────┐
                           │             │   Firestore   │
                           │             └───────────────┘
                           ▼
                    ┌──────────────┐
                    │Google Calendar│
                    │  (URL生成)   │
                    └──────────────┘
```

## 3. API エンドポイント

### 3.1. Slackイベント受信

**エンドポイント**: `/slack/events`  
**メソッド**: POST  
**コンテンツタイプ**: application/json

このエンドポイントはSlack APIからのイベント通知を受け取ります。Slack APIからのリクエストは署名が検証され、正当なものだけが処理されます。

#### リクエスト例（reaction_added イベント）:

```json
{
  "token": "verification_token",
  "team_id": "T0001",
  "api_app_id": "A0001",
  "event": {
    "type": "reaction_added",
    "user": "U0001",
    "item": {
      "type": "message",
      "channel": "C0001",
      "ts": "1638291600.000001"
    },
    "reaction": "calendar",
    "event_ts": "1638291605.000001"
  },
  "type": "event_callback",
  "event_id": "Ev0001",
  "event_time": 1638291605
}
```

### 3.2. ヘルスチェック

**エンドポイント**: `/health`  
**メソッド**: GET

システムの状態を確認するためのエンドポイントです。

#### レスポンス:

```
200 OK
```

### 3.3. セットアップガイド

**エンドポイント**: `/`  
**メソッド**: GET

セットアップガイドを表示するHTMLページを返します。デプロイしたCloud Runではリソース節約のため静的なHTMLを返します。

## 4. 内部関数API

### 4.1. AI処理サービス (`src/services/aiService.js`)

#### `extractEventsFromText(text, options)`

テキストから予定情報を抽出します。

**引数**:
- `text` (string): 分析するテキスト
- `options` (object): 抽出オプション
  - `currentDate` (string): 現在の日付（YYYY-MM-DD形式）
  - `currentTime` (string): 現在の時刻（HH:MM形式）
  - `maxEvents` (number): 抽出する最大予定数

**戻り値**:
予定オブジェクトの配列。各オブジェクトは以下のプロパティを持ちます:
- `title`: 予定のタイトル
- `date`: 予定の日付（YYYY-MM-DD形式）
- `startTime`: 開始時間（HH:MM形式）
- `endTime`: 終了時間（HH:MM形式）
- `location`: 場所（オプション）
- `description`: 説明（オプション）

**内部処理**:
1. Gemini APIを使用してテキストを分析
2. 予定情報をJSON形式で構造化
3. 失敗した場合はレガシーモードで再試行

#### `summarizeText(text, maxLength = 100)`

長いテキストを指定された文字数以内に要約します。

**引数**:
- `text` (string): 要約するテキスト
- `maxLength` (number): 最大文字数（デフォルト: 100）

**戻り値**:
- 要約されたテキスト（string）

### 4.2. カレンダーユーティリティ (`src/utils/calendarUtils.js`)

#### `createGoogleCalendarUrl(event)`

予定情報からGoogleカレンダーのURLを生成します。

**引数**:
- `event` (object): 予定情報オブジェクト

**戻り値**:
- Googleカレンダー追加用URL（string）

**サポートする予定パラメータ**:
- タイトル (`text`)
- 場所 (`location`)
- 説明 (`details`)
- 日時 (`dates` - ISO 8601形式)
- ビデオ会議リンク（Zoom、Google Meet、Microsoft Teamsを自動検出）

#### `detectMeetingUrls(text)`

テキスト内のオンラインミーティングURLを検出します。

**引数**:
- `text` (string): 検索するテキスト

**戻り値**:
- 検出されたミーティングURLの配列

### 4.3. Firestoreサービス (`src/services/firestoreService.js`)

#### `checkAndStoreReactionId(reactionId)`

リアクションIDを検証し、処理済みでなければFirestoreに保存します。

**引数**:
- `reactionId` (string): チェックするリアクションID

**戻り値**:
- `{ exists: boolean }`: リアクションが既に処理済みかどうか

## 5. デプロイメント設定

### 5.1. 環境変数

| 変数名 | 説明 | 必須 |
|--------|------|------|
| `SLACK_BOT_TOKEN` | Slackボットのトークン | ✓ |
| `SLACK_SIGNING_SECRET` | Slackアプリの署名シークレット | ✓ |
| `GEMINI_API_KEY` | Gemini APIキー | ✓ |
| `FIRESTORE_PROJECT_ID` | FirestoreプロジェクトID |  |
| `PORT` | サーバーポート番号（デフォルト: 8080） |  |
| `SLACK_TEAM_ID` | SlackチームID（オプション） |  |
| `NODE_ENV` | 実行環境（production/development） |  |

### 5.2. Cloud Run設定

**CPU**: 1  
**メモリ**: 512Mi  
**最大インスタンス数**: 10  
**タイムアウト**: 300秒  
**コンテナ環境**: Node.js 20

## 6. エラーレスポンス

### 6.1. 予定が見つからない場合

Slackスレッドに対して以下のレスポンスを返します:
```
予定情報を検出できませんでした。メッセージに日時情報が含まれていることを確認してください。
```
また、元のメッセージに `no_entry_sign` リアクションを追加します。

### 6.2. APIエラー

Slackスレッドに対して以下のレスポンスを返します:
```
エラーが発生しました: [エラーメッセージ]
技術サポートチームにお問い合わせください。
```

### 6.3. 複数予定検出時の上限超過

予定数が上限を超えた場合:
```
多数の予定が検出されました。最大5件までが処理されます。
```

## 7. リアクショントリガー

以下のSlackリアクションが予定検出をトリガーします:

- `:calendar:`
- `:カレンダー:`
- `:calendar_spiral:`
- `:date:`
- `:カレンダーに入れる:`
- `:calendar-bot:`

## 8. セキュリティ考慮事項

- すべてのSlackリクエストは署名検証を経て処理
- サーバーはHTTPSのみを使用
- APIキーは環境変数を通じて安全に管理
- 予定の説明文を要約する際も重要情報（URL、ミーティングID）は保持
- Firestoreトランザクションによる重複処理防止
- 環境変数を使用した認証情報の分離