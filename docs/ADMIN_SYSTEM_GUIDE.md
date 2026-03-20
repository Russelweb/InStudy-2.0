# InStudy 2.0 Admin System Guide

## Overview

InStudy 2.0 now includes a comprehensive admin system with the following features:

- ✅ **Admin Dashboard**: Full user and course management interface
- ✅ **Single Session Enforcement**: Only one active session per user account
- ✅ **User Management**: Create, delete, promote/demote users
- ✅ **Course Management**: Delete courses and all associated data
- ✅ **System Statistics**: Monitor system usage and health
- ✅ **Secure Access Control**: Admin-only endpoints and UI components

## Default Admin Account

A default admin account is automatically created when the system starts:

- **Email**: `admin@instudy.com`
- **Password**: `admin123`

⚠️ **Important**: Change this password immediately in production!

## Single Session Enforcement

### How It Works

- When a user logs in, all their previous sessions are automatically invalidated
- Only one active session per user account is allowed at any time
- If someone tries to login to the same account from another device/browser, the previous session becomes invalid
- This prevents account sharing and improves security

### Technical Implementation

- Database automatically deletes old sessions when creating new ones
- Frontend shows "session expired" message if token becomes invalid
- Users must re-authenticate if their session is invalidated

## Admin Dashboard Features

### 1. System Overview Tab

**System Statistics:**
- Total users count
- Total admin count  
- Total documents uploaded
- Total courses created

**System Health Monitoring:**
- Database status
- Authentication system status
- File storage availability
- Vector store operational status

### 2. User Management Tab

**User List Display:**
- View all registered users
- See user roles (Admin/Regular User)
- View registration dates
- Sort and filter capabilities

**User Actions:**
- **Promote to Admin**: Grant admin privileges to regular users
- **Revoke Admin**: Remove admin privileges (cannot revoke own privileges)
- **Delete User**: Permanently delete user and all their data
- **View User Details**: See user's courses and documents

**Safety Features:**
- Admins cannot delete their own account
- Admins cannot revoke their own admin privileges
- Confirmation dialogs for destructive actions

### 3. Course Management Tab

**Course Overview:**
- View all courses for any user
- See document counts per course
- Browse course contents

**Course Actions:**
- **Delete Course**: Remove course and all documents
- **View Documents**: See all files in a course
- **Bulk Operations**: Manage multiple courses

## API Endpoints

### Admin Authentication
- All admin endpoints require authentication
- Admin role verification on every request
- Proper error handling for unauthorized access

### Admin Endpoints

#### System Management
- `GET /api/admin/stats` - Get system-wide statistics
- `GET /api/admin/users` - Get all users list

#### User Management  
- `DELETE /api/admin/users/{user_id}` - Delete user and all data
- `POST /api/admin/users/{user_id}/make-admin` - Grant admin privileges
- `POST /api/admin/users/{user_id}/revoke-admin` - Revoke admin privileges
- `GET /api/admin/users/{user_id}/courses` - Get user's courses

#### Course Management
- `DELETE /api/admin/courses/{user_id}/{course_id}` - Delete course and data

## Security Features

### Access Control
- **Role-based Access**: Admin endpoints require admin privileges
- **Session Validation**: All requests validated against active sessions
- **Input Validation**: All admin actions validated and sanitized

### Data Protection
- **Confirmation Required**: Destructive actions require confirmation
- **Audit Logging**: All admin actions logged for accountability
- **Safe Defaults**: Admin privileges not granted by default

### Single Session Security
- **Session Invalidation**: Old sessions automatically invalidated
- **Token Rotation**: New login generates new session token
- **Concurrent Access Prevention**: Multiple logins not allowed

## Usage Instructions

### Accessing Admin Dashboard

1. **Login as Admin**:
   - Use default credentials: `admin@instudy.com` / `admin123`
   - Or login with any account that has admin privileges

2. **Navigate to Admin Panel**:
   - Admin users will see "Admin Panel" option in sidebar
   - Click to access the admin dashboard

3. **Manage Users**:
   - Go to "User Management" tab
   - Select users to promote, demote, or delete
   - View user details and courses

4. **Manage Courses**:
   - Go to "Course Management" tab  
   - Select user to view their courses
   - Delete courses as needed

### Creating Additional Admins

1. **Via Admin Dashboard**:
   - Go to User Management tab
   - Select a regular user
   - Click "🔐 Make Admin"

2. **Via Database** (for initial setup):
   - Update user record: `UPDATE users SET is_admin = 1 WHERE email = 'user@example.com'`

### Testing Single Session

1. **Login to Account**:
   - Login with any user account in one browser

2. **Login Again**:
   - Open another browser/incognito window
   - Login with same account

3. **Verify Enforcement**:
   - First browser session should become invalid
   - Only second browser should work

## Troubleshooting

### Common Issues

1. **"Access Denied" Error**:
   - Ensure user has admin privileges
   - Check if session is still valid
   - Verify admin flag in database

2. **Session Expired Frequently**:
   - This is normal with single session enforcement
   - Only one active session allowed per user
   - Login from new location invalidates old session

3. **Cannot Delete User**:
   - Cannot delete your own admin account
   - Ensure user exists in database
   - Check for proper admin privileges

### Debug Commands

**Check User Admin Status**:
```sql
SELECT id, email, is_admin FROM users WHERE email = 'user@example.com';
```

**View Active Sessions**:
```sql
SELECT s.token, s.user_id, u.email, s.expires_at 
FROM sessions s 
JOIN users u ON s.user_id = u.id 
WHERE s.expires_at > datetime('now');
```

**Make User Admin**:
```sql
UPDATE users SET is_admin = 1 WHERE email = 'user@example.com';
```

## Testing

### Automated Testing

Run the admin test script:
```bash
cd backend
python test_admin.py
```

This tests:
- Admin login functionality
- System statistics retrieval
- User management endpoints
- Single session enforcement

### Manual Testing

1. **Admin Dashboard Access**:
   - Login as admin
   - Verify "Admin Panel" appears in sidebar
   - Access all admin dashboard tabs

2. **User Management**:
   - Create test user account
   - Promote to admin via dashboard
   - Demote back to regular user
   - Delete test account

3. **Single Session**:
   - Login on one device/browser
   - Login same account on another device
   - Verify first session is invalidated

## Production Considerations

### Security Hardening

1. **Change Default Admin Password**:
   - Login as admin immediately
   - Change password from default `admin123`

2. **Limit Admin Accounts**:
   - Only create necessary admin accounts
   - Regularly review admin user list
   - Remove unused admin accounts

3. **Monitor Admin Activity**:
   - Review admin action logs
   - Monitor for suspicious admin activity
   - Set up alerts for admin actions

### Performance Optimization

1. **Database Indexing**:
   - Ensure proper indexes on user and session tables
   - Monitor query performance for admin operations

2. **Session Cleanup**:
   - Expired sessions are automatically cleaned up
   - Monitor session table size
   - Consider periodic cleanup jobs

### Backup and Recovery

1. **User Data Backup**:
   - Regular backups of user database
   - Backup user upload directories
   - Backup vector store data

2. **Admin Account Recovery**:
   - Keep secure backup of admin credentials
   - Document admin account recovery procedures
   - Test recovery procedures regularly

## Future Enhancements

Potential improvements for the admin system:

- **Audit Logging**: Detailed logs of all admin actions
- **Bulk Operations**: Mass user/course management
- **User Analytics**: Detailed user activity reports
- **System Monitoring**: Real-time system health dashboard
- **Role Management**: More granular permission system
- **API Rate Limiting**: Prevent admin API abuse
- **Admin Notifications**: Alerts for system events

## Support

For admin system issues:

1. Check the troubleshooting section above
2. Review backend logs for error details
3. Run the admin test script to verify functionality
4. Ensure all dependencies are installed correctly

The admin system provides comprehensive management capabilities while maintaining security and preventing unauthorized access.