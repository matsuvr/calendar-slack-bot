/**
 * 要約機能のデバッグテスト
 */

const { summarizeText } = require('./src/services/aiService');

async function testSummarizeDebug() {
  try {
    console.log('🔍 要約機能デバッグテスト');
    
    const testText = `
来週の月曜日（2025年1月20日）の午後2時から3時までプロジェクト進捗会議を開催します。
会議はオンラインで行います。Google Meetリンクは https://meet.google.com/abc-def-ghi です。
参加者：田中、佐藤、山田、鈴木
議題：Q1の進捗確認とQ2の計画について
    `;
    
    console.log('入力テキスト長:', testText.length);
    console.log('入力テキスト:', testText.trim());
    
    const result = await summarizeText(testText);
    console.log('要約結果:', `"${result}"`);
    console.log('要約結果長:', result.length);
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

testSummarizeDebug();
