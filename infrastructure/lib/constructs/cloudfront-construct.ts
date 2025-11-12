import {
  Annotations,
  CfnOutput,
  Duration,
  Tags,
  aws_certificatemanager as acm,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CloudFrontConstructProps } from '../types';

export class CloudFrontConstruct extends Construct {
  readonly distribution: cloudfront.Distribution;
  readonly securityHeadersPolicy: cloudfront.ResponseHeadersPolicy;
  readonly defaultCachePolicy: cloudfront.CachePolicy;
  readonly apiCachePolicy: cloudfront.CachePolicy;
  readonly filesCachePolicy: cloudfront.CachePolicy;

  constructor(scope: Construct, id: string, props: CloudFrontConstructProps) {
    super(scope, id);

    this.securityHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
      responseHeadersPolicyName: `dropify-${props.stage}-security-headers`,
      comment: 'Security headers for Dropify distribution',
      securityHeadersBehavior: {
        contentSecurityPolicy: {
          contentSecurityPolicy: "default-src 'self' https: data: blob:; connect-src 'self' https:; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:",
          override: true
        },
        strictTransportSecurity: {
          accessControlMaxAge: Duration.days(365 * 2),
          includeSubdomains: true,
          preload: true,
          override: true
        },
        xssProtection: { protection: true, modeBlock: true, override: true },
        referrerPolicy: { referrerPolicy: cloudfront.HeadersReferrerPolicy.NO_REFERRER_WHEN_DOWNGRADE, override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        contentTypeOptions: { override: true }
      }
    });

    this.defaultCachePolicy = new cloudfront.CachePolicy(this, 'DefaultCachePolicy', {
      cachePolicyName: `dropify-${props.stage}-static-cache`,
      defaultTtl: Duration.days(7),
      minTtl: Duration.minutes(5),
      maxTtl: Duration.days(365),
      enableAcceptEncodingBrotli: true,
      enableAcceptEncodingGzip: true
    });

    this.filesCachePolicy = new cloudfront.CachePolicy(this, 'FilesCachePolicy', {
      cachePolicyName: `dropify-${props.stage}-files-cache`,
      defaultTtl: Duration.minutes(15),
      minTtl: Duration.minutes(1),
      maxTtl: Duration.days(7),
      enableAcceptEncodingBrotli: true,
      enableAcceptEncodingGzip: true,
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Authorization'),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all()
    });

    this.apiCachePolicy = new cloudfront.CachePolicy(this, 'ApiCachePolicy', {
      cachePolicyName: `dropify-${props.stage}-api-cache`,
      defaultTtl: Duration.seconds(0),
      minTtl: Duration.seconds(0),
      maxTtl: Duration.seconds(0),
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Authorization', 'Content-Type'),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
      enableAcceptEncodingBrotli: true,
      enableAcceptEncodingGzip: true
    });

    const hostingOac = new cloudfront.S3OriginAccessControl(this, 'HostingOac', {
      originAccessControlName: `dropify-${props.stage}-hosting-oac`,
      description: 'Origin access control for Dropify static assets'
    });

    const filesOac = new cloudfront.S3OriginAccessControl(this, 'FilesOac', {
      originAccessControlName: `dropify-${props.stage}-files-oac`,
      description: 'Origin access control for Dropify private files'
    });

    const hostingOrigin = origins.S3BucketOrigin.withOriginAccessControl(props.hostingBucket, {
      originId: 'hosting-origin',
      originAccessControl: hostingOac,
      originAccessLevels: [cloudfront.AccessLevel.READ]
    });

    const filesOrigin = origins.S3BucketOrigin.withOriginAccessControl(props.userFilesBucket, {
      originId: 'files-origin',
      originAccessControl: filesOac,
      originAccessLevels: [cloudfront.AccessLevel.READ]
    });

    const certificate = props.cdnCertificateArn
      ? acm.Certificate.fromCertificateArn(this, 'CdnCertificate', props.cdnCertificateArn)
      : undefined;

    if (props.environmentConfig.cdnDomain && !certificate) {
      Annotations.of(this).addWarning(
        `A CDN domain (${props.environmentConfig.cdnDomain}) is configured but no certificate ARN was provided. The distribution will use the default CloudFront domain.`
      );
    }

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      enabled: true,
      comment: `Dropify CDN (${props.stage})`,
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      domainNames:
        props.environmentConfig.cdnDomain && certificate ? [props.environmentConfig.cdnDomain] : undefined,
      certificate,
      minimumProtocolVersion: certificate ? cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021 : undefined,
      defaultBehavior: {
        origin: hostingOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: this.defaultCachePolicy,
        responseHeadersPolicy: this.securityHeadersPolicy,
        compress: true
      },
      additionalBehaviors: {
        'files/*': {
          origin: filesOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachePolicy: this.filesCachePolicy,
          compress: true
        },
        'api/*': {
          origin: new origins.HttpOrigin(props.environmentConfig.apiDomain, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            originSslProtocols: [cloudfront.OriginSslPolicy.TLS_V1_2]
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: this.apiCachePolicy,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          compress: true
        }
      },
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: Duration.minutes(5) },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: Duration.minutes(5) }
      ],
      ...(props.logBucket
        ? {
            enableLogging: true,
            logBucket: props.logBucket,
            logFilePrefix: 'cloudfront/'
          }
        : {})
    });

    Tags.of(this).add('Project', 'Dropify');
    Tags.of(this).add('Environment', props.stage);

    new CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      exportName: `dropify-${props.stage}-distribution-id`
    });

    new CfnOutput(this, 'DistributionDomain', {
      value: this.distribution.distributionDomainName,
      exportName: `dropify-${props.stage}-distribution-domain`
    });
  }
}
