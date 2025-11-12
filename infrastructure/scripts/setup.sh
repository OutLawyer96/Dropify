#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

command -v aws >/dev/null 2>&1 || {
  echo "[setup] AWS CLI not found. Please install and configure the AWS CLI before continuing." >&2
  exit 1
}

command -v cdk >/dev/null 2>&1 || {
  echo "[setup] AWS CDK not found. Installing @aws-cdk/cli globally..."
  npm install -g aws-cdk
}

echo "[setup] Installing infrastructure dependencies..."
(cd "${PROJECT_ROOT}" && npm install)

echo "[setup] Bootstrapping CDK environment (if required)..."
(cd "${PROJECT_ROOT}" && npx cdk bootstrap)

echo "[setup] Setup complete."
