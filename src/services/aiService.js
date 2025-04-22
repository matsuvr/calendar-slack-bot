/**
 * Gemini AIを使用したテキスト処理サービス
 */

const { GoogleGenAI } = require('@google/genai');
const { config } = require('../config/config');

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
  try {
    if (text.length <= 100) {
      return text;
    }
    
    const prompt = `以下のテキストを100文字以内で要約してください:\n${text}`;

    const response = await ai.models.generateContent({
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

    const summary = response.candidates[0].content.parts[0].text.trim();
    return summary;
  } catch (error) {
    console.error('テキスト要約中にエラーが発生しました:', error);
    return text.substring(0, 97) + '...';
  }
}

/**
 * テキストから予定情報を抽出する関数
 * @param {string} text - 分析するテキスト
 * @returns {Promise<Array>} - 抽出された予定情報の配列
 */
async function extractEventsFromText(text) {
  try {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5);

    if (text.length < 10) {
      return [];
    }

    const systemPrompt = `
      あなたはテキストから予定やイベント情報を抽出するシステムです。
      テキストから予定情報を見つけて、JSONスキーマに沿った形式でレスポンスを返してください。
      複数の予定が含まれている場合は、それぞれを個別に抽出してください。
      予定が見つからない場合は空の配列[]を返してください。
      
      現在の日時は ${currentDate} ${currentTime} であることを考慮してください。
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

    const jsonResponse = response.candidates[0].content.parts[0].text;

    try {
      const parsedEvents = JSON.parse(jsonResponse);
      if (Array.isArray(parsedEvents)) {
        return parsedEvents;
      } else {
        return await extractEventsLegacy(text);
      }
    } catch (parseError) {
      return await extractEventsLegacy(text);
    }
  } catch (error) {
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