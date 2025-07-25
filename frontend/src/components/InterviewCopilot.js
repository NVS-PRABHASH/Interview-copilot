import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Eye, EyeOff, Settings, Volume2, VolumeX, RotateCcw } from 'lucide-react';
import axios from 'axios';
import API_CONFIG from '../config/api';

const InterviewCopilot = ({ apiKeys, onShowSetup, onResetSetup }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [currentSession, setCurrentSession] = useState(null);
  const [aiResponse, setAiResponse] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [transcriptHistory, setTranscriptHistory] = useState([]);
  const [microphonePermission, setMicrophonePermission] = useState('prompt');
  const [debugInfo, setDebugInfo] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const silenceTimeoutRef = useRef(null);
  
  // Create axios instance with configuration
  const apiClient = axios.create(API_CONFIG);

  // Create authorization header with API keys
  const getAuthHeader = () => {
    const keysString = JSON.stringify(apiKeys);
    const encodedKeys = btoa(keysString);
    return {
      'Authorization': `Bearer ${encodedKeys}`,
      'Content-Type': 'application/json'
    };
  };

  // Check microphone permission and setup
  useEffect(() => {
    const checkMicrophonePermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setMicrophonePermission('granted');
        setDebugInfo('✅ Microphone permission granted');
      } catch (error) {
        setMicrophonePermission('denied');
        setDebugInfo(`❌ Microphone permission denied: ${error.message}`);
        console.error('Microphone permission error:', error);
      }
    };
    
    checkMicrophonePermission();
  }, []);

  // Hotkey controls
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
      const response = await axios.post(`${backendUrl}/api/interview/session`, {}, {
      }
      )
      const response = await apiClient.post('/api/interview/session', {}, {
        headers: getAuthHeader()
      });
      const session = response.data;
      setCurrentSession(session);
      return session;
    } catch (error) {
      console.error('Failed to create session:', error);
      setDebugInfo('❌ Failed to create session');
      return null;
    }
  };

  // Convert audio blob to base64
  const audioToBase64 = (audioBlob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });
  };

  // Process audio chunk for transcription
  const processAudioChunk = async (audioBlob) => {
    if (!currentSession || !audioBlob) return;

    try {
      setDebugInfo('🔄 Processing audio...');
      
      const base64Audio = await audioToBase64(audioBlob);
      
      const response = await axios.post(`${backendUrl}/api/transcribe-audio`, {
      }
      )
      const response = await apiClient.post('/api/transcribe-audio', {
        session_id: currentSession.id,
        audio_data: base64Audio,
        audio_format: 'webm',
        sample_rate: 16000
      }, {
        headers: getAuthHeader()
      });

      const { transcript: newTranscript, confidence } = response.data;
      
      if (newTranscript && newTranscript.trim()) {
        setTranscript(newTranscript);
        setDebugInfo(`📝 Transcribed (${Math.round(confidence * 100)}%): ${newTranscript.slice(0, 50)}...`);
        
        // Save transcript to backend
        await saveTranscript(newTranscript, confidence);
        
        // Reset silence timeout
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
        }
        
        // Set new silence timeout (3 seconds of silence)
        silenceTimeoutRef.current = setTimeout(() => {
          if (newTranscript && currentSession) {
            processQuestion(newTranscript);
          }
        }, 3000);
      }
    } catch (error) {
      console.error('Failed to transcribe audio:', error);
      setDebugInfo(`❌ Transcription failed: ${error.response?.data?.detail || error.message}`);
    }
  };

  // Save transcript to backend
  const saveTranscript = async (text, confidence) => {
    if (!currentSession || !text.trim()) return;
    
    try {
      await apiClient.post('/api/interview/transcript', {
        session_id: currentSession.id,
        text: text.trim(),
        speaker: 'interviewer',
        confidence: confidence
      }, {
        headers: getAuthHeader()
      });
      
      setTranscriptHistory(prev => [...prev, { 
        text: text.trim(), 
        timestamp: new Date(),
        confidence: confidence 
      }]);
    } catch (error) {
      console.error('Failed to save transcript:', error);
    }
  };

  // Process question and get AI response
  const processQuestion = async (question) => {
    if (!currentSession || isProcessing) return;
    
    setIsProcessing(true);
    setDebugInfo('🤖 Generating AI response...');
    
    try {
      const response = await apiClient.post('/api/interview/ai-response', {
        session_id: currentSession.id,
        question: question.trim()
      }, {
        headers: getAuthHeader()
      });
      
      const aiResponseData = response.data;
      setAiResponse(aiResponseData.response);
      setDebugInfo('✅ AI response generated');
    } catch (error) {
      console.error('Failed to get AI response:', error);
      setAiResponse('Error: Could not generate response. Please try again.');
      setDebugInfo(`❌ AI response failed: ${error.response?.data?.detail || error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Start audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      
      streamRef.current = stream;
      audioChunksRef.current = [];
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size > 0) {
          processAudioChunk(audioBlob);
        }
      };
      
      // Record in 3-second chunks
      mediaRecorder.start();
      setIsRecording(true);
      
      const recordingInterval = setInterval(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
          setTimeout(() => {
            if (isListening && mediaRecorderRef.current) {
              audioChunksRef.current = [];
              mediaRecorderRef.current.start();
            }
          }, 100);
        } else {
          clearInterval(recordingInterval);
        }
      }, 3000);
      
      return recordingInterval;
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      setDebugInfo(`❌ Recording failed: ${error.message}`);
      setIsListening(false);
      return null;
    }
  };

  // Stop audio recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsRecording(false);
  };

  // Toggle listening
  const toggleListening = async () => {
    if (microphonePermission !== 'granted') {
      setDebugInfo('❌ Microphone permission required');
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
      stopRecording();
      setIsListening(false);
      setDebugInfo('🔴 Stopped listening');
    } else {
      const interval = await startRecording();
      if (interval) {
        setIsListening(true);
        setDebugInfo('🎤 Started listening...');
      }
    }
  };

  // Auto-hide when manually set to invisible
  const shouldHide = !isVisible;

  if (shouldHide) {
    return (
      <div className="hidden-indicator">
        <div className="hidden-dot"></div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      className="interview-copilot"
    >
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
            className={`listen-btn ${isListening ? 'listening' : ''} ${microphonePermission !== 'granted' ? 'permission-needed' : ''}`}
            onClick={toggleListening}
            disabled={isProcessing}
          >
            {microphonePermission !== 'granted' ? (
              <>
                <Volume2 className="w-4 h-4" />
                Grant Mic Access
              </>
            ) : isListening ? (
              <>
                <MicOff className="w-4 h-4" />
                Stop Listening
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                Start Listening
              </>
            )}
          </button>
          
          <button 
            className="icon-button"
            onClick={() => setIsVisible(false)}
            title="Hide (Ctrl+H)"
          >
            <EyeOff className="w-4 h-4" />
          </button>
          
          <button 
            className="icon-button"
            onClick={onShowSetup}
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          
          <button 
            className="icon-button reset-button"
            onClick={onResetSetup}
            title="Reset Setup"
          >
            <RotateCcw className="w-4 h-4" />
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
          {debugInfo && (
            <div className="debug-info">
              <small>{debugInfo}</small>
            </div>
          )}
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
                  <div className="history-meta">
                    <span className="history-time">
                      {item.timestamp.toLocaleTimeString()}
                    </span>
                    {item.confidence && (
                      <span className="history-confidence">
                        {Math.round(item.confidence * 100)}%
                      </span>
                    )}
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
          <span className="status-text">
            {isListening ? 'Listening' : 'Ready'}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default InterviewCopilot;