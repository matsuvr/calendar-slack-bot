# Calendar Slack Bot

Slackでカレンダー絵文字が付けられた投稿から予定情報を自動検出し、Googleカレンダーに追加するためのリンクを生成するボットです。Google Cloud Runで動作するように設計されています。

## 機能概要

- Slack上でカレンダー関連の絵文字リアクション（:calendar:など）が付けられたメッセージを検出
- Gemini AI API（gemini-2.5-flash-lite）を使用して投稿内容から予定情報を自動抽出
- AIによる簡潔で分かりやすいカレンダータイトル生成
- 予定のタイトル、日時、場所、説明文などを解析
- 複数の予定を同時に処理可能（最大5件、バッチ処理）
- 長い説明文を自動で100文字以内に要約（重要情報を保持）
- Googleカレンダーへ予定を追加するためのURLを生成（オンラインミーティングリンクも自動検出し場所に組み込み）
- Slackのスレッドに予定情報と共にカレンダー追加用リンクを返信
- メモリ内キャッシュによる高速な重複処理防止機能（TTL: 5分）
- 日本語テキスト処理の最適化（URL周りのスペース調整）

## 前提条件

- Node.js v20以上
- Slack APIアカウントとワークスペース管理権限
- Google AI Studio（Gemini API）のアクセス権
- （デプロイ時）Google Cloud Platformアカウント

**注意**: Firestoreは必要ありません（メモリ内キャッシュを使用）。

## インストール方法

### ローカル開発環境での設定

1. リポジトリをクローン
   ```bash
   git clone <リポジトリURL>
   cd calendar-slack-bot
   ```

2. 依存パッケージをインストール
   ```bash
   npm install
   ```

3. 環境変数の設定
   ```bash
   cp .env.example .env
   ```
   `.env`ファイルを編集し、以下の環境変数を設定してください：
   - `SLACK_BOT_TOKEN`: SlackボットのOAuthトークン
   - `SLACK_SIGNING_SECRET`: Slackアプリの署名シークレット
   - `GEMINI_API_KEY`: Gemini APIキー
   - `SLACK_TEAM_ID`: （オプション）SlackチームID（メッセージURLに使用）

4. 開発サーバーの起動
   ```bash
   npm run dev
   ```

## Slack APIの設定

1. [Slack API Dashboard](https://api.slack.com/apps)にアクセス
2. 「Create New App」→「From scratch」を選択
3. アプリ名を入力し、使用するワークスペースを選択

### ボットスコープの設定
1. サイドバーから「OAuth & Permissions」を選択
2. 「Bot Token Scopes」セクションで、以下のスコープを追加
   - `channels:history`
   - `channels:read`
   - `chat:write`
   - `reactions:read`
   - `reactions:write`

### イベントサブスクリプションの設定
1. 「Event Subscriptions」を選択し、「Enable Events」をONにする
2. Request URLに `https://あなたのサーバーのURL/slack/events` を入力
3. 「Subscribe to bot events」セクションで、`reaction_added` イベントを追加
4. 「Save Changes」をクリック

### アプリのインストール
1. 「Install to Workspace」ボタンをクリックしてアプリをインストール
2. インストール完了後に表示される「Bot User OAuth Token」を`.env`ファイルの`SLACK_BOT_TOKEN`にコピー
3. 「Basic Information」ページの「Signing Secret」を`.env`ファイルの`SLACK_SIGNING_SECRET`にコピー

## Gemini APIの設定

1. [Google AI Studio](https://makersuite.google.com/app/apikey)にアクセス
2. 「Get API key」をクリックしてAPIキーを取得
3. 生成されたAPIキーを`.env`ファイルの`GEMINI_API_KEY`としてコピー

## Google Cloud Runへのデプロイ

### 手動デプロイ

1. Google Cloud SDKをインストール
2. プロジェクトの認証設定
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

3. Dockerイメージのビルドとプッシュ
   ```bash
   gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/calendar-slack-bot
   ```

4. Cloud Runへのデプロイ
   ```bash
   gcloud run deploy calendar-slack-bot \
     --image gcr.io/YOUR_PROJECT_ID/calendar-slack-bot \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars SLACK_BOT_TOKEN=xoxb-your-token,SLACK_SIGNING_SECRET=your-secret,GEMINI_API_KEY=your-api-key,SLACK_TEAM_ID=your-team-id
   ```

### Cloud Buildによる自動デプロイ

リポジトリに含まれている`cloudbuild.yaml`を使用して自動デプロイが可能です：

1. [Google Cloud Build](https://console.cloud.google.com/cloud-build)でリポジトリを接続
2. 環境変数を[Secret Manager](https://console.cloud.google.com/security/secret-manager)で設定
3. トリガーを設定してデプロイを自動化

**注意**: Firestoreの設定は不要です（メモリ内キャッシュを使用）。

## 使い方

1. ボットをSlackチャンネルに招待
2. 予定情報が含まれるメッセージに、以下のいずれかの絵文字リアクションを追加
   - :calendar:
   - :カレンダー:
   - :calendar_spiral:
   - :date:
   - :カレンダーに入れる:
   - :calendar-bot:

3. ボットがメッセージ内の予定情報を抽出し、スレッドに返信
4. 返信に含まれるリンクをクリックしてGoogleカレンダーに予定を追加

### 予定情報の記述例

```
明日13時から14時まで会議室Aでプロジェクト進捗MTG
ZoomミーティングURL: https://us02web.zoom.us/j/123456789
```

このようなメッセージから以下の予定情報が抽出されます：
- タイトル: AIが生成した簡潔なタイトル（例：「プロジェクト進捗MTG」）
- 日付: 2025-06-26（明日の日付）
- 開始時間: 13:00
- 終了時間: 14:00
- 場所: 会議室A + ZoomミーティングURL

## トラブルシューティング

### ボットが応答しない場合
- Slackアプリが正しくインストールされているか確認
- 環境変数が正しく設定されているか確認
- ボットがチャンネルに招待されているか確認
- サーバーログでエラーメッセージを確認
- Slackイベント設定のRequest URLが正しいか確認

### 予定情報が正しく抽出されない場合
- メッセージ内の日時情報が明確に記載されているか確認
- 複数の日時情報がある場合は、関連情報をグループ化して記載
- シンプルな表現で記述してみる（「明日15時から会議」など）
- 日付と時間の両方が含まれているか確認

### デプロイ関連の問題
- Cloud Run権限が適切に設定されているか確認
- 環境変数が正しく設定されているか確認
- Dockerイメージが正しくビルドされているか確認
- Cloud RunのメモリとCPU設定が十分か確認

### Gemini API関連の問題
- APIキーの有効期限と権限を確認
- レート制限に達していないか確認
- 指定したモデル（gemini-2.5-flash-lite-preview-06-17）が利用可能か確認
- リトライ機能が正常に動作しているか確認

### メモリ内キャッシュ関連の問題
- キャッシュサイズが適切か確認
- TTL設定（5分）が適切か確認
- メモリリークが発生していないか確認
- キャッシュクリーンアップが正常に動作しているか確認

## 開発者向け情報

詳細な技術仕様については以下のドキュメントを参照してください：
- [設計ドキュメント](DESIGN_DOC.md)
- [API仕様書](API_SPEC.md)

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は[LICENSE](LICENSE)ファイルを参照してください。