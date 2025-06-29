/**
 * 修正されたaiService.jsのタイムアウト問題検証テスト
 */

const { extractEventsFromText, summarizeText, generateCalendarTitle } = require('./src/services/aiService');

async function testTimeoutFixes() {
  try {
    console.log('🔧 タイムアウト修正検証テスト開始');
    console.log('=' * 50);

    const testText = `
明日の午後2時から3時までプロジェクト進捗会議を開催します。
会議はオンラインで行います。Google Meetリンクは https://meet.google.com/abc-def-ghi です。
参加者：田中、佐藤、山田、鈴木
議題：Q1の進捗確認とQ2の計画について
    `;

    console.log('テストテキスト:', testText.trim());
    console.log('\n📊 パフォーマンステスト開始...\n');

    // 1. 予定抽出テスト（最も複雑で時間がかかる処理）
    console.log('1️⃣ 予定抽出テスト（Structured Output）');
    const extractStart = Date.now();
    
    try {
      const events = await extractEventsFromText(testText);
      const extractTime = Date.now() - extractStart;
      console.log(`✅ 予定抽出成功: ${extractTime}ms`);
      console.log(`📋 抽出された予定数: ${events.length}`);
      if (events.length > 0) {
        console.log(`📝 最初の予定: ${events[0].title} (${events[0].date} ${events[0].startTime}-${events[0].endTime})`);
      }
    } catch (error) {
      console.error(`❌ 予定抽出エラー: ${error.message}`);
    }

    // 2. 要約テスト
    console.log('\n2️⃣ 要約テスト');
    const summaryStart = Date.now();
    
    try {
      const summary = await summarizeText(testText);
      const summaryTime = Date.now() - summaryStart;
      console.log(`✅ 要約成功: ${summaryTime}ms`);
      console.log(`📄 要約結果: ${summary.substring(0, 100)}${summary.length > 100 ? '...' : ''}`);
    } catch (error) {
      console.error(`❌ 要約エラー: ${error.message}`);
    }

    // 3. タイトル生成テスト
    console.log('\n3️⃣ タイトル生成テスト');
    const titleStart = Date.now();
    
    try {
      const title = await generateCalendarTitle(testText, { title: 'プロジェクト進捗会議' });
      const titleTime = Date.now() - titleStart;
      console.log(`✅ タイトル生成成功: ${titleTime}ms`);
      console.log(`🏷️ 生成されたタイトル: ${title}`);
    } catch (error) {
      console.error(`❌ タイトル生成エラー: ${error.message}`);
    }

    console.log('\n🎉 タイムアウト修正検証テスト完了！');
    
  } catch (error) {
    console.error('❌ テスト実行エラー:', error.message);
    console.error('スタックトレース:', error.stack);
    process.exit(1);
  }
}

// メイン実行
if (require.main === module) {
  testTimeoutFixes();
}
