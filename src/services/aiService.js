/**
 * Vertex AI (Gemini)を使用したテキスト処理サービス
 * 最新の@google/genai SDKを使用してStructured Outputをサポート
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

// Vertex AI (Gemini) APIクライアントの初期化
let vertexAI;
try {
  vertexAI = new GoogleGenAI({
    vertexai: true,
    project: config.vertexai.projectId,
    location: config.vertexai.location
    // Cloud Run環境では、サービスアカウントによる自動認証が使用されるため、
    // 明示的な認証設定は不要です
  });
  console.log('✅ Vertex AI (Gemini) 最新APIクライアント初期化成功');
  console.log(`📍 プロジェクト: ${config.vertexai.projectId}, リージョン: ${config.vertexai.location}`);
  
  // Cloud Run環境での認証情報をログ出力
  if (process.env.K_SERVICE) {
    console.log('🏃 Cloud Run環境で実行中 - サービスアカウントによる自動認証を使用');
  }
} catch (error) {
  console.error('❌ Vertex AI (Gemini) APIの初期化に失敗しました:', error);
  
  // 認証エラーの場合、詳細な情報を提供
  if (error.message.includes('authentication') || error.message.includes('credentials')) {
    console.error('💡 Cloud Run環境では以下を確認してください:');
    console.error('   1. サービスアカウントにVertex AI User権限が付与されている');
    console.error('   2. プロジェクトでVertex AI APIが有効化されている');
    console.error('   3. GOOGLE_CLOUD_PROJECT環境変数が正しく設定されている');
  }
  
  throw error;
}

// Google AI Studio (Gemma 3n) APIクライアントの初期化
let googleAI;
try {
  if (!config.googleai.apiKey) {
    throw new Error('GEMINI_API_KEY環境変数が設定されていません');
  }
  
  googleAI = new GoogleGenAI(config.googleai.apiKey);
  console.log('✅ Google AI Studio (Gemma 3n) APIクライアント初期化成功');
} catch (error) {
  console.error('❌ Google AI Studio APIの初期化に失敗しました:', error);
  
  if (error.message.includes('GEMINI_API_KEY')) {
    console.error('💡 Google AI Studio認証の確認事項:');
    console.error('   1. GEMINI_API_KEY環境変数が設定されている');
    console.error('   2. API Keyが有効で、Gemma 3nモデルにアクセス可能');
  }
  
  throw error;
}

/**
 * AIクライアントを選択してAPI呼び出しを行う関数
 * @param {Object} params - API呼び出しパラメータ
 * @returns {Promise<Object>} API応答
 */
async function callAIWithRetry(params) {
  const maxRetries = 3;
  const baseDelay = 1000;

  // モデルに応じてクライアントを選択
  const isGemmaModel = params.model && params.model.includes('gemma');
  const aiClient = isGemmaModel ? googleAI : vertexAI;
  const clientName = isGemmaModel ? 'Google AI Studio (Gemma)' : 'Vertex AI (Gemini)';

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      let response;
      
      if (isGemmaModel) {
        // Google AI Studio用のAPI呼び出し
        response = await aiClient.models.generateContent({
          model: params.model,
          contents: [
            {
              role: 'user',
              parts: [{ text: params.contents }]
            }
          ],
          config: params.config?.generationConfig || {}
        });
      } else {
        // Vertex AI用のAPI呼び出し
        response = await aiClient.models.generateContent({
          model: params.model,
          contents: [
            {
              role: 'user',
              parts: [{ text: params.contents }]
            }
          ],
          config: {
            ...params.config?.generationConfig || {},
            thinkingConfig: {
              thinkingBudget: 0  // Thinkingモードを無効化
            }
          }
        });
      }
      
      // レスポンス形式を統一
      let responseText = '';
      if (response.text) {
        responseText = response.text;
      } else if (response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0];
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          responseText = candidate.content.parts[0].text || '';
        }
      }
      
      return {
        text: responseText
      };
    } catch (error) {
      console.error(`❌ ${clientName} API呼び出しエラー (試行 ${attempt + 1}/${maxRetries}):`, error.message);

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

    // 🚀 修正: 最新のVertex AI (GenAI) API呼び出し方法
    console.log('🤖 Vertex AI (Gemini) 要約API呼び出し開始');

    // タイムアウト処理を改善
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('AI要約処理タイムアウト (8秒)')), 8000);
    });

    const response = await Promise.race([
      callAIWithRetry({
        model: config.vertexai.models.summarize,
        contents: prompt,
        config: {        generationConfig: {
          temperature: 0.2,
          topP: 0.8,
          maxOutputTokens: 500  // 100から500に増加
        }
        }
      }),
      timeoutPromise
    ]);

    clearTimeout(timeoutId);
    const summary = response.text.trim();
    console.log('✅ Vertex AI (Gemini) 要約完了:', summary.substring(0, 50));

    // 🚀 キャッシュに保存
    responseCache.set(cacheKey, { data: summary, timestamp: Date.now() });

    console.log(`⏱️ AI要約完了: ${Date.now() - startTime}ms`);
    return summary;

  } catch (error) {
    console.error(`❌ 要約エラー (${Date.now() - startTime}ms):`, error.message);
    return text.substring(0, 97) + '...';
  }
}

/**
 * テキストから予定情報を抽出する関数（Structured Output使用）
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

    const prompt = `以下のテキストから予定やイベント情報を抽出してください。
予定が見つからない場合は空の配列を返してください。

重要な注意事項：
- 日付と時間は必ず正確に抽出してください
- 開始時間（startTime）と終了時間（endTime）は両方とも必須です
- 終了時間が明記されていない場合は、開始時間の1時間後を設定してください
- 時間は24時間形式（HH:MM）で指定してください

現在の日時: ${currentDate} ${currentTime}

テキスト:
${text}`;

    console.log('🤖 Vertex AI (Gemini) 予定抽出API呼び出し開始');

    // 構造化出力用のスキーマ定義（test-vertex-ai.jsと同じパターン）
    const responseSchema = {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: '予定やイベントのタイトル'
          },
          date: {
            type: 'string',
            description: '予定の日付（YYYY-MM-DD形式）'
          },
          startTime: {
            type: 'string',
            description: '開始時間（HH:MM形式、24時間表記）'
          },
          endTime: {
            type: 'string',
            description: '終了時間（HH:MM形式、24時間表記）'
          },
          location: {
            type: 'string',
            description: '予定の物理的な場所（会議室、ビル名など）'
          },
          description: {
            type: 'string',
            description: '予定の詳細な説明。オンラインミーティングのURLや追加情報を含む'
          }
        },
        required: ['title', 'date', 'startTime', 'endTime']
      }
    };

    // タイムアウト処理
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('AI予定抽出タイムアウト (15秒)')), 15000);
    });

    // 最新のVertex AI APIを使用（test-vertex-ai.jsと同じパターン）
    const response = await Promise.race([
      vertexAI.models.generateContent({
        model: config.vertexai.models.extract,
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        config: {
          temperature: 0.0,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
          thinkingConfig: {
            thinkingBudget: 0  // Thinkingモードを無効化
          }
        }
      }),
      timeoutPromise
    ]);

    clearTimeout(timeoutId);

    // レスポンステキストの前処理（test-vertex-ai.jsと同じパターン）
    let responseText = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

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

    // 抽出されたイベントデータをログ出力
    console.log('🔍 抽出されたイベントデータ:', JSON.stringify(parsedEvents, null, 2));

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

    const response = await callAIWithRetry({
      model: config.vertexai.models.summarize,
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

    console.log('🤖 Vertex AI (Gemini) タイトル生成API呼び出し開始');

    const response = await callAIWithRetry({
      model: config.vertexai.models.summarize, // Vertex AI (Gemini)を使用
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