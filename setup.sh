#!/bin/bash

echo "Setting up Ethiopian Bank Transfer Bot..."

# 1. Create directories
mkdir -p ethio-mini-app api bot ssl

# 2. Create .env.ethio file
cat > .env.ethio << EOF
# Replace these with your actual values
ETHIO_BOT_TOKEN=YOUR_BOT_TOKEN_HERE
MONGODB_URL=mongodb://localhost:27017
WEB_APP_URL=https://your-domain.com/ethio-mini-app
API_ENDPOINT=https://your-api.com
JWT_SECRET=$(openssl rand -hex 32)
EOF

echo "Please edit .env.ethio with your credentials"
echo "1. Get bot token from @BotFather"
echo "2. Update WEB_APP_URL with your domain"
echo "3. Set up MongoDB"