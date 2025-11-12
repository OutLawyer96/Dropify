# Dropify - Secure File Sharing Platform

Dropify is a modern, secure file sharing platform built with React. It provides users with an intuitive interface to upload, manage, and share files securely with customizable permissions and analytics.

## 🚀 Features

- **Secure File Upload**: Upload files with drag-and-drop support and progress tracking
- **File Management**: Organize, view, and manage all your uploaded files
- **Secure Sharing**: Generate secure sharing links with customizable permissions
- **Access Control**: Set download limits and expiration dates for shared files
- **Analytics**: Track file views, downloads, and sharing activity
- **Responsive Design**: Beautiful, mobile-friendly interface
- **Real-time Updates**: Live progress tracking and notifications

## 🛠️ Technology Stack

- **Frontend**: React 18 with React Router DOM
- **Styling**: CSS Modules with CSS Custom Properties
- **State Management**: React built-in state management (useState, useContext)
- **Build Tool**: Create React App
- **Package Manager**: npm

## 📦 Project Structure

```
src/
├── components/          # Reusable React components
│   └── Layout/         # Layout components (Header, Navigation, Layout)
├── pages/              # Page-level components
│   ├── Home.js         # Landing page
│   ├── Upload.js       # File upload page
│   └── Files.js        # File management page
├── services/           # API services and HTTP requests
│   └── api.js          # Main API service
├── styles/             # Global styles and CSS variables
│   ├── index.css       # Global styles and utility classes
│   └── variables.css   # CSS custom properties (design tokens)
├── utils/              # Utility functions and constants
│   ├── constants.js    # Application constants
│   └── helpers.js      # Helper utility functions
└── App.js              # Main App component with routing
```

## 🚦 Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm (comes with Node.js)

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd Dropify
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the development server**

   ```bash
   npm start
   ```

4. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000) to view the application.

### Environment Variables

Copy `.env.example` to `.env.local` and populate it after deploying the AWS infrastructure:

```bash
cp .env.example .env.local
```

Set the following values using the CloudFormation outputs:

- `REACT_APP_API_URL`
- `REACT_APP_COGNITO_REGION`
- `REACT_APP_COGNITO_USER_POOL_ID`
- `REACT_APP_COGNITO_CLIENT_ID`
- `REACT_APP_COGNITO_IDENTITY_POOL_ID`
- `REACT_APP_COGNITO_DOMAIN`

> These credentials are environment-specific and must **not** be committed to version control.

## ☁️ AWS Configuration

After provisioning the CDK stack, hook the frontend to the deployed resources:

1. **Deploy the backend stack**
   ```bash
   npm run deploy:dev --workspace infrastructure
   ```
2. **Fetch CloudFormation outputs**
   ```bash
   aws cloudformation describe-stacks \
     --stack-name DropifyBackendStack-dev \
     --query 'Stacks[0].Outputs'
   ```
3. **Populate `.env.local`** with the User Pool ID, App Client ID, Identity Pool ID, API URL, and domain prefix.
4. **Restart the frontend dev server** so Create React App loads the new variables.

## 🔐 Authentication Flow

1. Users sign up via Cognito User Pools and receive a verification code.
2. After confirming the code, Cognito triggers the post-confirmation Lambda to create a user record in DynamoDB.
3. Sign in returns ID, access, and refresh tokens which the React `AuthContext` stores (sessionStorage or localStorage based on "Remember me").
4. Protected routes (`/upload`, `/files`) use `ProtectedRoute` to enforce authentication.
5. When tokens expire, the app refreshes the session using the Cognito refresh token before retrying API requests.

## 📤 File Upload Flow

1. The frontend calls `POST /files/initiate` to obtain a presigned S3 URL.
2. API Gateway invokes the initiate Lambda which validates quota, persists metadata, and returns the presigned PUT URL.
3. The browser uploads the file directly to S3 while tracking progress with Axios.
4. S3 emits an `ObjectCreated` event that updates DynamoDB with file details and storage usage.
5. The React app refreshes the file list via `GET /files` and can generate secure share links with `POST /share`.

## 📜 Available Scripts

- **`npm start`**: Runs the app in development mode
- **`npm test`**: Launches the test runner in interactive watch mode
- **`npm run build`**: Builds the app for production to the `build` folder
- **`npm run eject`**: Removes the single build dependency (irreversible)
- **`npm run deploy:dev --workspace infrastructure`**: Deploys the AWS backend resources to the dev environment
- **`npm run deploy:prod --workspace infrastructure`**: Deploys the AWS backend resources to the production environment

## 🎨 Design System

The application uses a comprehensive design system with:

- **CSS Custom Properties**: Consistent colors, typography, and spacing
- **CSS Modules**: Component-scoped styling to prevent conflicts
- **Responsive Design**: Mobile-first approach with breakpoints
- **Accessibility**: WCAG compliant with proper focus management

### Color Palette

- **Primary**: Blue color scheme for main actions and branding
- **Secondary**: Gray color scheme for text and secondary elements
- **Success**: Green for success states and confirmations
- **Error**: Red for error states and warnings
- **Warning**: Orange for warning states and cautions

## 🔧 Configuration

### File Upload Configuration

Default configuration in `src/utils/constants.js`:

- **Max file size**: 100MB per file
- **Max total upload**: 500MB per batch
- **Max files**: 10 files per upload
- **Supported formats**: Images, documents, archives, audio, video, and code files

### API Configuration

The React app reads AWS settings from environment variables and the helpers in `src/config/aws-config.js`. Ensure the following are in sync:

1. `.env.local` (Cognito + API values)
2. `src/config/aws-config.js` (centralized AWS config)
3. `src/utils/constants.js` (endpoint definitions)

## 🛠️ Troubleshooting

### Network Error During File Upload

**Symptom**: "Network error" message appears when clicking "Upload All" after selecting files

**Cause**: CORS configuration missing or incorrect on S3 bucket

**Solution**:

1. Verify the infrastructure has been deployed with the latest changes
2. Check browser console (F12) for specific CORS error messages
3. Ensure `COGNITO_ALLOWED_CALLBACK_URLS` environment variable includes your frontend origin
4. Redeploy infrastructure: `npm run deploy:dev --workspace infrastructure`
5. Clear browser cache and restart React dev server

### CORS Configuration

CORS (Cross-Origin Resource Sharing) affects both API Gateway calls and direct S3 uploads. The application needs proper CORS configuration to work correctly.

**Origins that need to be configured:**

- **Development**: `http://localhost:3000` (or your custom port like `http://localhost:3001`)
- **Production**: Your actual domain (e.g., `https://app.dropify.com`)

**How to verify CORS is working:**

1. Open browser DevTools (F12) and go to the Network tab
2. Look for preflight OPTIONS requests before PUT requests
3. Check for `Access-Control-Allow-Origin` headers in responses
4. Verify no CORS errors appear in the browser console

**CORS configuration locations:**

- **API Gateway**: Configured in `infrastructure/lib/dropify-backend-stack.ts` using `defaultCorsPreflightOptions`
- **S3 Bucket**: Configured in the `uploadsBucket` definition with `cors` property
- **Origins source**: Derived from `COGNITO_ALLOWED_CALLBACK_URLS` environment variable via `buildAllowedOrigins()` function

### Environment Configuration

The infrastructure environment variables and frontend `.env` file work together:

**Infrastructure deployment (CDK):**

- Uses environment variables from your shell or CI/CD environment
- `COGNITO_ALLOWED_CALLBACK_URLS` affects CORS for both API Gateway and S3
- Set this before running `npm run deploy:dev --workspace infrastructure`

**Frontend configuration (.env.local):**

- Created by copying `.env.example` and filling in CDK output values
- Contains AWS resource identifiers (User Pool ID, API URL, etc.)
- Changes require restarting the React dev server (`npm start`)

**Step-by-step guide to configure environment:**

1. **Before deploying infrastructure**, set environment variables:

   ```bash
   export COGNITO_ALLOWED_CALLBACK_URLS=http://localhost:3000,http://localhost:3001
   ```

2. **Deploy the infrastructure**:

   ```bash
   npm run deploy:dev --workspace infrastructure
   ```

3. **Get CDK output values**:

   ```bash
   aws cloudformation describe-stacks \
     --stack-name DropifyBackendStack-dev \
     --query 'Stacks[0].Outputs'
   ```

4. **Create `.env.local`** from `.env.example`:

   ```bash
   cp .env.example .env.local
   ```

5. **Populate `.env.local`** with the CDK output values:

   - `REACT_APP_API_URL`: API Gateway URL
   - `REACT_APP_COGNITO_USER_POOL_ID`: Cognito User Pool ID
   - `REACT_APP_COGNITO_CLIENT_ID`: Cognito App Client ID
   - `REACT_APP_COGNITO_IDENTITY_POOL_ID`: Cognito Identity Pool ID
   - And other required values

6. **Restart the React dev server**:
   ```bash
   npm start
   ```

### Common Issues

- **401 Unauthorized**: Re-authenticate; expired tokens are automatically refreshed but may require a new login if the refresh token is invalid.
- **CORS blocked uploads**: Confirm the API Gateway and S3 bucket CORS policies include your frontend origin (`http://localhost:3000` in dev).
- **Missing environment variables**: The app throws descriptive errors on startup when AWS config is absent—double-check `.env.local` and restart `npm start`.
- **Slow uploads**: Verify network throughput and ensure the selected region matches your deployment to minimize latency.
- **Running on different port**: If you run the frontend on a port other than 3000 (e.g., `PORT=3001 npm start`), add that origin to `COGNITO_ALLOWED_CALLBACK_URLS` and redeploy the infrastructure.

## 🚧 Current Status

- ✅ Cognito authentication and protected routing are in place
- ✅ Direct-to-S3 uploads with presigned URLs are functional
- ✅ File listings are wired to API Gateway + DynamoDB
- 🚧 Advanced analytics dashboards remain under development

## 🤝 Contributing

We welcome contributions from the development team! Here's how different team members can contribute:

### For Upload Feature Development

- Implement file upload functionality in `src/pages/Upload.js`
- Add drag-and-drop component
- Integrate with API service methods in `src/services/api.js`

### For File Management Development

- Build file listing components for `src/pages/Files.js`
- Create file operations (delete, rename, organize)
- Implement search and filtering functionality

### For Sharing Feature Development

- Develop sharing link generation
- Add permission management UI
- Implement analytics dashboard

### Development Guidelines

1. **Code Style**: Follow existing patterns and use CSS Modules for styling
2. **State Management**: Use React's built-in state management (useState, useContext)
3. **API Integration**: Use the API service structure in `src/services/api.js`
4. **Styling**: Follow the design system defined in CSS variables
5. **Components**: Create reusable components in the `src/components/` directory

## 🔒 Security

- All file uploads should be validated on both client and server
- Implement proper authentication and authorization
- Use HTTPS in production
- Sanitize all user inputs
- Implement rate limiting for API endpoints

## 📱 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For support and questions, please contact the development team or create an issue in the project repository.

---

**Built with ❤️ by the Dropify Team**
