import * as path from "path";
import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
  Tags,
  aws_dynamodb as dynamodb,
  aws_apigateway as apigateway,
  aws_lambda as lambda,
  aws_lambda_nodejs as lambdaNodejs,
  aws_s3_notifications as s3n,
  aws_s3 as s3,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { EnvironmentConfig, Stage } from "./types";
import { buildAllowedOrigins } from "./config/cors";

export interface DropifyBackendStackProps extends StackProps {
  stage: Stage;
  environmentConfig: EnvironmentConfig;
}

export class DropifyBackendStack extends Stack {
  readonly hostingBucket: s3.Bucket;
  readonly uploadsBucket: s3.Bucket;
  readonly filesTable: dynamodb.Table;
  readonly shareLinksTable: dynamodb.Table;
  readonly usersTable: dynamodb.Table;
  readonly statusFunction: lambdaNodejs.NodejsFunction;
  readonly api: apigateway.RestApi;
  // Cognito-related
  // cognito construct will be stored here after creation

  constructor(scope: Construct, id: string, props: DropifyBackendStackProps) {
    super(scope, id, props);

    const { stage, environmentConfig } = props;
    const isProd = stage === "prod";

    // Generate allowed origins for CORS configuration (used by both S3 and API Gateway)
    const allowedOrigins = buildAllowedOrigins(environmentConfig, stage);

    this.hostingBucket = new s3.Bucket(this, "HostingBucket", {
      bucketName: environmentConfig.staticSiteBucketName,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      autoDeleteObjects: !isProd,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      lifecycleRules: [
        {
          id: "ExpireOldObjectVersions",
          enabled: true,
          noncurrentVersionExpiration: Duration.days(90),
        },
      ],
    });

    this.uploadsBucket = new s3.Bucket(this, "UploadsBucket", {
      bucketName: environmentConfig.fileBucketName,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      autoDeleteObjects: !isProd,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      cors: [
        {
          allowedOrigins: allowedOrigins,
          allowedMethods: [
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.HEAD,
            s3.HttpMethods.GET,
          ],
          allowedHeaders: ["*"],
          exposedHeaders: ["ETag"],
          maxAge: 3600,
        },
      ],
      lifecycleRules: [
        {
          id: "TransitionToInfrequentAccess",
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: Duration.days(30),
            },
          ],
        },
      ],
    });

    // Files Table with userId + uploadTimestamp#fileId keys and GSIs
    this.filesTable = new dynamodb.Table(this, "FilesTable", {
      tableName: environmentConfig.filesTableName,
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sortKey", type: dynamodb.AttributeType.STRING }, // uploadTimestamp#fileId
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: isProd,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      stream: environmentConfig.dynamodbConfig?.streamEnabled
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
      pointInTimeRecovery: isProd,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      stream: environmentConfig.dynamodbConfig?.streamEnabled
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
      pointInTimeRecovery: isProd,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    this.statusFunction = new lambdaNodejs.NodejsFunction(
      this,
      "StatusFunction",
      {
        functionName: `dropify-${stage}-status`,
        entry: path.join(__dirname, "..", "src", "lambda", "hello.ts"),
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_18_X,
        memorySize: 128,
        timeout: Duration.seconds(10),
        environment: {
          STAGE: stage,
          FILES_TABLE_NAME: this.filesTable.tableName,
          SHARELINKS_TABLE_NAME: this.shareLinksTable.tableName,
          USERS_TABLE_NAME: this.usersTable.tableName,
          HOSTING_BUCKET_NAME: this.hostingBucket.bucketName,
          UPLOADS_BUCKET_NAME: this.uploadsBucket.bucketName,
        },
      }
    );

    this.api = new apigateway.RestApi(this, "DropifyApi", {
      restApiName: `dropify-${stage}-api`,
      description: `Dropify public API (${stage})`,
      deployOptions: {
        stageName: "prod",
        throttlingBurstLimit: 20,
        throttlingRateLimit: 10,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: allowedOrigins,
        allowMethods: ["GET", "POST", "DELETE", "PUT", "OPTIONS"],
        allowHeaders: [
          "Authorization",
          "Content-Type",
          "X-Amz-Date",
          "X-Amz-Security-Token",
          "X-Requested-With",
        ],
        exposeHeaders: ["Content-Length", "Content-Type"],
        allowCredentials: true,
        maxAge: Duration.hours(12),
      },
    });

    const statusResource = this.api.root.addResource("status");
    statusResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(this.statusFunction)
    );

    // Grant Lambda function permissions to access DynamoDB tables
    this.filesTable.grantReadWriteData(this.statusFunction);
    this.shareLinksTable.grantReadWriteData(this.statusFunction);
    this.usersTable.grantReadWriteData(this.statusFunction);

    // Grant Lambda function permissions to access S3 buckets
    this.hostingBucket.grantRead(this.statusFunction);
    this.uploadsBucket.grantReadWrite(this.statusFunction);

    // --- Cognito trigger Lambdas ---
    const preSignupFn = new lambdaNodejs.NodejsFunction(
      this,
      "CognitoPreSignup",
      {
        functionName: `dropify-${stage}-cognito-pre-signup`,
        entry: path.join(
          __dirname,
          "..",
          "src",
          "lambda",
          "cognito-triggers",
          "pre-signup.ts"
        ),
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_18_X,
        memorySize: 128,
        timeout: Duration.seconds(10),
        environment: {
          STAGE: stage,
          USERS_TABLE_NAME: this.usersTable.tableName,
        },
      }
    );

    const postConfirmationFn = new lambdaNodejs.NodejsFunction(
      this,
      "CognitoPostConfirmation",
      {
        functionName: `dropify-${stage}-cognito-post-confirmation`,
        entry: path.join(
          __dirname,
          "..",
          "src",
          "lambda",
          "cognito-triggers",
          "post-confirmation.ts"
        ),
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_18_X,
        memorySize: 128,
        timeout: Duration.seconds(10),
        environment: {
          STAGE: stage,
          USERS_TABLE_NAME: this.usersTable.tableName,
        },
      }
    );

    const preTokenFn = new lambdaNodejs.NodejsFunction(
      this,
      "CognitoPreTokenGeneration",
      {
        functionName: `dropify-${stage}-cognito-pre-token`,
        entry: path.join(
          __dirname,
          "..",
          "src",
          "lambda",
          "cognito-triggers",
          "pre-token-generation.ts"
        ),
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_18_X,
        memorySize: 128,
        timeout: Duration.seconds(10),
        environment: {
          STAGE: stage,
          USERS_TABLE_NAME: this.usersTable.tableName,
        },
      }
    );

    // Grant trigger Lambdas access to users table
    this.usersTable.grantReadWriteData(preSignupFn);
    this.usersTable.grantReadWriteData(postConfirmationFn);
    this.usersTable.grantReadWriteData(preTokenFn);

    // Instantiate Cognito Construct and wire triggers
    // Lazy import to avoid circular type issues in types
    const { CognitoConstruct } = require("./constructs/cognito-construct");
    const cognitoConstruct = new CognitoConstruct(this, "Cognito", {
      stage,
      environmentConfig,
      usersTableName: this.usersTable.tableName,
      triggerFunctions: {
        preSignup: preSignupFn,
        postConfirmation: postConfirmationFn,
        preTokenGeneration: preTokenFn,
      },
    });

    // --- File operation Lambdas (minimal stubs) ---
    const filesCreateFn = new lambdaNodejs.NodejsFunction(this, "FilesCreate", {
      functionName: `dropify-${stage}-files-create`,
      entry: path.join(
        __dirname,
        "..",
        "src",
        "lambda",
        "files",
        "create-file.ts"
      ),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 256,
      timeout: Duration.seconds(10),
      environment: {
        STAGE: stage,
        FILES_TABLE_NAME: this.filesTable.tableName,
        UPLOADS_BUCKET_NAME: this.uploadsBucket.bucketName,
      },
    });

    const filesListFn = new lambdaNodejs.NodejsFunction(this, "FilesList", {
      functionName: `dropify-${stage}-files-list`,
      entry: path.join(
        __dirname,
        "..",
        "src",
        "lambda",
        "files",
        "list-files.ts"
      ),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 256,
      timeout: Duration.seconds(10),
      environment: {
        STAGE: stage,
        FILES_TABLE_NAME: this.filesTable.tableName,
      },
    });

    const filesGetFn = new lambdaNodejs.NodejsFunction(this, "FilesGet", {
      functionName: `dropify-${stage}-files-get`,
      entry: path.join(
        __dirname,
        "..",
        "src",
        "lambda",
        "files",
        "get-file.ts"
      ),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 256,
      timeout: Duration.seconds(10),
      environment: {
        STAGE: stage,
        FILES_TABLE_NAME: this.filesTable.tableName,
        UPLOADS_BUCKET_NAME: this.uploadsBucket.bucketName,
      },
    });

    const filesDeleteFn = new lambdaNodejs.NodejsFunction(this, "FilesDelete", {
      functionName: `dropify-${stage}-files-delete`,
      entry: path.join(
        __dirname,
        "..",
        "src",
        "lambda",
        "files",
        "delete-file.ts"
      ),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 256,
      timeout: Duration.seconds(10),
      environment: {
        STAGE: stage,
        FILES_TABLE_NAME: this.filesTable.tableName,
        UPLOADS_BUCKET_NAME: this.uploadsBucket.bucketName,
      },
    });

    const filesUpdateFn = new lambdaNodejs.NodejsFunction(this, "FilesUpdate", {
      functionName: `dropify-${stage}-files-update`,
      entry: path.join(
        __dirname,
        "..",
        "src",
        "lambda",
        "files",
        "update-file.ts"
      ),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 256,
      timeout: Duration.seconds(10),
      environment: {
        STAGE: stage,
        FILES_TABLE_NAME: this.filesTable.tableName,
      },
    });

    // Grant these lambdas permissions to tables and bucket
    this.filesTable.grantReadWriteData(filesCreateFn);
    this.filesTable.grantReadWriteData(filesListFn);
    this.filesTable.grantReadWriteData(filesGetFn);
    this.filesTable.grantReadWriteData(filesDeleteFn);
    this.filesTable.grantReadWriteData(filesUpdateFn);
    this.uploadsBucket.grantReadWrite(filesCreateFn);
    this.uploadsBucket.grantReadWrite(filesGetFn);
    this.uploadsBucket.grantReadWrite(filesDeleteFn);

    // Create a Cognito authorizer for the API methods (in-scope to avoid cross-stack validation issues)
    const fileAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      "FilesCognitoAuthorizer",
      {
        cognitoUserPools: [cognitoConstruct.userPool],
      }
    );

    // Create /files resource and methods protected by Cognito
    const filesResource = this.api.root.addResource("files");
    filesResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(filesCreateFn),
      {
        authorizer: fileAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );
    filesResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(filesListFn),
      {
        authorizer: fileAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    const fileIdResource = filesResource.addResource("{fileId}");
    fileIdResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(filesGetFn),
      {
        authorizer: fileAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );
    fileIdResource.addMethod(
      "DELETE",
      new apigateway.LambdaIntegration(filesDeleteFn),
      {
        authorizer: fileAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );
    fileIdResource.addMethod(
      "PUT",
      new apigateway.LambdaIntegration(filesUpdateFn),
      {
        authorizer: fileAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // --- Initiate upload endpoint (presign) ---
    const initiateFn = new lambdaNodejs.NodejsFunction(this, "FilesInitiate", {
      functionName: `dropify-${stage}-files-initiate`,
      entry: path.join(
        __dirname,
        "..",
        "src",
        "lambda",
        "files",
        "initiate-upload.ts"
      ),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 256,
      timeout: Duration.seconds(10),
      environment: {
        STAGE: stage,
        UPLOADS_BUCKET_NAME: this.uploadsBucket.bucketName,
        FILES_TABLE_NAME: this.filesTable.tableName,
        USERS_TABLE_NAME: this.usersTable.tableName,
      },
    });

    this.uploadsBucket.grantPut(initiateFn);
    this.usersTable.grantReadData(initiateFn);

    filesResource
      .addResource("initiate")
      .addMethod("POST", new apigateway.LambdaIntegration(initiateFn), {
        authorizer: fileAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      });

    // --- Finalize upload: S3 event -> Lambda ---
    const finalizeFn = new lambdaNodejs.NodejsFunction(this, "FilesFinalize", {
      functionName: `dropify-${stage}-files-finalize`,
      entry: path.join(
        __dirname,
        "..",
        "src",
        "lambda",
        "files",
        "finalize-upload.ts"
      ),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 256,
      timeout: Duration.seconds(20),
      environment: {
        STAGE: stage,
        FILES_TABLE_NAME: this.filesTable.tableName,
        USERS_TABLE_NAME: this.usersTable.tableName,
      },
    });

    // Grant permissions for finalize lambda to read object metadata and write to DynamoDB
    this.uploadsBucket.grantRead(finalizeFn);
    this.filesTable.grantReadWriteData(finalizeFn);
    this.usersTable.grantReadWriteData(finalizeFn);

    // Add S3 event notification (ObjectCreated) to invoke finalize lambda
    this.uploadsBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(finalizeFn)
    );

    // --- Share operation Lambdas ---
    const shareCreateFn = new lambdaNodejs.NodejsFunction(this, "ShareCreate", {
      functionName: `dropify-${stage}-share-create`,
      entry: path.join(
        __dirname,
        "..",
        "src",
        "lambda",
        "share",
        "create-share.ts"
      ),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 256,
      timeout: Duration.seconds(10),
      environment: {
        STAGE: stage,
        FILES_TABLE_NAME: this.filesTable.tableName,
        SHARELINKS_TABLE_NAME: this.shareLinksTable.tableName,
      },
    });

    const shareListFn = new lambdaNodejs.NodejsFunction(this, "ShareList", {
      functionName: `dropify-${stage}-share-list`,
      entry: path.join(
        __dirname,
        "..",
        "src",
        "lambda",
        "share",
        "list-shares.ts"
      ),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 256,
      timeout: Duration.seconds(10),
      environment: {
        STAGE: stage,
        SHARELINKS_TABLE_NAME: this.shareLinksTable.tableName,
      },
    });

    const shareGetFn = new lambdaNodejs.NodejsFunction(this, "ShareGet", {
      functionName: `dropify-${stage}-share-get`,
      entry: path.join(
        __dirname,
        "..",
        "src",
        "lambda",
        "share",
        "get-share.ts"
      ),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 256,
      timeout: Duration.seconds(10),
      environment: {
        STAGE: stage,
        FILES_TABLE_NAME: this.filesTable.tableName,
        SHARELINKS_TABLE_NAME: this.shareLinksTable.tableName,
        UPLOADS_BUCKET_NAME: this.uploadsBucket.bucketName,
      },
    });

    const shareDeleteFn = new lambdaNodejs.NodejsFunction(this, "ShareDelete", {
      functionName: `dropify-${stage}-share-delete`,
      entry: path.join(
        __dirname,
        "..",
        "src",
        "lambda",
        "share",
        "delete-share.ts"
      ),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 256,
      timeout: Duration.seconds(10),
      environment: {
        STAGE: stage,
        SHARELINKS_TABLE_NAME: this.shareLinksTable.tableName,
      },
    });

    const shareAnalyticsFn = new lambdaNodejs.NodejsFunction(
      this,
      "ShareAnalytics",
      {
        functionName: `dropify-${stage}-share-analytics`,
        entry: path.join(
          __dirname,
          "..",
          "src",
          "lambda",
          "share",
          "get-analytics.ts"
        ),
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_18_X,
        memorySize: 256,
        timeout: Duration.seconds(10),
        environment: {
          STAGE: stage,
          SHARELINKS_TABLE_NAME: this.shareLinksTable.tableName,
        },
      }
    );

    // Grant share lambdas permissions to tables and bucket
    this.filesTable.grantReadData(shareCreateFn);
    this.shareLinksTable.grantReadWriteData(shareCreateFn);

    this.shareLinksTable.grantReadData(shareListFn);

    this.filesTable.grantReadData(shareGetFn);
    this.shareLinksTable.grantReadWriteData(shareGetFn);
    this.uploadsBucket.grantRead(shareGetFn);

    this.shareLinksTable.grantReadWriteData(shareDeleteFn);

    this.shareLinksTable.grantReadData(shareAnalyticsFn);

    // Create /share resource and methods
    const shareResource = this.api.root.addResource("share");

    // POST /share - Create share link (requires auth)
    shareResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(shareCreateFn),
      {
        authorizer: fileAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // GET /share/{shareId} - Access share link (public, no auth required)
    const shareIdResource = shareResource.addResource("{shareId}");
    shareIdResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(shareGetFn)
    );

    // DELETE /share/{shareId} - Delete share link (requires auth)
    shareIdResource.addMethod(
      "DELETE",
      new apigateway.LambdaIntegration(shareDeleteFn),
      {
        authorizer: fileAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // GET /share/list/{fileId} - List share links for a file (requires auth)
    const shareListResource = shareResource.addResource("list");
    const shareListFileIdResource = shareListResource.addResource("{fileId}");
    shareListFileIdResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(shareListFn),
      {
        authorizer: fileAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // GET /share/analytics/{shareId} - Get analytics for a share link (requires auth)
    const shareAnalyticsResource = shareResource.addResource("analytics");
    const shareAnalyticsIdResource =
      shareAnalyticsResource.addResource("{shareId}");
    shareAnalyticsIdResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(shareAnalyticsFn),
      {
        authorizer: fileAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // Note: Cognito authorizers will be created/attached per-API method where needed.
    // We intentionally do not create a global authorizer here to avoid validation errors
    // when methods/resources are created in separate stacks or constructs.

    Tags.of(this).add("Project", "Dropify");
    Tags.of(this).add("Environment", stage);

    new CfnOutput(this, "HostingBucketName", {
      value: this.hostingBucket.bucketName,
      exportName: `dropify-${stage}-hosting-bucket`,
    });

    new CfnOutput(this, "UploadsBucketName", {
      value: this.uploadsBucket.bucketName,
      exportName: `dropify-${stage}-uploads-bucket`,
    });

    new CfnOutput(this, "FilesTableName", {
      value: this.filesTable.tableName,
      exportName: `dropify-${stage}-files-table`,
    });

    new CfnOutput(this, "ShareLinksTableName", {
      value: this.shareLinksTable.tableName,
      exportName: `dropify-${stage}-sharelinks-table`,
    });

    new CfnOutput(this, "UsersTableName", {
      value: this.usersTable.tableName,
      exportName: `dropify-${stage}-users-table`,
    });

    new CfnOutput(this, "ApiUrl", {
      value: this.api.url,
      exportName: `dropify-${stage}-api-url`,
    });
  }
}
