/**
 * SlackのURL生成テスト
 */

const { config } = require('./src/config/config');

function testSlackUrlGeneration() {
  console.log('🔗 Slack URL生成テスト');
  console.log('=' * 40);
  
  // テスト用のイベントデータ
  const testEvent = {
    item: {
      channel: 'C08MLF4UNDC',
      ts: '1751189282.164239'
    }
  };
  
  console.log('設定確認:');
  console.log('- SLACK_WORKSPACE_NAME:', config.slack.workspaceName);
  console.log('- SLACK_TEAM_ID:', config.slack.teamId);
  
  // URL生成のテスト
  const workspaceName = config.slack.workspaceName;
  const messageUrl = `https://${workspaceName}.slack.com/archives/${testEvent.item.channel}/p${testEvent.item.ts.replace('.', '')}`;
  
  console.log('\n生成されたURL:');
  console.log('📎', messageUrl);
  
  // 期待値との比較
  const expectedUrl = 'https://calendar-agent-test.slack.com/archives/C08MLF4UNDC/p1751189282164239';
  console.log('\n期待値:');
  console.log('📎', expectedUrl);
  
  console.log('\n結果:');
  if (messageUrl === expectedUrl) {
    console.log('✅ URL生成が正しく動作しています！');
  } else {
    console.log('❌ URL生成に問題があります');
    console.log('差分:', {
      generated: messageUrl,
      expected: expectedUrl
    });
  }
}

// テスト実行
testSlackUrlGeneration();
