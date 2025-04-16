const { App, ExpressReceiver } = require('@slack/bolt');
const { GoogleGenAI } = require('@google/genai');
const express = require('express');
require('dotenv').config();

// ポート番号の設定
const PORT = parseInt(process.env.PORT) || 8080;

// デモモードの判定
const DEMO_MODE = !process.env.SLACK_BOT_TOKEN;

// デバッグ情報の表示
console.log(`アプリケーション起動プロセスを開始します...`);
console.log(`設定されたポート: ${PORT}`);
console.log(`Node.jsバージョン: ${process.version}`);
console.log(`環境変数NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`SLACK_BOT_TOKEN設定状況: ${process.env.SLACK_BOT_TOKEN ? 'あり' : 'なし'}`);
console.log(`SLACK_SIGNING_SECRET設定状況: ${process.env.SLACK_SIGNING_SECRET ? 'あり' : 'なし'}`);
console.log(`GEMINI_API_KEY設定状況: ${process.env.GEMINI_API_KEY ? 'あり' : 'なし'}`);

if (DEMO_MODE) {
  console.log('⚠️ デモモードで起動します（SLACK_BOT_TOKENが設定されていません）');
  console.log('この状態ではSlack連携機能は無効化されています');
}

// 環境変数のチェック
try {
  const requiredEnvVars = ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET', 'GEMINI_API_KEY'];
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missingEnvVars.length > 0) {
    console.warn(`警告: 以下の環境変数が設定されていません: ${missingEnvVars.join(', ')}`);
    console.warn('環境変数が設定されていなくても起動を試みます...');
  } else {
    console.log('必須環境変数の確認: OK');
  }
} catch (envCheckError) {
  console.error('環境変数チェック中にエラーが発生しました:', envCheckError);
}

// ExpressReceiverとエクスプレスアプリの初期化
let expressReceiver;
let expressApp;

if (DEMO_MODE) {
  // デモモードではシンプルなExpressアプリのみを使用
  expressApp = express();
  console.log('デモモード: 単独のExpressアプリを初期化しました');
} else {
  // 本番モードではSlack Boltと統合したExpressを使用
  try {
    expressReceiver = new ExpressReceiver({
      signingSecret: process.env.SLACK_SIGNING_SECRET || 'dummy-secret-for-startup',
      endpoints: '/slack/events', // Slack APIのRequest URLに合わせる
      processBeforeResponse: false, // Slackへの応答を優先するためfalseに変更
    });
    expressApp = expressReceiver.app;
    console.log('ExpressReceiverの初期化: 成功');
  } catch (receiverInitError) {
    console.error('ExpressReceiverの初期化に失敗しました:', receiverInitError);
    // 最小限のExpressアプリを作成して起動だけは成功させる
    expressApp = express();
  }
}

// デモモードではリクエストボディのパース用ミドルウェアを追加
if (DEMO_MODE) {
  expressApp.use(express.json());
  expressApp.use(express.urlencoded({ extended: true }));
  console.log('デモモード: JSONとフォームデータのパース用ミドルウェアを追加しました');
}

// 基本的なエンドポイントの設定
expressApp.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Slackのチャレンジリクエストとイベント処理に対応するエンドポイント
if (DEMO_MODE) {
  // デモモードの場合のみ、直接expressAppにルートを設定
  expressApp.post('/slack/events', async (req, res) => {
    console.log('デモモード: Slackからのリクエスト受信:', req.body);

    // チャレンジパラメータがある場合はその値をそのまま返す
    if (req.body && req.body.challenge) {
      console.log('Slackチャレンジリクエストに応答:', req.body.challenge);
      return res.status(200).json({ challenge: req.body.challenge });
    }

    console.log('デモモード: イベントリクエストを受信しましたが処理はスキップします');
    return res.status(200).send('OK');
  });
} else {
  // 本番モードでは、expressReceiverが/slack/eventsを処理するため
  // ここでの追加ルート定義は不要（むしろ有害）
  console.log('本番モード: /slack/eventsはExpressReceiverが処理します');
}

// セットアップガイド用のエンドポイント
expressApp.get('/', (req, res) => {
  res.status(200).send(`
    <html>
      <head>
        <title>Calendar Slack Bot - Setup Guide</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #4285f4; }
          h2 { color: #34a853; margin-top: 30px; }
          pre { background: #f1f1f1; padding: 10px; border-radius: 5px; overflow-x: auto; }
          .warning { background: #ffeaa7; padding: 15px; border-left: 5px solid #fdcb6e; margin: 20px 0; }
          .step { background: #e3f2fd; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          code { background: #f1f1f1; padding: 2px 5px; border-radius: 3px; }
        </style>
      </head>
      <body>
        <h1>Calendar Slack Bot - セットアップガイド</h1>
        
        <div class="warning">
          <h3>⚠️ 現在サーバーはデモモードで実行されています</h3>
          <p>完全な機能を有効にするには、環境変数の設定が必要です。</p>
        </div>
        
        <h2>必要な環境変数</h2>
        <p>以下の環境変数をGoogle Cloud Runの設定で指定してください：</p>
        <pre>SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
GEMINI_API_KEY=...</pre>
        
        <h2>セットアップ手順</h2>
        
        <div class="step">
          <h3>ステップ 1: Slackアプリの作成</h3>
          <ol>
            <li><a href="https://api.slack.com/apps" target="_blank">Slack API Dashboard</a>にアクセスします。</li>
            <li>「Create New App」→「From scratch」を選択します。</li>
            <li>アプリ名を入力し、使用するワークスペースを選択します。</li>
          </ol>
        </div>
        
        <div class="step">
          <h3>ステップ 2: ボットスコープの設定</h3>
          <ol>
            <li>サイドバーから「OAuth & Permissions」を選択します。</li>
            <li>「Bot Token Scopes」セクションで、以下のスコープを追加します：
              <ul>
                <li>channels:history</li>
                <li>channels:read</li>
                <li>chat:write</li>
                <li>reactions:read</li>
                <li>reactions:write</li>
              </ul>
            </li>
          </ol>
        </div>
        
        <div class="step">
          <h3>ステップ 3: アプリのインストールと認証情報の取得</h3>
          <ol>
            <li>「Install to Workspace」ボタンをクリックしてアプリをインストールします。</li>
            <li>インストール完了後、以下の情報をメモします：
              <ul>
                <li>「Bot User OAuth Token」(<code>SLACK_BOT_TOKEN</code>として使用)</li>
                <li>「Basic Information」ページの「Signing Secret」(<code>SLACK_SIGNING_SECRET</code>として使用)</li>
              </ul>
            </li>
          </ol>
        </div>
        
        <div class="step">
          <h3>ステップ 4: イベントサブスクリプションの設定</h3>
          <ol>
            <li>「Event Subscriptions」を選択し、「Enable Events」をONにします。</li>
            <li>Request URLに以下を入力します：<br><code>${req.protocol}://${req.get('host')}/slack/events</code></li>
            <li>「Subscribe to bot events」セクションで、以下のイベントを追加します：
              <ul>
                <li>reaction_added</li>
              </ul>
            </li>
            <li>「Save Changes」をクリックします。</li>
          </ol>
        </div>
        
        <div class="step">
          <h3>ステップ 5: Gemini API Keyの取得</h3>
          <ol>
            <li><a href="https://makersuite.google.com/app/apikey" target="_blank">Google AI Studio</a>にアクセスします。</li>
            <li>「Get API key」をクリックしてAPIキーを取得します。</li>
            <li>生成されたAPIキーを<code>GEMINI_API_KEY</code>として使用します。</li>
          </ol>
        </div>
        
        <div class="step">
          <h3>ステップ 6: 環境変数の設定</h3>
          <ol>
            <li><a href="https://console.cloud.google.com/run" target="_blank">Google Cloud Run Console</a>にアクセスします。</li>
            <li>このサービスの詳細ページに移動します。</li>
            <li>「Edit & Deploy New Revision」をクリックします。</li>
            <li>「Variables & Secrets」タブで、以下の環境変数を追加します：
              <pre>SLACK_BOT_TOKEN=xoxb-...（ステップ3で取得したBot User OAuth Token）
SLACK_SIGNING_SECRET=...（ステップ3で取得したSigning Secret）
GEMINI_API_KEY=...（ステップ5で取得したAPI Key）</pre>
            </li>
            <li>「Deploy」をクリックして新しいリビジョンをデプロイします。</li>
          </ol>
        </div>
        
        <h2>使い方</h2>
        <p>セットアップが完了すると、Slackチャンネルでメッセージに以下のいずれかの絵文字リアクションを追加することで、予定を自動検出します：</p>
        <ul>
          <li>:calendar:</li>
          <li>:カレンダー:</li>
          <li>:calendar_spiral:</li>
          <li>:date:</li>
          <li>:カレンダーに入れる:</li>
          <li>:calendar-bot:</li>
        </ul>
        
        <p>Bot は予定情報を検出すると、スレッドに予定情報とGoogleカレンダーへの追加リンクを返信します。</p>
        
        <p>現在の状態: <span style="color: ${DEMO_MODE ? 'red' : 'green'}">${DEMO_MODE ? 'デモモード（機能制限あり）' : '本番モード（完全機能）'}</span></p>
        
        <hr>
        <p>Calendar Slack Bot - ${new Date().getFullYear()}</p>
      </body>
    </html>
  `);
});

// Expressサーバーを起動
let server;
try {
  console.log(`ポート ${PORT} でExpressサーバーを起動します...`);
  server = expressApp.listen(PORT, () => {
    console.log(`✅ サーバーの起動成功: ポート ${PORT} でリッスン中`);
  });

  // サーバー起動のエラーハンドリング
  server.on('error', (error) => {
    console.error('サーバー起動エラー:', error);
  });
} catch (serverStartError) {
  console.error('Expressサーバーの起動に失敗しました:', serverStartError);
}

// デモモードの場合はここで処理を終了
if (DEMO_MODE) {
  console.log('デモモードで起動完了。Slack統合機能は無効化されています。');
  console.log('環境変数を設定して再デプロイすると、完全な機能が有効になります。');
} else {
  // 本番モードの場合のみSlackアプリとGemini APIを初期化

  // Slackアプリの初期化
  let app;
  try {
    console.log('本番モード: Slack Bolt初期化を開始します');
    
    // すでに初期化済みのExpressReceiverを使用（2回目の初期化を避ける）
    console.log('既存のExpressReceiverを使用します');
    
    // JSONボディパーサーの状態を確認
    if (!expressApp._router || !expressApp._router.stack.some(layer => layer.name === 'jsonParser')) {
      console.log('JSONボディパーサーを追加します');
      expressApp.use(express.json());
      expressApp.use(express.urlencoded({ extended: true }));
    } else {
      console.log('JSONボディパーサーはすでに設定されています');
    }

    // エラーが発生した場合のデバッグ情報を追加
    expressApp.use((err, req, res, next) => {
      if (err) {
        console.error('Expressエラー:', err);
        return res.status(500).send('Internal Server Error');
      }
      next();
    });
    
    app = new App({
      token: process.env.SLACK_BOT_TOKEN,
      receiver: expressReceiver,
      processBeforeResponse: false, // 応答を先に返す
    });
    console.log('Slackアプリの初期化: 成功');
    
    // デバッグ用のログミドルウェアを追加
    app.use(async (args) => {
      console.log(`Slackイベント受信: ${args.payload.type || 'unknown'}`);
      const result = await args.next();
      console.log('イベント処理完了');
      return result;
    });
    
  } catch (appInitError) {
    console.error('Slackアプリの初期化に失敗しました:', appInitError);
    process.exit(1);
  }

  // Gemini APIの初期化
  let ai;
  try {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    console.log('Gemini APIの初期化: 成功');
  } catch (aiInitError) {
    console.error('Gemini APIの初期化に失敗しました:', aiInitError);
    process.exit(1);
  }

  // カレンダースタンプのリアクションが追加されたときのイベントハンドラ
  app.event('reaction_added', async ({ event, client, ack }) => {
    try {
      console.log('reaction_addedイベントを受信:', event);
      // ack()を呼び出してSlackに応答
      await ack();
      console.log('ack()が正常に呼び出されました。');

      const calendarReactions = ['calendar', 'カレンダー', 'calendar_spiral', 'date', 'カレンダーに入れる', 'calendar-bot'];

      if (calendarReactions.includes(event.reaction)) {
        console.log('カレンダー関連のリアクションが検出されました:', event.reaction);
        const result = await client.conversations.history({
          channel: event.item.channel,
          latest: event.item.ts,
          inclusive: true,
          limit: 1
        });

        const message = result.messages[0];

        if (message && message.text) {
          await client.reactions.add({
            channel: event.item.channel,
            timestamp: event.item.ts,
            name: 'hourglass_flowing_sand'
          });

          const events = await extractEventsFromText(message.text);

          await client.reactions.remove({
            channel: event.item.channel,
            timestamp: event.item.ts,
            name: 'hourglass_flowing_sand'
          });

          if (events.length > 0) {
            for (const eventItem of events) {
              try {
                if (eventItem.startTime && !eventItem.startTime.includes(':00')) {
                  eventItem.startTime = eventItem.startTime + ':00';
                }

                if (eventItem.endTime && !eventItem.endTime.includes(':00')) {
                  eventItem.endTime = eventItem.endTime + ':00';
                }

                const calendarUrl = createGoogleCalendarUrl(eventItem);

                await client.chat.postMessage({
                  channel: event.item.channel,
                  thread_ts: event.item.ts,
                  text: `予定を検出しました: ${eventItem.title}\n${calendarUrl}`
                });
              } catch (itemError) {
                console.error('個別の予定処理でエラー:', itemError);
                await client.chat.postMessage({
                  channel: event.item.channel,
                  thread_ts: event.item.ts,
                  text: `この予定の処理中にエラーが発生しました: ${eventItem.title}\nエラー: ${itemError.message}`
                });
              }
            }
          } else {
            await client.reactions.add({
              channel: event.item.channel,
              timestamp: event.item.ts,
              name: 'no_entry_sign'
            });

            await client.chat.postMessage({
              channel: event.item.channel,
              thread_ts: event.item.ts,
              text: '予定情報を検出できませんでした。'
            });
          }
        }
      } else {
        console.log('カレンダー関連のリアクションではありません:', event.reaction);
      }
    } catch (error) {
      console.error('reaction_addedイベント処理中にエラーが発生しました:', error);

      try {
        if (event && event.item && event.item.channel && event.item.ts) {
          await client.chat.postMessage({
            channel: event.item.channel,
            thread_ts: event.item.ts,
            text: `エラーが発生しました: ${error.message}`
          });
        } else {
          console.error('イベント情報が不完全です:', event);
        }
      } catch (postError) {
        console.error('エラーメッセージの投稿に失敗しました:', postError);
      }
    }
  });

  /**
   * テキストから予定情報を抽出する関数
   * @param {string} text - 分析するテキスト
   * @returns {Array} - 抽出された予定情報の配列
   */
  async function extractEventsFromText(text) {
    try {
      const now = new Date();
      const currentDate = now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().slice(0, 5);

      const systemPrompt = `
        あなたはテキストから予定やイベント情報を抽出するシステムです。
        テキストから予定情報を見つけて、JSONスキーマに沿った形式でレスポンスを返してください。
        複数の予定が含まれている場合は、それぞれを個別に抽出してください。
        予定が見つからない場合は空の配列[]を返してください。
        
        現在の日時は ${currentDate} ${currentTime} であることを考慮してください。
        
        location項目には物理的な場所のみを入れ、オンラインミーティングのURLは含めないでください。
        オンラインミーティングのURLやその他の詳細情報はdescription項目に入れてください。
      `;

      const userPrompt = `以下のテキストから予定やイベント情報を抽出してください：\n${text}`;

      const responseSchema = {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "予定やイベントのタイトル"
            },
            date: {
              type: "string",
              description: "予定の日付（YYYY-MM-DD形式）"
            },
            startTime: {
              type: "string",
              description: "開始時間（HH:MM形式、24時間表記）"
            },
            endTime: {
              type: "string",
              description: "終了時間（HH:MM形式、24時間表記）"
            },
            location: {
              type: "string",
              description: "予定の物理的な場所（会議室、ビル名など）。URLは含めないでください。",
              nullable: true
            },
            description: {
              type: "string",
              description: "予定の詳細な説明。オンラインミーティングのURLや追加情報を含む。",
              nullable: true
            }
          },
          required: ["title"]
        }
      };

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [
          {
            role: "user",
            parts: [
              { text: systemPrompt },
              { text: userPrompt }
            ]
          }
        ],
        config: {
          generationConfig: {
            temperature: 0.2,
            topP: 0.8,
            responseMimeType: "application/json",
            responseSchema: responseSchema
          }
        }
      });

      const jsonResponse = response.text();

      try {
        const parsedEvents = JSON.parse(jsonResponse);

        if (Array.isArray(parsedEvents)) {
          return parsedEvents;
        } else {
          return [];
        }
      } catch (parseError) {
        return await extractEventsLegacy(text);
      }
    } catch (error) {
      console.error('Gemini API構造化出力エラー:', error);
      return await extractEventsLegacy(text);
    }
  }

  /**
   * フォールバック処理（レガシーモード）
   * @param {string} text - 分析するテキスト
   * @returns {Array} - 抽出された予定情報の配列
   */
  async function extractEventsLegacy(text) {
    try {
      const now = new Date();
      const currentDate = now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().slice(0, 5);

      const prompt = `
        以下のテキストから予定やイベント情報を抽出してください。
        複数の予定が含まれている場合は、それぞれを個別に抽出してください。
        
        現在の日時は ${currentDate} ${currentTime} であることを考慮してください。
        
        各予定について、以下の情報を可能な限り特定してください：
        - タイトル (title)
        - 日付（YYYY-MM-DD形式）(date)
        - 開始時間（HH:MM形式、24時間表記）(startTime)
        - 終了時間（HH:MM形式、24時間表記）(endTime)
        - 場所（物理的な場所のみ。オンラインミーティングのURLは含めないでください）(location)
        - 説明（オンラインミーティングのURLや詳細情報を含む）(description)
        
        必ず以下の形式のJSONの配列で返してください:
        [
          {
            "title": "ミーティングのタイトル",
            "date": "2025-03-28",
            "startTime": "14:00",
            "endTime": "15:00",
            "location": "会議室A",
            "description": "オンラインでの参加リンク: https://example.com/meeting\\nミーティングの詳細説明..."
          }
        ]
        
        location項目が存在しない場合はnullとして返してください。
        予定が見つからない場合は空の配列[]を返してください。
        JSONの形式を厳密に守り、余分なテキストは含めないでください。
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-001',
        contents: `${prompt}\n\nテキスト: ${text}`,
        config: {
          generationConfig: {
            temperature: 0.2,
            topP: 0.8
          }
        }
      });

      const responseText = response.text();

      try {
        try {
          const parsedJson = JSON.parse(responseText.trim());
          return Array.isArray(parsedJson) ? parsedJson : [];
        } catch (directParseError) {
          const jsonBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (jsonBlockMatch) {
            const parsedJson = JSON.parse(jsonBlockMatch[1].trim());
            return Array.isArray(parsedJson) ? parsedJson : [];
          }

          const jsonMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
          if (jsonMatch) {
            const parsedJson = JSON.parse(jsonMatch[0]);
            return Array.isArray(parsedJson) ? parsedJson : [];
          } else {
            return [];
          }
        }
      } catch (parseError) {
        console.error('JSON解析エラー:', parseError);
        return [];
      }
    } catch (error) {
      console.error('Gemini API レガシーモード error:', error);
      return [];
    }
  }

  /**
   * 予定情報からGoogleカレンダーのURLを生成する関数
   * @param {Object} event - 予定情報
   * @returns {string} - Googleカレンダー追加用のURL
   */
  function createGoogleCalendarUrl(event) {
    console.log('カレンダーURL生成開始:', event);

    const baseUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE';

    const params = new URLSearchParams();

    if (event.title) {
      params.append('text', event.title);
      console.log('タイトル設定:', event.title);
    } else {
      params.append('text', '無題の予定');
      console.log('タイトルなし、デフォルト設定: 無題の予定');
    }

    if (event.location && event.location !== null) {
      params.append('location', event.location);
      console.log('場所設定:', event.location);
    }

    let meetUrl = null;
    if (event.description) {
      const meetUrlMatch = event.description.match(/<?(https:\/\/meet\.google\.com\/[a-z0-9\-]+)>?/i);
      if (meetUrlMatch) {
        meetUrl = meetUrlMatch[1];
        console.log('Google Meet URL検出:', meetUrl);
        params.append('conferenceData', 'true');
        params.append('add', `conference-${meetUrl}`);
      }
    }

    if (event.description && event.description !== null) {
      params.append('details', event.description);
      console.log('説明設定:', event.description);
    }

    if (event.date) {
      console.log('日付情報あり:', event.date);
      let dates = '';

      const startDate = event.date.replace(/-/g, '');

      let startTime = '';
      if (event.startTime) {
        if (event.startTime.match(/^\d{2}:\d{2}:\d{2}$/)) {
          startTime = event.startTime.replace(/:/g, '');
        } else if (event.startTime.match(/^\d{2}:\d{2}$/)) {
          startTime = event.startTime.replace(':', '') + '00';
        } else {
          startTime = event.startTime.replace(/:/g, '');
          if (startTime.length === 4) startTime += '00';
        }
      } else {
        startTime = '000000';
      }

      dates += `${startDate}T${startTime}`;
      console.log('開始日時パラメータ(正確なフォーマット):', `${startDate}T${startTime}`);

      dates += '/';
      const endDate = event.date.replace(/-/g, '');

      let endTime = '';
      if (event.endTime) {
        if (event.endTime.match(/^\d{2}:\d{2}:\d{2}$/)) {
          endTime = event.endTime.replace(/:/g, '');
        } else if (event.endTime.match(/^\d{2}:\d{2}$/)) {
          endTime = event.endTime.replace(':', '') + '00';
        } else {
          endTime = event.endTime.replace(/:/g, '');
          if (endTime.length === 4) endTime += '00';
        }
      } else {
        endTime = startTime !== '000000' ?
          (parseInt(startTime.substring(0, 2)) + 1).toString().padStart(2, '0') + startTime.substring(2) :
          '235900';
      }

      dates += `${endDate}T${endTime}`;
      console.log('終了日時パラメータ(正確なフォーマット):', `${endDate}T${endTime}`);

      params.append('dates', dates);
    } else {
      console.log('日付情報なし、今日の日付を使用');
      const today = new Date();
      const todayFormatted = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
      params.append('dates', `${todayFormatted}T120000/${todayFormatted}T130000`);
      console.log('デフォルト日時パラメータ設定:', `${todayFormatted}T120000/${todayFormatted}T130000`);
    }

    const finalUrl = baseUrl + (baseUrl.includes('?') ? '&' : '?') + params.toString();
    console.log('生成されたカレンダーURL:', finalUrl);
    return finalUrl;
  }

  (async () => {
    try {
      console.log('Slackアプリを起動します...');
      await app.start();
      console.log('⚡️ Boltアプリの起動成功');
      console.log('アプリケーションの起動プロセスが完了しました（本番モード）');
      console.log('利用可能なエンドポイント: /slack/events (Slackイベント), /health (ヘルスチェック)');

      ['SIGINT', 'SIGTERM'].forEach(signal => {
        process.on(signal, async () => {
          try {
            await app.stop();
            server.close();
            console.log('アプリケーションを正常に終了しました');
            process.exit(0);
          } catch (error) {
            console.error('アプリケーション終了エラー:', error);
            process.exit(1);
          }
        });
      });
    } catch (error) {
      console.error('アプリケーション起動エラー:', error);
      console.error(error.stack);
      process.exit(1);
    }
  })();
}