/**
 * API統合テスト
 * サーバー全体の動作をテスト
 */

const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const request = require('supertest');

// テストサーバーの動的import
let server;
let app;

beforeAll(async () => {
  // 環境変数を設定
  process.env.NODE_ENV = 'test';
  process.env.PORT = '3001';
  process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
  process.env.SLACK_SIGNING_SECRET = 'test-signing-secret';
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  
  // server.jsをrequireしてアプリを取得
  const serverModule = require('../../server.js');
  app = serverModule.app || serverModule; // server.jsがappをexportしているかチェック
});

afterAll((done) => {
  if (server) {
    server.close(done);
  } else {
    done();
  }
});

describe('API Integration Tests', () => {
  
  describe('Health Check', () => {
    test('GET /health should return OK', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.text).toBe('OK');
    });
  });

  describe('Demo Mode Functionality', () => {
    test('should handle Slack events endpoint', async () => {
      const slackEvent = {
        type: 'url_verification',
        challenge: 'test-challenge'
      };

      const response = await request(app)
        .post('/slack/events')
        .send(slackEvent)
        .expect(200);
        
      expect(response.text).toBe('test-challenge');
    });

    test('should reject invalid Slack events', async () => {
      const invalidEvent = {
        invalid: 'data'
      };

      await request(app)
        .post('/slack/events')
        .send(invalidEvent)
        .expect(400);
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for unknown routes', async () => {
      await request(app)
        .get('/unknown-route')
        .expect(404);
    });

    test('should handle malformed JSON', async () => {
      await request(app)
        .post('/slack/events')
        .send('invalid json')
        .expect(400);
    });
  });
});
