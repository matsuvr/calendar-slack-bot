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

// Gemini APIクライアントの初期化
let ai;
try {
  ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });
} catch (error) {
  console.error('Gemini APIの初期化に失敗しました:', error);
  throw error;
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
    
    const prompt = `以下のテキストを100文字以内で要約してください:\n${text}`;

    // 🚀 高速化: タイムアウト付きAPI呼び出し
    const apiPromise = ai.models.generateContent({
      model: config.gemini.models.summarize,
      contents: prompt,
      config: {
        generationConfig: {
          temperature: 0.2,
          topP: 0.8,
          maxOutputTokens: 100
        }
      }
    });

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('AI要約処理タイムアウト (8秒)')), 8000)
    );

    const response = await Promise.race([apiPromise, timeoutPromise]);
    const summary = response.candidates[0].content.parts[0].text.trim();
    
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

    const systemPrompt = `
      あなたはテキストから予定やイベント情報を抽出するシステムです。
      テキストから予定情報を見つけて、JSONスキーマに沿った形式でレスポンスを返してください。
      複数の予定が含まれている場合は、それぞれを個別に抽出してください。
      予定が見つからない場合は空の配列[]を返してください。
      
      現在の日時は ${currentDate} ${currentTime} であることを考慮してください。
    `;

    const userPrompt = `以下のテキストから予定やイベント情報を抽出してください：\n${text}`;    const responseSchema = {
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

    // 🚀 高速化: タイムアウト付きAPI呼び出し
    const apiPromise = ai.models.generateContent({
      model: config.gemini.models.extract,
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

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('AI予定抽出タイムアウト (15秒)')), 15000)
    );

    const response = await Promise.race([apiPromise, timeoutPromise]);
    const jsonResponse = response.candidates[0].content.parts[0].text;

    try {
      const parsedEvents = JSON.parse(jsonResponse);
      if (Array.isArray(parsedEvents)) {
        // 🚀 キャッシュに保存
        responseCache.set(cacheKey, { data: parsedEvents, timestamp: Date.now() });
        
        // 定期的なキャッシュクリーンアップ
        if (Math.random() < 0.1) {
          setImmediate(cleanupAICache);
        }
        
        console.log(`⏱️ AI予定抽出完了: ${Date.now() - startTime}ms, ${parsedEvents.length}件`);
        return parsedEvents;
      } else {
        console.warn('AI応答が配列ではありません、レガシーモードで再試行');
        return await extractEventsLegacy(text);
      }
    } catch (parseError) {
      console.warn('AI応答のJSON解析に失敗、レガシーモードで再試行:', parseError.message);
      return await extractEventsLegacy(text);
    }
  } catch (error) {
    console.error(`❌ AI予定抽出エラー (${Date.now() - startTime}ms):`, error.message);
    return await extractEventsLegacy(text);
  }
}

/**
 * フォールバック処理（レガシーモード）
 * @param {string} text - 分析するテキスト
 * @returns {Promise<Array>} - 抽出された予定情報の配列
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
      
      JSONの配列形式のみで返してください。余分なテキストは含めないでください。
      予定が見つからない場合は空の配列[]を返してください。
    `;

    const response = await ai.models.generateContent({
      model: config.gemini.models.extract,
      contents: `${prompt}\n\nテキスト: ${text}`,
      config: {
        generationConfig: {
          temperature: 0.2,
          topP: 0.8,
          maxOutputTokens: 1024
        }
      }
    });

    const responseText = response.candidates[0].content.parts[0].text;

    try {
      let parsedJson;
      try {
        parsedJson = JSON.parse(responseText.trim());
      } catch (directParseError) {
        const jsonBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonBlockMatch) {
          parsedJson = JSON.parse(jsonBlockMatch[1].trim());
        } else {
          const jsonMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
          if (jsonMatch) {
            parsedJson = JSON.parse(jsonMatch[0]);
          } else {
            return [];
          }
        }
      }
      
      return Array.isArray(parsedJson) ? parsedJson : [];
    } catch (parseError) {
      console.error('レガシーモードでのJSON解析エラー:', parseError);
      return [];
    }
  } catch (error) {
    console.error('レガシーモードでのAI処理エラー:', error);
    return [];
  }
}

module.exports = {
  summarizeText,
  extractEventsFromText
};