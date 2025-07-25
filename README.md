# Interview Copilot - Web Application

A powerful web-based interview assistant that operates discreetly during job interviews to help users with real-time AI-powered responses. Built with React frontend and FastAPI backend, featuring Google Speech-to-Text integration and Gemini AI.

## 🚀 Features

- **Real-time Speech Recognition** - Google Speech-to-Text API integration
- **AI-Powered Responses** - Gemini 2.5 Flash for intelligent interview assistance
- **Stealth Interface** - Minimalist, hideable UI perfect for interviews
- **Hotkey Controls** - Global keyboard shortcuts (Ctrl+H to hide, Ctrl+L to listen)
- **Session Management** - Track multiple interview sessions
- **Secure API Key Management** - Session-based storage of user credentials
- **Responsive Design** - Works on desktop and mobile devices

## 🛠️ Technology Stack

### Frontend
- **React 19** - Modern React with hooks
- **Framer Motion** - Smooth animations and transitions
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Beautiful icons
- **Axios** - HTTP client for API calls

### Backend
- **FastAPI** - High-performance Python web framework
- **MongoDB** - Document database for session storage
- **Google Speech-to-Text API** - Audio transcription
- **Gemini AI** - Response generation
- **Motor** - Async MongoDB driver

## 📋 Prerequisites

Before running the application, you'll need:

1. **Google Speech-to-Text API Key**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable Speech-to-Text API
   - Create API key in Credentials section

2. **Gemini API Key**
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Sign in with Google account
   - Create API key

3. **MongoDB Database**
   - Local MongoDB installation, or
   - MongoDB Atlas cloud database

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone <repository-url>
cd interview-copilot-web
```

### 2. Install Dependencies
```bash
# Install all dependencies (frontend + backend)
npm run install:all

# Or install separately:
# Backend
cd backend && pip install -r requirements.txt

# Frontend
cd frontend && npm install
```

### 3. Environment Setup

Create `.env` files:

**backend/.env:**
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=interview_copilot
```

**frontend/.env:**
```env
REACT_APP_BACKEND_URL=http://localhost:8000
```

### 4. Start the Application
```bash
# Start both frontend and backend
npm run dev

# Or start separately:
npm run dev:backend  # Backend on port 8000
npm run dev:frontend # Frontend on port 3000
```

### 5. Setup API Keys

1. Open the application in your browser
2. Click "Get Started" to open the setup modal
3. Enter your Google Speech-to-Text API key
4. Enter your Gemini API key
5. Complete the validation process

## 🎯 Usage Guide

### Basic Operation

1. **Start a Session**: The app automatically creates a new interview session
2. **Grant Microphone Permission**: Allow browser access to your microphone
3. **Start Listening**: Click the microphone button or press `Ctrl+L`
4. **View Transcripts**: Real-time speech appears in the transcript section
5. **Get AI Responses**: AI suggestions appear automatically for detected questions
6. **Hide Interface**: Press `Ctrl+H` to hide during screen sharing

### Hotkeys

| Shortcut | Action |
|----------|--------|
| `Ctrl+L` | Toggle listening on/off |
| `Ctrl+H` | Hide/show interface |

### Interview Tips

1. **Position the interface** in a corner where you can glance at it naturally
2. **Test everything** before your actual interview
3. **Use Ctrl+H immediately** when starting screen share
4. **Keep responses natural** - use AI suggestions as guidance, not scripts
5. **Practice with the hotkeys** to operate smoothly during interviews

## 🏗️ Architecture

### Frontend Structure
```
frontend/src/
├── components/
│   ├── SetupModal.js      # API key setup interface
│   └── InterviewCopilot.js # Main copilot interface
├── App.js                 # Main application component
├── App.css               # Styling and animations
└── index.js              # React entry point
```

### Backend Structure
```
backend/
├── server.py             # FastAPI application
├── requirements.txt      # Python dependencies
└── .env                 # Environment variables
```

### API Endpoints

- `POST /api/validate-keys` - Validate API keys
- `POST /api/transcribe-audio` - Transcribe audio to text
- `POST /api/interview/session` - Create interview session
- `GET /api/interview/session/{id}` - Get session details
- `POST /api/interview/transcript` - Save transcript
- `POST /api/interview/ai-response` - Generate AI response

## 🔒 Security & Privacy

- **API Keys**: Stored only in browser session storage
- **Audio Data**: Processed in real-time, not permanently stored
- **Transcripts**: Saved to database for session context only
- **HTTPS**: Use HTTPS in production for secure API communication

## 🚀 Deployment

### Lovable Platform Deployment

The application is structured for easy deployment on Lovable:

1. **Build the frontend**:
   ```bash
   npm run build
   ```

2. **Configure environment variables** in your deployment platform

3. **Deploy backend** with Python/FastAPI support

4. **Deploy frontend** static files

### Environment Variables for Production

**Backend:**
```env
MONGO_URL=your_mongodb_connection_string
DB_NAME=interview_copilot
```

**Frontend:**
```env
REACT_APP_BACKEND_URL=https://your-backend-domain.com
```

## 🧪 Testing

### Backend API Testing
```bash
# Run comprehensive API tests
npm run test:api

# Run unit tests
npm run test
```

### Frontend Testing
```bash
cd frontend
npm test
```

## 🛠️ Development

### Project Scripts

```bash
npm run dev              # Start both frontend and backend
npm run dev:backend      # Start backend only
npm run dev:frontend     # Start frontend only
npm run build           # Build frontend for production
npm run start           # Start production backend
npm run install:all     # Install all dependencies
npm run test           # Run backend tests
npm run test:api       # Run API integration tests
```

### Adding New Features

1. **Backend**: Add new endpoints in `backend/server.py`
2. **Frontend**: Create components in `frontend/src/components/`
3. **Styling**: Update `frontend/src/App.css`
4. **API Integration**: Use axios in React components

## 📝 API Documentation

### Authentication

API keys are passed in the Authorization header as base64-encoded JSON:

```javascript
const authHeader = {
  'Authorization': `Bearer ${btoa(JSON.stringify({
    google_speech_api_key: 'your-key',
    gemini_api_key: 'your-key'
  }))}`
};
```

### Audio Transcription

```javascript
const response = await axios.post('/api/transcribe-audio', {
  session_id: 'session-uuid',
  audio_data: 'base64-encoded-audio',
  audio_format: 'webm',
  sample_rate: 16000
}, { headers: authHeader });
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is for educational and personal use. Ensure compliance with your organization's interview policies before use in professional settings.

## ⚠️ Important Notes

- **Test thoroughly** before actual interviews
- **Respect interview policies** of your target companies
- **Use responsibly** - this tool should supplement, not replace, your preparation
- **Check microphone permissions** in your browser settings
- **Ensure stable internet** for API calls during interviews

## 🆘 Troubleshooting

### Common Issues

**"Microphone not accessible"**
- Check browser microphone permissions
- Ensure HTTPS in production (required for microphone access)
- Try refreshing the page

**"API key validation failed"**
- Verify your API keys are correct
- Check API quotas and billing
- Ensure APIs are enabled in Google Cloud Console

**"No transcription appearing"**
- Check microphone permissions
- Verify audio input levels
- Test with different browsers

**"AI responses not generating"**
- Verify Gemini API key
- Check internet connection
- Review API usage limits

### Getting Help

1. Check the browser console for error messages
2. Review the backend logs
3. Test API endpoints individually
4. Verify all environment variables are set correctly

---

**Built with ❤️ for interview success**