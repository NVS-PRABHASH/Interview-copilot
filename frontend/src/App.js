import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Eye, EyeOff, Settings, Key, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import './App.css';
import SetupModal from './components/SetupModal';
import InterviewCopilot from './components/InterviewCopilot';
import { apiKeyManager } from './utils/apiKeyManager';
import API_CONFIG from './config/api';

function App() {
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [apiKeys, setApiKeys] = useState(null);
  const [showSetup, setShowSetup] = useState(true);

  // Check if API keys are stored in sessionStorage
  useEffect(() => {
    const storedKeys = apiKeyManager.getKeys();
    if (storedKeys) {
      setApiKeys(storedKeys);
      setIsSetupComplete(true);
      setShowSetup(false);
    }
  }, []);

  const handleSetupComplete = (keys) => {
    setApiKeys(keys);
    setIsSetupComplete(true);
    setShowSetup(false);
    
    // Store encrypted keys
    apiKeyManager.storeKeys(keys);
  };

  const handleShowSetup = () => {
    setShowSetup(true);
  };

  const handleResetSetup = () => {
    setApiKeys(null);
    setIsSetupComplete(false);
    setShowSetup(true);
    apiKeyManager.clearKeys();
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