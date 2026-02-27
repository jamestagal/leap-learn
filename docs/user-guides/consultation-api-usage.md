# Consultation API Usage Guide

This guide provides comprehensive examples and best practices for using the Consultation Domain API. The consultation system enables businesses to collect detailed information about potential clients through a structured workflow.

## Quick Start

### Authentication

All API endpoints require authentication via JWT token:

```bash
# Login to get JWT token
curl -X POST \
  http://localhost:4001/auth/login \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "user@example.com",
    "password": "your-password"
  }'

# Use the token in subsequent requests
curl -X GET \
  http://localhost:4001/consultations \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

### Basic Workflow

1. **Create a consultation** (starts in draft status)
2. **Auto-save drafts** as user fills out sections
3. **Complete the consultation** when all required fields are filled
4. **Archive consultations** after processing

## Core API Endpoints

### 1. Create Consultation

Creates a new consultation in draft status.

**Request:**
```bash
curl -X POST \
  http://localhost:4001/consultations \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "contact_info": {
      "business_name": "Tech Innovations Inc",
      "email": "contact@techinnovations.com",
      "phone": "+1-555-0123",
      "website": "https://techinnovations.com"
    },
    "business_context": {
      "industry": "technology",
      "company_size": "50-100",
      "team_size": 25,
      "years_in_business": 8
    }
  }'
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "status": "draft",
  "contact_info": {
    "business_name": "Tech Innovations Inc",
    "email": "contact@techinnovations.com",
    "phone": "+1-555-0123",
    "website": "https://techinnovations.com"
  },
  "business_context": {
    "industry": "technology",
    "company_size": "50-100",
    "team_size": 25,
    "years_in_business": 8
  },
  "completion_percentage": 25.5,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

### 2. Update Consultation (Auto-save)

Updates consultation data and automatically saves as draft.

**Request:**
```bash
curl -X PUT \
  http://localhost:4001/consultations/550e8400-e29b-41d4-a716-446655440000 \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "pain_points": {
      "primary_challenges": [
        "Slow customer acquisition",
        "High operational costs",
        "Lack of automation"
      ],
      "specific_problems": "Our current sales process is manual and time-consuming. Customer onboarding takes 2-3 weeks.",
      "impact_assessment": "This delays revenue generation and increases customer churn.",
      "urgency_level": "high"
    },
    "goals_objectives": {
      "primary_goals": [
        "Automate sales process",
        "Reduce onboarding time to 2 days",
        "Increase conversion rate by 30%"
      ],
      "success_metrics": "Time to onboard, conversion rate, customer satisfaction",
      "timeline": "3-6 months",
      "budget_range": "$50k-100k"
    }
  }'
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "status": "draft",
  "contact_info": {
    "business_name": "Tech Innovations Inc",
    "email": "contact@techinnovations.com",
    "phone": "+1-555-0123",
    "website": "https://techinnovations.com"
  },
  "business_context": {
    "industry": "technology",
    "company_size": "50-100",
    "team_size": 25,
    "years_in_business": 8
  },
  "pain_points": {
    "primary_challenges": [
      "Slow customer acquisition",
      "High operational costs",
      "Lack of automation"
    ],
    "specific_problems": "Our current sales process is manual and time-consuming...",
    "impact_assessment": "This delays revenue generation and increases customer churn.",
    "urgency_level": "high"
  },
  "goals_objectives": {
    "primary_goals": [
      "Automate sales process",
      "Reduce onboarding time to 2 days",
      "Increase conversion rate by 30%"
    ],
    "success_metrics": "Time to onboard, conversion rate, customer satisfaction",
    "timeline": "3-6 months",
    "budget_range": "$50k-100k"
  },
  "completion_percentage": 75.8,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T11:45:00Z"
}
```

### 3. Complete Consultation

Marks consultation as completed when all required sections are filled.

**Request:**
```bash
curl -X POST \
  http://localhost:4001/consultations/550e8400-e29b-41d4-a716-446655440000/complete \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "additional_context": {
      "technical_requirements": "Must integrate with existing Salesforce CRM",
      "constraints": "Budget cannot exceed $100k, timeline must be under 6 months",
      "preferred_approach": "Phased implementation starting with core automation"
    }
  }'
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "completion_percentage": 100.0,
  "completed_at": "2024-01-15T12:00:00Z",
  "message": "Consultation completed successfully"
}
```

### 4. List Consultations

Retrieve consultations with filtering and pagination.

**Request:**
```bash
# List all consultations
curl -X GET \
  http://localhost:4001/consultations \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'

# List with filters
curl -X GET \
  'http://localhost:4001/consultations?status=completed&page=1&limit=10&sort=created_at&order=desc' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

**Response:**
```json
{
  "consultations": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "contact_info": {
        "business_name": "Tech Innovations Inc",
        "email": "contact@techinnovations.com"
      },
      "status": "completed",
      "completion_percentage": 100.0,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T12:00:00Z",
      "completed_at": "2024-01-15T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "pages": 1
  }
}
```

### 5. Get Consultation Details

Retrieve full details for a specific consultation.

**Request:**
```bash
curl -X GET \
  http://localhost:4001/consultations/550e8400-e29b-41d4-a716-446655440000 \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

## Draft Management

### Auto-save Functionality

The system automatically saves consultation progress as drafts:

- **Auto-save interval**: Every 30 seconds when user is actively editing
- **Manual save**: Triggered on field blur or explicit save action
- **Conflict resolution**: Last-write-wins with user notification

**Monitor Draft Status:**
```bash
curl -X GET \
  http://localhost:4001/consultations/550e8400-e29b-41d4-a716-446655440000/drafts \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

**Response:**
```json
{
  "consultation_id": "550e8400-e29b-41d4-a716-446655440000",
  "latest_draft": {
    "id": "draft-123",
    "data": {
      "contact_info": { "business_name": "Updated Name" }
    },
    "saved_at": "2024-01-15T11:45:30Z",
    "auto_saved": true
  },
  "has_unsaved_changes": false
}
```

### Restore from Draft

```bash
curl -X POST \
  http://localhost:4001/consultations/550e8400-e29b-41d4-a716-446655440000/restore-draft \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -d '{"draft_id": "draft-123"}'
```

## Version History

### View Version History

Track all changes made to a consultation:

```bash
curl -X GET \
  http://localhost:4001/consultations/550e8400-e29b-41d4-a716-446655440000/versions \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

**Response:**
```json
{
  "versions": [
    {
      "id": "version-456",
      "version_number": 3,
      "changes": [
        "Updated pain_points.primary_challenges",
        "Added goals_objectives.budget_range"
      ],
      "created_at": "2024-01-15T11:45:00Z",
      "created_by": "user@example.com"
    },
    {
      "id": "version-455",
      "version_number": 2,
      "changes": [
        "Updated business_context.team_size"
      ],
      "created_at": "2024-01-15T10:45:00Z",
      "created_by": "user@example.com"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 2,
    "pages": 1
  }
}
```

### Rollback to Previous Version

```bash
curl -X POST \
  http://localhost:4001/consultations/550e8400-e29b-41d4-a716-446655440000/rollback \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -d '{"version_id": "version-455"}'
```

## Error Handling

### Common Error Responses

**Validation Error (400):**
```json
{
  "error": "validation_failed",
  "message": "Invalid input data",
  "details": {
    "contact_info.email": "Invalid email format",
    "business_context.team_size": "Must be a positive integer"
  }
}
```

**Not Found (404):**
```json
{
  "error": "consultation_not_found",
  "message": "Consultation with ID 550e8400-e29b-41d4-a716-446655440000 not found"
}
```

**Unauthorized (401):**
```json
{
  "error": "unauthorized",
  "message": "Invalid or expired JWT token"
}
```

**Conflict (409):**
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

## Advanced Usage

### Batch Operations

**Export Multiple Consultations:**
```bash
curl -X POST \
  http://localhost:4001/consultations/export \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -d '{
    "consultation_ids": [
      "550e8400-e29b-41d4-a716-446655440000",
      "660f9500-f39c-52e5-b827-557766551111"
    ],
    "format": "json"
  }'
```

### Search and Filtering

**Complex Search:**
```bash
curl -X GET \
  'http://localhost:4001/consultations/search?q=technology&industry=tech&budget_min=50000&created_after=2024-01-01' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

### Webhooks (if implemented)

**Register Webhook:**
```bash
curl -X POST \
  http://localhost:4001/webhooks \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -d '{
    "url": "https://your-app.com/webhooks/consultation",
    "events": ["consultation.completed", "consultation.archived"],
    "secret": "your-webhook-secret"
  }'
```

## Rate Limiting

The API implements rate limiting to ensure fair usage:

- **Rate limit**: 100 requests per minute per user
- **Burst limit**: 20 requests per 10 seconds
- **Headers**: Check `X-RateLimit-*` headers in responses

**Example Response Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 85
X-RateLimit-Reset: 1642248600
```

## Best Practices

### 1. Efficient Data Loading
- Use pagination for list endpoints
- Request only needed fields using field selection
- Cache consultation data locally when possible

### 2. Error Handling
- Always check HTTP status codes
- Parse error details for user-friendly messages
- Implement retry logic with exponential backoff

### 3. Performance Optimization
- Batch API calls when possible
- Use appropriate page sizes (10-50 items)
- Implement client-side caching for reference data

### 4. Security
- Always use HTTPS in production
- Store JWT tokens securely
- Implement token refresh logic
- Validate all user inputs client-side

### 5. User Experience
- Show progress indicators for long operations
- Implement auto-save with visual feedback
- Handle network failures gracefully
- Provide clear error messages to users

## SDK Examples

### JavaScript/TypeScript

```typescript
import { ConsultationAPI } from '@yourorg/consultation-sdk';

const api = new ConsultationAPI({
  baseURL: 'http://localhost:4001',
  token: 'YOUR_JWT_TOKEN'
});

// Create consultation
const consultation = await api.consultations.create({
  contact_info: {
    business_name: 'Tech Innovations Inc',
    email: 'contact@techinnovations.com'
  }
});

// Auto-save draft
await api.consultations.update(consultation.id, {
  business_context: { industry: 'technology' }
});

// Complete consultation
await api.consultations.complete(consultation.id);
```

### Python

```python
from consultation_client import ConsultationClient

client = ConsultationClient(
    base_url='http://localhost:4001',
    token='YOUR_JWT_TOKEN'
)

# Create consultation
consultation = client.consultations.create({
    'contact_info': {
        'business_name': 'Tech Innovations Inc',
        'email': 'contact@techinnovations.com'
    }
})

# List consultations
consultations = client.consultations.list(status='completed', page=1, limit=10)
```

### Go

```go
package main

import (
    "github.com/yourorg/consultation-go-client"
)

func main() {
    client := consultation.NewClient("http://localhost:4001", "YOUR_JWT_TOKEN")

    // Create consultation
    req := &consultation.CreateRequest{
        ContactInfo: &consultation.ContactInfo{
            BusinessName: "Tech Innovations Inc",
            Email:       "contact@techinnovations.com",
        },
    }

    consultation, err := client.Consultations.Create(ctx, req)
    if err != nil {
        log.Fatal(err)
    }
}
```

## Integration Examples

### React Hook Example

```typescript
import { useState, useEffect } from 'react';
import { useConsultationAPI } from './hooks/useConsultationAPI';

export const ConsultationForm = ({ consultationId }: { consultationId?: string }) => {
  const { consultation, updateConsultation, completeConsultation } = useConsultationAPI(consultationId);
  const [formData, setFormData] = useState(consultation?.data || {});

  // Auto-save functionality
  useEffect(() => {
    const autoSaveTimer = setTimeout(() => {
      if (consultation?.id && formData !== consultation.data) {
        updateConsultation(formData);
      }
    }, 30000); // Auto-save every 30 seconds

    return () => clearTimeout(autoSaveTimer);
  }, [formData, consultation, updateConsultation]);

  const handleSubmit = async () => {
    await completeConsultation(formData);
  };

  return (
    <form>
      {/* Form fields */}
      <button onClick={handleSubmit}>Complete Consultation</button>
    </form>
  );
};
```

This guide provides a comprehensive overview of the Consultation API. For more specific integration examples or advanced use cases, consult the technical documentation or contact the development team.