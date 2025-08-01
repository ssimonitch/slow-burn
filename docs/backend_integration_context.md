# Backend Integration Context for Frontend Team

This document provides important context from the backend Sprint 2 implementation that will help the frontend team understand the architecture and capabilities available.

## Authentication Architecture

### Key Decision: Frontend-Direct Authentication
During Sprint 2, a critical architecture decision was made:
- **Frontend handles all user-facing authentication** by calling Supabase directly using the supabase-js client library
- **Backend acts as a secure resource server** that validates JWTs but does NOT provide authentication endpoints like `/login` or `/signup`
- This approach simplifies the architecture and leverages Supabase's robust client-side authentication features

### How It Works
1. Frontend uses Supabase SDK for all auth operations (sign up, login, password reset, etc.)
2. Supabase returns a JWT access token upon successful authentication
3. Frontend includes this JWT in the Authorization header when calling backend APIs
4. Backend validates the JWT using JWKS public key verification with caching for performance

### Backend JWT Validation
The backend implements comprehensive JWT validation with:
- JWKS public key verification (no secret key needed)
- Automatic key rotation handling
- 10-minute cache for optimal performance
- Fallback to Supabase API validation when needed
- Two dependency types: `require_auth` and `optional_auth`

## Database Schema Overview

The backend team has implemented a comprehensive database schema with the following tables:

### Core Tables
1. **users** - Extended user profiles beyond Supabase auth
   - Includes `affinity_score` for AI companion relationship tracking
   - `preferences` JSONB field for user settings
   - Automatic `updated_at` timestamps

2. **plans** - Workout plans with immutable versioning
   - Version tracking system (plans are never modified, only new versions created)
   - Support for public/private plans
   - Comprehensive metadata including difficulty levels

3. **exercises** - Comprehensive exercise library
   - Advanced biomechanical classification system
   - Multiple categorization dimensions (equipment, force type, mechanics)
   - Relationships for exercise variations and progressions
   - Pre-seeded with extensive exercise data

4. **workout_sessions** - Intermediate table for workout tracking
   - Links users to their workout instances
   - Tracks session-level metrics (duration, notes, ratings)

5. **sets** - Individual set tracking
   - Automatic volume load calculation (weight × reps)
   - Comprehensive performance metrics (RPE, rest time, tempo)
   - Links to both exercises and workout sessions

6. **memories** - AI conversation memory with vector search
   - Uses pgvector extension with halfvec(3072) for embeddings
   - HNSW index for optimized similarity search
   - Conversation grouping with `conversations` table
   - Custom `search_memories` function for semantic search

### Advanced Features

#### Vector Search for AI Memory
The backend implements semantic memory search using pgvector:
- 3072-dimensional vectors (matching OpenAI/Gemini embeddings)
- Optimized HNSW indexing for fast similarity search
- Conversation context tracking
- This enables the AI to remember past interactions and provide contextual responses

#### Exercise Classification System
The exercise library includes:
- **Movement patterns** (push, pull, squat, hinge, carry, etc.)
- **Muscle groups** with primary/secondary targeting
- **Equipment categories** (barbell, dumbbell, machine, bodyweight, etc.)
- **Biomechanical properties** (compound/isolation, bilateral/unilateral)
- Junction tables for many-to-many relationships

#### Immutable Plan Versioning
- Plans are never edited directly
- Each modification creates a new version
- Full history tracking
- Enables plan sharing and templates

## API Patterns

### Protected Endpoints
All backend endpoints (except health checks) require JWT authentication:
```
Authorization: Bearer <jwt_token_from_supabase>
```

### Expected API Structure
- `/api/v1/plans` - CRUD operations for workout plans
- `/api/v1/exercises` - Browse and search exercise library
- `/api/v1/workouts/log` - Submit completed workout sessions
- `/api/v1/chat` - AI companion chat interface
- `/api/v1/auth/me` - Get current user profile (example protected endpoint)

### Response Formats
The backend uses consistent JSON response formats with:
- Pydantic models for automatic validation
- Detailed error messages with proper HTTP status codes
- Pagination support where applicable

## AI Integration Details

### Chat Endpoint Flow
When the frontend calls the `/chat` endpoint:
1. Backend receives the user's message
2. Retrieves relevant memories using vector similarity search
3. Constructs a detailed prompt with AI persona and context
4. Calls Google Gemini 2.5 Flash API
5. Returns structured JSON response

### Affinity System
- Each user has an `affinity_score` tracking their relationship with the AI
- Score increases when users complete workouts
- Score is passed to AI for personality adjustments
- Enables progressive relationship building

## Important Considerations for Frontend

1. **Authentication State**: Always check Supabase session before making backend calls
2. **Token Refresh**: Supabase SDK handles token refresh automatically
3. **Error Handling**: Backend returns detailed error messages - display appropriately
4. **Offline Support**: Plan for offline workout logging with sync when online
5. **Vector Embeddings**: Text sent to `/chat` will be converted to embeddings server-side

## Performance Optimizations

The backend includes several performance optimizations:
- JWT validation caching (10-minute TTL)
- Database indexes on all foreign keys and commonly queried fields
- HNSW vector indexes for fast similarity search
- Connection pooling for database queries

## Security Measures

- Row Level Security (RLS) enabled on all tables
- User data isolation (users can only access their own data)
- No direct database access from frontend
- All inputs validated with Pydantic models
- SQL injection prevention through parameterized queries

This architecture ensures a secure, performant, and scalable foundation for the Slow Burn AI Fitness Companion.