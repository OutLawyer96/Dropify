import {
  CfnOutput,
  RemovalPolicy,
  Tags,
  aws_dynamodb as dynamodb,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { EnvironmentConfig, Stage } from "../types";

export interface DynamoDBConstructProps {
  stage: Stage;
  environmentConfig: EnvironmentConfig;
}

export class DynamoDBConstruct extends Construct {
  readonly filesTable: dynamodb.Table;
  readonly shareLinksTable: dynamodb.Table;
  readonly usersTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DynamoDBConstructProps) {
    super(scope, id);

    const { stage, environmentConfig } = props;
    const isProd = stage === "prod";
    const dynamoConfig = environmentConfig.dynamodbConfig || {
      billingMode: "PAY_PER_REQUEST" as const,
      pointInTimeRecovery: false,
      encryption: true,
    };

    // Files Table with optimized access patterns
    this.filesTable = new dynamodb.Table(this, "FilesTable", {
      tableName: environmentConfig.filesTableName,
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sortKey", type: dynamodb.AttributeType.STRING }, // uploadTimestamp#fileId
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: dynamoConfig.pointInTimeRecovery || isProd,
      encryption: dynamoConfig.encryption
        ? dynamodb.TableEncryption.AWS_MANAGED
        : undefined,
      stream: dynamoConfig.streamEnabled
        ? dynamodb.StreamViewType.NEW_AND_OLD_IMAGES
        : undefined,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      timeToLiveAttribute: "expiresAt",
    });

    // GSI1: Direct file lookup by fileId
    this.filesTable.addGlobalSecondaryIndex({
      indexName: "fileIdIndex",
      partitionKey: { name: "fileId", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI2: Sort files by size
    this.filesTable.addGlobalSecondaryIndex({
      indexName: "userFileSizeIndex",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "fileSize", type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ShareLinks Table with TTL support
    this.shareLinksTable = new dynamodb.Table(this, "ShareLinksTable", {
      tableName: environmentConfig.shareLinksTableName,
      partitionKey: { name: "linkId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: dynamoConfig.pointInTimeRecovery || isProd,
      encryption: dynamoConfig.encryption
        ? dynamodb.TableEncryption.AWS_MANAGED
        : undefined,
      stream: dynamoConfig.streamEnabled
        ? dynamodb.StreamViewType.NEW_AND_OLD_IMAGES
        : undefined,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      timeToLiveAttribute: "ttl",
    });

    // GSI1: List share links by file
    this.shareLinksTable.addGlobalSecondaryIndex({
      indexName: "fileIdIndex",
      partitionKey: { name: "fileId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Users Table - simple key-value store
    this.usersTable = new dynamodb.Table(this, "UsersTable", {
      tableName: environmentConfig.usersTableName,
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: dynamoConfig.pointInTimeRecovery || isProd,
      encryption: dynamoConfig.encryption
        ? dynamodb.TableEncryption.AWS_MANAGED
        : undefined,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // Tagging
    Tags.of(this).add("Project", "Dropify");
    Tags.of(this).add("Environment", stage);

    // Outputs
    new CfnOutput(this, "FilesTableName", {
      value: this.filesTable.tableName,
      exportName: `dropify-${stage}-files-table-name`,
    });

    new CfnOutput(this, "FilesTableArn", {
      value: this.filesTable.tableArn,
      exportName: `dropify-${stage}-files-table-arn`,
    });

    new CfnOutput(this, "ShareLinksTableName", {
      value: this.shareLinksTable.tableName,
      exportName: `dropify-${stage}-sharelinks-table-name`,
    });

    new CfnOutput(this, "ShareLinksTableArn", {
      value: this.shareLinksTable.tableArn,
      exportName: `dropify-${stage}-sharelinks-table-arn`,
    });

    new CfnOutput(this, "UsersTableName", {
      value: this.usersTable.tableName,
      exportName: `dropify-${stage}-users-table-name`,
    });

    new CfnOutput(this, "UsersTableArn", {
      value: this.usersTable.tableArn,
      exportName: `dropify-${stage}-users-table-arn`,
    });
  }
}
