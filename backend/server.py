from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi import Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
from emergentintegrations.llm.chat import LlmChat, UserMessage
import asyncio
import json
import base64
import aiohttp
from google.cloud import speech
from google.oauth2 import service_account
import io
from functools import wraps
import hashlib
import hmac

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Rate limiting setup
limiter = Limiter(key_func=get_remote_address)

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'interview_copilot')]

# Security configuration
JWT_SECRET = os.environ.get('JWT_SECRET_KEY', 'your-super-secret-jwt-key-here')
CORS_ORIGINS = os.environ.get('CORS_ORIGINS', 'http://localhost:3000').split(',')

# Create the main app without a prefix
app = FastAPI(title="Interview Copilot API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer(auto_error=False)

# Input validation decorator
def validate_session_id(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        session_id = kwargs.get('session_id') or (args[0].session_id if args and hasattr(args[0], 'session_id') else None)
        if not session_id or len(session_id) < 10:
            raise HTTPException(status_code=400, detail="Invalid session ID")
        return await func(*args, **kwargs)
    return wrapper

# Models
class APIKeysModel(BaseModel):
    google_speech_api_key: str
    gemini_api_key: str

class InterviewSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True
    user_id: Optional[str] = None

class InterviewSessionCreate(BaseModel):
    user_id: Optional[str] = None

class TranscriptEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    text: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    speaker: str = "interviewer"
    confidence: Optional[float] = None

class TranscriptCreate(BaseModel):
    session_id: str
    text: str
    speaker: str = "interviewer"
    confidence: Optional[float] = None

class AIResponse(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    question: str
    response: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class AIResponseRequest(BaseModel):
    session_id: str
    question: str

class AudioTranscriptionRequest(BaseModel):
    session_id: str
    audio_data: str  # Base64 encoded audio
    audio_format: str = "webm"
    sample_rate: int = 16000

class AudioTranscriptionResponse(BaseModel):
    transcript: str
    confidence: float
    session_id: str

class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Global storage for API keys (in production, use proper session management)
user_api_keys: Dict[str, APIKeysModel] = {}

async def get_api_keys(credentials: HTTPAuthorizationCredentials = Depends(security)) -> APIKeysModel:
    """Extract API keys from request headers or session"""
    if not credentials:
        raise HTTPException(status_code=401, detail="API keys required")
    
    # In this implementation, we'll pass API keys in the Authorization header as JSON
    try:
        keys_data = json.loads(base64.b64decode(credentials.credentials).decode())
        return APIKeysModel(**keys_data)
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid API keys format")

# API Key validation endpoint
@api_router.post("/validate-keys")
@limiter.limit("10/minute")
async def validate_api_keys(request: Request, keys: APIKeysModel):
    """Validate provided API keys"""
    # Input validation
    if not keys.google_speech_api_key or len(keys.google_speech_api_key) < 20:
        raise HTTPException(status_code=400, detail="Invalid Google Speech API key format")
    
    if not keys.gemini_api_key or len(keys.gemini_api_key) < 20:
        raise HTTPException(status_code=400, detail="Invalid Gemini API key format")
    
    try:
        # Test Gemini API key
        try:
            chat = LlmChat(
                api_key=keys.gemini_api_key,
                session_id="test",
                system_message="Test message"
            ).with_model("gemini", "gemini-2.5-flash").with_max_tokens(10)
            
            test_message = UserMessage(text="Hello")
            await chat.send_message(test_message)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid Gemini API key: {str(e)}")
        
        # Test Google Speech API key (basic validation)
        if not keys.google_speech_api_key or len(keys.google_speech_api_key) < 20:
            raise HTTPException(status_code=400, detail="Invalid Google Speech API key format")
        
        return {"status": "valid", "message": "API keys validated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation error: {str(e)}")

# Audio transcription endpoint
@api_router.post("/transcribe-audio", response_model=AudioTranscriptionResponse)
@limiter.limit("30/minute")
async def transcribe_audio(http_request: Request, request: AudioTranscriptionRequest, api_keys: APIKeysModel = Depends(get_api_keys)):
    """Transcribe audio using Google Speech-to-Text API"""
    # Input validation
    if not request.session_id or len(request.session_id) < 10:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    if not request.audio_data or len(request.audio_data) < 100:
        raise HTTPException(status_code=400, detail="Invalid audio data")
    
    try:
        # Verify session exists
        session = await db.interview_sessions.find_one({"id": request.session_id})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Decode base64 audio data
        try:
            audio_data = base64.b64decode(request.audio_data)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid audio data: {str(e)}")
        
        # Create Google Speech client with API key
        try:
            # For API key authentication, we'll use the REST API directly
            async with aiohttp.ClientSession() as session:
                url = f"https://speech.googleapis.com/v1/speech:recognize?key={api_keys.google_speech_api_key}"
                
                # Prepare the request payload
                payload = {
                    "config": {
                        "encoding": "WEBM_OPUS",
                        "sampleRateHertz": request.sample_rate,
                        "languageCode": "en-US",
                        "enableAutomaticPunctuation": True,
                        "model": "latest_long"
                    },
                    "audio": {
                        "content": base64.b64encode(audio_data).decode('utf-8')
                    }
                }
                
                async with session.post(url, json=payload) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        raise HTTPException(status_code=400, detail=f"Google Speech API error: {error_text}")
                    
                    result = await response.json()
                    
                    # Extract transcript and confidence
                    transcript = ""
                    confidence = 0.0
                    
                    if "results" in result and result["results"]:
                        for result_item in result["results"]:
                            if "alternatives" in result_item and result_item["alternatives"]:
                                alternative = result_item["alternatives"][0]
                                transcript += alternative.get("transcript", "")
                                confidence = max(confidence, alternative.get("confidence", 0.0))
                    
                    if not transcript.strip():
                        transcript = ""
                        confidence = 0.0
                    
                    return AudioTranscriptionResponse(
                        transcript=transcript.strip(),
                        confidence=confidence,
                        session_id=request.session_id
                    )
                    
        except aiohttp.ClientError as e:
            raise HTTPException(status_code=500, detail=f"Network error: {str(e)}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Transcription error: {str(e)}")
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Transcription error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to transcribe audio: {str(e)}")

# Interview Session Management
@api_router.post("/interview/session", response_model=InterviewSession)
@limiter.limit("10/minute")
async def create_interview_session(request: Request, input: InterviewSessionCreate):
    session_obj = InterviewSession(**input.dict())
    await db.interview_sessions.insert_one(session_obj.dict())
    
    # Create indexes for better performance
    await db.interview_sessions.create_index("id")
    await db.interview_sessions.create_index("created_at")
    
    return session_obj

@api_router.get("/interview/session/{session_id}", response_model=InterviewSession)
@limiter.limit("60/minute")
async def get_interview_session(request: Request, session_id: str):
    if not session_id or len(session_id) < 10:
        raise HTTPException(status_code=400, detail="Invalid session ID")
        
    session = await db.interview_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return InterviewSession(**session)

@api_router.get("/interview/sessions", response_model=List[InterviewSession])
@limiter.limit("20/minute")
async def get_all_sessions(request: Request):
    sessions = await db.interview_sessions.find().to_list(100)
    return [InterviewSession(**session) for session in sessions]

# Transcript Management
@api_router.post("/interview/transcript", response_model=TranscriptEntry)
@limiter.limit("100/minute")
async def add_transcript(request: Request, input: TranscriptCreate):
    # Input validation
    if not input.session_id or len(input.session_id) < 10:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    if not input.text or len(input.text.strip()) < 1:
        raise HTTPException(status_code=400, detail="Transcript text is required")
    
    if len(input.text) > 10000:
        raise HTTPException(status_code=400, detail="Transcript text too long")
    
    # Verify session exists
    session = await db.interview_sessions.find_one({"id": input.session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    transcript_obj = TranscriptEntry(**input.dict())
    await db.transcripts.insert_one(transcript_obj.dict())
    
    # Create indexes for better performance
    await db.transcripts.create_index([("session_id", 1), ("timestamp", 1)])
    
    return transcript_obj

@api_router.get("/interview/transcript/{session_id}", response_model=List[TranscriptEntry])
@limiter.limit("60/minute")
async def get_session_transcripts(request: Request, session_id: str):
    if not session_id or len(session_id) < 10:
        raise HTTPException(status_code=400, detail="Invalid session ID")
        
    transcripts = await db.transcripts.find({"session_id": session_id}).sort("timestamp", 1).to_list(1000)
    return [TranscriptEntry(**transcript) for transcript in transcripts]

# AI Response Generation
@api_router.post("/interview/ai-response", response_model=AIResponse)
@limiter.limit("20/minute")
async def generate_ai_response(http_request: Request, input: AIResponseRequest, api_keys: APIKeysModel = Depends(get_api_keys)):
    # Input validation
    if not input.session_id or len(input.session_id) < 10:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    if not input.question or len(input.question.strip()) < 5:
        raise HTTPException(status_code=400, detail="Question must be at least 5 characters")
    
    if len(input.question) > 5000:
        raise HTTPException(status_code=400, detail="Question too long")
    
    try:
        # Verify session exists
        session = await db.interview_sessions.find_one({"id": input.session_id})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Get session context (recent transcripts)
        recent_transcripts = await db.transcripts.find(
            {"session_id": input.session_id}
        ).sort("timestamp", -1).limit(5).to_list(5)
        
        # Prepare context for AI
        context = "Recent interview conversation:\n"
        for transcript in reversed(recent_transcripts):
            context += f"{transcript['speaker']}: {transcript['text']}\n"
        
        # Create system message for interview assistance
        system_message = """You are an expert interview copilot assistant. Your role is to help the interviewee answer questions professionally and effectively.

When given an interview question, provide:
1. A clear, concise, and professional answer
2. Key points to emphasize
3. Examples or experiences to mention if relevant

Keep responses natural, authentic, and appropriate for a professional interview setting. 
Format your response to be easy to read quickly during an interview.

Structure your response as:
**Main Answer:** [Direct response to the question]
**Key Points:** [2-3 bullet points of important aspects to mention]
**Example/Experience:** [If relevant, suggest a brief example to share]"""

        # Initialize Gemini chat
        chat = LlmChat(
            api_key=api_keys.gemini_api_key,
            session_id=input.session_id,
            system_message=system_message
        ).with_model("gemini", "gemini-2.5-flash").with_max_tokens(1024)
        
        # Create user message with context and question
        full_prompt = f"{context}\n\nCurrent Question: {input.question}\n\nPlease provide a professional interview response:"
        user_message = UserMessage(text=full_prompt)
        
        # Get AI response
        ai_response_text = await chat.send_message(user_message)
        
        # Save the AI response
        response_obj = AIResponse(
            session_id=input.session_id,
            question=input.question,
            response=ai_response_text
        )
        await db.ai_responses.insert_one(response_obj.dict())
        
        # Create indexes for better performance
        await db.ai_responses.create_index([("session_id", 1), ("timestamp", 1)])
        
        return response_obj
        
    except Exception as e:
        logging.error(f"Error generating AI response: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate AI response: {str(e)}")

@api_router.get("/interview/ai-responses/{session_id}", response_model=List[AIResponse])
@limiter.limit("60/minute")
async def get_session_ai_responses(request: Request, session_id: str):
    if not session_id or len(session_id) < 10:
        raise HTTPException(status_code=400, detail="Invalid session ID")
        
    responses = await db.ai_responses.find({"session_id": session_id}).sort("timestamp", 1).to_list(1000)
    return [AIResponse(**response) for response in responses]

# Original status endpoints
@api_router.get("/")
@limiter.limit("100/minute")
async def root(request: Request):
    return {"message": "Interview Copilot API", "version": "1.0.0", "status": "running"}

@api_router.post("/status", response_model=StatusCheck)
@limiter.limit("30/minute")
async def create_status_check(request: Request, input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
@limiter.limit("60/minute")
async def get_status_checks(request: Request):
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)