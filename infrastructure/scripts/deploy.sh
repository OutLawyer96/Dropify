#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./scripts/deploy.sh [dev|prod]

Deploy the Dropify infrastructure to the specified environment.
EOF
}

if [[ ${1:-} == "" ]]; then
  usage
  exit 1
fi

STAGE="$1"
shift || true

if ! command -v aws >/dev/null 2>&1; then
  echo "[deploy] AWS CLI is required but was not found in PATH." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[deploy] npm is required but was not found in PATH." >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "[deploy] curl is required but was not found in PATH." >&2
  exit 1
fi

echo "[deploy] Verifying AWS credentials..."
aws sts get-caller-identity >/dev/null

STAGE_UPPER=$(echo "${STAGE}" | tr '[:lower:]' '[:upper:]')
CERT_ENV_VAR="DROPIFY_${STAGE_UPPER}_CDN_CERT_ARN"
CERT_ARN="${!CERT_ENV_VAR:-}"

if [[ -n "${CERT_ARN}" ]]; then
  echo "[deploy] Validating ACM certificate in us-east-1..."
  CERT_STATUS=$(aws acm describe-certificate --certificate-arn "${CERT_ARN}" --region us-east-1 --query 'Certificate.Status' --output text)
  if [[ "${CERT_STATUS}" != "ISSUED" ]]; then
    echo "[deploy] ACM certificate ${CERT_ARN} must be in ISSUED state (current: ${CERT_STATUS})." >&2
    exit 1
  fi
else
  echo "[deploy] ${CERT_ENV_VAR} is not set; distribution will use the default CloudFront domain." >&2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${PROJECT_ROOT}/.." && pwd)"

cd "${PROJECT_ROOT}" || exit 1

export CDK_DEPLOY_STAGE="${STAGE}"
STACK_NAME="dropify-${STAGE}"

case "${STAGE}" in
  dev)
    echo "[deploy] Deploying Dropify development stack (${STACK_NAME})"
    npm run build
    npx cdk synth "${STACK_NAME}" >/dev/null
    npx cdk deploy "${STACK_NAME}" "$@"
    ;;
  prod)
    echo "[deploy] Deploying Dropify production stack (${STACK_NAME})"
    npm run build
    npx cdk diff "${STACK_NAME}" || true
    npx cdk deploy "${STACK_NAME}" "$@"
    ;;
  *)
    echo "[deploy] Unknown environment: ${STAGE}" >&2
    usage
    exit 1
    ;;
 esac

echo "[deploy] Deployment complete."

HOSTING_BUCKET=$(aws cloudformation describe-stacks --stack-name "${STACK_NAME}" --query "Stacks[0].Outputs[?OutputKey=='HostingBucketName'].OutputValue" --output text)
FILES_BUCKET=$(aws cloudformation describe-stacks --stack-name "${STACK_NAME}" --query "Stacks[0].Outputs[?OutputKey=='UserFilesBucketName'].OutputValue" --output text)
DISTRIBUTION_ID=$(aws cloudformation describe-stacks --stack-name "${STACK_NAME}" --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text)
DISTRIBUTION_DOMAIN=$(aws cloudformation describe-stacks --stack-name "${STACK_NAME}" --query "Stacks[0].Outputs[?OutputKey=='DistributionDomain'].OutputValue" --output text)

USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name "${STACK_NAME}" --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name "${STACK_NAME}" --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" --output text)
IDENTITY_POOL_ID=$(aws cloudformation describe-stacks --stack-name "${STACK_NAME}" --query "Stacks[0].Outputs[?OutputKey=='IdentityPoolId'].OutputValue" --output text)

if [[ -n "${USER_POOL_ID}" && "${USER_POOL_ID}" != "None" ]]; then
  echo "[deploy] Cognito User Pool ID: ${USER_POOL_ID}"
fi

if [[ -n "${USER_POOL_CLIENT_ID}" && "${USER_POOL_CLIENT_ID}" != "None" ]]; then
  echo "[deploy] Cognito User Pool Client ID: ${USER_POOL_CLIENT_ID}"
fi

if [[ -n "${IDENTITY_POOL_ID}" && "${IDENTITY_POOL_ID}" != "None" ]]; then
  echo "[deploy] Cognito Identity Pool ID: ${IDENTITY_POOL_ID}"
fi

if [[ -z "${HOSTING_BUCKET}" || "${HOSTING_BUCKET}" == "None" ]]; then
  echo "[deploy] Failed to resolve hosting bucket from stack outputs." >&2
  exit 1
fi

if [[ -z "${FILES_BUCKET}" || "${FILES_BUCKET}" == "None" ]]; then
  echo "[deploy] Failed to resolve user files bucket from stack outputs." >&2
  exit 1
fi

echo "[deploy] Validating S3 bucket accessibility..."
aws s3api head-bucket --bucket "${HOSTING_BUCKET}" >/dev/null
aws s3api head-bucket --bucket "${FILES_BUCKET}" >/dev/null

echo "[deploy] Building React application..."
(cd "${REPO_ROOT}" && npm install && npm run build)

if [[ ! -d "${REPO_ROOT}/build" ]]; then
  echo "[deploy] React build directory not found after build." >&2
  exit 1
fi

echo "[deploy] Uploading build artifacts to s3://${HOSTING_BUCKET}"
aws s3 sync "${REPO_ROOT}/build" "s3://${HOSTING_BUCKET}" --delete

if [[ "${DISTRIBUTION_ID}" != "None" && -n "${DISTRIBUTION_ID}" ]]; then
  echo "[deploy] Creating CloudFront invalidation for ${DISTRIBUTION_ID}"
  aws cloudfront create-invalidation --distribution-id "${DISTRIBUTION_ID}" --paths "/*"
fi

if [[ "${DISTRIBUTION_DOMAIN}" != "None" && -n "${DISTRIBUTION_DOMAIN}" ]]; then
  echo "[deploy] Checking CDN endpoint https://${DISTRIBUTION_DOMAIN}"
  if ! curl -sSfI "https://${DISTRIBUTION_DOMAIN}/" >/dev/null; then
    echo "[deploy] CDN health check failed for https://${DISTRIBUTION_DOMAIN}/" >&2
    exit 1
  fi
fi

echo "[deploy] Deployment and post-deploy steps completed successfully."
