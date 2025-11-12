import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { DropifyStack } from "../lib/dropify-stack";
import { getEnvironmentConfig } from "../lib/config/environments";

describe("DropifyStack", () => {
  it("synthesises with baseline resources", () => {
    const app = new App();
    const devConfig = getEnvironmentConfig("dev");
    const stack = new DropifyStack(app, "dropify-dev-test", {
      env: { account: "000000000000", region: "us-east-1" },
      stage: "dev",
      environmentConfig: devConfig,
    });

    const template = Template.fromStack(stack);

    template.resourceCountIs("AWS::EC2::VPC", 1);
    template.hasResourceProperties("AWS::IAM::Role", {
      RoleName: "dropify-dev-lambda-role",
    });

    template.hasResourceProperties("AWS::S3::Bucket", {
      BucketName: devConfig.staticSiteBucketName,
    });

    template.resourceCountIs("AWS::CloudFront::Distribution", 1);
  });
});
