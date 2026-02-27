# Consultation Domain Troubleshooting Guide

This guide covers common issues, error scenarios, and solutions when working with the Consultation Domain API.

## Table of Contents

1. [Authentication Issues](#authentication-issues)
2. [API Connectivity Problems](#api-connectivity-problems)
3. [Data Validation Errors](#data-validation-errors)
4. [Performance Issues](#performance-issues)
5. [Database Connection Problems](#database-connection-problems)
6. [Auto-save and Draft Issues](#auto-save-and-draft-issues)
7. [Version Control Conflicts](#version-control-conflicts)
8. [Deployment Issues](#deployment-issues)
9. [Monitoring and Debugging](#monitoring-and-debugging)
10. [Common Error Codes](#common-error-codes)

## Authentication Issues

### Issue: "401 Unauthorized" when making API calls

**Symptoms:**
```json
{
  "error": "unauthorized",
  "message": "Invalid or expired JWT token"
}
```

**Possible Causes:**
- Expired JWT token
- Invalid token format
- Missing Authorization header
- Token not properly stored

**Solutions:**

1. **Check token expiration:**
```bash
# Decode JWT token to check expiration
echo "YOUR_JWT_TOKEN" | cut -d'.' -f2 | base64 -d | jq '.exp'
```

2. **Refresh token if expired:**
```javascript
// JavaScript example
const refreshToken = async () => {
  try {
    const response = await fetch('/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('refresh_token')}`
      }
    });

    if (response.ok) {
      const { token } = await response.json();
      localStorage.setItem('auth_token', token);
      return token;
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
    // Redirect to login
    window.location.href = '/login';
  }
};
```

3. **Verify header format:**
```bash
# Correct format
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" http://localhost:4001/consultations

# Incorrect format (missing "Bearer")
curl -H "Authorization: YOUR_JWT_TOKEN" http://localhost:4001/consultations
```

### Issue: Token refresh not working

**Solutions:**
1. Check refresh token validity
2. Verify refresh endpoint configuration
3. Clear all stored tokens and re-login

```javascript
const forceReLogin = () => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('refresh_token');
  sessionStorage.clear();
  window.location.href = '/login';
};
```

## API Connectivity Problems

### Issue: "Connection refused" or network timeouts

**Symptoms:**
- API requests failing with network errors
- Inconsistent connectivity
- Slow response times

**Diagnostic Steps:**

1. **Check service health:**
```bash
# Health check endpoint
curl http://localhost:4001/health

# Expected response
{
  "status": "healthy",
  "service": "consultation-domain",
  "version": "1.0.0",
  "timestamp": "2024-01-15T12:00:00Z"
}
```

2. **Verify service is running:**
```bash
# Check if service is listening on expected port
netstat -tlnp | grep 4001

# Check Docker containers
docker ps | grep service-core
```

3. **Test database connectivity:**
```bash
# From inside service container
docker exec -it service-core-container psql -h postgres -U username -d database_name
```

**Solutions:**

1. **Service restart:**
```bash
# Docker Compose
docker-compose restart service-core

# Kubernetes
kubectl rollout restart deployment/service-core
```

2. **Check environment variables:**
```bash
# Verify API URL configuration
echo $API_URL
echo $DATABASE_URL
echo $JWT_SECRET
```

3. **Network troubleshooting:**
```bash
# Test connectivity to database
telnet postgres-host 5432

# Check DNS resolution
nslookup service-core
```

## Data Validation Errors

### Issue: "400 Bad Request" with validation errors

**Common Validation Errors:**

1. **Invalid email format:**
```json
{
  "error": "validation_failed",
  "details": {
    "contact_info.email": "Invalid email format"
  }
}
```

**Solution:**
```javascript
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};
```

2. **Missing required fields:**
```json
{
  "error": "validation_failed",
  "details": {
    "contact_info.business_name": "This field is required",
    "business_context.industry": "This field is required"
  }
}
```

**Solution:**
```javascript
const validateRequiredFields = (data) => {
  const errors = {};

  if (!data.contact_info?.business_name) {
    errors['contact_info.business_name'] = 'Business name is required';
  }

  if (!data.business_context?.industry) {
    errors['business_context.industry'] = 'Industry is required';
  }

  return Object.keys(errors).length > 0 ? errors : null;
};
```

3. **Invalid data types:**
```json
{
  "error": "validation_failed",
  "details": {
    "business_context.team_size": "Must be a positive integer"
  }
}
```

**Solution:**
```javascript
const validateTeamSize = (teamSize) => {
  if (teamSize !== undefined && teamSize !== null) {
    const num = parseInt(teamSize, 10);
    return !isNaN(num) && num > 0;
  }
  return true; // Optional field
};
```

### Issue: Array field validation errors

**Problem:** Sending string instead of array for multi-value fields

**Incorrect:**
```json
{
  "pain_points": {
    "primary_challenges": "Slow customer acquisition"
  }
}
```

**Correct:**
```json
{
  "pain_points": {
    "primary_challenges": ["Slow customer acquisition", "High operational costs"]
  }
}
```

**Frontend validation:**
```javascript
const ensureArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return [value];
  return [];
};
```

## Performance Issues

### Issue: Slow API response times

**Diagnostic Steps:**

1. **Check response times:**
```bash
# Time a simple request
time curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:4001/consultations

# Expected: < 2 seconds for list operations
# Expected: < 1 second for individual consultation
```

2. **Monitor database queries:**
```sql
-- Check slow queries (PostgreSQL)
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query LIKE '%consultation%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

3. **Check server load:**
```bash
# Monitor CPU and memory usage
docker stats service-core-container

# Check database connections
docker exec postgres-container psql -c "SELECT count(*) FROM pg_stat_activity;"
```

**Solutions:**

1. **Optimize pagination:**
```javascript
// Instead of loading all consultations
const loadAllConsultations = async () => {
  return await api.consultations.list({ limit: 1000 }); // Bad
};

// Use proper pagination
const loadConsultationsPage = async (page = 1, limit = 20) => {
  return await api.consultations.list({ page, limit }); // Good
};
```

2. **Implement caching:**
```javascript
const consultationCache = new Map();

const getCachedConsultation = async (id) => {
  if (consultationCache.has(id)) {
    return consultationCache.get(id);
  }

  const consultation = await api.consultations.get(id);
  consultationCache.set(id, consultation);
  return consultation;
};
```

3. **Reduce payload size:**
```javascript
// Request only needed fields
const loadConsultationSummary = async () => {
  return await api.consultations.list({
    fields: 'id,contact_info.business_name,status,completion_percentage,updated_at'
  });
};
```

### Issue: Memory leaks in frontend applications

**Common Causes:**
- Event listeners not cleaned up
- Intervals/timeouts not cleared
- Subscription not unsubscribed

**React Solution:**
```javascript
useEffect(() => {
  const autoSaveInterval = setInterval(() => {
    if (formData.hasChanges) {
      autoSave(formData);
    }
  }, 30000);

  return () => {
    clearInterval(autoSaveInterval); // Cleanup
  };
}, [formData]);
```

**Vue Solution:**
```javascript
beforeUnmount() {
  if (this.autoSaveInterval) {
    clearInterval(this.autoSaveInterval);
  }
  if (this.apiSubscription) {
    this.apiSubscription.unsubscribe();
  }
}
```

## Database Connection Problems

### Issue: "Database connection failed"

**Symptoms:**
```json
{
  "error": "database_error",
  "message": "Connection to database failed"
}
```

**Diagnostic Steps:**

1. **Check database status:**
```bash
# Check if PostgreSQL is running
docker exec postgres-container pg_isready

# Check connection from service
docker exec service-core-container pg_isready -h postgres -p 5432
```

2. **Verify connection string:**
```bash
# Check environment variables
docker exec service-core-container env | grep DATABASE
```

3. **Test manual connection:**
```bash
# Connect to database manually
psql "postgresql://username:password@postgres:5432/database_name"
```

**Solutions:**

1. **Restart database service:**
```bash
docker-compose restart postgres
```

2. **Check database logs:**
```bash
docker logs postgres-container --tail 50
```

3. **Verify user permissions:**
```sql
-- Check user permissions
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name='consultations';
```

### Issue: Database migration failures

**Check migration status:**
```bash
# Check Atlas migration status
docker exec service-core-container atlas migrate status \
  --url "postgres://user:pass@postgres/db?sslmode=disable"
```

**Common migration issues:**

1. **Schema conflicts:**
```sql
-- Check for existing tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE '%consultation%';
```

2. **Permission issues:**
```sql
-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE database_name TO username;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO username;
```

## Auto-save and Draft Issues

### Issue: Auto-save not working

**Diagnostic Steps:**

1. **Check auto-save configuration:**
```javascript
// Verify auto-save interval
console.log('Auto-save interval:', AUTO_SAVE_INTERVAL);

// Check if auto-save is triggered
const autoSave = debounce(async (data) => {
  console.log('Auto-saving:', data);
  await api.consultations.update(consultationId, data);
}, 30000);
```

2. **Monitor network requests:**
```javascript
// Add logging to API calls
const originalUpdate = api.consultations.update;
api.consultations.update = function(...args) {
  console.log('API update called:', args);
  return originalUpdate.apply(this, args);
};
```

**Common Issues:**

1. **Race conditions:**
```javascript
// Problem: Multiple auto-saves firing
let autoSavePromise = null;

const autoSave = async (data) => {
  if (autoSavePromise) {
    await autoSavePromise; // Wait for previous save
  }

  autoSavePromise = api.consultations.update(consultationId, data);
  return autoSavePromise;
};
```

2. **Stale data being saved:**
```javascript
// Problem: Using old state in auto-save
useEffect(() => {
  const timer = setTimeout(() => {
    autoSave(formData); // May use stale formData
  }, 30000);

  return () => clearTimeout(timer);
}, [/* missing formData dependency */]);

// Solution: Include all dependencies
useEffect(() => {
  const timer = setTimeout(() => {
    autoSave(formData);
  }, 30000);

  return () => clearTimeout(timer);
}, [formData]); // Include formData dependency
```

### Issue: Draft conflicts

**Scenario:** Multiple users editing the same consultation

**Error Response:**
```json
{
  "error": "consultation_modified",
  "message": "Consultation was modified by another user",
  "details": {
    "last_modified": "2024-01-15T11:50:00Z",
    "modified_by": "other-user@example.com"
  }
}
```

**Solution - Conflict Resolution:**
```javascript
const handleSaveConflict = async (error, localData) => {
  if (error.status === 409) { // Conflict
    const result = await showConflictDialog({
      message: 'This consultation was modified by another user.',
      localChanges: localData,
      remoteChanges: error.data.current_data,
      lastModifiedBy: error.data.modified_by,
      options: ['Use my changes', 'Use their changes', 'Merge changes']
    });

    switch (result.action) {
      case 'use_local':
        return api.consultations.forceUpdate(consultationId, localData);
      case 'use_remote':
        return error.data.current_data;
      case 'merge':
        const merged = await mergeChanges(localData, error.data.current_data);
        return api.consultations.update(consultationId, merged);
    }
  }
  throw error;
};
```

## Version Control Conflicts

### Issue: Unable to rollback to previous version

**Error:**
```json
{
  "error": "version_not_found",
  "message": "Version with ID version-123 not found"
}
```

**Solutions:**

1. **Check version history:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:4001/consultations/CONSULTATION_ID/versions
```

2. **Verify version permissions:**
```javascript
const checkVersionAccess = async (consultationId, versionId) => {
  try {
    const versions = await api.consultations.getVersionHistory(consultationId);
    return versions.some(v => v.id === versionId);
  } catch (error) {
    console.error('Cannot access version history:', error);
    return false;
  }
};
```

### Issue: Version history too large

**Problem:** Too many versions causing performance issues

**Solution - Version cleanup:**
```bash
# Clean up old versions (keep last 50)
curl -X DELETE \
  -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:4001/consultations/CONSULTATION_ID/versions/cleanup?keep=50"
```

## Deployment Issues

### Issue: Service won't start after deployment

**Check deployment logs:**
```bash
# Docker
docker logs service-core-container --tail 100

# Kubernetes
kubectl logs deployment/service-core -n consultation-domain
```

**Common deployment issues:**

1. **Environment variable missing:**
```bash
# Check required environment variables
docker exec service-core-container env | grep -E "(DATABASE_URL|JWT_SECRET|PORT)"
```

2. **Database migration not run:**
```bash
# Run migrations manually
docker exec service-core-container atlas migrate apply \
  --url "postgres://user:pass@postgres/db?sslmode=disable"
```

3. **Port conflicts:**
```bash
# Check if port is already in use
netstat -tlnp | grep 4001
```

### Issue: Health check failures

**Test health endpoint:**
```bash
curl -f http://localhost:4001/health || echo "Health check failed"
```

**Common health check issues:**
- Database not accessible
- Required services not ready
- Configuration errors

**Solution:**
```bash
# Check dependencies
docker exec service-core-container netcat -zv postgres 5432
docker exec service-core-container netcat -zv nats 4222
```

## Monitoring and Debugging

### Enable Debug Logging

**Environment variables:**
```bash
export LOG_LEVEL=debug
export ENABLE_SQL_LOGGING=true
export ENABLE_REQUEST_LOGGING=true
```

**Application configuration:**
```yaml
# docker-compose.yml
services:
  service-core:
    environment:
      - LOG_LEVEL=debug
      - ENABLE_SQL_LOGGING=true
      - ENABLE_REQUEST_LOGGING=true
```

### Monitoring API Performance

**Using curl with timing:**
```bash
curl -w "@curl-format.txt" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:4001/consultations

# curl-format.txt
     time_namelookup:  %{time_namelookup}\n
        time_connect:  %{time_connect}\n
     time_appconnect:  %{time_appconnect}\n
    time_pretransfer:  %{time_pretransfer}\n
       time_redirect:  %{time_redirect}\n
  time_starttransfer:  %{time_starttransfer}\n
                     ----------\n
          time_total:  %{time_total}\n
```

**Database query monitoring:**
```sql
-- Enable query logging in PostgreSQL
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_duration = on;
SELECT pg_reload_conf();
```

### Frontend Debugging

**API request debugging:**
```javascript
// Add request/response interceptors
api.interceptors.request.use(request => {
  console.log('Starting Request:', request);
  return request;
});

api.interceptors.response.use(
  response => {
    console.log('Response:', response);
    return response;
  },
  error => {
    console.error('API Error:', error.response || error);
    return Promise.reject(error);
  }
);
```

**Auto-save debugging:**
```javascript
const debugAutoSave = (data) => {
  console.group('Auto-save Debug');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Data changed:', data);
  console.log('Consultation ID:', consultationId);
  console.log('User ID:', currentUser?.id);
  console.groupEnd();
};
```

## Common Error Codes

### HTTP Status Codes

| Code | Error | Meaning | Solution |
|------|-------|---------|----------|
| 400 | Bad Request | Invalid request data | Check request payload and validation |
| 401 | Unauthorized | Authentication failed | Check JWT token |
| 403 | Forbidden | Insufficient permissions | Check user roles and permissions |
| 404 | Not Found | Resource doesn't exist | Verify consultation ID |
| 409 | Conflict | Concurrent modification | Handle conflict resolution |
| 422 | Unprocessable Entity | Validation failed | Fix validation errors |
| 500 | Internal Server Error | Server error | Check server logs |
| 503 | Service Unavailable | Service temporarily down | Wait and retry |

### Application-Specific Errors

| Error Code | Description | Common Causes | Solution |
|------------|-------------|---------------|----------|
| `consultation_not_found` | Consultation doesn't exist | Invalid ID, deleted consultation | Verify consultation exists |
| `consultation_modified` | Concurrent modification | Multiple users editing | Implement conflict resolution |
| `validation_failed` | Input validation failed | Invalid data format | Fix validation errors |
| `database_error` | Database operation failed | Connection issues, constraint violations | Check database connectivity |
| `auto_save_failed` | Auto-save operation failed | Network issues, validation errors | Retry or manual save |
| `version_not_found` | Version doesn't exist | Invalid version ID | Check version history |
| `insufficient_permissions` | User lacks permissions | Role/permission issues | Check user authorization |

### Rate Limiting Errors

```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests",
  "details": {
    "limit": 100,
    "remaining": 0,
    "reset_time": "2024-01-15T12:01:00Z"
  }
}
```

**Solution:**
```javascript
const handleRateLimit = async (error) => {
  if (error.status === 429) {
    const resetTime = new Date(error.data.details.reset_time);
    const waitTime = resetTime.getTime() - Date.now();

    console.log(`Rate limited. Waiting ${waitTime}ms before retry`);
    await new Promise(resolve => setTimeout(resolve, waitTime));

    // Retry the request
    return retryRequest();
  }
  throw error;
};
```

This troubleshooting guide covers the most common issues you may encounter when working with the Consultation Domain API. For issues not covered here, check the application logs and contact the development team with specific error messages and reproduction steps.