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
  // Cloud Runの使用料を節約するため、静的なページを表示
  res.status(200).send(`
    <html>
      <head>
        <title>Calendar Slack Bot - AI-Powered Calendar Assistant</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
          .container { background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #2c3e50; font-size: 2.2em; margin-bottom: 10px; text-align: center; }
          h2 { color: #e74c3c; margin-top: 15px; font-size: 1.6em; text-align: center; }
          h3 { color: #34495e; margin-top: 25px; font-size: 1.3em; border-bottom: 2px solid #e74c3c; padding-bottom: 5px; }
          .status { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center; }
          .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin: 30px 0; }
          .feature { background: #ecf0f1; padding: 20px; border-radius: 8px; border-left: 4px solid #e74c3c; }
          .feature h4 { color: #2c3e50; margin-top: 0; font-size: 1.1em; }
          .tech-stack { background: #34495e; color: white; padding: 20px; border-radius: 8px; margin: 25px 0; }
          .tech-list { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 15px; }
          .tech-item { background: #e74c3c; color: white; padding: 5px 12px; border-radius: 15px; font-size: 0.9em; }
          .button { display: inline-block; background: linear-gradient(135deg, #e74c3c, #c0392b); color: white; padding: 12px 25px; border-radius: 25px; text-decoration: none; margin: 10px 5px; transition: transform 0.2s; }
          .button:hover { transform: translateY(-2px); }
          .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #bdc3c7; color: #7f8c8d; }
          .emoji { font-size: 1.2em; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1><span class="emoji">🤖</span> Calendar Slack Bot</h1>
          <h2>AI-Powered Calendar Assistant</h2>
          
          <div class="status">
            <h3 style="margin-top: 0; color: white; border: none;">✨ サービス稼働中</h3>
            <p>最新のAI技術を活用した高速処理システムで運用中です</p>
            <p>Slackワークスペースで今すぐご利用いただけます</p>
          </div>
          
          <div class="features">
            <div class="feature">
              <h4><span class="emoji">🧠</span> AI-Powered 予定抽出</h4>
              <p>Google Gemini AIが自然言語から予定情報を高精度で抽出し、簡潔で分かりやすいタイトルを自動生成します。</p>
            </div>
            <div class="feature">
              <h4><span class="emoji">⚡</span> 高速メモリキャッシュ</h4>
              <p>メモリ内キャッシュ（TTL: 5分）による重複処理防止で、従来のデータベース接続よりも圧倒的に高速。</p>
            </div>
            <div class="feature">
              <h4><span class="emoji">🌐</span> 日本語処理最適化</h4>
              <p>全角文字とURL周りのスペース調整、Slackマークアップの早期除去で処理精度が大幅向上。</p>
            </div>
            <div class="feature">
              <h4><span class="emoji">📱</span> バッチ処理対応</h4>
              <p>最大5件の予定を並列処理（3件ずつ）で効率的に処理し、複数予定にも素早く対応。</p>
            </div>
            <div class="feature">
              <h4><span class="emoji">🔗</span> ミーティングURL統合</h4>
              <p>Zoom、Google Meet、Microsoft TeamsのURLを自動検出し、カレンダーの場所情報に統合。</p>
            </div>
            <div class="feature">
              <h4><span class="emoji">🔐</span> セキュア＆リライアブル</h4>
              <p>リトライ機能付きAPI呼び出し、包括的エラーハンドリング、メモリ自動クリーンアップ。</p>
            </div>
          </div>
          
          <div class="tech-stack">
            <h3 style="margin-top: 0; color: white;">🚀 Technology Stack</h3>
            <div class="tech-list">
              <span class="tech-item">Node.js 20+</span>
              <span class="tech-item">Google Gemini AI</span>
              <span class="tech-item">Slack Bolt</span>
              <span class="tech-item">Express.js</span>
              <span class="tech-item">Google Cloud Run</span>
              <span class="tech-item">Memory Cache</span>
              <span class="tech-item">TTL Management</span>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p><strong>使い方:</strong> Slackメッセージに <span class="emoji">📅</span> :calendar: リアクションを追加するだけ！</p>
            <a href="https://github.com/yourusername/calendar-slack-bot" class="button">📚 GitHub Repository</a>
            <a href="/health" class="button">🏥 Health Check</a>
          </div>
        </div>
        
        <div class="footer">
          <p><strong>Calendar Slack Bot</strong> - ${new Date().getFullYear()}</p>
          <p>Powered by Google Gemini AI • Google Cloud Run • Memory Cache Technology</p>
          <p>高速 • 正確 • セキュア</p>
        </div>
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
} else if (process.env.NODE_ENV !== 'test') {
  // テスト環境でない本番モードの場合のみSlackアプリを初期化

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

// テスト環境用のエクスポート
if (process.env.NODE_ENV === 'test') {
  module.exports = {
    app: expressApp,
    server: server,
    closeServer: () => {
      if (server) {
        return new Promise((resolve) => {
          server.close(resolve);
        });
      }
      return Promise.resolve();
    }
  };
}