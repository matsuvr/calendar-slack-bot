/**
 * Slackイベント処理のハンドラー
 */

const { config } = require('../config/config');
const { checkAndMarkReactionAsProcessed } = require('../services/firestoreService');
const { summarizeText, extractEventsFromText } = require('../services/aiService');
const { createGoogleCalendarUrl, normalizeEventData } = require('../utils/calendarUtils');

/**
 * カレンダー絵文字リアクションが追加された時の処理
 * @param {Object} event - Slackイベントオブジェクト
 * @param {Object} client - Slackクライアント
 */
async function handleCalendarReaction({ event, client }) {
  try {
    if (!config.calendarReactions.includes(event.reaction)) {
      return; // カレンダー関連の絵文字でない場合は処理しない
    }

    // すでに処理済みのリアクションかチェック
    const shouldContinue = await checkAndMarkReactionAsProcessed(
      event.item.channel, 
      event.item.ts, 
      event.reaction, 
      event.user
    );
    
    if (!shouldContinue) {
      return; // すでに処理済みの場合は終了
    }

    // メッセージの内容を取得
    const result = await client.conversations.history({
      channel: event.item.channel,
      latest: event.item.ts,
      inclusive: true,
      limit: 1
    });

    const message = result.messages[0];
    if (!message || !message.text) {
      return; // メッセージが存在しないか、テキストがない場合は終了
    }

    // 処理中であることを示す砂時計リアクションを追加
    await client.reactions.add({
      channel: event.item.channel,
      timestamp: event.item.ts,
      name: 'hourglass_flowing_sand'
    });

    // Slack投稿へのリンクを作成
    const teamId = config.slack.teamId;
    const messageUrl = `https://${teamId || 'app'}.slack.com/archives/${event.item.channel}/p${event.item.ts.replace('.', '')}`;
    
    const originalMessageText = message.text;
    
    try {
      // メッセージから予定情報を抽出
      const events = await extractEventsFromText(originalMessageText);

      // 処理中の砂時計リアクションを削除
      await client.reactions.remove({
        channel: event.item.channel,
        timestamp: event.item.ts,
        name: 'hourglass_flowing_sand'
      });

      if (events.length > 0) {
        // 予定が見つかった場合の処理
        await processExtractedEvents({
          events,
          client,
          channelId: event.item.channel,
          messageTs: event.item.ts,
          originalText: originalMessageText,
          messageUrl
        });
      } else {
        // 予定が見つからなかった場合の処理
        await client.reactions.add({
          channel: event.item.channel,
          timestamp: event.item.ts,
          name: 'no_entry_sign'
        });

        await client.chat.postMessage({
          channel: event.item.channel,
          thread_ts: event.item.ts,
          text: '予定情報を検出できませんでした。'
        });
      }
    } catch (apiError) {
      // エラー処理
      await client.chat.postMessage({
        channel: event.item.channel,
        thread_ts: event.item.ts,
        text: `エラーが発生しました: ${apiError.message}`
      });
    }
  } catch (error) {
    // 最終的なエラーハンドリング
    try {
      if (event && event.item && event.item.channel && event.item.ts) {
        await client.chat.postMessage({
          channel: event.item.channel,
          thread_ts: event.item.ts,
          text: `エラーが発生しました: ${error.message}`
        });
      }
    } catch (postError) {
      console.error('エラーメッセージの投稿に失敗しました:', postError);
    }
  }
}

/**
 * 抽出された予定情報を処理する
 * @param {Object} params - 処理パラメータ
 */
async function processExtractedEvents({ events, client, channelId, messageTs, originalText, messageUrl }) {
  // 処理する予定の数を制限
  const MAX_EVENTS = config.app.maxEvents;
  let processEvents = events;
  
  if (events.length > MAX_EVENTS) {
    processEvents = events.slice(0, MAX_EVENTS);
    await client.chat.postMessage({
      channel: channelId,
      thread_ts: messageTs,
      text: `注意: ${events.length}件の予定が検出されましたが、処理数制限のため最初の${MAX_EVENTS}件のみ処理します。`
    });
  }

  // 元のテキストを要約してイベントの説明に使用
  let sharedDescription = originalText;
  if (originalText.length > 100) {
    try {
      const summaryResponse = await summarizeText(originalText);
      if (summaryResponse && summaryResponse.trim() !== '') {
        sharedDescription = summaryResponse;
      }
    } catch (summaryError) {
      console.error('テキスト要約エラー:', summaryError);
      sharedDescription = originalText.substring(0, 97) + '...';
    }
  }
  
  // Slack投稿へのリンクを説明に追加
  sharedDescription = `${sharedDescription}\n\nSlack投稿: ${messageUrl}`;

  // 各予定を処理
  const processPromises = processEvents.map(async (eventItem) => {
    try {
      // イベントデータの標準化
      const normalizedEvent = normalizeEventData(eventItem);
      
      // 説明を設定
      normalizedEvent.description = sharedDescription;
      
      // GoogleカレンダーのURLを生成
      const calendarUrl = createGoogleCalendarUrl(normalizedEvent);

      // 結果をSlackに投稿
      return client.chat.postMessage({
        channel: channelId,
        thread_ts: messageTs,
        text: `予定を検出しました: ${normalizedEvent.title}\n${calendarUrl}`
      });
    } catch (itemError) {
      return client.chat.postMessage({
        channel: channelId,
        thread_ts: messageTs,
        text: `この予定の処理中にエラーが発生しました: ${eventItem.title}\nエラー: ${itemError.message}`
      });
    }
  });
  
  // すべての予定処理を並行実行
  await Promise.all(processPromises);
}

module.exports = {
  handleCalendarReaction
};