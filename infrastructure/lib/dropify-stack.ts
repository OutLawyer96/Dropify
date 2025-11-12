import { Stack, Tags } from "aws-cdk-lib";
import { Construct } from "constructs";
import { DropifyStackProps } from "./types";
import { VpcConstruct } from "./constructs/vpc-construct";
import { IamConstruct } from "./constructs/iam-construct";
import { SecurityConstruct } from "./constructs/security-construct";
import { S3Construct } from "./constructs/s3-construct";
import { DynamoDBConstruct } from "./constructs/dynamodb-construct";
import { CloudFrontConstruct } from "./constructs/cloudfront-construct";

export class DropifyStack extends Stack {
  readonly network: VpcConstruct;
  readonly iam: IamConstruct;
  readonly security: SecurityConstruct;
  readonly storage: S3Construct;
  readonly database: DynamoDBConstruct;
  readonly cdn: CloudFrontConstruct;

  constructor(scope: Construct, id: string, props: DropifyStackProps) {
    super(scope, id, props);

    this.network = new VpcConstruct(this, "Network", {
      stage: props.stage,
      environmentConfig: props.environmentConfig,
    });

    this.iam = new IamConstruct(this, "Iam", {
      stage: props.stage,
      environmentConfig: props.environmentConfig,
    });

    this.security = new SecurityConstruct(this, "Security", {
      stage: props.stage,
      environmentConfig: props.environmentConfig,
      vpc: this.network.vpc,
    });

    this.storage = new S3Construct(this, "Storage", {
      stage: props.stage,
      environmentConfig: props.environmentConfig,
      fileProcessorRole: this.iam.fileProcessorRole,
    });

    this.database = new DynamoDBConstruct(this, "Database", {
      stage: props.stage,
      environmentConfig: props.environmentConfig,
    });

    this.cdn = new CloudFrontConstruct(this, "Cdn", {
      stage: props.stage,
      environmentConfig: props.environmentConfig,
      hostingBucket: this.storage.hostingBucket,
      userFilesBucket: this.storage.userFilesBucket,
      logBucket: this.storage.accessLogsBucket,
      cdnCertificateArn: props.environmentConfig.cdnCertificateArn,
    });

    Tags.of(this).add("Project", "Dropify");
    Tags.of(this).add("Environment", props.stage);

    Object.entries(props.environmentConfig.tags ?? {}).forEach(
      ([key, value]) => {
        Tags.of(this).add(key, value);
      }
    );
  }
}
