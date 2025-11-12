import { StackProps } from "aws-cdk-lib";
import type { IRole } from "aws-cdk-lib/aws-iam";
import type { IFunction } from "aws-cdk-lib/aws-lambda";
import type { IBucket } from "aws-cdk-lib/aws-s3";

export type Stage = "dev" | "prod";

export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  checksum?: string;
  uploadedAt?: string;
  expiresAt?: string;
  ownerId?: string;
  status: "pending" | "validating" | "available" | "archived" | "error";
  version?: string;
}

export interface ShareLink {
  id: string;
  fileId: string;
  token: string;
  createdAt: string;
  expiresAt?: string;
  passwordProtected: boolean;
  maxDownloads?: number;
  downloads?: number;
}

export interface ShareOptions {
  expiresInHours?: number;
  maxDownloads?: number;
  password?: string;
  allowAnonymousDownload?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  createdAt: string;
  lastActiveAt?: string;
  plan?: "free" | "pro" | "enterprise";
}

export interface EnvironmentLimits {
  maxUploadSizeMb: number;
  maxFileCount: number;
  storageQuotaGb: number;
  chunkSizeMb: number;
  requestTimeoutMs: number;
}

export interface FeatureFlags {
  enableSharing: boolean;
  enableVirusScan: boolean;
  enableAuditTrail: boolean;
  enableAutomaticExpiry: boolean;
}

export interface DynamoDBConfig {
  billingMode: "PAY_PER_REQUEST" | "PROVISIONED";
  pointInTimeRecovery: boolean;
  encryption: boolean;
  streamEnabled?: boolean;
}

export interface EnvironmentConfig {
  stage: Stage;
  account: string;
  region: string;
  apiDomain: string;
  cdnDomain?: string;
  cdnCertificateArn?: string;
  staticSiteBucketName: string;
  fileBucketName: string;
  databaseTableName: string;
  filesTableName: string;
  shareLinksTableName: string;
  usersTableName: string;
  userPoolName: string;
  cognitoConfig?: CognitoUserPoolConfig & CognitoIdentityPoolConfig;
  dynamodbConfig?: DynamoDBConfig;
  limits: EnvironmentLimits;
  featureFlags: FeatureFlags;
  tags?: Record<string, string>;
}

export interface DropifyStackProps extends StackProps {
  stage: Stage;
  environmentConfig: EnvironmentConfig;
}

export interface BucketCorsRule {
  allowedMethods: string[];
  allowedOrigins: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  maxAge?: number;
}

export interface BucketLifecycleRule {
  id: string;
  enabled: boolean;
  transitions?: Array<{
    storageClass: string;
    transitionAfterDays: number;
  }>;
  expirationDays?: number;
}

export interface S3ConstructProps {
  stage: Stage;
  environmentConfig: EnvironmentConfig;
  fileProcessorRole?: IRole;
  fileProcessorFunction?: IFunction;
}

export interface CloudFrontBehavior {
  pathPattern: string;
  compress?: boolean;
  cachePolicyName?: string;
  originName: string;
}

export interface CloudFrontConstructProps {
  stage: Stage;
  environmentConfig: EnvironmentConfig;
  hostingBucket: IBucket;
  userFilesBucket: IBucket;
  logBucket?: IBucket;
  cdnCertificateArn?: string;
}

// ===========================
// Cognito & Auth Types
// ===========================

export interface CognitoUserPoolConfig {
  userPoolName?: string;
  userPoolClientName?: string;
  userPoolDomain?: string;
  passwordPolicy?: {
    minLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumbers?: boolean;
    requireSymbols?: boolean;
  };
  mfaConfiguration?: "OFF" | "OPTIONAL" | "REQUIRED";
  emailVerificationSubject?: string;
  emailVerificationMessage?: string;
  allowedCallbackUrls?: string[];
  accessTokenValidity?: number; // minutes
  idTokenValidity?: number; // minutes
  refreshTokenValidity?: number; // days
}

export interface CognitoIdentityPoolConfig {
  identityPoolName?: string;
  allowUnauthenticatedIdentities?: boolean;
}

export interface CognitoTriggerConfig {
  preSignup?: boolean;
  postConfirmation?: boolean;
  preTokenGeneration?: boolean;
}

export interface UserAttributes {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  [key: string]: any;
}

export interface AuthenticatedUser {
  sub: string;
  email?: string;
  name?: string;
  plan?: string;
  storageUsed?: number;
  storageLimit?: number;
  [key: string]: any;
}

export interface CognitoAuthorizerConfig {
  authorizerName?: string;
  identitySource?: string;
  resultTtlSeconds?: number;
}

export interface CognitoConstructProps {
  stage: Stage;
  environmentConfig: EnvironmentConfig;
  usersTableName: string;
  triggerFunctions?: {
    preSignup?: import("aws-cdk-lib").aws_lambda.IFunction;
    postConfirmation?: import("aws-cdk-lib").aws_lambda.IFunction;
    preTokenGeneration?: import("aws-cdk-lib").aws_lambda.IFunction;
  };
}

// ===========================
// DynamoDB Record Interfaces
// ===========================

export interface DynamoDBFileRecord {
  userId: string;
  sortKey: string; // Format: uploadTimestamp#fileId
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  s3Key: string;
  uploadTimestamp: string;
  lastAccessedAt?: string;
  downloadCount: number;
  metadata?: Record<string, string>;
  tags?: string[];
  expiresAt?: number; // Unix timestamp for TTL
}

export interface DynamoDBShareLinkRecord {
  linkId: string;
  fileId: string;
  userId: string;
  createdAt: string;
  expiresAt?: string;
  ttl?: number; // Unix timestamp for DynamoDB TTL
  maxDownloads?: number;
  currentDownloads: number;
  passwordHash?: string;
  isActive: boolean;
}

export interface DynamoDBUserRecord {
  userId: string;
  email: string;
  displayName: string;
  createdAt: string;
  lastLoginAt?: string;
  storageUsed: number;
  storageLimit: number;
  preferences?: Record<string, any>;
}

// ===========================
// DynamoDB Configuration Types
// ===========================

export interface GSIConfig {
  indexName: string;
  partitionKey: string;
  sortKey?: string;
  projectionType: "ALL" | "KEYS_ONLY" | "INCLUDE";
  nonKeyAttributes?: string[];
}

export interface DynamoDBTableConfig {
  tableName: string;
  partitionKey: string;
  sortKey?: string;
  gsis?: GSIConfig[];
  ttlAttribute?: string;
  streamEnabled?: boolean;
}

export interface TableIndexes {
  primary: { pk: string; sk?: string };
  gsi1?: { pk: string; sk?: string };
  gsi2?: { pk: string; sk?: string };
}

// ===========================
// Repository Parameter Types
// ===========================

export interface QueryOptions {
  indexName?: string;
  limit?: number;
  scanIndexForward?: boolean;
  exclusiveStartKey?: Record<string, any>;
  filterExpression?: string;
  expressionAttributeValues?: Record<string, any>;
}

export interface ListFilesParams {
  userId: string;
  limit?: number;
  sortBy?: "uploadTime" | "size" | "name";
  sortOrder?: "asc" | "desc";
  lastEvaluatedKey?: Record<string, any>;
}

export interface CreateFileParams {
  userId: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  s3Key: string;
  metadata?: Record<string, string>;
  tags?: string[];
  expiresAt?: number;
}

export interface UpdateFileParams {
  fileName?: string;
  lastAccessedAt?: string;
  downloadCount?: number;
  metadata?: Record<string, string>;
  tags?: string[];
}

export interface CreateShareLinkParams {
  linkId: string;
  fileId: string;
  userId: string;
  expiresAt?: string;
  maxDownloads?: number;
  passwordHash?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  lastEvaluatedKey?: Record<string, any>;
  count: number;
}
