# Node.jsイメージを使用（安定版のLTSに更新）
FROM node:20-slim

# アプリケーションディレクトリを作成
WORKDIR /usr/src/app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール（--production=false でdevDependenciesも含めてデバッグを容易に）
RUN npm ci --production=false && npm cache clean --force

# アプリケーションのソースコードをコピー
COPY . .

# Dockerコンテナ内のポートを公開
EXPOSE 8080

# .envファイルがない場合のデフォルト値を設定
ENV PORT=8080
ENV NODE_ENV=production

# デバッグ情報の強化とスタートアップスクリプトの作成
RUN echo '#!/bin/bash \n\
echo "============================================" \n\
echo "コンテナ起動時の環境変数とファイル確認" \n\
echo "============================================" \n\
echo "環境変数の確認:" \n\
echo "PORT=$PORT" \n\
echo "NODE_ENV=$NODE_ENV" \n\
echo "SLACK_BOT_TOKEN=${SLACK_BOT_TOKEN:0:5}... (設定されていれば)" \n\
echo "SLACK_SIGNING_SECRET=${SLACK_SIGNING_SECRET:0:5}... (設定されていれば)" \n\
echo "GEMINI_API_KEY=${GEMINI_API_KEY:0:5}... (設定されていれば)" \n\
if [ -z "$SLACK_BOT_TOKEN" ] || [ -z "$SLACK_SIGNING_SECRET" ] || [ -z "$GEMINI_API_KEY" ]; then \n\
  echo "警告: 必須環境変数が設定されていません。以下の環境変数を設定してください: SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, GEMINI_API_KEY" \n\
  echo "環境変数が設定されていないため、アプリケーションは正常に動作しない可能性があります。" \n\
else \n\
  echo "必須環境変数が正常に設定されています。" \n\
fi \n\
echo "Node.jsのバージョン:" \n\
node -v \n\
echo "NPMのバージョン:" \n\
npm -v \n\
echo "ファイル一覧:" \n\
ls -la \n\
echo "server.jsの権限:" \n\
ls -la server.js \n\
echo "package.jsonの内容:" \n\
cat package.json \n\
echo "============================================" \n\
echo "サーバー起動コマンド: node server.js" \n\
echo "============================================" \n\
exec "$@"' > /usr/local/bin/entrypoint.sh \
&& chmod +x /usr/local/bin/entrypoint.sh

# npmのデバッグモードを有効化
ENV NODE_DEBUG=module,net,http,fs

# アプリケーションを起動（デバッグ情報を有効化）
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "--trace-warnings", "server.js"]