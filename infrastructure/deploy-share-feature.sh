#!/bin/bash
# Deploy the backend with share functionality

cd "$(dirname "$0")"

echo "Building TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    echo "Build failed!"
    exit 1
fi

echo "Deploying stack..."
npx cdk deploy dropify-backend-dev --require-approval never

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
else
    echo "❌ Deployment failed!"
    exit 1
fi
