/**
 * Gemini AIを使用したテキスト処理サービス
 */

const { GoogleGenAI } = require('@google/genai');
const { config } = require('../config/config');

// 🚀 高速化: キャッシュ機能を追加
const responseCache = new Map();
const CACHE_TTL = 1800000; // 30分間キャッシュ
const MAX_CACHE_SIZE = 500;

/**
 * キャッシュのクリーンアップ
 */
function cleanupAICache() {
  const now = Date.now();
  let deleted = 0;

  for (const [key, value] of responseCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      responseCache.delete(key);
      deleted++;
    }
  }

  if (responseCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(responseCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toDelete = entries.slice(0, responseCache.size - MAX_CACHE_SIZE);
    toDelete.forEach(([key]) => responseCache.delete(key));
    deleted += toDelete.length;
  }

  if (deleted > 0) {
    console.log(`🗑️ AIキャッシュクリーンアップ: ${deleted}件削除`);
  }
}

// Gemini APIクライアントの初期化（最新版に修正）
let ai;
try {
  ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  console.log('✅ Gemini APIクライアント初期化成功');
} catch (error) {
  console.error('❌ Gemini APIの初期化に失敗しました:', error);
  throw error;
}

/**
 * Gemini APIのリトライ機能付き呼び出し
 * @param {Object} params - API呼び出しパラメータ
 * @returns {Promise<Object>} API応答
 */
async function callGeminiWithRetry(params) {
  const maxRetries = 3;
  const baseDelay = 1000;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: params.model || config.gemini.models.summarize,
        contents: params.contents,
        config: {
          thinkingConfig: {
            thinkingBudget: 0, // Thinkingを無効化
          },
          ...params.config
        }
      });

      return response;
    } catch (error) {
      console.error(`❌ Gemini API呼び出しエラー (試行 ${attempt + 1}/${maxRetries}):`, error.message);

      // 最後の試行の場合はエラーを投げる
      if (attempt === maxRetries - 1) {
        throw error;
      }

      // エクスポネンシャルバックオフ
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * テキストを要約する関数
 * @param {string} text - 要約するテキスト
 * @returns {Promise<string>} - 要約されたテキスト
 */
async function summarizeText(text) {
  const startTime = Date.now();

  try {
    if (text.length <= 100) {
      return text;
    }

    // 🚀 高速化: キャッシュチェック
    const cacheKey = `summary:${text.substring(0, 100)}`;
    const cached = responseCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log(`⚡ 要約キャッシュヒット (${Date.now() - startTime}ms)`);
      return cached.data;
    }
    const prompt = `以下のテキストを100文字以内で要約してください。ただし、Google Meet、Zoom、Teams、Webexなどの会議URL,ミーティングID、シークレットなどが含まれていた場合は、URL、ID、シークレットはそのまま残してください。この場合は100文字を超えてしまっても構いません:\n${text}`;

    // 🚀 修正: 最新のGenAI API呼び出し方法
    console.log('🤖 Gemini要約API呼び出し開始');

    // タイムアウト処理を改善
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('AI要約処理タイムアウト (8秒)')), 8000);
    }); try {
      const response = await Promise.race([
        callGeminiWithRetry({
          model: config.gemini.models.summarize,
          contents: prompt,
          config: {
            generationConfig: {
              temperature: 0.2,
              topP: 0.8,
              maxOutputTokens: 100
            }
          }
        }),
        timeoutPromise
      ]);

      clearTimeout(timeoutId);
      const summary = response.text.trim();
      console.log('✅ Gemini要約完了:', summary.substring(0, 50));

      // 🚀 キャッシュに保存
      responseCache.set(cacheKey, { data: summary, timestamp: Date.now() });

      console.log(`⏱️ AI要約完了: ${Date.now() - startTime}ms`);
      return summary;
    } catch (innerError) {
      clearTimeout(timeoutId);
      throw innerError;
    }
  } catch (error) {
    console.error(`❌ 要約エラー (${Date.now() - startTime}ms):`, error.message);
    return text.substring(0, 97) + '...';
  }
}

/**
 * テキストから予定情報を抽出する関数
 * @param {string} text - 分析するテキスト
 * @returns {Promise<Array>} - 抽出された予定情報の配列
 */
async function extractEventsFromText(text) {
  const startTime = Date.now();

  try {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5);

    if (text.length < 10) {
      return [];
    }

    // 🚀 高速化: キャッシュチェック
    const cacheKey = `events:${text.substring(0, 200)}`;
    const cached = responseCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log(`⚡ 予定抽出キャッシュヒット (${Date.now() - startTime}ms)`);
      return cached.data;
    }

    // よりシンプルなプロンプトに変更
    const prompt = `以下のテキストから予定やイベント情報を抽出し、JSON配列形式で返してください。
予定が見つからない場合は空の配列[]を返してください。特に、日付と時間が重要なので、注意深く抽出してください。

現在の日時が ${currentDate} ${currentTime} であることを考慮してください。

テキスト:
${text}

JSON形式で返してください（コードブロックは使わず、純粋なJSONのみ）:`;

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

    console.log('🤖 Gemini予定抽出API呼び出し開始');

    // タイムアウト処理
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('AI予定抽出タイムアウト (15秒)')), 15000);
    });

    const response = await Promise.race([
      callGeminiWithRetry({
        model: config.gemini.models.extract,
        contents: prompt,
        config: {
          generationConfig: {
            temperature: 0.1,
            topP: 0.9,
            responseMimeType: "application/json",
            responseSchema: responseSchema
          }
        }
      }),
      timeoutPromise
    ]);

    clearTimeout(timeoutId);

    // レスポンステキストの前処理（Markdown形式のJSONをクリーンアップ）
    let responseText = response.text.trim();

    // ```json...``` のMarkdown形式を除去
    if (responseText.startsWith('```json') && responseText.endsWith('```')) {
      responseText = responseText.slice(7, -3).trim();
    } else if (responseText.startsWith('```') && responseText.endsWith('```')) {
      responseText = responseText.slice(3, -3).trim();
    }

    console.log('🔍 API応答テキスト（最初の100文字）:', responseText.substring(0, 100));

    // JSONパース
    let parsedEvents;
    try {
      parsedEvents = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ JSONパースエラー:', parseError.message);
      console.error('📄 問題のあるレスポンステキスト:', responseText);
      throw new Error(`JSON解析に失敗しました: ${parseError.message}`);
    }

    if (!Array.isArray(parsedEvents)) {
      throw new Error('APIレスポンスが配列形式ではありません');
    }

    // 🚀 キャッシュに保存
    responseCache.set(cacheKey, { data: parsedEvents, timestamp: Date.now() });

    // 定期的なキャッシュクリーンアップ
    if (Math.random() < 0.1) {
      setImmediate(cleanupAICache);
    }

    console.log(`⏱️ AI予定抽出完了: ${Date.now() - startTime}ms, ${parsedEvents.length}件`);
    return parsedEvents;

  } catch (error) {
    console.error(`❌ AI予定抽出エラー (${Date.now() - startTime}ms):`, error.message);
    throw error;
  }
}

/**
 * テキストから会議情報（URL、ID、パスワード等）を抽出
 * @param {string} text - 抽出対象のテキスト
 * @returns {Promise<string>} 会議情報の文字列（見つからない場合は空文字）
 */
async function extractMeetingInfo(text) {
  try {
    const prompt = `以下のテキストから会議に関連する重要な情報を抽出してください。
以下のような情報が含まれている場合は、必ず抽出してください：
- Google Meet のURL
- Microsoft Teams の会議URL
- Webex の会議URL
- Zoom の会議URL、ミーティングID、パスコード
- その他のビデオ会議ツールのURL
- 会議室名、場所情報
- 電話番号での参加情報

テキスト：
${text}

抽出された会議情報のみを返してください。見つからない場合は空文字を返してください。`;

    const response = await callGeminiWithRetry({
      model: config.gemini.models.summarize,
      contents: prompt,
      config: {
        generationConfig: {
          temperature: 0.2,
          topP: 0.8,
          maxOutputTokens: 200
        }
      }
    });

    const result = response.text.trim();

    // 「見つからない」「ありません」等の応答は空文字として扱う
    if (result.includes('見つからない') || result.includes('ありません') || result.includes('なし')) {
      return '';
    }

    return result;
  } catch (error) {
    console.error('会議情報抽出エラー:', error);
    return '';
  }
}

/**
 * テキストからカレンダータイトルを生成する関数
 * @param {string} text - 元のテキスト
 * @param {Object} eventData - 抽出されたイベントデータ
 * @returns {Promise<string>} - 生成されたタイトル
 */
async function generateCalendarTitle(text, eventData = {}) {
  const startTime = Date.now();
  
  try {
    // 🚀 高速化: キャッシュチェック
    const cacheKey = `title:${text.substring(0, 50)}:${eventData.title || ''}`;
    const cached = responseCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log(`⚡ タイトル生成キャッシュヒット (${Date.now() - startTime}ms)`);
      return cached.data;
    }

    const prompt = `以下のテキストから、カレンダーに登録するのに適した簡潔で分かりやすいタイトルを生成してください。

要件：
- 15文字以内で簡潔に
- 会議やイベントの目的が分かるように
- 既存のタイトル「${eventData.title || ''}」がある場合は、それを参考にしつつ改善
- 「ミーティング」「会議」などの冗長な言葉は省略可能
- 日本語で出力

テキスト：
${text}

生成されたタイトルのみを返してください：`;

    console.log('🤖 Geminiタイトル生成API呼び出し開始');

    const response = await callGeminiWithRetry({
      model: config.gemini.models.lite, // gemini-2.5-flash-liteを使用
      contents: prompt,
      config: {
        generationConfig: {
          temperature: 0.3,
          topP: 0.8,
          maxOutputTokens: 50
        }
      }
    });

    let generatedTitle = response.text.trim();
    
    // タイトルの後処理
    generatedTitle = generatedTitle
      .replace(/^["'「]|["'」]$/g, '') // 引用符を除去
      .replace(/^\d+\.\s*/, '') // 番号付きリストの数字を除去
      .substring(0, 20); // 最大20文字に制限

    // フォールバック処理
    if (!generatedTitle || generatedTitle.length < 2) {
      generatedTitle = eventData.title || 'カレンダー予定';
    }

    // 🚀 キャッシュに保存
    responseCache.set(cacheKey, { data: generatedTitle, timestamp: Date.now() });

    console.log(`⏱️ タイトル生成完了: ${Date.now() - startTime}ms - "${generatedTitle}"`);
    return generatedTitle;

  } catch (error) {
    console.error(`❌ タイトル生成エラー (${Date.now() - startTime}ms):`, error.message);
    // エラー時はフォールバック
    return eventData.title || text.substring(0, 15) + '...' || 'カレンダー予定';
  }
}

module.exports = {
  summarizeText,
  extractEventsFromText,
  extractMeetingInfo,
  generateCalendarTitle // 新しい関数をエクスポート
};