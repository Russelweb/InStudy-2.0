# InStudy 2.0 Authentication System

## Overview

InStudy 2.0 now includes a complete user authentication system with the following features:

- ✅ **Local Authentication**: SQLite database with PBKDF2 password hashing
- ✅ **Email + Password**: Simple registration with email validation
- ✅ **Persistent Sessions**: 30-day session tokens with automatic cleanup
- ✅ **Login-First UI**: Authentication required before accessing any features
- ✅ **User Isolation**: Each user gets their own upload and vector store directories
- ✅ **Secure API**: All endpoints protected with authentication middleware

## Quick Start

### 1. Start the Backend

```bash
cd backend
pip install -r requirements.txt
python main.py
```

### 2. Start the Frontend

```bash
cd frontend
pip install -r requirements.txt
streamlit run app.py
```

### 3. Create Your Account

1. Open http://localhost:8501
2. Click "Create Account"
3. Enter your email and password
4. Start using InStudy 2.0!

## Architecture

### Backend Components

- **Authentication Database** (`backend/database/auth_db.py`): SQLite operations for users and sessions
- **Authentication Service** (`backend/services/auth_service.py`): Business logic layer
- **Authentication Routes** (`backend/api/routes/auth.py`): API endpoints for auth operations
- **Authentication Middleware** (`backend/middleware/auth_middleware.py`): Protects all API routes
- **Authentication Models** (`backend/models/auth_models.py`): Pydantic models for validation

### Frontend Components

- **Authentication Manager** (`frontend/utils/auth_utils.py`): Handles auth state and API calls
- **Authentication Guard** (`frontend/components/auth_guard.py`): Protects pages and shows login forms
- **Updated App** (`frontend/app.py`): Requires authentication before showing main interface

## API Endpoints

### Authentication Endpoints

- `POST /api/auth/register` - Register new user account
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - Logout and invalidate session
- `GET /api/auth/me` - Get current user information
- `POST /api/auth/verify` - Verify session token validity

### Protected Endpoints

All existing endpoints now require authentication:

- `/api/documents/*` - Document upload and management
- `/api/chat/*` - AI tutor chat functionality
- `/api/quiz/*` - Quiz generation
- `/api/flashcards/*` - Flashcard generation
- `/api/summary/*` - Document summarization
- `/api/planner/*` - Study planning
- `/api/stats/*` - User statistics and analytics

## User Data Isolation

Each authenticated user gets their own isolated directories:

```
backend/
├── uploads/
│   ├── 1/                    # User ID 1's files
│   │   ├── course1/
│   │   └── course2/
│   └── 2/                    # User ID 2's files
│       ├── course1/
│       └── course2/
└── vector_store/
    ├── 1_course1/            # User 1's course 1 vectors
    ├── 1_course2/            # User 1's course 2 vectors
    ├── 2_course1/            # User 2's course 1 vectors
    └── 2_course2/            # User 2's course 2 vectors
```

## Security Features

### Password Security
- PBKDF2 hashing with SHA-256
- 100,000 iterations for strong security
- Random 32-character salt per password
- Constant-time comparison to prevent timing attacks

### Session Security
- Cryptographically secure 32-byte tokens
- 30-day expiration with automatic cleanup
- HTTP-only token transmission
- Secure token storage in session state

### API Security
- All endpoints protected by authentication middleware
- Bearer token authentication
- Automatic user context injection
- Proper error handling and status codes

## Testing

### Manual Testing

1. **Registration Flow**:
   - Go to http://localhost:8501
   - Click "Create Account"
   - Enter email and password
   - Verify account creation and automatic login

2. **Login Flow**:
   - Logout from current session
   - Click "Sign In"
   - Enter credentials
   - Verify successful login

3. **Feature Access**:
   - Upload documents
   - Ask AI tutor questions
   - Generate quizzes and flashcards
   - Verify all features work with authentication

### Automated Testing

Run the authentication test script:

```bash
cd backend
python test_auth.py
```

This tests:
- User registration
- User login
- Protected endpoint access
- User info retrieval
- Logout functionality
- Access denial after logout

## Migration from Demo User

The system automatically migrates from the previous "demo_user" approach:

- **Before**: All users shared "demo_user" data
- **After**: Each authenticated user gets isolated data
- **Compatibility**: Existing demo_user data remains accessible for reference

## Configuration

### Environment Variables

No additional environment variables required. The system uses:

- SQLite database stored at `backend/users.db`
- Session tokens with 30-day expiration
- Automatic directory creation for new users

### Customization

You can customize the authentication system by modifying:

- **Session Duration**: Change `expires_days` in `auth_service.py`
- **Password Requirements**: Update validation in `auth_models.py`
- **Database Location**: Modify `db_path` in `auth_db.py`

## Troubleshooting

### Common Issues

1. **"Authentication required" errors**:
   - Ensure you're logged in
   - Check if session has expired
   - Verify backend is running

2. **"Cannot connect to backend" errors**:
   - Start the backend server: `python backend/main.py`
   - Check if running on http://localhost:8000

3. **Registration/login failures**:
   - Verify email format is valid
   - Ensure password is at least 8 characters
   - Check backend logs for detailed errors

### Debug Mode

Enable debug logging by setting log level in backend:

```python
logging.basicConfig(level=logging.DEBUG)
```

## Future Enhancements

Potential improvements for the authentication system:

- **Password Reset**: Email-based password recovery
- **Email Verification**: Verify email addresses during registration
- **Two-Factor Authentication**: TOTP-based 2FA
- **Social Login**: OAuth integration with Google/GitHub
- **Admin Panel**: User management interface
- **Rate Limiting**: Prevent brute force attacks
- **Audit Logging**: Track authentication events

## Support

For issues or questions about the authentication system:

1. Check the troubleshooting section above
2. Review backend logs for error details
3. Run the test script to verify system health
4. Check that all dependencies are installed correctly

The authentication system is designed to be secure, user-friendly, and maintainable while providing complete data isolation between users.