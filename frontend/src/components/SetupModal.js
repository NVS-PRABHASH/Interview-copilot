import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Key, Eye, EyeOff, CheckCircle, AlertCircle, Loader, X, ExternalLink } from 'lucide-react';
import axios from 'axios';
import API_CONFIG from '../config/api';

const SetupModal = ({ onComplete, onClose, existingKeys }) => {
  const [step, setStep] = useState(1);
  const [googleApiKey, setGoogleApiKey] = useState(existingKeys?.google_speech_api_key || '');
  const [geminiApiKey, setGeminiApiKey] = useState(existingKeys?.gemini_api_key || '');
  const [showGoogleKey, setShowGoogleKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [validationSuccess, setValidationSuccess] = useState(false);

  // Create axios instance with configuration
  const apiClient = axios.create(API_CONFIG);

  const validateKeys = async () => {
    if (!googleApiKey.trim() || !geminiApiKey.trim()) {
      setValidationError('Please enter both API keys');
      return false;
    }

    setIsValidating(true);
    setValidationError('');

    try {
      const response = await apiClient.post('/api/validate-keys', {
        google_speech_api_key: googleApiKey.trim(),
        gemini_api_key: geminiApiKey.trim()
      });

      if (response.data.status === 'valid') {
        setValidationSuccess(true);
        setTimeout(() => {
          onComplete({
            google_speech_api_key: googleApiKey.trim(),
            gemini_api_key: geminiApiKey.trim()
          });
        }, 1000);
        return true;
      }
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Failed to validate API keys';
      setValidationError(errorMessage);
    } finally {
      setIsValidating(false);
    }

    return false;
  };

  const handleNext = () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      validateKeys();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const canProceed = () => {
    if (step === 1) return true;
    if (step === 2) return googleApiKey.trim().length > 0;
    if (step === 3) return geminiApiKey.trim().length > 0;
    return false;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="setup-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="setup-modal"
      >
        {/* Header */}
        <div className="setup-header">
          <div className="setup-title">
            <Key className="w-6 h-6 text-blue-500" />
            <h2>Setup Interview Copilot</h2>
          </div>
          <button onClick={onClose} className="close-button">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress indicator */}
        <div className="progress-indicator">
          {[1, 2, 3].map((stepNum) => (
            <div
              key={stepNum}
              className={`progress-step ${step >= stepNum ? 'active' : ''} ${step > stepNum ? 'completed' : ''}`}
            >
              {step > stepNum ? <CheckCircle className="w-4 h-4" /> : stepNum}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="setup-content">
          {step === 1 && (
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="setup-step"
            >
              <div className="step-icon">🎯</div>
              <h3>Welcome to Interview Copilot</h3>
              <p>
                Your invisible assistant for job interviews. This application uses AI to help you
                answer interview questions professionally and effectively.
              </p>
              <div className="features-list">
                <div className="feature">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Real-time speech transcription</span>
                </div>
                <div className="feature">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>AI-powered response suggestions</span>
                </div>
                <div className="feature">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Stealth mode for screen sharing</span>
                </div>
                <div className="feature">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Hotkey controls</span>
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="setup-step"
            >
              <div className="step-icon">🎤</div>
              <h3>Google Speech-to-Text API Key</h3>
              <p>
                We need your Google Speech-to-Text API key for real-time transcription.
                Your key is stored securely in your browser session only.
              </p>
              
              <div className="api-key-input">
                <label>Google Speech-to-Text API Key</label>
                <div className="input-group">
                  <input
                    type={showGoogleKey ? 'text' : 'password'}
                    value={googleApiKey}
                    onChange={(e) => setGoogleApiKey(e.target.value)}
                    placeholder="Enter your Google Speech-to-Text API key"
                    className="api-key-field"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGoogleKey(!showGoogleKey)}
                    className="toggle-visibility"
                  >
                    {showGoogleKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="help-text">
                <p>
                  <strong>How to get your API key:</strong>
                </p>
                <ol>
                  <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">Google Cloud Console <ExternalLink className="w-3 h-3 inline" /></a></li>
                  <li>Create a new project or select an existing one</li>
                  <li>Enable the Speech-to-Text API</li>
                  <li>Go to "Credentials" and create an API key</li>
                  <li>Copy and paste the API key above</li>
                </ol>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="setup-step"
            >
              <div className="step-icon">🤖</div>
              <h3>Gemini API Key</h3>
              <p>
                We need your Gemini API key for AI-powered response generation.
                Your key is stored securely in your browser session only.
              </p>
              
              <div className="api-key-input">
                <label>Gemini API Key</label>
                <div className="input-group">
                  <input
                    type={showGeminiKey ? 'text' : 'password'}
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="Enter your Gemini API key"
                    className="api-key-field"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="toggle-visibility"
                  >
                    {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="help-text">
                <p>
                  <strong>How to get your API key:</strong>
                </p>
                <ol>
                  <li>Go to <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio <ExternalLink className="w-3 h-3 inline" /></a></li>
                  <li>Sign in with your Google account</li>
                  <li>Click "Create API Key"</li>
                  <li>Copy and paste the API key above</li>
                </ol>
              </div>

              {validationError && (
                <div className="error-message">
                  <AlertCircle className="w-4 h-4" />
                  {validationError}
                </div>
              )}

              {validationSuccess && (
                <div className="success-message">
                  <CheckCircle className="w-4 h-4" />
                  API keys validated successfully!
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <div className="setup-footer">
          {step > 1 && (
            <button onClick={handleBack} className="back-button">
              Back
            </button>
          )}
          
          <button
            onClick={handleNext}
            disabled={!canProceed() || isValidating}
            className="next-button"
          >
            {isValidating ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Validating...
              </>
            ) : step === 3 ? (
              'Complete Setup'
            ) : (
              'Next'
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default SetupModal;