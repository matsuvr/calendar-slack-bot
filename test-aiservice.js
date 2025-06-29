/**
 * aiService.jsのテストスクリプト
 * 更新されたVertex AI APIを使用した動作確認
 */

const { extractEventsFromText, summarizeText, generateCalendarTitle } = require('./src/services/aiService');

async function testAIService() {
  try {
    console.log('🚀 aiService.js動作テスト開始');
    console.log('=' * 50);

    // テスト用のサンプルテキスト
    const testText = `
来週の月曜日（2025年1月20日）の午後2時から3時までプロジェクト進捗会議を開催します。
会議はオンラインで行います。Google Meetリンクは https://meet.google.com/abc-def-ghi です。
参加者：田中、佐藤、山田、鈴木
議題：Q1の進捗確認とQ2の計画について
    `;

    // 1. 予定抽出テスト
    console.log('\n1️⃣ 予定抽出テスト');
    console.log('入力テキスト:', testText.trim());
    console.log('\n抽出開始...');
    
    const events = await extractEventsFromText(testText);
    console.log('✅ 抽出された予定:', JSON.stringify(events, null, 2));

    // 2. 要約テスト
    console.log('\n2️⃣ 要約テスト');
    const summary = await summarizeText(testText);
    console.log('✅ 要約結果:', summary);

    // 3. タイトル生成テスト
    console.log('\n3️⃣ タイトル生成テスト');
    const eventData = events.length > 0 ? events[0] : {};
    const title = await generateCalendarTitle(testText, eventData);
    console.log('✅ 生成されたタイトル:', title);

    console.log('\n🎉 全テスト完了！aiService.jsは正常に動作しています。');

  } catch (error) {
    console.error('❌ テストエラー:', error.message);
    console.error('エラー詳細:', error);
    process.exit(1);
  }
}

// メイン実行
if (require.main === module) {
  testAIService();
}
