/**
 * Calendar Slack Bot - メインサーバーファイル
 * カレンダー絵文字のリアクションからGoogleカレンダーのURLを生成するSlack Bot
 */

const { App, ExpressReceiver } = require('@slack/bolt');
const express = require('express');
const { config, validateConfig } = require('./src/config/config');
const { handleCalendarReaction } = require('./src/handlers/slackHandlers');

// 設定の検証
validateConfig();

// ExpressReceiverとエクスプレスアプリの初期化
let expressReceiver;
let expressApp;

if (config.app.demoMode) {
  // デモモードではシンプルなExpressアプリのみを使用
  console.log('⚠️ デモモードで起動します（SLACK_BOT_TOKENが設定されていません）');
  expressApp = express();
} else {  // 本番モードではSlack Boltと統合したExpressを使用
  try {    expressReceiver = new ExpressReceiver({
      signingSecret: config.slack.signingSecret || 'dummy-secret-for-startup',
      endpoints: '/slack/events', // Slack APIのRequest URLに合わせる
      processBeforeResponse: config.slack.processBeforeResponse,
    });
    expressApp = expressReceiver.app;
  } catch (receiverInitError) {
    console.error('ExpressReceiverの初期化に失敗しました:', receiverInitError);
    // 最小限のExpressアプリを作成して起動だけは成功させる
    expressApp = express();
  }
}

// デモモードではリクエストボディのパース用ミドルウェアを追加
if (config.app.demoMode) {
  expressApp.use(express.json());
  expressApp.use(express.urlencoded({ extended: true }));
}

// 基本的なエンドポイントの設定
expressApp.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// デモモード専用：カレンダーURL生成テスト用APIエンドポイント
if (config.app.demoMode) {
  const { createGoogleCalendarUrl } = require('./src/utils/calendarUtils');
  
  expressApp.post('/api/calendar-url', (req, res) => {
    try {
      const eventData = req.body;
      const calendarUrl = createGoogleCalendarUrl(eventData);
      
      res.json({
        success: true,
        url: calendarUrl,
        message: 'GoogleカレンダーURLが正常に生成されました'
      });
    } catch (error) {
      console.error('カレンダーURL生成エラー:', error);
      res.status(500).json({
        success: false,
        message: 'カレンダーURL生成に失敗しました',
        error: error.message
      });
    }
  });
}

// Slackのチャレンジリクエストとイベント処理に対応するエンドポイント
if (config.app.demoMode) {
  // デモモードの場合のみ、直接expressAppにルートを設定
  expressApp.post('/slack/events', async (req, res) => {
    // チャレンジパラメータがある場合はその値をそのまま返す
    if (req.body && req.body.challenge) {
      return res.status(200).json({ challenge: req.body.challenge });
    }
    return res.status(200).send('OK');
  });
}

// セットアップガイド用のエンドポイント
expressApp.get('/', (req, res) => {
  // Cloud Runの使用料を節約するため、静的なFirebaseページを表示
  res.status(200).send(`
    <html>
      <head>
        <title>Calendar Slack Bot - Firebase Static Page</title>        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #333; font-size: 1.8em; margin-bottom: 10px; }
          h2 { color: #FF8C00; margin-top: 10px; font-size: 1.5em; }
          h3 { color: #FF5722; margin-top: 30px; }
          .container { text-align: center; padding: 50px 20px; }
          .status { background: #FFF3E0; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .button { display: inline-block; background: #FF5722; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; margin-top: 20px; }
        </style>
      </head>      <body>
        <div class="container">
          <h1>Slackに書き込まれた予定をカレンダーに登録しようとするBot</h1>
          <h2 style="color: #FF8C00; margin-top: 10px;">Calendar Slack Bot</h2>
            <div class="status">
            <h3>静的ページ表示モード</h3>
            <p>このページは静的ホスティングページです。サーバーリソースの節約のため、メインページは静的コンテンツとして提供されています。</p>
            <p>ボットは正常に稼働中です。Slackワークスペースでご利用いただけます。</p>
          </div>
          
          <p>Slackでカレンダー絵文字（:calendar:）を使用して予定を自動検出します。</p>
          <p>このサービスはGoogleのCloud Runで動作しています。</p>
          
          <a href="https://github.com/yourusername/calendar-slack-bot" class="button">GitHubリポジトリ</a>
        </div>
        
        <footer style="text-align: center; margin-top: 50px; font-size: 0.8em; color: #888;">
          <p>Calendar Slack Bot - ${new Date().getFullYear()}</p>
          <p>Powered by Firebase & Google Cloud Run</p>
        </footer>
      </body>
    </html>
  `);
});

// Expressサーバーを起動
let server;
try {
  server = expressApp.listen(config.server.port, () => {
    console.log(`✅ サーバーの起動成功: ポート ${config.server.port} でリッスン中`);
  });

  // サーバー起動のエラーハンドリング
  server.on('error', (error) => {
    console.error('サーバー起動エラー:', error);
  });
} catch (serverStartError) {
  console.error('Expressサーバーの起動に失敗しました:', serverStartError);
}

// デモモードの場合はここで処理を終了
if (config.app.demoMode) {
  console.log('デモモードで起動完了。Slack統合機能は無効化されています。');
} else {
  // 本番モードの場合のみSlackアプリを初期化

  // Slackアプリの初期化
  let app;
  try {
    app = new App({
      token: config.slack.botToken,
      receiver: expressReceiver,
      processBeforeResponse: config.slack.processBeforeResponse,
    });    // リアクション追加イベントのハンドラー登録
    app.event('reaction_added', async ({ event, client }) => {
      console.log('🔄 reaction_added イベントを受信:', {
        reaction: event.reaction,
        user: event.user,
        channel: event.item?.channel,
        timestamp: event.item?.ts,
        item_type: event.item?.type
      });
      
      // バックグラウンドで処理を実行（イベントは自動的に応答される）
      setImmediate(async () => {
        try {
          await handleCalendarReaction({ event, client });
        } catch (error) {
          console.error('ハンドラー実行エラー:', error);
        }
      });
    });

    // 他のイベントも監視してデバッグ
    app.event(/.*/, async ({ event }) => {
      console.log('📥 受信したイベント:', event.type);
    });
    
    // アプリを起動
    (async () => {
      try {
        await app.start();
        console.log('✅ Slackアプリの起動に成功しました');
        
        // 終了シグナルのハンドリング
        ['SIGINT', 'SIGTERM'].forEach(signal => {
          process.on(signal, async () => {
            try {
              await app.stop();
              server.close();
              process.exit(0);
            } catch (error) {
              console.error('アプリ停止中にエラーが発生しました:', error);
              process.exit(1);
            }
          });
        });
      } catch (error) {
        console.error('Slackアプリの起動に失敗しました:', error);
        process.exit(1);
      }
    })();
  } catch (appInitError) {
    console.error('Slackアプリの初期化に失敗しました:', appInitError);
    process.exit(1);
  }
}