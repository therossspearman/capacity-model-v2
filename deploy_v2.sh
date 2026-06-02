#!/bin/bash
echo "🚀 Building Worker Code (V2)..."
# Encode worker.js to base64 and wrap in JS export
cat src/worker/worker.js | base64 | tr -d '\n' > worker_b64.tmp
echo "export const workerCode = \"$(cat worker_b64.tmp)\";" > src/worker/workerCode.js
rm worker_b64.tmp
echo "✅ Worker Code Built."

echo "🚀 Releasing Block (V2)..."
echo "Deployment Description: V2 Migration Release" | block release
