import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

function App() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [currentSession, setCurrentSession] = useState(null);
  const [aiResponse, setAiResponse] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [transcriptHistory, setTranscriptHistory] = useState([]);
  const [microphonePermission, setMicrophonePermission] = useState('prompt');
  const [speechSupported, setSpeechSupported] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  
  const recognitionRef = useRef(null);
  const silenceTimeoutRef = useRef(null);
  const backendUrl = process.env.REACT_APP_BACKEND_URL;

  // Check browser support and request microphone permission
  useEffect(() => {
    const checkSpeechSupport = async () => {
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        setSpeechSupported(true);
        setDebugInfo('✅ Speech Recognition supported');
        
        // Request microphone permission
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop()); // Stop immediately, we just need permission
          setMicrophonePermission('granted');
          setDebugInfo('✅ Microphone permission granted');
        } catch (error) {
          setMicrophonePermission('denied');
          setDebugInfo(`❌ Microphone permission denied: ${error.message}`);
          console.error('Microphone permission error:', error);
        }
      } else {
        setSpeechSupported(false);
        setDebugInfo('❌ Speech Recognition not supported in this browser');
      }
    };
    
    checkSpeechSupport();
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if (!speechSupported || microphonePermission !== 'granted') {
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';
    
    recognitionRef.current.onstart = () => {
      console.log('Speech recognition started');
      setDebugInfo('🎤 Speech recognition active');
      setIsListening(true);
    };
    
    recognitionRef.current.onresult = (event) => {
      console.log('Speech recognition result:', event);
      let finalTranscript = '';
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      if (finalTranscript) {
        setTranscript(finalTranscript);
        handleFinalTranscript(finalTranscript);
        setDebugInfo(`📝 Final: ${finalTranscript.slice(0, 50)}...`);
      } else {
        setTranscript(interimTranscript);
        setDebugInfo(`🎯 Listening: ${interimTranscript.slice(0, 50)}...`);
      }
      
      // Reset silence timeout
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
      
      // Set new silence timeout (3 seconds of silence)
      silenceTimeoutRef.current = setTimeout(() => {
        if (finalTranscript && currentSession) {
          processQuestion(finalTranscript);
        }
      }, 3000);
    };
    
    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setDebugInfo(`❌ Error: ${event.error}`);
      
      if (event.error === 'no-speech') {
        setDebugInfo('🔇 No speech detected - keep talking');
      } else if (event.error === 'audio-capture') {
        setDebugInfo('❌ Microphone not accessible');
        setIsListening(false);
      } else if (event.error === 'not-allowed') {
        setDebugInfo('❌ Microphone permission denied');
        setMicrophonePermission('denied');
        setIsListening(false);
      } else {
        setDebugInfo(`❌ Recognition error: ${event.error}`);
      }
    };
    
    recognitionRef.current.onend = () => {
      console.log('Speech recognition ended');
      setDebugInfo('🔴 Recognition stopped');
      
      // Auto-restart if we're supposed to be listening
      if (isListening) {
        setTimeout(() => {
          if (recognitionRef.current && isListening) {
            try {
              recognitionRef.current.start();
              setDebugInfo('🔄 Restarting recognition...');
            } catch (error) {
              console.error('Failed to restart recognition:', error);
              setDebugInfo(`❌ Restart failed: ${error.message}`);
              setIsListening(false);
            }
          }
        }, 100);
      } else {
        setIsListening(false);
      }
    };
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [speechSupported, microphonePermission, isListening, currentSession]);

  // Screen sharing detection - removed automatic detection to prevent permission prompts
  // Users can manually hide the interface using Ctrl+H hotkey

  // Hotkey controls (Ctrl+H to hide/show)
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.key === 'h') {
        event.preventDefault();
        setIsVisible(!isVisible);
      }
      if (event.ctrlKey && event.key === 'l') {
        event.preventDefault();
        toggleListening();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, isListening]);

  // Create new interview session
  const createSession = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/interview/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const session = await response.json();
      setCurrentSession(session);
      return session;
    } catch (error) {
      console.error('Failed to create session:', error);
      return null;
    }
  };

  // Handle final transcript
  const handleFinalTranscript = async (text) => {
    if (!currentSession || !text.trim()) return;
    
    try {
      await fetch(`${backendUrl}/api/interview/transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: currentSession.id,
          text: text.trim(),
          speaker: 'interviewer'
        })
      });
      
      setTranscriptHistory(prev => [...prev, { text: text.trim(), timestamp: new Date() }]);
    } catch (error) {
      console.error('Failed to save transcript:', error);
    }
  };

  // Process question and get AI response
  const processQuestion = async (question) => {
    if (!currentSession || isProcessing) return;
    
    setIsProcessing(true);
    try {
      const response = await fetch(`${backendUrl}/api/interview/ai-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: currentSession.id,
          question: question.trim()
        })
      });
      
      const aiResponseData = await response.json();
      setAiResponse(aiResponseData.response);
    } catch (error) {
      console.error('Failed to get AI response:', error);
      setAiResponse('Error: Could not generate response. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle listening
  const toggleListening = async () => {
    if (!speechSupported) {
      setDebugInfo('❌ Speech recognition not supported in this browser');
      return;
    }
    
    if (microphonePermission !== 'granted') {
      setDebugInfo('❌ Microphone permission required');
      // Try to request permission again
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setMicrophonePermission('granted');
        setDebugInfo('✅ Microphone permission granted');
      } catch (error) {
        setDebugInfo(`❌ Microphone permission denied: ${error.message}`);
        return;
      }
    }
    
    if (!currentSession) {
      const session = await createSession();
      if (!session) return;
    }
    
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      setDebugInfo('🔴 Stopped listening');
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setDebugInfo('🎤 Starting to listen...');
        } catch (error) {
          console.error('Failed to start recognition:', error);
          setDebugInfo(`❌ Failed to start: ${error.message}`);
        }
      } else {
        setDebugInfo('❌ Speech recognition not initialized');
      }
    }
  };

  // Auto-hide when manually set to invisible (removed problematic screen sharing detection)
  const shouldHide = !isVisible;

  if (shouldHide) {
    return (
      <div className="hidden-indicator">
        <div className="hidden-dot"></div>
      </div>
    );
  }

  return (
    <div className="interview-copilot">
      <div className="copilot-header">
        <div className="header-left">
          <h1>🎯 Interview Copilot</h1>
          <div className="session-info">
            {currentSession && (
              <span className="session-id">Session: {currentSession.id.slice(0, 8)}...</span>
            )}
          </div>
        </div>
        <div className="header-controls">
          <button 
            className={`listen-btn ${isListening ? 'listening' : ''}`}
            onClick={toggleListening}
            disabled={isProcessing}
          >
            {isListening ? '🎤 Listening...' : '🎤 Start Listening'}
          </button>
          <button 
            className="hide-btn"
            onClick={() => setIsVisible(false)}
            title="Hide (Ctrl+H)"
          >
            👁️
          </button>
        </div>
      </div>

      <div className="copilot-content">
        {/* Real-time transcript */}
        <div className="transcript-section">
          <h3>📝 Live Transcript</h3>
          <div className="transcript-box">
            {transcript || 'Waiting for speech...'}
          </div>
        </div>

        {/* AI Response */}
        <div className="response-section">
          <h3>🤖 AI Response</h3>
          <div className="response-box">
            {isProcessing ? (
              <div className="processing">
                <div className="spinner"></div>
                Generating response...
              </div>
            ) : (
              <div className="response-content">
                {aiResponse || 'AI response will appear here...'}
              </div>
            )}
          </div>
        </div>

        {/* Recent questions */}
        <div className="history-section">
          <h3>📋 Recent Questions</h3>
          <div className="history-list">
            {transcriptHistory.length === 0 ? (
              <div className="no-history">No questions yet</div>
            ) : (
              transcriptHistory.slice(-3).map((item, index) => (
                <div key={index} className="history-item">
                  <div className="history-text">{item.text}</div>
                  <div className="history-time">
                    {item.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="copilot-footer">
        <div className="shortcuts">
          <span>Shortcuts: Ctrl+H (Hide) | Ctrl+L (Listen)</span>
        </div>
        <div className="status">
          <span className={`status-dot ${isListening ? 'active' : ''}`}></span>
        </div>
      </div>
    </div>
  );
}

export default App;