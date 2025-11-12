# Dropify Infrastructure — Cognito Notes

This folder contains the AWS CDK infrastructure for Dropify. The CDK stack now provisions Cognito resources and integrates Lambda triggers.

Cognito provisions

- User Pool (with optional domain)
- User Pool Client
- Identity Pool (Cognito Identity)
- Lambda triggers: PreSignUp, PostConfirmation, PreTokenGeneration

Trigger Lambdas

- The trigger handlers live under `src/lambda/cognito-triggers/`.
- They are wired into the User Pool at stack creation time. The PostConfirmation handler writes a basic user record into the Users DynamoDB table.

IAM and roles

- Identity Pool authenticated/unauthenticated roles are created and attached by the `CognitoConstruct`.
- A dedicated `CognitoTriggerRole` exists in the IAM construct for trigger functions if you prefer to reuse it.

How to build & synth locally

```bash
cd infrastructure
npm install
npm run build
npm run synth
```

Running tests

```bash
cd infrastructure
npm test
```

Deployment notes

- `scripts/deploy.sh` will now echo Cognito outputs (UserPoolId, UserPoolClientId, IdentityPoolId) after deployment.
- Attach Cognito authorizers to API methods as needed (we intentionally do not create a global authorizer in the backend stack to avoid cross-stack/attachment validation issues).

If you'd like, I can attach the authorizer to specific API methods (for example `POST /files`), or consolidate any role policies into a single place — tell me which option you prefer.

---

Generated: automated update

# Dropify Infrastructure

This package contains the AWS CDK (v2) infrastructure-as-code foundation for the Dropify platform. The stacks defined here provide secure, repeatable environments that mirror the API capabilities expected by the React frontend in the root project.

## Project Structure

```
infrastructure/
├── bin/                 # CDK app entry points
├── lib/                 # CDK stacks and reusable constructs
│   ├── config/          # Environment configuration
│   ├── constructs/      # Reusable infrastructure building blocks
│   └── types/           # Shared TypeScript interfaces
├── scripts/             # Operational helper scripts
├── test/                # Jest-based infrastructure tests
├── package.json         # npm manifest for the CDK workspace
├── tsconfig.json        # TypeScript configuration
└── cdk.json             # CDK CLI configuration
```

### Stacks & Constructs

- **DropifyStack** – coordinates networking, IAM, storage, database, CDN, and security components that will support compute, storage, and data services.
- **VpcConstruct** – defines a multi-AZ VPC with public/private subnets, NAT Gateways, and VPC endpoints for core AWS services.
- **IamConstruct** – prepares least-privilege IAM roles and policies for Lambda, API Gateway, S3 automation, DynamoDB access, and CloudFront deployments.
- **SecurityConstruct** – configures security groups and baseline network controls for workloads deployed inside the VPC.
- **S3Construct** – provisions the static hosting bucket, private user files bucket, shared access logs bucket, and related policies/notifications.
- **DynamoDBConstruct** – creates three optimized DynamoDB tables (Files, ShareLinks, Users) with global secondary indexes, TTL support, and encryption.
- **CloudFrontConstruct** – establishes the global CDN with multiple origins, cache behaviours, security headers, and Origin Access Control.

## Getting Started

### Prerequisites

- Node.js 18+
- npm 8+
- AWS CLI configured with credentials capable of deploying CDK stacks
- AWS CDK CLI (`npm install -g aws-cdk`) – installed automatically during setup

### Installation & Setup

```bash
npm install --workspaces
npm run infra:setup
```

`infra:setup` installs dependencies, validates prerequisites, and runs `cdk bootstrap` for the target AWS account/region.

### Useful Commands

All commands are executed from the repository root using npm workspaces.

| Command                                      | Description                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| `npm run deploy:dev`                         | Deploy the development infrastructure stack and publish the latest React build. |
| `npm run deploy:prod`                        | Deploy the production infrastructure stack and publish the latest React build.  |
| `npm run diff --workspace infrastructure`    | Show infrastructure changes between the working tree and deployed stacks.       |
| `npm run destroy --workspace infrastructure` | Tear down the currently deployed stacks.                                        |

### Testing

Infrastructure tests are handled through Jest.

```bash
npm test --workspace infrastructure
```

### Continuous Integration

GitHub Actions workflows located in `.github/workflows/` execute linting, TypeScript compilation, and CDK synth on pull requests. Pushes to `main` and `develop` trigger automated deployments via the `deploy.yml` workflow.

## File Upload Architecture

The upload pipeline is now split into two Lambda functions that share reusable helpers under `src/lambda/shared/`:

- `files/initiate-upload.ts` validates filenames, MIME types, and size limits with Zod, enforces per-plan quotas from `constants.ts`, records intended uploads, and responds with presigned S3 URLs plus sanitized metadata keys.
- `files/finalize-upload.ts` verifies S3 object metadata (checksum, size, MIME), normalises filenames, and upserts the file record while atomically updating user storage usage. Conditional writes guard against stale storage totals and retry helpers smooth transient DynamoDB errors.
- Shared modules provide DynamoDB helpers, structured error handling, and metadata utilities so all upload handlers process limits, logging, and storage mutations consistently.
- Cognito triggers initialise each new user with the correct plan entitlement and `storageLimit`, keeping backend quotas aligned with the frontend selection flow.

## Storage & CDN Architecture

- **App Hosting Bucket** (`staticSiteBucketName`) stores the React build privately with server-side encryption, strict CORS limited to the CDN/API domains, and access grants only via CloudFront Origin Access Control.
- **User Files Bucket** (`fileBucketName`) stores uploads privately with encryption, versioning, lifecycle optimisations, and S3 event notifications for future processors.
- **Access Logs Bucket** aggregates server access logs for both buckets and CloudFront.
- **CloudFront Distribution** orchestrates three behaviours and terminates TLS using an ACM certificate in `us-east-1`:
  - `/` (default) → hosting bucket with aggressive caching and security headers.
  - `/files/*` → private files bucket via Origin Access Control with short-lived caching for downloads.
  - `/api/*` → future API Gateway endpoint, forwarding auth headers and query strings.

CloudFormation outputs expose bucket names and the distribution identifier/domain for CI/CD pipelines and manual deployments.

## Environment Configuration

Environment-specific infrastructure settings (AWS account, region, bucket names, CDN certificate ARN, and feature flags) are managed in `lib/config/environments.ts`. The frontend's runtime configuration mirrors these values via environment variables outlined in the repository-level `.env.example` file, including CDN and API domains.

## Relationship to the Frontend

The React frontend (`src/`) currently interacts with mock API services defined in `src/services/api.js`. The constructs and types in this package reflect those API contracts so that future backend implementations (Lambda, API Gateway, DynamoDB, Cognito, etc.) can replace the mocks without breaking the UI.

## Deploying the React Frontend

`scripts/deploy.sh` performs the full release flow:

1. Validates toolchain prerequisites (AWS CLI credentials, npm, `curl`) and ensures the configured ACM certificate is present and in the `ISSUED` state.
2. Builds the infrastructure TypeScript project and deploys the selected CDK stack.
3. Builds the React application (`npm run build` from the repository root).
4. Confirms the target S3 buckets exist and are accessible.
5. Synchronises the web build to the hosting bucket via `aws s3 sync`.
6. Invalidates the CloudFront distribution to propagate the latest assets globally.
7. Performs a CDN health check against the distribution domain to confirm routing and TLS readiness.

Ensure the invoking principal has S3, CloudFront invalidation, and CloudFormation `DescribeStacks` permissions.

## DynamoDB Data Model

Dropify uses a three-table DynamoDB design optimized for specific access patterns:

### Files Table

**Primary Key:**

- Partition Key: `userId` (string)
- Sort Key: `sortKey` (string) - Format: `{uploadTimestamp}#{fileId}`

**Global Secondary Indexes:**

1. **fileIdIndex** - Direct file lookup
   - Partition Key: `fileId`
   - Projection: ALL
2. **userFileSizeIndex** - Sort files by size
   - Partition Key: `userId`
   - Sort Key: `fileSize` (number)
   - Projection: ALL

**Attributes:**

- `fileId` - Unique file identifier
- `fileName` - Original filename
- `fileSize` - File size in bytes
- `mimeType` - MIME type
- `s3Key` - S3 object key
- `uploadTimestamp` - ISO 8601 timestamp
- `lastAccessedAt` - Last download/access time
- `downloadCount` - Number of times downloaded
- `metadata` - Custom key-value metadata
- `tags` - Array of tags
- `expiresAt` - Optional TTL timestamp (Unix seconds)

**Access Patterns:**

- List files by user (sorted by upload time)
- Get file by fileId
- List files by user sorted by size
- Calculate total storage used by user

### ShareLinks Table

**Primary Key:**

- Partition Key: `linkId` (string)

**Global Secondary Indexes:**

1. **fileIdIndex** - List share links by file
   - Partition Key: `fileId`
   - Sort Key: `createdAt`
   - Projection: ALL

**Attributes:**

- `linkId` - Unique share link identifier
- `fileId` - Associated file ID
- `userId` - Owner user ID
- `createdAt` - ISO 8601 timestamp
- `expiresAt` - Optional expiration timestamp
- `ttl` - TTL attribute (Unix seconds)
- `maxDownloads` - Optional download limit
- `currentDownloads` - Current download count
- `passwordHash` - Optional password protection
- `isActive` - Boolean activation status

**Access Patterns:**

- Get share link by linkId
- List share links for a file
- Validate share link (expiration, download limits)
- Automatic deletion via TTL

### Users Table

**Primary Key:**

- Partition Key: `userId` (string)

**Attributes:**

- `userId` - Unique user identifier
- `email` - User email address
- `displayName` - User display name
- `createdAt` - ISO 8601 timestamp
- `lastLoginAt` - Last login timestamp
- `storageUsed` - Total bytes used
- `storageLimit` - Storage quota in bytes
- `preferences` - User preferences object

**Access Patterns:**

- Get user profile
- Update storage usage
- Check storage availability
- Update user preferences

### Table Configuration

All tables use:

- **Billing Mode:** PAY_PER_REQUEST (on-demand)
- **Encryption:** AWS-managed encryption at rest
- **Point-in-Time Recovery:** Enabled for production
- **Streams:** Configurable via feature flags
- **Removal Policy:** RETAIN for production, DESTROY for dev

## Data Access Layer

The `lib/data-access/` directory provides TypeScript repositories for type-safe DynamoDB operations:

- **BaseRepository** - Abstract base with common DynamoDB operations (get, put, update, delete, query, scan, batch operations)
- **FilesRepository** - File management (create, list, update, delete, download tracking, storage calculations)
- **ShareLinksRepository** - Share link lifecycle (create, validate, increment downloads, deactivate, batch operations)
- **UsersRepository** - User profile management (create, update, storage tracking, preferences)

All repositories use **Zod schemas** (`lib/schemas/`) for runtime validation of inputs and outputs.

## Troubleshooting

- **Missing AWS credentials** – Ensure `aws configure` has been run, or provide temporary credentials via environment variables.
- **Missing CDN certificate** – Verify `DROPIFY_<STAGE>_CDN_CERT_ARN` points to a valid ACM certificate in `us-east-1` and that the issuing account trusts CloudFront.
- **Bootstrap errors** – Run `cdk bootstrap` with the appropriate AWS profile/region, or re-run `npm run infra:setup`.
- **CloudFront invalidation failures** – Confirm `cloudfront:CreateInvalidation` permission is present.
- **S3 access denied errors** – Verify the hosting bucket exists and the CloudFront Origin Access Control is attached to the distribution.

## License

MIT © Dropify Team
