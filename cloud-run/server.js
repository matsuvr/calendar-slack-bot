const { App, ExpressReceiver } = require('@slack/bolt');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

// ExpressReceiverを初期化（HTTPリクエスト処理用）
const expressReceiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  processBeforeResponse: true,
});

// Slackアプリの初期化
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver: expressReceiver,
});

// Gemini APIの初期化
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// エンドポイントを追加（ヘルスチェック用）
expressReceiver.app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// カレンダースタンプのリアクションが追加されたときのイベントハンドラ
app.event('reaction_added', async ({ event, client }) => {
  try {
    // "カレンダーに入れる"スタンプかどうかを確認
    const calendarReactions = ['calendar', 'カレンダー', 'calendar_spiral', 'date', 'カレンダーに入れる', 'calendar-bot'];

    if (calendarReactions.includes(event.reaction)) {
      // メッセージ情報を取得
      const result = await client.conversations.history({
        channel: event.item.channel,
        latest: event.item.ts,
        inclusive: true,
        limit: 1
      });

      const message = result.messages[0];

      if (message && message.text) {
        // リアクションを追加して処理中であることを示す
        await client.reactions.add({
          channel: event.item.channel,
          timestamp: event.item.ts,
          name: 'hourglass_flowing_sand' // 処理中を示すスタンプ
        });

        // Gemini APIに投稿内容を送信して予定情報を抽出
        const events = await extractEventsFromText(message.text);

        // 処理中のリアクションを削除
        await client.reactions.remove({
          channel: event.item.channel,
          timestamp: event.item.ts,
          name: 'hourglass_flowing_sand'
        });

        if (events.length > 0) {
          // 予定が見つかった場合、各予定に対してGoogleカレンダーURLを生成
          for (const eventItem of events) {
            try {
              // 時刻フォーマットの正規化（HH:MM形式をHH:MM:00形式に）
              if (eventItem.startTime && !eventItem.startTime.includes(':00')) {
                eventItem.startTime = eventItem.startTime + ':00';
              }

              if (eventItem.endTime && !eventItem.endTime.includes(':00')) {
                eventItem.endTime = eventItem.endTime + ':00';
              }

              const calendarUrl = createGoogleCalendarUrl(eventItem);

              // スレッドに返信
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
          // 予定が見つからなかった場合
          await client.reactions.add({
            channel: event.item.channel,
            timestamp: event.item.ts,
            name: 'no_entry_sign' // "予定なし"スタンプ
          });

          // スレッドに返信
          await client.chat.postMessage({
            channel: event.item.channel,
            thread_ts: event.item.ts,
            text: '予定情報を検出できませんでした。'
          });
        }
      }
    }
  } catch (error) {
    console.error('エラーが発生しました:', error);

    // エラーメッセージをスレッドに投稿
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
    // 現在の日時を取得
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD形式
    const currentTime = now.toTimeString().slice(0, 5);  // HH:MM形式

    // Gemini 2.0-flash向けの構造化出力リクエスト形式
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

    // 構造化出力のレスポンススキーマを定義
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

    // Gemini 2.0-flash用の構造化出力リクエスト
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-001',
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

    // レスポンステキストを取得
    const jsonResponse = response.text();

    try {
      const parsedEvents = JSON.parse(jsonResponse);

      // 配列であることを確認
      if (Array.isArray(parsedEvents)) {
        return parsedEvents;
      } else {
        return [];
      }
    } catch (parseError) {
      // JSONの解析に失敗した場合はフォールバック
      return await extractEventsLegacy(text);
    }
  } catch (error) {
    console.error('Gemini API構造化出力エラー:', error);
    // フォールバック: 従来のプロンプト方式を試す
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
    // 現在の日時を取得
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD形式
    const currentTime = now.toTimeString().slice(0, 5);  // HH:MM形式

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

    // JSONを抽出して解析
    try {
      // まず直接JSONとして解析を試みる
      try {
        const parsedJson = JSON.parse(responseText.trim());
        return Array.isArray(parsedJson) ? parsedJson : [];
      } catch (directParseError) {
        // ```json から ```までの間のJSONを抽出
        const jsonBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonBlockMatch) {
          const parsedJson = JSON.parse(jsonBlockMatch[1].trim());
          return Array.isArray(parsedJson) ? parsedJson : [];
        }

        // JSONっぽい部分を正規表現で抽出
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
      // JSONの解析に失敗した場合は空の配列を返す
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

  // URLパラメータの作成
  const params = new URLSearchParams();

  // タイトル
  if (event.title) {
    params.append('text', event.title);
    console.log('タイトル設定:', event.title);
  } else {
    params.append('text', '無題の予定');
    console.log('タイトルなし、デフォルト設定: 無題の予定');
  }

  // 場所
  if (event.location && event.location !== null) {
    params.append('location', event.location);
    console.log('場所設定:', event.location);
  }

  // Google MeetのURL抽出
  let meetUrl = null;
  if (event.description) {
    // descriptionから Google Meet のURLを抽出
    const meetUrlMatch = event.description.match(/<?(https:\/\/meet\.google\.com\/[a-z0-9\-]+)>?/i);
    if (meetUrlMatch) {
      meetUrl = meetUrlMatch[1];
      console.log('Google Meet URL検出:', meetUrl);
      // Google Meetパラメータを追加（カレンダーがMeet統合機能をサポート）
      params.append('conferenceData', 'true');
      params.append('add', `conference-${meetUrl}`);
    }
  }

  // 説明
  if (event.description && event.description !== null) {
    params.append('details', event.description);
    console.log('説明設定:', event.description);
  }

  // 日時
  if (event.date) {
    console.log('日付情報あり:', event.date);
    let dates = '';

    // 開始日時 - YYYYMMDDTHHMMSS 形式が必要
    const startDate = event.date.replace(/-/g, '');

    // 時間から:を削除し、秒を追加せずに使用
    let startTime = '';
    if (event.startTime) {
      // HH:MM:SS の形式であれば、そのまま:を削除
      if (event.startTime.match(/^\d{2}:\d{2}:\d{2}$/)) {
        startTime = event.startTime.replace(/:/g, '');
      }
      // HH:MM の形式であれば、:を削除して秒を追加
      else if (event.startTime.match(/^\d{2}:\d{2}$/)) {
        startTime = event.startTime.replace(':', '') + '00';
      }
      // その他の形式の場合はそのまま使用
      else {
        startTime = event.startTime.replace(/:/g, '');
        if (startTime.length === 4) startTime += '00'; // 4桁の場合は秒を追加
      }
    } else {
      startTime = '000000';
    }

    dates += `${startDate}T${startTime}`;
    console.log('開始日時パラメータ(正確なフォーマット):', `${startDate}T${startTime}`);

    // 終了日時
    dates += '/';
    const endDate = event.date.replace(/-/g, '');

    // 終了時間も同様に処理
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
      // 開始時間がある場合は1時間後、ない場合は終日
      endTime = startTime !== '000000' ?
        (parseInt(startTime.substring(0, 2)) + 1).toString().padStart(2, '0') + startTime.substring(2) :
        '235900';
    }

    dates += `${endDate}T${endTime}`;
    console.log('終了日時パラメータ(正確なフォーマット):', `${endDate}T${endTime}`);

    params.append('dates', dates);
  } else {
    console.log('日付情報なし、今日の日付を使用');
    // 日付がない場合は今日の日付を使用
    const today = new Date();
    const todayFormatted = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    params.append('dates', `${todayFormatted}T120000/${todayFormatted}T130000`); // デフォルトは12:00-13:00
    console.log('デフォルト日時パラメータ設定:', `${todayFormatted}T120000/${todayFormatted}T130000`);
  }

  const finalUrl = baseUrl + (baseUrl.includes('?') ? '&' : '?') + params.toString();
  console.log('生成されたカレンダーURL:', finalUrl);
  return finalUrl;
}

// サーバーの起動
const PORT = parseInt(process.env.PORT) || 8080;
(async () => {
  // Boltアプリを起動
  await app.start();
  console.log('⚡️ Bolt app is running!');

  // Expressサーバーは個別に起動する
  expressReceiver.app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
})();