import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { CloudFrontConstruct } from "../lib/constructs/cloudfront-construct";
import { getEnvironmentConfig } from "../lib/config/environments";

describe("CloudFrontConstruct", () => {
  it("creates distribution with expected behaviors and origins", () => {
    const app = new App();
    const stack = new Stack(app, "CloudFrontTestStack");
    const devConfig = getEnvironmentConfig("dev");

    const hostingBucket = new Bucket(stack, "HostingBucket", {
      bucketName: "test-hosting-bucket",
    });

    const filesBucket = new Bucket(stack, "FilesBucket", {
      bucketName: "test-files-bucket",
    });

    new CloudFrontConstruct(stack, "Cdn", {
      stage: "dev",
      environmentConfig: devConfig,
      hostingBucket,
      userFilesBucket: filesBucket,
      cdnCertificateArn: "arn:aws:acm:us-east-1:123456789012:certificate/test",
    });

    const template = Template.fromStack(stack);

    template.resourceCountIs("AWS::CloudFront::Distribution", 1);

    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        Aliases: Match.arrayWith([devConfig.cdnDomain]),
        DefaultCacheBehavior: Match.objectLike({
          ViewerProtocolPolicy: "redirect-to-https",
        }),
        CacheBehaviors: Match.arrayWith([
          Match.objectLike({
            PathPattern: "files/*",
          }),
        ]),
        Origins: Match.arrayWith([
          Match.objectLike({
            Id: "hosting-origin",
            OriginAccessControlId: Match.anyValue(),
          }),
          Match.objectLike({
            Id: "files-origin",
            OriginAccessControlId: Match.anyValue(),
          }),
        ]),
        ViewerCertificate: Match.objectLike({
          MinimumProtocolVersion: "TLSv1.2_2021",
        }),
      }),
    });

    template.resourceCountIs("AWS::S3::BucketPolicy", 2);
  });
});
