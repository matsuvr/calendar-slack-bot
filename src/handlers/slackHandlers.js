/**
 * Slackイベント処理のハンドラー（高速化版）
 */

const { config } = require('../config/config');
const { checkAndMarkReactionAsProcessed } = require('../services/firestoreService');
const { summarizeText, extractEventsFromText } = require('../services/aiService');
const { createGoogleCalendarUrl, normalizeEventData } = require('../utils/calendarUtils');

// グローバルな処理キュー（メモリ内キャッシュ）
const processingQueue = new Map();

/**
 * カレンダー絵文字リアクションが追加された時の処理
 * @param {Object} event - Slackイベントオブジェクト
 * @param {Object} client - Slackクライアント
 */
async function handleCalendarReaction({ event, client }) {
  const startTime = Date.now();
  const queueKey = `${event.item.channel}-${event.item.ts}-${event.reaction}`;
  
  try {
    // 🚀 超高速化: 早期リターンチェック
    if (!config.calendarReactions.includes(event.reaction) || 
        event.item.type !== 'message') {
      return;
    }

    // 🚀 重複処理防止（メモリキャッシュ）
    if (processingQueue.has(queueKey)) {
      console.log('⚡ 既に処理中のイベント:', queueKey);
      return;
    }
    processingQueue.set(queueKey, true);

    console.log('✅ カレンダーリアクション検出:', event.reaction);

    // 🚀 即座に処理中表示（非同期・待機なし）
    client.reactions.add({
      channel: event.item.channel,
      timestamp: event.item.ts,
      name: 'hourglass_flowing_sand'
    }).catch(() => {}); // エラーは無視

    // 🚀 重複チェックとメッセージ取得を並列実行
    const [shouldContinue, messageResult] = await Promise.all([
      checkAndMarkReactionAsProcessed(
        event.item.channel, 
        event.item.ts, 
        event.reaction, 
        event.user
      ).catch(() => true),
      client.conversations.history({
        channel: event.item.channel,
        latest: event.item.ts,
        inclusive: true,
        limit: 1
      })
    ]);

    if (!shouldContinue || !messageResult?.messages?.[0]?.text) {
      await removeProcessingReaction(client, event.item.channel, event.item.ts);
      processingQueue.delete(queueKey);
      return;
    }

    const message = messageResult.messages[0];
    const teamId = config.slack.teamId || 'app';
    const messageUrl = `https://${teamId}.slack.com/archives/${event.item.channel}/p${event.item.ts.replace('.', '')}`;

    // 🚀 AI処理を非同期で開始（結果を待たない）
    processAIAndRespond({
      client,
      event,
      message: message.text,
      messageUrl,
      startTime
    }).finally(() => {
      processingQueue.delete(queueKey);
    });

    // 🚀 即座にリターン（AI処理の完了を待たない）
    console.log(`⏱️ 初期処理完了: ${Date.now() - startTime}ms`);
    
  } catch (error) {
    console.error('handleCalendarReaction エラー:', error);
    processingQueue.delete(queueKey);
    await handleError(client, event, error);
  }
}

/**
 * AI処理と応答を非同期で実行
 */
async function processAIAndRespond({ client, event, message, messageUrl, startTime }) {
  try {
    // 🚀 AI処理（タイムアウト: 10秒）
    const events = await Promise.race([
      extractEventsFromText(message),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('AI処理タイムアウト')), 10000)
      )
    ]);

    // 処理中リアクション削除
    await removeProcessingReaction(client, event.item.channel, event.item.ts);

    if (events.length > 0) {
      // 🚀 イベント処理を非同期バッチで実行
      await processEventsInBatches({
        events,
        client,
        channelId: event.item.channel,
        messageTs: event.item.ts,
        originalText: message,
        messageUrl
      });
    } else {
      // 予定が見つからない場合
      await Promise.all([
        client.reactions.add({
          channel: event.item.channel,
          timestamp: event.item.ts,
          name: 'no_entry_sign'
        }),
        client.chat.postMessage({
          channel: event.item.channel,
          thread_ts: event.item.ts,
          text: '予定情報を検出できませんでした。'
        })
      ]).catch(() => {});
    }

    console.log(`⏱️ 全体処理完了: ${Date.now() - startTime}ms`);
    
  } catch (error) {
    console.error('AI処理エラー:', error);
    await handleError(client, event, error);
  }
}

/**
 * イベントをバッチで処理（高速化）
 */
async function processEventsInBatches({ events, client, channelId, messageTs, originalText, messageUrl }) {
  const MAX_EVENTS = config.app.maxEvents || 5;
  const BATCH_SIZE = 3; // 並列処理のバッチサイズ
  
  const processEvents = events.slice(0, MAX_EVENTS);
  
  // 制限通知（非同期・待機なし）
  if (events.length > MAX_EVENTS) {
    client.chat.postMessage({
      channel: channelId,
      thread_ts: messageTs,
      text: `注意: ${events.length}件中、最初の${MAX_EVENTS}件のみ処理します。`
    }).catch(() => {});
  }

  // 🚀 軽量な要約処理
  const summary = originalText.length > 100
    ? originalText.substring(0, 97) + '...'
    : originalText;
  
  const finalDescription = `${summary}\n\nSlack投稿: ${messageUrl}`;

  // 🚀 バッチ処理でイベントを処理
  for (let i = 0; i < processEvents.length; i += BATCH_SIZE) {
    const batch = processEvents.slice(i, i + BATCH_SIZE);
    
    await Promise.allSettled(
      batch.map(async (eventItem) => {
        try {
          const normalizedEvent = normalizeEventData(eventItem);
          normalizedEvent.description = finalDescription;
          
          const calendarUrl = createGoogleCalendarUrl(normalizedEvent);
          
          return client.chat.postMessage({
            channel: channelId,
            thread_ts: messageTs,
            text: `📅 ${normalizedEvent.title}\n${calendarUrl}`,
            unfurl_links: false // リンクのプレビューを無効化（高速化）
          });
        } catch (error) {
          console.error('イベント処理エラー:', error);
        }
      })
    );
  }
}

/**
 * 処理中リアクションを削除（エラーを無視）
 */
async function removeProcessingReaction(client, channel, timestamp) {
  try {
    await client.reactions.remove({
      channel,
      timestamp,
      name: 'hourglass_flowing_sand'
    });
  } catch (error) {
    // エラーは無視（既に削除されている可能性がある）
  }
}

/**
 * エラーハンドリング
 */
async function handleError(client, event, error) {
  try {
    await Promise.all([
      removeProcessingReaction(client, event.item.channel, event.item.ts),
      client.chat.postMessage({
        channel: event.item.channel,
        thread_ts: event.item.ts,
        text: `エラーが発生しました: ${error.message}`,
        unfurl_links: false
      })
    ]);
  } catch (postError) {
    console.error('エラーメッセージ投稿失敗:', postError);
  }
}

module.exports = {
  handleCalendarReaction
};