#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { DropifyStack } from '../lib/dropify-stack';
import { environments } from '../lib/config/environments';
import { EnvironmentConfig, Stage } from '../lib/types';
import { DropifyBackendStack } from '../lib/dropify-backend-stack';

const app = new App();

for (const stage of Object.keys(environments) as Stage[]) {
  const config = environments[stage];
  if (!config) {
    continue;
  }

  new DropifyStack(app, `dropify-${stage}`, {
    env: {
      account: config.account,
      region: config.region
    },
    description: `Dropify core infrastructure (${stage})`,
    stage,
    environmentConfig: config,
    tags: {
      Project: 'Dropify',
      Environment: stage,
      ManagedBy: 'AWS CDK'
    }
  });

  new DropifyBackendStack(app, `dropify-backend-${stage}`, {
    env: {
      account: config.account,
      region: config.region
    },
    description: `Dropify backend API resources (${stage})`,
    stage,
    environmentConfig: config,
    tags: {
      Project: 'Dropify',
      Environment: stage,
      ManagedBy: 'AWS CDK'
    }
  });
}
