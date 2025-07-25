// API Configuration
const API_CONFIG = {
  baseURL: process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  }
};

export default API_CONFIG;