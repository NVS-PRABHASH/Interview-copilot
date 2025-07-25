import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Eye, EyeOff, Settings, Key, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import './App.css';
import SetupModal from './components/SetupModal';
import InterviewCopilot from './components/InterviewCopilot';

function App() {
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [apiKeys, setApiKeys] = useState(null);
  const [showSetup, setShowSetup] = useState(true);

  // Check if API keys are stored in sessionStorage
  useEffect(() => {
    const storedKeys = sessionStorage.getItem('interview_copilot_keys');
    if (storedKeys) {
      try {
        const keys = JSON.parse(storedKeys);
        setApiKeys(keys);
        setIsSetupComplete(true);
        setShowSetup(false);
      } catch (error) {
        console.error('Failed to parse stored API keys:', error);
        sessionStorage.removeItem('interview_copilot_keys');
      }
    }
  }, []);

  const handleSetupComplete = (keys) => {
    setApiKeys(keys);
    setIsSetupComplete(true);
    setShowSetup(false);
    
    // Store keys in sessionStorage for this session
    sessionStorage.setItem('interview_copilot_keys', JSON.stringify(keys));
  };

  const handleShowSetup = () => {
    setShowSetup(true);
  };

  const handleResetSetup = () => {
    setApiKeys(null);
    setIsSetupComplete(false);
    setShowSetup(true);
    sessionStorage.removeItem('interview_copilot_keys');
  };

  return (
    <div className="app">
      <AnimatePresence mode="wait">
        {showSetup && (
          <SetupModal
            onComplete={handleSetupComplete}
            onClose={() => setShowSetup(false)}
            existingKeys={apiKeys}
          />
        )}
      </AnimatePresence>

      {isSetupComplete && (
        <InterviewCopilot
          apiKeys={apiKeys}
          onShowSetup={handleShowSetup}
          onResetSetup={handleResetSetup}
        />
      )}

      {/* Welcome screen when no setup */}
      {!isSetupComplete && !showSetup && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="welcome-screen"
        >
          <div className="welcome-content">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="welcome-header"
            >
              <div className="welcome-icon">🎯</div>
              <h1>Interview Copilot</h1>
              <p>Your invisible assistant for job interviews</p>
            </motion.div>

            <motion.button
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              onClick={() => setShowSetup(true)}
              className="setup-button"
            >
              <Key className="w-5 h-5" />
              Get Started
            </motion.button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default App;