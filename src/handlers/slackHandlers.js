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
  const startTime = Date.now();
  try {
    console.log('🎯 リアクションイベントを受信:', {
      reaction: event.reaction,
      user: event.user,
      channel: event.item.channel,
      timestamp: event.item.ts,
      eventType: event.type
    });

    if (!config.calendarReactions.includes(event.reaction)) {
      console.log('❌ カレンダー関連の絵文字ではありません:', event.reaction);
      return; // カレンダー関連の絵文字でない場合は処理しない
    }

    if (event.item.type !== 'message') {
      console.log('❌ メッセージ以外のアイテムに対するリアクションです:', event.item.type);
      return; // メッセージ以外のアイテムの場合は処理しない
    }

    console.log('✅ カレンダーリアクションを検出:', event.reaction);

    // 🚀 高速化: 即座に処理中表示を行い、その後並列で重複チェックとメッセージ取得を実行
    const processingReactionPromise = client.reactions.add({
      channel: event.item.channel,
      timestamp: event.item.ts,
      name: 'hourglass_flowing_sand'
    }).catch(err => console.warn('処理中リアクション追加失敗:', err));

    // � 高速化: 重複チェックとメッセージ取得を並列実行
    const [shouldContinue, messageResult] = await Promise.all([
      checkAndMarkReactionAsProcessed(
        event.item.channel, 
        event.item.ts, 
        event.reaction, 
        event.user
      ).catch(err => {
        console.error('重複チェックエラー:', err);
        return true; // エラー時は処理を続行
      }),
      client.conversations.history({
        channel: event.item.channel,
        latest: event.item.ts,
        inclusive: true,
        limit: 1
      }).catch(err => {
        console.error('メッセージ取得エラー:', err);
        return { messages: [] };
      }),
      processingReactionPromise
    ]);

    console.log(`⏱️ 初期処理完了: ${Date.now() - startTime}ms`);
    
    if (!shouldContinue) {
      // 🚀 処理済みの場合は即座にリアクションを削除
      await client.reactions.remove({
        channel: event.item.channel,
        timestamp: event.item.ts,
        name: 'hourglass_flowing_sand'
      }).catch(err => console.warn('処理中リアクション削除失敗:', err));
      return;
    }

    const message = messageResult.messages[0];
    if (!message || !message.text) {
      await client.reactions.remove({
        channel: event.item.channel,
        timestamp: event.item.ts,
        name: 'hourglass_flowing_sand'
      }).catch(err => console.warn('処理中リアクション削除失敗:', err));
      return;
    }

    // Slack投稿へのリンクを作成
    const teamId = config.slack.teamId;
    const messageUrl = `https://${teamId || 'app'}.slack.com/archives/${event.item.channel}/p${event.item.ts.replace('.', '')}`;
      const originalMessageText = message.text;
    
    try {
      // 🚀 高速化: AI処理開始と同時にSlackリンク準備を並列実行
      const teamId = config.slack.teamId;
      const messageUrl = `https://${teamId || 'app'}.slack.com/archives/${event.item.channel}/p${event.item.ts.replace('.', '')}`;
      
      // AI処理実行（タイムアウト付き）
      const aiStartTime = Date.now();
      const eventsPromise = Promise.race([
        extractEventsFromText(originalMessageText),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AI処理タイムアウト (15秒)')), 15000)
        )
      ]);

      const events = await eventsPromise;
      console.log(`⏱️ AI処理完了: ${Date.now() - aiStartTime}ms`);

      // 🚀 高速化: 処理中リアクション削除と後続処理を並列実行      // 🚀 高速化: 処理中リアクション削除と後続処理を並列実行
      const removeReactionPromise = client.reactions.remove({
        channel: event.item.channel,
        timestamp: event.item.ts,
        name: 'hourglass_flowing_sand'
      }).catch(err => console.warn('処理中リアクション削除失敗:', err));

      if (events.length > 0) {
        // 🚀 高速化: リアクション削除と予定処理を並列実行
        await Promise.all([
          removeReactionPromise,
          processExtractedEvents({
            events,
            client,
            channelId: event.item.channel,
            messageTs: event.item.ts,
            originalText: originalMessageText,
            messageUrl
          })
        ]);
      } else {
        // 予定が見つからなかった場合の処理
        await Promise.all([
          removeReactionPromise,
          client.reactions.add({
            channel: event.item.channel,
            timestamp: event.item.ts,
            name: 'no_entry_sign'
          }).catch(err => console.warn('エラーリアクション追加失敗:', err)),
          client.chat.postMessage({
            channel: event.item.channel,
            thread_ts: event.item.ts,
            text: '予定情報を検出できませんでした。'
          }).catch(err => console.warn('エラーメッセージ投稿失敗:', err))
        ]);
      }
      
      console.log(`⏱️ 全体処理完了: ${Date.now() - startTime}ms`);
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
  const processStartTime = Date.now();
  
  // 処理する予定の数を制限
  const MAX_EVENTS = config.app.maxEvents;
  let processEvents = events;
  
  if (events.length > MAX_EVENTS) {
    processEvents = events.slice(0, MAX_EVENTS);
    // 🚀 高速化: 制限通知を非同期で送信（処理をブロックしない）
    client.chat.postMessage({
      channel: channelId,
      thread_ts: messageTs,
      text: `注意: ${events.length}件の予定が検出されましたが、処理数制限のため最初の${MAX_EVENTS}件のみ処理します。`
    }).catch(err => console.warn('制限通知投稿失敗:', err));
  }

  // 🚀 高速化: テキスト要約とイベント処理を並列実行
  const summaryPromise = originalText.length > 100 
    ? Promise.race([
        summarizeText(originalText).catch(err => {
          console.warn('テキスト要約エラー:', err);
          return originalText.substring(0, 97) + '...';
        }),
        new Promise(resolve => 
          setTimeout(() => resolve(originalText.substring(0, 97) + '...'), 8000) // 8秒でタイムアウト
        )
      ])
    : Promise.resolve(originalText);

  // 🚀 高速化: イベント正規化を並列で実行
  const normalizedEventsPromise = Promise.all(
    processEvents.map(eventItem => {
      try {
        return normalizeEventData(eventItem);
      } catch (error) {
        console.warn('イベント正規化エラー:', error);
        return eventItem; // 正規化失敗時は元データを使用
      }
    })
  );

  // 🚀 並列処理: 要約とイベント正規化を同時実行
  const [sharedDescription, normalizedEvents] = await Promise.all([
    summaryPromise,
    normalizedEventsPromise
  ]);

  // Slack投稿へのリンクを説明に追加
  const finalDescription = `${sharedDescription}\n\nSlack投稿: ${messageUrl}`;

  console.log(`⏱️ 前処理完了: ${Date.now() - processStartTime}ms`);

  // 🚀 高速化: カレンダーURL生成と投稿を完全並列化
  const processPromises = normalizedEvents.map(async (normalizedEvent, index) => {
    try {
      const eventStartTime = Date.now();
      
      // 説明を設定
      normalizedEvent.description = finalDescription;
      
      // GoogleカレンダーのURLを生成
      const calendarUrl = createGoogleCalendarUrl(normalizedEvent);
      
      console.log(`⏱️ イベント${index + 1}処理: ${Date.now() - eventStartTime}ms`);

      // 結果をSlackに投稿（エラー時もcatch）
      return await client.chat.postMessage({
        channel: channelId,
        thread_ts: messageTs,
        text: `予定を検出しました: ${normalizedEvent.title}\n${calendarUrl}`
      });
    } catch (itemError) {
      console.error(`イベント${index + 1}処理エラー:`, itemError);
      return await client.chat.postMessage({
        channel: channelId,
        thread_ts: messageTs,
        text: `この予定の処理中にエラーが発生しました: ${normalizedEvents[index]?.title || '不明'}\nエラー: ${itemError.message}`
      }).catch(err => console.error('エラーメッセージ投稿失敗:', err));
    }
  });
  
  // すべての予定処理を並行実行
  await Promise.allSettled(processPromises); // allSettledで一部のエラーで全体が止まらないように
  
  console.log(`⏱️ 予定処理完了: ${Date.now() - processStartTime}ms`);
}

module.exports = {
  handleCalendarReaction
};