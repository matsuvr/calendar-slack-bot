# Node.jsイメージを使用
FROM node:18-slim

# アプリケーションディレクトリを作成
WORKDIR /usr/src/app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm ci --only=production

# アプリケーションのソースコードをコピー
COPY . .

# Dockerコンテナ内のポートを公開
EXPOSE 8080

# .envファイルがない場合のデフォルト値を設定
ENV PORT=8080
ENV NODE_ENV=production

# アプリケーションを起動
CMD [ "node", "server.js" ]