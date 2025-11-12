import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvironmentConfig, Stage } from '../types';

export interface SecurityConstructProps {
  stage: Stage;
  environmentConfig: EnvironmentConfig;
  vpc: ec2.IVpc;
}

export class SecurityConstruct extends Construct {
  readonly lambdaSecurityGroup: ec2.SecurityGroup;
  readonly endpointSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: SecurityConstructProps) {
    super(scope, id);

    this.lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: props.vpc,
      securityGroupName: `dropify-${props.stage}-lambda-sg`,
      description: 'Security group for Dropify Lambda functions',
      allowAllOutbound: true
    });

    this.endpointSecurityGroup = new ec2.SecurityGroup(this, 'EndpointSecurityGroup', {
      vpc: props.vpc,
      securityGroupName: `dropify-${props.stage}-endpoint-sg`,
      description: 'Security group for VPC endpoints',
      allowAllOutbound: true
    });

    this.lambdaSecurityGroup.addIngressRule(this.endpointSecurityGroup, ec2.Port.tcp(443), 'Allow HTTPS from endpoints');
    this.lambdaSecurityGroup.addIngressRule(ec2.Peer.ipv4(props.vpc.vpcCidrBlock), ec2.Port.tcp(443), 'Allow HTTPS from VPC');
  }
}
