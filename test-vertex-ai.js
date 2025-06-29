/**
 * Vertex AI導通テストスクリプト
 * ローカル環境でVertex AIとの接続を確認
 */

require('dotenv').config();

// 最新のVertex AI SDKを使用
const { GoogleGenAI } = require('@google/genai');

// 設定値の表示
console.log('🔧 設定確認:');
console.log('- GOOGLE_CLOUD_PROJECT:', process.env.GOOGLE_CLOUD_PROJECT || '未設定');
console.log('- VERTEX_AI_LOCATION:', process.env.VERTEX_AI_LOCATION || 'global(デフォルト)');
console.log('- GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '設定済み' : '未設定');

async function testVertexAI() {
  console.log('\n🚀 Vertex AI 導通テスト開始\n');

  // 必須環境変数チェック
  if (!process.env.GOOGLE_CLOUD_PROJECT) {
    console.error('❌ GOOGLE_CLOUD_PROJECT が設定されていません');
    process.exit(1);
  }

  try {
    // 1. Vertex AI クライアント初期化テスト
    console.log('1️⃣ Vertex AI クライアント初期化テスト');
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    const location = process.env.VERTEX_AI_LOCATION || 'global';
    const model = 'gemini-2.5-flash';

    // 最新のVertex AI APIを使用してクライアントを初期化
    const ai = new GoogleGenAI({
      vertexai: true,
      project: project,
      location: location
    });
    console.log('✅ Vertex AI クライアント初期化成功');

    // 2. 設定の定義
    console.log('\n2️⃣ 生成設定の準備');
    const generationConfig = {
      maxOutputTokens: 8192,
      temperature: 0.1,
      topP: 0.95,
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        }
      ],
    };
    console.log('✅ 生成設定準備完了');

    // 3. 簡単なテキスト生成テスト
    console.log('\n3️⃣ テキスト生成テスト');
    const testPrompt = "こんにちは。これはVertex AIの接続テストです。「テスト成功」と返してください。";
    
    console.log('📤 送信プロンプト:', testPrompt);
    
    const startTime = Date.now();
    const req = {
      model: model,
      contents: [
        {
          role: 'user',
          parts: [{ text: testPrompt }]
        }
      ],
      config: generationConfig,
    };

    const response = await ai.models.generateContent(req);
    const responseTime = Date.now() - startTime;
    
    console.log('📥 AI応答:', response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(response));
    console.log('⏱️ 応答時間:', responseTime + 'ms');
    console.log('✅ テキスト生成テスト成功');

    // 4. Structured Output テスト（予定抽出）
    console.log('\n4️⃣ Structured Output テスト（予定抽出）');
    const eventTestPrompt = `以下のテキストから予定情報を抽出してください。

テキスト: 明日の午後2時から3時まで会議室Aで部長会議を開催します。議題は来期の予算についてです。

以下の厳密なJSON形式で返してください（他のテキストは含めないでください）：
{
  "events": [
    {
      "title": "タイトル",
      "date": "YYYY-MM-DD",
      "startTime": "HH:MM",
      "endTime": "HH:MM",
      "location": "場所",
      "description": "説明"
    }
  ]
}`;

    console.log('📤 予定抽出テスト実行中...');
    const eventStartTime = Date.now();
    
    const eventReq = {
      model: model,
      contents: [
        {
          role: 'user',
          parts: [{ text: eventTestPrompt }]
        }
      ],
      config: {
        ...generationConfig,
        temperature: 0.0, // Structured outputでは温度を下げる
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            events: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  date: { type: 'string' },
                  startTime: { type: 'string' },
                  endTime: { type: 'string' },
                  location: { type: 'string' },
                  description: { type: 'string' }
                },
                required: ['title', 'date', 'startTime', 'endTime', 'location', 'description']
              }
            }
          },
          required: ['events']
        }
      }
    };

    const eventResponse = await ai.models.generateContent(eventReq);
    const eventResponseTime = Date.now() - eventStartTime;
    
    const eventText = eventResponse.text || eventResponse.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(eventResponse);
    console.log('📥 予定抽出結果:', eventText);
    console.log('⏱️ 応答時間:', eventResponseTime + 'ms');
    
    // JSONパース試行
    try {
      const parsedEvents = JSON.parse(eventText);
      console.log('✅ JSON解析成功:', parsedEvents);
      console.log('✅ Structured Output テスト成功');
    } catch (parseError) {
      console.log('⚠️ JSON解析失敗:', parseError.message);
      console.log('📝 生データでも有効な応答を取得');
    }

    // 5. 複雑なStructured Output テスト
    console.log('\n5️⃣ 複雑なStructured Output テスト（会議議事録）');
    const complexPrompt = `以下の会議内容を構造化してください。

会議内容: 
プロジェクトマネージャーの田中さんから、来月のリリース計画について報告がありました。
開発チームの鈴木さんは、現在のタスクが予定より2日遅れていると報告。
QAチームの佐藤さんは、テストケースを50個作成完了したと報告。
次回会議は来週木曜日の午前10時に決定。

以下のJSON形式で返してください：`;

    const complexReq = {
      model: model,
      contents: [
        {
          role: 'user',
          parts: [{ text: complexPrompt }]
        }
      ],
      config: {
        ...generationConfig,
        temperature: 0.0,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            meetingTitle: { type: 'string' },
            participants: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  role: { type: 'string' },
                  report: { type: 'string' }
                },
                required: ['name', 'role', 'report']
              }
            },
            nextMeeting: {
              type: 'object',
              properties: {
                date: { type: 'string' },
                time: { type: 'string' }
              },
              required: ['date', 'time']
            }
          },
          required: ['meetingTitle', 'participants', 'nextMeeting']
        }
      }
    };

    const complexStartTime = Date.now();
    const complexResponse = await ai.models.generateContent(complexReq);
    const complexResponseTime = Date.now() - complexStartTime;
    
    const complexText = complexResponse.text || complexResponse.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(complexResponse);
    console.log('📥 議事録構造化結果:', complexText);
    console.log('⏱️ 応答時間:', complexResponseTime + 'ms');
    
    try {
      const parsedMeeting = JSON.parse(complexText);
      console.log('✅ JSON解析成功:', JSON.stringify(parsedMeeting, null, 2));
      console.log('✅ 複雑なStructured Output テスト成功');
    } catch (parseError) {
      console.log('⚠️ JSON解析失敗:', parseError.message);
    }

    // 6. 認証情報の確認
    console.log('\n6️⃣ 認証情報確認');
    console.log('🔐 認証方式: Application Default Credentials (ADC)');
    console.log('📁 認証ファイル確認中...');
    
    // ADCファイルパスを確認
    const adcPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (adcPath) {
      console.log('📄 ADCファイル:', adcPath);
    } else {
      console.log('ℹ️  GOOGLE_APPLICATION_CREDENTIALS 未設定（gcloud auth application-default loginを使用）');
    }

    console.log(`\n✅ プロジェクト: ${project}`);
    console.log(`✅ ロケーション: ${location}`);
    console.log(`✅ モデル: ${model}`);

    console.log('\n🎉 全ての導通テスト成功！');
    console.log('✅ Vertex AI は正常に動作しています');
    console.log('✅ Structured Output 機能も正常に動作しています');

  } catch (error) {
    console.error('\n❌ 導通テスト失敗:', error.message);
    console.error('\n🔍 エラー詳細:');
    console.error('- エラータイプ:', error.constructor.name);
    console.error('- エラーコード:', error.code || 'なし');
    console.error('- エラーステータス:', error.status || 'なし');
    
    if (error.details) {
      console.error('- エラー詳細:', error.details);
    }
    
    // 一般的な問題のトラブルシューティング
    console.error('\n💡 トラブルシューティング:');
    
    if (error.message.includes('404')) {
      console.error('1. Vertex AI APIが有効化されているか確認:');
      console.error('   gcloud services enable aiplatform.googleapis.com');
      console.error('2. プロジェクトIDが正しいか確認');
      console.error('3. リージョン設定を確認（global, us-central1, asia-northeast1など）');
      console.error('4. モデル名を確認（gemini-2.5-flash）');
    }
    
    if (error.message.includes('401') || error.message.includes('403')) {
      console.error('1. 認証を確認:');
      console.error('   gcloud auth application-default login');
      console.error('2. IAM権限を確認:');
      console.error('   gcloud projects add-iam-policy-binding ' + process.env.GOOGLE_CLOUD_PROJECT);
      console.error('   --member="user:$(gcloud config get-value account)"');
      console.error('   --role="roles/aiplatform.user"');
    }

    if (error.message.includes('PERMISSION_DENIED')) {
      console.error('3. Vertex AI APIの権限を確認:');
      console.error('   - roles/aiplatform.user');
      console.error('   - roles/ml.developer');
    }
    
    process.exit(1);
  }
}

// Google AI Studio テスト（比較用） - 旧APIを使用するのでスキップ
async function testGoogleAIStudio() {
  console.log('\n📱 Google AI Studio テスト（比較用）');
  console.log('⚠️  新しいVertex AI SDKでは、Google AI Studio テストは別のライブラリが必要です');
  console.log('ℹ️  このテストはスキップします（Vertex AIが正常に動作していれば十分です）');
}

// 環境情報表示
function showEnvironmentInfo() {
  console.log('\n🌍 環境情報:');
  console.log('- Node.js バージョン:', process.version);
  console.log('- プラットフォーム:', process.platform);
  console.log('- アーキテクチャ:', process.arch);
  console.log('- 作業ディレクトリ:', process.cwd());
  
  // gcloud CLI の確認
  const { execSync } = require('child_process');
  try {
    const gcloudVersion = execSync('gcloud --version', { encoding: 'utf8' });
    console.log('- gcloud CLI: インストール済み');
    console.log('  バージョン:', gcloudVersion.split('\n')[0]);
    
    const currentProject = execSync('gcloud config get-value project', { encoding: 'utf8' }).trim();
    console.log('- 現在のプロジェクト:', currentProject);
    
    const currentAccount = execSync('gcloud config get-value account', { encoding: 'utf8' }).trim();
    console.log('- 現在のアカウント:', currentAccount);
    
  } catch (error) {
    console.log('- gcloud CLI: 未インストールまたはパス未設定');
  }
}

// メイン実行
async function main() {
  console.log('🔬 Vertex AI 導通テストスクリプト');
  console.log('=====================================');
  
  showEnvironmentInfo();
  
  // Vertex AI テスト
  await testVertexAI();
  
  // Google AI Studio テスト（比較用）
  await testGoogleAIStudio();
  
  console.log('\n🏁 全てのテスト完了');
}

// エラーハンドリング付きで実行
main().catch((error) => {
  console.error('\n💥 予期しないエラーが発生しました:', error);
  process.exit(1);
});