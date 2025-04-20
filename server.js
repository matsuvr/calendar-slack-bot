const { App, ExpressReceiver } = require('@slack/bolt');
const { GoogleGenAI } = require('@google/genai');
const express = require('express');
require('dotenv').config();
const { Firestore } = require('@google-cloud/firestore');

// Firestoreの初期化
const firestore = new Firestore();
const processedReactionsCollection = firestore.collection('processedReactions');

// Firestoreの読み取り専用モードのフラグ（環境変数から設定可能）
const FIRESTORE_READONLY = process.env.FIRESTORE_READONLY === 'true' || false;
console.log(`Firestoreモード: ${FIRESTORE_READONLY ? '読み取り専用' : '読み書き可能'}`);

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
console.log(`Firestoreコレクション: processedReactions - 重複チェックに使用`);

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
  // Cloud Runの使用料を節約するため、静的なFirebaseページを表示
  res.status(200).send(`
    <html>
      <head>
        <title>Calendar Slack Bot - Firebase Static Page</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #FF8C00; }
          h2 { color: #FF5722; margin-top: 30px; }
          .container { text-align: center; padding: 50px 20px; }
          .firebase-logo { width: 100px; margin-bottom: 20px; }
          .status { background: #FFF3E0; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .button { display: inline-block; background: #FF5722; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <img src="https://www.gstatic.com/devrel-devsite/prod/vfe8699a5d354c41f3f953a7a9794768d4d2f39d37577d5708b5539be069912e1/firebase/images/lockup.svg" alt="Firebase Logo" class="firebase-logo">
          <h1>Calendar Slack Bot</h1>
          
          <div class="status">
            <h2>静的ページ表示モード</h2>
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

  /**
   * テキストを要約する関数
   * @param {string} text - 要約するテキスト
   * @returns {string} - 要約されたテキスト
   */
  async function summarizeText(text) {
    try {
      // 短いテキストは要約せずそのまま返す（効率化）
      if (text.length <= 100) {
        console.log('テキストが短いため要約をスキップします');
        return text;
      }
      
      // 要約処理の開始時間を記録（パフォーマンス測定用）
      const startTime = Date.now();
      
      const prompt = `以下のテキストを100文字以内で要約してください。重要な情報（日時、会議タイトル、ミーティングIDなど）は必ず含めてください。不要な挨拶や冗長な表現は省略してください:\n${text}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-lite',
        contents: prompt,
        config: {
          generationConfig: {
            temperature: 0.2,
            topP: 0.8,
            maxOutputTokens: 100
          }
        }
      });

      const summary = response.candidates[0].content.parts[0].text.trim();
      const processingTime = Date.now() - startTime;
      console.log(`要約テキスト生成: ${summary} (処理時間: ${processingTime}ms)`);
      return summary;
    } catch (error) {
      console.error('Gemini API要約エラー:', error);
      // エラーが発生した場合は簡易的な要約を行う（API呼び出しなし）
      return text.substring(0, 97) + '...';
    }
  }

  /**
   * テキストから予定情報を抽出する関数
   * @param {string} text - 分析するテキスト
   * @returns {Array} - 抽出された予定情報の配列
   */
  async function extractEventsFromText(text) {
    try {
      const extractionStartTime = Date.now(); // 処理時間計測開始
      const now = new Date();
      const currentDate = now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().slice(0, 5);

      // 予定情報が含まれていない可能性が高いテキストは早期リターン
      if (text.length < 10) {
        console.log('テキストが短すぎるため抽出をスキップします:', text);
        return [];
      }

      const systemPrompt = `
        あなたはテキストから予定やイベント情報を抽出するシステムです。
        テキストから予定情報を見つけて、JSONスキーマに沿った形式でレスポンスを返してください。
        複数の予定が含まれている場合は、それぞれを個別に抽出してください。
        予定が見つからない場合は空の配列[]を返してください。
        
        現在の日時は ${currentDate} ${currentTime} であることを考慮してください。
        
        location項目には物理的な場所のみを入れ、オンラインミーティングのURLは含めないでください。
        オンラインミーティングのURLやその他の詳細情報はdescription項目に入れてください。

        特に、Zoom、Google Meet、Teamsなどのミーティングリンクは必ず完全な形でdescriptionに含めてください。
        ミーティング以外のURLについても改変せず、元のまま保持することが非常に重要です。
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

      // 構造化出力モデルを使用 (高速)
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

      // 新しいGemini API応答形式に合わせて修正
      const jsonResponse = response.candidates[0].content.parts[0].text;

      try {
        const parsedEvents = JSON.parse(jsonResponse);
        const processingTime = Date.now() - extractionStartTime;
        console.log(`イベント抽出処理完了: 所要時間=${processingTime}ms, 抽出数=${Array.isArray(parsedEvents) ? parsedEvents.length : 0}`);

        if (Array.isArray(parsedEvents)) {
          return parsedEvents;
        } else {
          return [];
        }
      } catch (parseError) {
        console.error('JSON解析エラー、レガシーモードにフォールバック:', parseError);
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
      console.log('レガシーモードでのイベント抽出を開始します');
      const legacyStartTime = Date.now();
      
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
        
        JSONの配列形式のみで返してください。余分なテキストは含めないでください。
        予定が見つからない場合は空の配列[]を返してください。
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `${prompt}\n\nテキスト: ${text}`,
        config: {
          generationConfig: {
            temperature: 0.2,
            topP: 0.8,
            maxOutputTokens: 1024
          }
        }
      });

      // 新しいGemini API応答形式に合わせて修正
      const responseText = response.candidates[0].content.parts[0].text;

      try {
        let parsedJson;
        // 直接JSONとして解析を試みる
        try {
          parsedJson = JSON.parse(responseText.trim());
        } catch (directParseError) {
          // コードブロック内のJSONを探す
          const jsonBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (jsonBlockMatch) {
            parsedJson = JSON.parse(jsonBlockMatch[1].trim());
          } else {
            // 配列形式の文字列を探す
            const jsonMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
            if (jsonMatch) {
              parsedJson = JSON.parse(jsonMatch[0]);
            } else {
              return [];
            }
          }
        }
        
        const processingTime = Date.now() - legacyStartTime;
        console.log(`レガシーモードでのイベント抽出完了: 所要時間=${processingTime}ms, イベント数=${Array.isArray(parsedJson) ? parsedJson.length : 0}`);
        
        return Array.isArray(parsedJson) ? parsedJson : [];
      } catch (parseError) {
        console.error('レガシーモードのJSON解析エラー:', parseError);
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
    const urlGenStartTime = Date.now();
    console.log('カレンダーURL生成開始:', event.title || '無題の予定');
    
    const baseUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
    const params = new URLSearchParams();
    
    // タイトル
    if (event.title) {
      params.append('text', event.title);
    } else {
      params.append('text', '無題の予定');
    }
    
    // 場所
    if (event.location && event.location !== null) {
      params.append('location', event.location);
    }
    
    // Slackのマークアップ（<URL>形式）を解除する関数
    function removeSlackUrlMarkup(text) {
      if (!text) return text;
      // Slack特有のURL表記 <https://...> からブラケットを除去
      return text.replace(/<(https?:\/\/[^>|]+)(?:\|[^>]+)?>/g, '$1');
    }

    // descriptionのURLマークアップを解除
    if (event.description) {
      event.description = removeSlackUrlMarkup(event.description);
    }
    
    // ビデオ会議URLの検出と設定
    let videoUrl = null;
    if (event.description) {
      // Google Meet URLの検出
      const meetUrlMatch = event.description.match(/https:\/\/meet\.google\.com\/[a-z0-9\-]+/i);
      if (meetUrlMatch) {
        videoUrl = meetUrlMatch[0];
        params.append('add', `conference-${videoUrl}`);
      } else {
        // Zoom URLの検出 - Slackマークアップ対応済み
        const zoomUrlMatch = event.description.match(/https:\/\/[^/]*zoom\.(?:us|com)\/j\/[^\s]+/i);
        if (zoomUrlMatch) {
          videoUrl = zoomUrlMatch[0];
          params.append('add', `conference-${videoUrl}`);
        }
      }
    }
    
    // 説明
    if (event.description && event.description !== null) {
      params.append('details', event.description);
    }
    
    // 日時
    if (event.date) {
      let dates = '';
      
      // 開始日時 - YYYYMMDDTHHMMSS 形式が必要
      const startDate = event.date.replace(/-/g, '');
      
      // 時間処理の効率化
      let startTime = '';
      if (event.startTime) {
        // 形式から:を削除して標準化
        startTime = event.startTime.replace(/:/g, '');
        if (startTime.length === 4) startTime += '00'; // 秒を追加
      } else {
        startTime = '000000'; // デフォルト
      }
      
      dates += `${startDate}T${startTime}`;
      
      // 終了日時
      dates += '/';
      const endDate = event.date.replace(/-/g, '');
      
      // 終了時間の処理
      let endTime = '';
      if (event.endTime) {
        endTime = event.endTime.replace(/:/g, '');
        if (endTime.length === 4) endTime += '00';
      } else {
        // 開始時間がある場合は1時間後、ない場合は終日
        endTime = startTime !== '000000' ? 
                 (parseInt(startTime.substring(0, 2)) + 1).toString().padStart(2, '0') + startTime.substring(2) :
                 '235900';
      }
      
      dates += `${endDate}T${endTime}`;
      params.append('dates', dates);
    } else {
      // 日付がない場合は今日の日付でデフォルト設定
      const today = new Date();
      const todayFormatted = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
      params.append('dates', `${todayFormatted}T120000/${todayFormatted}T130000`); // デフォルトは12:00-13:00
    }
    
    const finalUrl = baseUrl + (baseUrl.includes('?') ? '&' : '?') + params.toString();
    console.log(`カレンダーURL生成完了: ${event.title || '無題の予定'} (所要時間: ${Date.now() - urlGenStartTime}ms)`);
    return finalUrl;
  }

  // カレンダースタンプのリアクションが追加されたときのイベントハンドラ
  app.event('reaction_added', async ({ event, client }) => {
    try {
      console.log('reaction_addedイベントを受信:', event);
      const processingStartTime = Date.now(); // 処理時間計測開始

      const calendarReactions = ['calendar', 'カレンダー', 'calendar_spiral', 'date', 'カレンダーに入れる', 'calendar-bot'];

      if (calendarReactions.includes(event.reaction)) {
        console.log('カレンダー関連のリアクションが検出されました:', event.reaction);

        // 処理済みリアクションをチェック
        const reactionKey = `${event.item.channel}-${event.item.ts}-${event.reaction}`;
        console.log(`Firestoreでの重複チェック実行: キー=${reactionKey}`);
        
        try {
          // トランザクションを使用して読み取りと書き込みを原子的に行う
          if (!FIRESTORE_READONLY) {
            const result = await firestore.runTransaction(async (transaction) => {
              const docRef = processedReactionsCollection.doc(reactionKey);
              const docSnapshot = await transaction.get(docRef);
              
              if (docSnapshot.exists) {
                console.log('このリアクションはすでに処理済みです:', reactionKey);
                return { alreadyProcessed: true };
              }
              
              // ドキュメントが存在しない場合は作成して処理継続
              transaction.set(docRef, { 
                processed: true,
                channel: event.item.channel,
                timestamp: event.item.ts,
                reaction: event.reaction,
                user: event.user,
                processedAt: new Date()
              });
              
              return { alreadyProcessed: false };
            });
            
            // すでに処理済みの場合は早期リターン
            if (result.alreadyProcessed) {
              return;
            }
            console.log('Firestoreトランザクション完了: 処理継続');
          } else {
            // 読み取り専用モードの場合は重複チェックのみ実行
            const firestoreDoc = await processedReactionsCollection.doc(reactionKey).get();
            if (firestoreDoc.exists) {
              console.log('このリアクションはすでに処理済みです (読み取り専用モード):', reactionKey);
              return;
            }
            console.log('⚠️ 読み取り専用モード: 重複チェックのみ実行、書き込みはスキップします');
          }
        } catch (firestoreError) {
          console.error('Firestore操作でエラー:', firestoreError);
          // エラーがあっても処理を続行（ただし重複処理のリスクあり）
          console.log('Firestoreエラーを無視して処理を続行します');
        }

        // メッセージを取得
        const result = await client.conversations.history({
          channel: event.item.channel,
          latest: event.item.ts,
          inclusive: true,
          limit: 1
        });

        const message = result.messages[0];

        if (message && message.text) {
          // 砂時計リアクションを追加して処理中であることを示す
          await client.reactions.add({
            channel: event.item.channel,
            timestamp: event.item.ts,
            name: 'hourglass_flowing_sand'
          });

          // Slackの投稿URLを生成
          const teamId = process.env.SLACK_TEAM_ID || '';
          const messageUrl = `https://${teamId || 'app'}.slack.com/archives/${event.item.channel}/p${event.item.ts.replace('.', '')}`;
          
          // オリジナルメッセージテキストを保持
          const originalMessageText = message.text;
          
          try {
            // 処理時間を測定開始
            const extractionStartTime = Date.now();
            
            // Gemini APIを使用して日付と時間の情報を抽出
            const events = await extractEventsFromText(originalMessageText);
            
            console.log(`イベント抽出完了: ${events.length}件 (所要時間: ${Date.now() - extractionStartTime}ms)`);

            // 砂時計リアクションを削除
            await client.reactions.remove({
              channel: event.item.channel,
              timestamp: event.item.ts,
              name: 'hourglass_flowing_sand'
            });

            if (events.length > 0) {
              // イベントの数を制限（多すぎる場合は警告表示）
              const MAX_EVENTS = 5;
              let processEvents = events;
              if (events.length > MAX_EVENTS) {
                console.log(`検出されたイベントが多すぎます: ${events.length}件 - 最初の${MAX_EVENTS}件のみ処理します`);
                processEvents = events.slice(0, MAX_EVENTS);
                await client.chat.postMessage({
                  channel: event.item.channel,
                  thread_ts: event.item.ts,
                  text: `注意: ${events.length}件の予定が検出されましたが、処理数制限のため最初の${MAX_EVENTS}件のみ処理します。`
                });
              }
            
              // 要約処理は1回だけ実行し、全イベントで共有（処理時間短縮）
              let sharedDescription = originalMessageText;
              if (originalMessageText.length > 100) {
                try {
                  const summaryResponse = await summarizeText(originalMessageText);
                  if (summaryResponse && summaryResponse.trim() !== '') {
                    sharedDescription = summaryResponse;
                  }
                } catch (summaryError) {
                  console.error('テキスト要約中にエラー:', summaryError);
                  sharedDescription = originalMessageText.substring(0, 97) + '...';
                }
              }
              
              // 最終的な説明文にはSlack投稿URLを追加
              sharedDescription = `${sharedDescription}\n\nSlack投稿: ${messageUrl}`;

              // 各イベントを処理する配列を作成して、Promise.allで並列処理する
              const processPromises = processEvents.map(async (eventItem) => {
                try {
                  // 時間フォーマットを修正
                  if (eventItem.startTime && !eventItem.startTime.includes(':00')) {
                    eventItem.startTime = eventItem.startTime + ':00';
                  }

                  if (eventItem.endTime && !eventItem.endTime.includes(':00')) {
                    eventItem.endTime = eventItem.endTime + ':00';
                  }

                  // 共有の説明文を使用
                  eventItem.description = sharedDescription;
                  
                  // Google Calendar URLを生成
                  const calendarUrl = createGoogleCalendarUrl(eventItem);

                  // スレッドに返信
                  return client.chat.postMessage({
                    channel: event.item.channel,
                    thread_ts: event.item.ts,
                    text: `予定を検出しました: ${eventItem.title}\n${calendarUrl}`
                  });
                } catch (itemError) {
                  console.error('個別の予定処理でエラー:', itemError);
                  return client.chat.postMessage({
                    channel: event.item.channel,
                    thread_ts: event.item.ts,
                    text: `この予定の処理中にエラーが発生しました: ${eventItem.title}\nエラー: ${itemError.message}`
                  });
                }
              });
              
              // すべてのイベント処理を並列実行して完了を待つ
              await Promise.all(processPromises);
            } else {
              // 予定が見つからなかった場合
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
          } catch (apiError) {
            console.error('APIリクエスト処理エラー:', apiError);
            await client.chat.postMessage({
              channel: event.item.channel,
              thread_ts: event.item.ts,
              text: `エラーが発生しました: ${apiError.message}`
            });
          }
        }
      } else {
        console.log('カレンダー関連のリアクションではありません:', event.reaction);
      }
      
      // 全体の処理時間をログ出力
      console.log(`イベント処理完了: 所要時間=${Date.now() - processingStartTime}ms`);
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