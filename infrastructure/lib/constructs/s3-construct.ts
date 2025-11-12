import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  Tags,
  aws_iam as iam,
  aws_s3 as s3,
  aws_s3_notifications as s3n,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { buildAllowedOrigins } from "../config/cors";
import { S3ConstructProps } from "../types";

export class S3Construct extends Construct {
  readonly hostingBucket: s3.Bucket;
  readonly userFilesBucket: s3.Bucket;
  readonly accessLogsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: S3ConstructProps) {
    super(scope, id);

    const allowedOrigins = buildAllowedOrigins(
      props.environmentConfig,
      props.stage
    );

    this.accessLogsBucket = new s3.Bucket(this, "AccessLogsBucket", {
      bucketName: `dropify-${props.stage}-access-logs`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: "ExpireLogs",
          enabled: true,
          expiration: Duration.days(90),
        },
      ],
    });

    this.hostingBucket = new s3.Bucket(this, "HostingBucket", {
      bucketName: props.environmentConfig.staticSiteBucketName,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
      versioned: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins,
          allowedHeaders: ["*"],
        },
      ],
      serverAccessLogsBucket: this.accessLogsBucket,
      serverAccessLogsPrefix: "hosting/",
      autoDeleteObjects: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    this.userFilesBucket = new s3.Bucket(this, "UserFilesBucket", {
      bucketName: props.environmentConfig.fileBucketName,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      enforceSSL: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: "TransitionToInfrequentAccess",
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER_INSTANT_RETRIEVAL,
              transitionAfter: Duration.days(180),
            },
          ],
        },
      ],
      cors: [
        {
          allowedOrigins,
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
      serverAccessLogsBucket: this.accessLogsBucket,
      serverAccessLogsPrefix: "files/",
    });

    Tags.of(this.hostingBucket).add("Project", "Dropify");
    Tags.of(this.userFilesBucket).add("Project", "Dropify");
    Tags.of(this.hostingBucket).add("Environment", props.stage);
    Tags.of(this.userFilesBucket).add("Environment", props.stage);

    this.hostingBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowCloudFrontAccess",
        principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
        actions: ["s3:GetObject"],
        resources: [`${this.hostingBucket.bucketArn}/*`],
        conditions: {
          StringEquals: {
            "AWS:SourceAccount": Stack.of(this).account,
          },
        },
      })
    );

    this.userFilesBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "DenyAnonymousAccess",
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
        resources: [`${this.userFilesBucket.bucketArn}/*`],
        conditions: {
          StringEquals: {
            "aws:PrincipalType": "Anonymous",
          },
        },
      })
    );

    if (props.fileProcessorRole) {
      this.userFilesBucket.grantReadWrite(props.fileProcessorRole);
      this.userFilesBucket.grantPutAcl(props.fileProcessorRole);
    }

    if (props.fileProcessorFunction) {
      this.userFilesBucket.addEventNotification(
        s3.EventType.OBJECT_CREATED_PUT,
        new s3n.LambdaDestination(props.fileProcessorFunction)
      );
    }

    new CfnOutput(this, "HostingBucketName", {
      value: this.hostingBucket.bucketName,
      exportName: `dropify-${props.stage}-hosting-bucket`,
    });

    new CfnOutput(this, "UserFilesBucketName", {
      value: this.userFilesBucket.bucketName,
      exportName: `dropify-${props.stage}-files-bucket`,
    });

    new CfnOutput(this, "AccessLogsBucketName", {
      value: this.accessLogsBucket.bucketName,
      exportName: `dropify-${props.stage}-logs-bucket`,
    });
  }
}
