# Node.jsイメージを使用（安定版のLTSに更新）
FROM node:20-slim

# アプリケーションディレクトリを作成
WORKDIR /usr/src/app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール（package-lock.jsonの同期問題を解決するためにnpm installを使用）
RUN npm install --production && npm cache clean --force

# アプリケーションのソースコードをコピー
COPY . .

# Dockerコンテナ内のポートを公開
EXPOSE 8080

# .envファイルがない場合のデフォルト値を設定
ENV PORT=8080
ENV NODE_ENV=production

# デバッグ情報用の簡易スクリプトを作成
RUN echo '#!/bin/bash' > /usr/local/bin/entrypoint.sh && \
    echo 'echo "コンテナ起動: ポート=$PORT"' >> /usr/local/bin/entrypoint.sh && \
    echo 'echo "Node.jsバージョン: $(node -v)"' >> /usr/local/bin/entrypoint.sh && \
    echo 'echo "フォルダ内容: $(ls -la)"' >> /usr/local/bin/entrypoint.sh && \
    echo 'exec "$@"' >> /usr/local/bin/entrypoint.sh && \
    chmod +x /usr/local/bin/entrypoint.sh

# アプリケーションを起動
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]