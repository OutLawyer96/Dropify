import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Stage } from '../types';

export interface VpcConstructProps {
  stage: Stage;
}

export class VpcConstruct extends Construct {
  readonly vpc: ec2.Vpc;
  readonly gatewayEndpoints: Record<string, ec2.GatewayVpcEndpoint> = {};
  readonly interfaceEndpoints: Record<string, ec2.InterfaceVpcEndpoint> = {};

  constructor(scope: Construct, id: string, props: VpcConstructProps) {
    super(scope, id);

    const isProd = props.stage === 'prod';

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `dropify-${props.stage}-vpc`,
      maxAzs: isProd ? 3 : 2,
      natGateways: isProd ? 2 : 1,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24
        },
        {
          name: 'PrivateApp',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24
        },
        {
          name: 'PrivateData',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24
        }
      ]
    });

    this.gatewayEndpoints.s3 = this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      subnets: [{ subnets: this.vpc.privateSubnets }]
    });

    this.interfaceEndpoints.secretsManager = this.vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      subnets: {
        subnets: this.vpc.privateSubnets
      }
    });

    this.interfaceEndpoints.logs = this.vpc.addInterfaceEndpoint('CloudWatchLogsEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      subnets: {
        subnets: this.vpc.privateSubnets
      }
    });

    this.interfaceEndpoints.lambda = this.vpc.addInterfaceEndpoint('LambdaEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.LAMBDA,
      subnets: {
        subnets: this.vpc.privateSubnets
      }
    });
  }
}
