import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { S3Construct } from "../lib/constructs/s3-construct";
import { getEnvironmentConfig } from "../lib/config/environments";

describe("S3Construct", () => {
  it("creates hosting and user files buckets with expected properties", () => {
    const app = new App();
    const stack = new Stack(app, "TestStack");
    const devConfig = getEnvironmentConfig("dev");

    const fileProcessorRole = new Role(stack, "FileProcessorRoleTest", {
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
    });

    new S3Construct(stack, "Storage", {
      stage: "dev",
      environmentConfig: devConfig,
      fileProcessorRole,
    });

    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::S3::Bucket", {
      BucketName: devConfig.staticSiteBucketName,
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          { ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } },
        ],
      },
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      CorsConfiguration: {
        CorsRules: [
          Match.objectEquals({
            AllowedHeaders: ["*"],
            AllowedMethods: ["GET", "HEAD"],
            AllowedOrigins: [
              `https://${devConfig.cdnDomain}`,
              `https://${devConfig.apiDomain}`,
              "http://localhost:3000",
              "https://localhost:3000",
            ],
          }),
        ],
      },
    });

    template.hasResourceProperties("AWS::S3::Bucket", {
      BucketName: devConfig.fileBucketName,
      VersioningConfiguration: { Status: "Enabled" },
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          { ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } },
        ],
      },
      CorsConfiguration: {
        CorsRules: [
          Match.objectEquals({
            AllowedHeaders: ["*"],
            AllowedMethods: ["PUT", "POST", "HEAD", "GET"],
            AllowedOrigins: [
              `https://${devConfig.cdnDomain}`,
              `https://${devConfig.apiDomain}`,
              "http://localhost:3000",
              "https://localhost:3000",
            ],
            ExposedHeaders: ["ETag"],
            MaxAge: 3600,
          }),
        ],
      },
    });

    template.hasResourceProperties("AWS::S3::BucketPolicy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: "DenyAnonymousAccess",
          }),
        ]),
      },
    });
  });
});
