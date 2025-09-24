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

Create a `.env` file in the root directory to configure environment variables:

```env
# API Configuration
REACT_APP_API_URL=http://localhost:3001/api

# Feature Flags
REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_ENABLE_PASSWORD_PROTECTION=true
```

## 📜 Available Scripts

- **`npm start`**: Runs the app in development mode
- **`npm test`**: Launches the test runner in interactive watch mode
- **`npm run build`**: Builds the app for production to the `build` folder
- **`npm run eject`**: Removes the single build dependency (irreversible)

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

The application is configured to work with a REST API. Update the API base URL in:

1. Environment variables (`.env` file)
2. Constants file (`src/utils/constants.js`)

## 🚧 Current Status

This is the initial frontend setup and foundation. The following components are currently placeholder implementations ready for development:

- **Upload Component**: File upload functionality with drag-and-drop
- **File Management**: File listing, organization, and operations
- **Sharing System**: Link generation and permission management
- **Analytics**: Usage tracking and reporting

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