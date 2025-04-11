# Slack Calendar Bot

Slackの投稿に「カレンダーに入れる」スタンプ（:calendar:）を付けると、その投稿からイベント情報を抽出してGoogleカレンダーに登録できるURLを生成するボットです。

## 機能

- 「カレンダーに入れる」スタンプが付いた投稿からイベント情報を抽出
- Google Gemini APIを使用してテキストから予定情報を解析
- 複数の予定が含まれている場合は、それぞれに対してカレンダーURLを生成
- 予定が見つからない場合は「予定なし」スタンプで返答
- 不完全な予定情報（場所や時間が不明など）でもわかる範囲でURLを生成

## 必要条件

- Node.js 20以上
- Slack APIアカウントとボットトークン
- Google Gemini APIキー

## セットアップ手順

### 1. リポジトリのクローン

```bash
git clone https://github.com/yourusername/slack-calendar-bot.git
cd slack-calendar-bot
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env`ファイルを作成し、以下の情報を入力します：

SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token
GEMINI_API_KEY=your-gemini-api-key
PORT=3000


### 4. Slackアプリの設定

1. [Slack API](https://api.slack.com/apps)にアクセスし、新しいアプリを作成します。
2. 「Socket Mode」を有効にします。
3. 「Event Subscriptions」を有効にし、以下のイベントを登録します：
   - `reaction_added`
4. 「OAuth & Permissions」で以下のスコープを追加します：
   - `channels:history`
   - `chat:write`
   - `reactions:read`
   - `reactions:write`
5. アプリをワークスペースにインストールし、トークンを取得します。

### 5. カスタムスタンプの追加

以下のスタンプをワークスペースに追加します：

- `:calendar-bot:` - カレンダーに追加する予定を示すスタンプ
- `:no_event:` - 予定が見つからなかったことを示すスタンプ

### 6. アプリの起動

```bash
npm start
```

## デプロイ方法

### Herokuへのデプロイ

1. Herokuアカウントを作成し、Heroku CLIをインストールします。

2. Herokuにログインし、新しいアプリを作成します。

```bash
heroku login
heroku create slack-calendar-bot
```

3.  環境変数を設定します。

```bash
heroku config:set SLACK_BOT_TOKEN=xoxb-your-bot-token
heroku config:set SLACK_SIGNING_SECRET=your-signing-secret
heroku config:set SLACK_APP_TOKEN=xapp-your-app-token
heroku config:set GEMINI_API_KEY=your-gemini-api-key
```

4. アプリをデプロイします。

```bash
git push heroku main
```

### AWS Lambdaへのデプロイ（Serverless Framework使用）

1. Serverless Frameworkをインストールします。

```bash
npm install -g serverless
```

2. `serverless.yml`ファイルを作成します（リポジトリ内の`serverless.yml`を参照）。

3. AWS認証情報をセットアップします。

4. デプロイを実行します。

```bash
serverless deploy
```

### Google Cloud Runへのデプロイ

1. Google Cloud SDKをインストールします。

```bash
# Google Cloud SDKのインストール手順はOSによって異なります
# https://cloud.google.com/sdk/docs/install
```

2. Google Cloudにログインします。

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

3. Dockerイメージをビルドし、Google Container Registryにプッシュします。

```bash
# リポジトリのcloud-runフォルダに移動
cd cloud-run

# イメージをビルド
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/calendar-slack-bot
```

4. Cloud Runサービスをデプロイします。

```bash
gcloud run deploy calendar-slack-bot \
  --image gcr.io/YOUR_PROJECT_ID/calendar-slack-bot \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars="SLACK_BOT_TOKEN=xoxb-your-bot-token,SLACK_SIGNING_SECRET=your-signing-secret,SLACK_APP_TOKEN=xapp-your-app-token,GEMINI_API_KEY=your-gemini-api-key"
```

5. デプロイが完了すると、サービスのURLが表示されます。このURLをSlackアプリの設定で使用します。

## 使用方法

1. ボットをSlackチャンネルに招待します。
2. 予定情報を含むメッセージを投稿します。例：
   「明日14時から16時まで会議室Aでプロジェクトミーティングを行います。」
3. そのメッセージに`:calendar-bot:`スタンプを付けます。
4. ボットが予定を解析し、GoogleカレンダーURLをスレッドで返信します。
5. URLをクリックしてGoogleカレンダーに予定を追加できます。

## 注意事項

- 自然言語処理の性質上、すべての予定が正確に抽出されるとは限りません。
- 曖昧な表現や複雑な予定情報は正確に解析されない場合があります。
- 日本語と英語の両方に対応していますが、他の言語では正確性が低下する可能性があります。