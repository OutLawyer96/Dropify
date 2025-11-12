import {
  EnvironmentConfig,
  EnvironmentLimits,
  FeatureFlags,
  Stage,
} from "../types";

const sharedLimits: EnvironmentLimits = {
  maxUploadSizeMb: 5_000,
  maxFileCount: 50,
  storageQuotaGb: 500,
  chunkSizeMb: 16,
  requestTimeoutMs: 60_000,
};

const sharedFlags: FeatureFlags = {
  enableSharing: true,
  enableVirusScan: true,
  enableAuditTrail: true,
  enableAutomaticExpiry: true,
};

const sharedDynamoDBConfig = {
  billingMode: "PAY_PER_REQUEST" as const,
  pointInTimeRecovery: false,
  encryption: true,
};

export const environments: Partial<Record<Stage, EnvironmentConfig>> = {
  dev: {
    stage: "dev",
    account: "908532959458",
    region: "eu-north-1",
    apiDomain: process.env.DROPIFY_DEV_API ?? "api.dev.dropify.local",
    cdnDomain: process.env.DROPIFY_DEV_CDN ?? "cdn.dev.dropify.local",
    cdnCertificateArn: process.env.DROPIFY_DEV_CDN_CERT_ARN,
    staticSiteBucketName:
      process.env.DROPIFY_DEV_STATIC_BUCKET ?? "dropify-dev-app-hosting",
    fileBucketName: process.env.DROPIFY_DEV_BUCKET ?? "dropify-dev-uploads",
    databaseTableName: process.env.DROPIFY_DEV_TABLE ?? "dropify-dev-files",
    filesTableName: "dropify-dev-files",
    shareLinksTableName: "dropify-dev-sharelinks",
    usersTableName: "dropify-dev-users",
    userPoolName: process.env.DROPIFY_DEV_USER_POOL ?? "dropify-dev-users",
    cognitoConfig: {
      userPoolName: process.env.DROPIFY_DEV_USER_POOL ?? "dropify-dev-users",
      userPoolClientName:
        process.env.DROPIFY_DEV_USER_POOL_CLIENT ?? "dropify-dev-client",
      userPoolDomain:
        process.env.DROPIFY_DEV_COGNITO_DOMAIN ?? "dropify-dev-auth",
      passwordPolicy: {
        minLength: Number(process.env.COGNITO_PASSWORD_MIN_LENGTH ?? 8),
        requireUppercase: process.env.COGNITO_REQUIRE_UPPERCASE === "true",
        requireLowercase: process.env.COGNITO_REQUIRE_LOWERCASE !== "false",
        requireNumbers: process.env.COGNITO_REQUIRE_NUMBERS === "true",
        requireSymbols: process.env.COGNITO_REQUIRE_SYMBOLS === "true",
      },
      mfaConfiguration: (process.env.COGNITO_MFA_CONFIGURATION as any) || "OFF",
      emailVerificationSubject:
        process.env.COGNITO_EMAIL_VERIFICATION_SUBJECT ??
        "Verify your Dropify account",
      emailVerificationMessage:
        process.env.COGNITO_EMAIL_VERIFICATION_MESSAGE ??
        "Your verification code is {####}",
      allowedCallbackUrls: (
        process.env.COGNITO_ALLOWED_CALLBACK_URLS ?? "http://localhost:3000"
      ).split(","),
      accessTokenValidity: Number(
        process.env.COGNITO_ACCESS_TOKEN_VALIDITY_MINUTES ?? 60
      ),
      idTokenValidity: Number(
        process.env.COGNITO_ID_TOKEN_VALIDITY_MINUTES ?? 60
      ),
      refreshTokenValidity: Number(
        process.env.COGNITO_REFRESH_TOKEN_VALIDITY_DAYS ?? 30
      ),
    },
    dynamodbConfig: {
      ...sharedDynamoDBConfig,
      streamEnabled: sharedFlags.enableAuditTrail,
    },
    limits: { ...sharedLimits },
    featureFlags: { ...sharedFlags },
    tags: {
      Environment: "dev",
      Project: "Dropify",
    },
  },
  prod: {
    stage: "prod",
    account: process.env.DROPIFY_PROD_ACCOUNT ?? "000000000000",
    region: process.env.DROPIFY_PROD_REGION ?? "us-east-1",
    apiDomain: process.env.DROPIFY_PROD_API ?? "api.dropify.app",
    cdnDomain: process.env.DROPIFY_PROD_CDN ?? "cdn.dropify.app",
    cdnCertificateArn: process.env.DROPIFY_PROD_CDN_CERT_ARN,
    staticSiteBucketName:
      process.env.DROPIFY_PROD_STATIC_BUCKET ?? "dropify-prod-app-hosting",
    fileBucketName: process.env.DROPIFY_PROD_BUCKET ?? "dropify-prod-uploads",
    databaseTableName: process.env.DROPIFY_PROD_TABLE ?? "dropify-prod-files",
    filesTableName:
      process.env.DROPIFY_PROD_FILES_TABLE ?? "dropify-prod-files",
    shareLinksTableName:
      process.env.DROPIFY_PROD_SHARELINKS_TABLE ?? "dropify-prod-sharelinks",
    usersTableName:
      process.env.DROPIFY_PROD_USERS_TABLE ?? "dropify-prod-users",
    userPoolName: process.env.DROPIFY_PROD_USER_POOL ?? "dropify-prod-users",
    cognitoConfig: {
      userPoolName: process.env.DROPIFY_PROD_USER_POOL ?? "dropify-prod-users",
      userPoolClientName:
        process.env.DROPIFY_PROD_USER_POOL_CLIENT ?? "dropify-prod-client",
      userPoolDomain:
        process.env.DROPIFY_PROD_COGNITO_DOMAIN ?? "dropify-prod-auth",
      passwordPolicy: {
        minLength: Number(process.env.COGNITO_PASSWORD_MIN_LENGTH ?? 12),
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSymbols: true,
      },
      mfaConfiguration:
        (process.env.COGNITO_MFA_CONFIGURATION as any) || "OPTIONAL",
      emailVerificationSubject:
        process.env.COGNITO_EMAIL_VERIFICATION_SUBJECT ??
        "Verify your Dropify account",
      emailVerificationMessage:
        process.env.COGNITO_EMAIL_VERIFICATION_MESSAGE ??
        "Your verification code is {####}",
      allowedCallbackUrls: (
        process.env.COGNITO_ALLOWED_CALLBACK_URLS ?? "https://app.dropify.app"
      ).split(","),
      accessTokenValidity: Number(
        process.env.COGNITO_ACCESS_TOKEN_VALIDITY_MINUTES ?? 60
      ),
      idTokenValidity: Number(
        process.env.COGNITO_ID_TOKEN_VALIDITY_MINUTES ?? 60
      ),
      refreshTokenValidity: Number(
        process.env.COGNITO_REFRESH_TOKEN_VALIDITY_DAYS ?? 30
      ),
    },
    dynamodbConfig: {
      ...sharedDynamoDBConfig,
      pointInTimeRecovery: true,
      streamEnabled: sharedFlags.enableAuditTrail,
    },
    limits: {
      ...sharedLimits,
      maxUploadSizeMb: 10_000,
      storageQuotaGb: 5_000,
    },
    featureFlags: {
      ...sharedFlags,
      enableAutomaticExpiry: true,
    },
    tags: {
      Environment: "prod",
      Project: "Dropify",
    },
  },
};

export const getEnvironmentConfig = (stage: Stage): EnvironmentConfig => {
  const config = environments[stage];

  if (!config) {
    // If we try to get a config that doesn't exist, stop the deployment.
    throw new Error(`Configuration for stage "${stage}" could not be found.`);
  }

  return config;
};
