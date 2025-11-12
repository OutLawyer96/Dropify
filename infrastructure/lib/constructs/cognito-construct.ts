import { CfnOutput, Tags, aws_cognito as cognito, aws_iam as iam } from "aws-cdk-lib";
import { Construct } from "constructs";
import { CognitoConstructProps } from "../types";
import type { IFunction } from "aws-cdk-lib/aws-lambda";

export class CognitoConstruct extends Construct {
  readonly userPool: cognito.UserPool;
  readonly userPoolClient: cognito.UserPoolClient;
  readonly userPoolDomain?: cognito.UserPoolDomain;
  readonly identityPool?: cognito.CfnIdentityPool;
  readonly cognitoAuthenticatedRole?: iam.Role;
  readonly cognitoUnauthenticatedRole?: iam.Role;

  constructor(
    scope: Construct,
    id: string,
    props: CognitoConstructProps & {
      triggerFunctions?: {
        preSignup?: IFunction;
        postConfirmation?: IFunction;
        preTokenGeneration?: IFunction;
      };
    }
  ) {
    super(scope, id);

    const cfg = props.environmentConfig.cognitoConfig ?? {};

    // Build lambda triggers if provided
    const lambdaTriggers: cognito.UserPoolTriggers | undefined = (():
      | cognito.UserPoolTriggers
      | undefined => {
      if (!props.triggerFunctions) return undefined;
      const lt: Partial<cognito.UserPoolTriggers> = {};
      if (props.triggerFunctions.preSignup)
        lt.preSignUp = props.triggerFunctions.preSignup;
      if (props.triggerFunctions.postConfirmation)
        lt.postConfirmation = props.triggerFunctions.postConfirmation;
      if (props.triggerFunctions.preTokenGeneration)
        lt.preTokenGeneration = props.triggerFunctions.preTokenGeneration;
      return Object.keys(lt).length > 0
        ? (lt as cognito.UserPoolTriggers)
        : undefined;
    })();

    this.userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: cfg.userPoolName ?? `${props.stage}-dropify-users`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      lambdaTriggers: lambdaTriggers,
      passwordPolicy: {
        minLength: cfg.passwordPolicy?.minLength ?? 8,
        requireLowercase: cfg.passwordPolicy?.requireLowercase ?? true,
        requireUppercase: cfg.passwordPolicy?.requireUppercase ?? false,
        requireDigits: cfg.passwordPolicy?.requireNumbers ?? false,
        requireSymbols: cfg.passwordPolicy?.requireSymbols ?? false,
      },
      mfa:
        cfg.mfaConfiguration === "REQUIRED"
          ? cognito.Mfa.REQUIRED
          : cfg.mfaConfiguration === "OPTIONAL"
          ? cognito.Mfa.OPTIONAL
          : cognito.Mfa.OFF,
    });

    // User Pool Client
    this.userPoolClient = new cognito.UserPoolClient(this, "UserPoolClient", {
      userPool: this.userPool,
      generateSecret: false,
      userPoolClientName:
        cfg.userPoolClientName ?? `${props.stage}-dropify-client`,
      authFlows: { userPassword: true, userSrp: true },
      oAuth: {
        flows: { authorizationCodeGrant: true, implicitCodeGrant: true },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: cfg.allowedCallbackUrls ?? ["http://localhost:3000"],
      },
    });

    if (cfg.userPoolDomain) {
      this.userPoolDomain = new cognito.UserPoolDomain(this, "UserPoolDomain", {
        userPool: this.userPool,
        cognitoDomain: { domainPrefix: cfg.userPoolDomain },
      });
    }

    // Identity Pool (Cognito Identity)
    const identityPool = new cognito.CfnIdentityPool(this, "IdentityPool", {
      identityPoolName:
        cfg.identityPoolName ?? `${props.stage}-dropify-identity`,
      allowUnauthenticatedIdentities:
        cfg.allowUnauthenticatedIdentities ?? true,
      cognitoIdentityProviders: [
        {
          clientId: this.userPoolClient.userPoolClientId,
          providerName: this.userPool.userPoolProviderName,
        },
      ],
    });

    this.identityPool = identityPool;

    // Create IAM roles for authenticated and unauthenticated users and attach to identity pool
    this.cognitoAuthenticatedRole = new iam.Role(this, "CognitoAuthRole", {
      assumedBy: new iam.FederatedPrincipal(
        "cognito-identity.amazonaws.com",
        {
          StringEquals: {
            "cognito-identity.amazonaws.com:aud": identityPool.ref,
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "authenticated",
          },
        },
        "sts:AssumeRoleWithWebIdentity"
      ),
      description: "Role for authenticated Cognito users",
    });

    this.cognitoUnauthenticatedRole = new iam.Role(this, "CognitoUnauthRole", {
      assumedBy: new iam.FederatedPrincipal(
        "cognito-identity.amazonaws.com",
        {
          StringEquals: {
            "cognito-identity.amazonaws.com:aud": identityPool.ref,
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "unauthenticated",
          },
        },
        "sts:AssumeRoleWithWebIdentity"
      ),
      description: "Role for unauthenticated Cognito users",
    });

    // Attach role mappings via CfnIdentityPoolRoleAttachment
    new cognito.CfnIdentityPoolRoleAttachment(
      this,
      "IdentityPoolRoleAttachment",
      {
        identityPoolId: identityPool.ref,
        roles: {
          authenticated: this.cognitoAuthenticatedRole.roleArn,
          unauthenticated: this.cognitoUnauthenticatedRole.roleArn,
        },
      }
    );

    // Outputs
    new CfnOutput(this, "UserPoolId", {
      value: this.userPool.userPoolId,
      exportName: `dropify-${props.stage}-userpool-id`,
    });
    new CfnOutput(this, "UserPoolArn", {
      value: this.userPool.userPoolArn,
      exportName: `dropify-${props.stage}-userpool-arn`,
    });
    new CfnOutput(this, "UserPoolClientId", {
      value: this.userPoolClient.userPoolClientId,
      exportName: `dropify-${props.stage}-userpool-client-id`,
    });
    new CfnOutput(this, "IdentityPoolId", {
      value: identityPool.ref,
      exportName: `dropify-${props.stage}-identity-pool-id`,
    });
    if (this.userPoolDomain)
      new CfnOutput(this, "UserPoolDomainOutput", {
        value: cfg.userPoolDomain || "",
        exportName: `dropify-${props.stage}-userpool-domain`,
      });

    Tags.of(this).add("Project", "Dropify");
    Tags.of(this).add("Environment", props.stage);
  }
}
