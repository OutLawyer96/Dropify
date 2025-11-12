import { Arn, Stack, aws_iam as iam } from "aws-cdk-lib";
import { Construct } from "constructs";
import { EnvironmentConfig, Stage } from "../types";

export interface IamConstructProps {
  stage: Stage;
  environmentConfig: EnvironmentConfig;
}

export class IamConstruct extends Construct {
  readonly lambdaExecutionRole: iam.Role;
  readonly apiGatewayRole: iam.Role;
  readonly fileProcessorRole: iam.Role;
  readonly cloudfrontDeploymentRole: iam.Role;
  readonly cognitoTriggerRole?: iam.Role;
  // Identity pool roles are created by CognitoConstruct; only trigger role lives here

  constructor(scope: Construct, id: string, props: IamConstructProps) {
    super(scope, id);

    this.lambdaExecutionRole = new iam.Role(this, "LambdaExecutionRole", {
      roleName: `dropify-${props.stage}-lambda-role`,
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      description: "Execution role for Dropify Lambda functions",
    });

    this.lambdaExecutionRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AWSLambdaBasicExecutionRole"
      )
    );

    const stack = Stack.of(this);
    const bucketArn = Arn.format(
      {
        service: "s3",
        resource: props.environmentConfig.fileBucketName,
      },
      stack
    );
    const bucketObjectsArn = `${bucketArn}/*`;

    // DynamoDB Table ARNs for all three tables
    const filesTableArn = Arn.format(
      {
        service: "dynamodb",
        resource: "table",
        resourceName: props.environmentConfig.filesTableName,
        account: props.environmentConfig.account,
        region: props.environmentConfig.region,
      },
      stack
    );

    const shareLinksTableArn = Arn.format(
      {
        service: "dynamodb",
        resource: "table",
        resourceName: props.environmentConfig.shareLinksTableName,
        account: props.environmentConfig.account,
        region: props.environmentConfig.region,
      },
      stack
    );

    const usersTableArn = Arn.format(
      {
        service: "dynamodb",
        resource: "table",
        resourceName: props.environmentConfig.usersTableName,
        account: props.environmentConfig.account,
        region: props.environmentConfig.region,
      },
      stack
    );

    // S3 Permissions
    this.lambdaExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "S3FileAccess",
        actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
        resources: [bucketObjectsArn],
      })
    );

    this.lambdaExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "S3ListBucket",
        actions: ["s3:ListBucket"],
        resources: [bucketArn],
      })
    );

    // DynamoDB Permissions - Files Table with GSI access
    this.lambdaExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "DynamoDbFilesAccess",
        actions: [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
        ],
        resources: [
          filesTableArn,
          `${filesTableArn}/index/*`, // Include GSI access
        ],
      })
    );

    // DynamoDB Permissions - ShareLinks Table with GSI access
    this.lambdaExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "DynamoDbShareLinksAccess",
        actions: [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
        ],
        resources: [
          shareLinksTableArn,
          `${shareLinksTableArn}/index/*`, // Include GSI access
        ],
      })
    );

    // DynamoDB Permissions - Users Table
    this.lambdaExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "DynamoDbUsersAccess",
        actions: [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
        ],
        resources: [usersTableArn],
      })
    );

    // Cognito trigger role - for Lambda triggers that operate on the users table
    this.cognitoTriggerRole = new iam.Role(this, "CognitoTriggerRole", {
      roleName: `dropify-${props.stage}-cognito-trigger-role`,
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      description:
        "Role for Cognito trigger Lambdas with access to Users table",
    });

    this.cognitoTriggerRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AWSLambdaBasicExecutionRole"
      )
    );

    this.cognitoTriggerRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "CognitoTriggerDynamoDbUsersAccess",
        actions: [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
        ],
        resources: [usersTableArn],
      })
    );

    const hostingBucketArn = Arn.format(
      {
        service: "s3",
        resource: props.environmentConfig.staticSiteBucketName,
      },
      stack
    );

    const hostingBucketObjectsArn = `${hostingBucketArn}/*`;

    this.fileProcessorRole = new iam.Role(this, "FileProcessorRole", {
      roleName: `dropify-${props.stage}-file-processor-role`,
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      description: "Lambda role for processing file uploads",
    });

    this.fileProcessorRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AWSLambdaBasicExecutionRole"
      )
    );

    this.fileProcessorRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "UserFilesBucketAccess",
        actions: [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
        ],
        resources: [bucketArn, bucketObjectsArn],
      })
    );

    this.fileProcessorRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "UserFilesObjectAcl",
        actions: ["s3:PutObjectAcl"],
        resources: [bucketObjectsArn],
      })
    );

    this.cloudfrontDeploymentRole = new iam.Role(
      this,
      "CloudFrontDeploymentRole",
      {
        roleName: `dropify-${props.stage}-deployment-role`,
        assumedBy: new iam.ServicePrincipal("codebuild.amazonaws.com"),
        description:
          "Deployment role for uploading site assets and invalidating CloudFront",
      }
    );

    this.cloudfrontDeploymentRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("CloudWatchLogsFullAccess")
    );

    this.cloudfrontDeploymentRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "DeployStaticAssets",
        actions: ["s3:PutObject", "s3:PutObjectAcl", "s3:DeleteObject"],
        resources: [hostingBucketObjectsArn],
      })
    );

    this.cloudfrontDeploymentRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "ListHostingBucket",
        actions: ["s3:ListBucket"],
        resources: [hostingBucketArn],
      })
    );

    this.cloudfrontDeploymentRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "InvalidateDistribution",
        actions: ["cloudfront:CreateInvalidation"],
        resources: ["*"],
      })
    );

    this.apiGatewayRole = new iam.Role(this, "ApiGatewayRole", {
      roleName: `dropify-${props.stage}-apigw-role`,
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      description: "Service role for API Gateway integrations",
    });

    this.apiGatewayRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["lambda:InvokeFunction"],
        resources: ["*"],
      })
    );

    // No identity-pool roles here — they are created in the Cognito construct to
    // ensure the identity pool ARN and role attachments are owned in one place.
  }
}
