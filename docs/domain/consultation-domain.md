# Consultation Domain Documentation

## Overview

The Consultation Domain is a core business component of the GoFast microservices application that manages client consultation data for sales professionals. It provides structured data capture, progressive saving, and comprehensive lifecycle management for business consultations.

## Business Purpose

This domain enables sales professionals to:
- Systematically collect client information during consultations
- Track consultation progress with auto-save functionality
- Maintain consistent data capture across all client interactions
- Provide reliable data storage with version tracking for accountability
- Generate structured data for follow-up activities and proposal preparation

## Data Model

### Core Entities

#### Consultation
The primary entity representing a client consultation session.

**Fields:**
- `id`: Unique consultation identifier (UUID)
- `user_id`: Sales professional who owns the consultation (UUID)
- `contact_info`: JSON structure containing business contact details
- `business_context`: JSON structure with business operational information
- `pain_points`: JSON structure documenting challenges and issues
- `goals_objectives`: JSON structure capturing business goals and project requirements
- `status`: Current consultation status (`draft`, `completed`, `archived`)
- `completion_percentage`: Automatically calculated completion percentage (0-100)
- `created_at`: Timestamp when consultation was created
- `updated_at`: Timestamp of last modification
- `completed_at`: Timestamp when consultation was marked complete

#### ConsultationDraft
Intermediate storage for partially completed consultations to support auto-save functionality.

**Fields:**
- `id`: Unique draft identifier (UUID)
- `consultation_id`: Reference to parent consultation (UUID)
- `contact_info`: Partial contact information (JSON)
- `business_context`: Partial business context (JSON)
- `pain_points`: Partial pain points data (JSON)
- `goals_objectives`: Partial goals and objectives (JSON)
- `auto_saved`: Boolean indicating if this was an automatic save
- `draft_notes`: Optional notes about the draft state
- `created_at`: Draft creation timestamp
- `updated_at`: Last draft modification timestamp

#### ConsultationVersion
Historical snapshots of consultations for audit trail and rollback capabilities.

**Fields:**
- `id`: Unique version identifier (UUID)
- `consultation_id`: Reference to parent consultation (UUID)
- `user_id`: User who made the changes (UUID)
- `version_number`: Sequential version number
- `contact_info`: Contact info at this version (JSON)
- `business_context`: Business context at this version (JSON)
- `pain_points`: Pain points at this version (JSON)
- `goals_objectives`: Goals and objectives at this version (JSON)
- `status`: Status at this version
- `completion_percentage`: Completion percentage at this version
- `change_summary`: Human-readable summary of changes
- `changed_fields`: Array of field names that changed (JSON)
- `created_at`: Version creation timestamp

### Data Structures

#### ContactInfo
```json
{
  "business_name": "string",
  "contact_person": "string",
  "email": "string",
  "phone": "string",
  "website": "string",
  "social_media": {
    "linkedin": "string",
    "facebook": "string",
    "instagram": "string"
  }
}
```

#### BusinessContext
```json
{
  "industry": "string",
  "business_type": "string",
  "team_size": 25,
  "current_platform": "string",
  "digital_presence": ["website", "social-media"],
  "marketing_channels": ["seo", "paid-ads", "social"]
}
```

#### PainPoints
```json
{
  "primary_challenges": ["string"],
  "technical_issues": ["string"],
  "urgency_level": "medium",
  "impact_assessment": "string",
  "current_solution_gaps": ["string"]
}
```

#### GoalsObjectives
```json
{
  "primary_goals": ["string"],
  "secondary_goals": ["string"],
  "success_metrics": ["string"],
  "kpis": ["string"],
  "timeline": {
    "desired_start": "2025-10-01",
    "target_completion": "2025-12-31",
    "milestones": ["string"]
  },
  "budget_range": "10k-25k",
  "budget_constraints": ["string"]
}
```

## Business Logic and Rules

### Consultation Lifecycle

1. **Draft Creation**
   - New consultations start with `draft` status
   - All data fields are optional to support progressive data entry
   - Completion percentage is automatically calculated based on filled sections

2. **Progressive Data Entry**
   - Data can be saved incrementally as drafts
   - Auto-save functionality prevents data loss
   - Drafts are promoted to full consultations when complete

3. **Completion**
   - Consultations can be marked as `completed` when finished
   - Completion triggers final validation and sets `completed_at` timestamp
   - Completed consultations can still be edited (creates new version)

4. **Archival**
   - Old or inactive consultations can be marked as `archived`
   - Archived consultations are excluded from active lists but remain accessible
   - Archival helps maintain clean working datasets

### Validation Rules

#### Field Validation
- **Email**: Must be valid email format when provided
- **Phone**: No specific format required (international flexibility)
- **Website**: Must be valid URL format when provided
- **Urgency Level**: Must be one of: `low`, `medium`, `high`, `critical`
- **Status**: Must be one of: `draft`, `completed`, `archived`

#### Business Rules
- **User Ownership**: Users can only access their own consultations
- **Draft Uniqueness**: Only one draft can exist per consultation
- **Version Tracking**: Versions are created automatically on significant changes
- **Completion Calculation**: Based on presence of meaningful data in each section:
  - Contact Info: Business name required
  - Business Context: Industry required
  - Pain Points: At least one primary challenge required
  - Goals/Objectives: At least one primary goal required

### Status Transitions

```
draft → completed → archived
  ↓         ↓
draft ← completed
```

**Allowed Transitions:**
- `draft` → `completed`: When consultation is finished
- `completed` → `archived`: When consultation is no longer active
- `completed` → `draft`: To reopen for editing
- `draft` → `archived`: To archive incomplete consultations

**Forbidden Transitions:**
- `archived` → any other status (archival is final)

### Version Management

**Automatic Version Creation:**
- Triggered when consultation data changes significantly
- Compares current data with previous version
- Only creates version if meaningful changes detected
- Tracks which specific fields changed

**Change Detection:**
- Deep comparison of JSON structures
- Ignores timestamp-only changes
- Records field-level change tracking
- Generates human-readable change summaries

### Draft Management

**Auto-Save Behavior:**
- Drafts are saved automatically during data entry
- Configurable save intervals (default: 30 seconds)
- Prevents data loss during long consultation sessions
- Handles concurrent modifications gracefully

**Draft Cleanup:**
- Abandoned drafts are cleaned up after 24 hours of inactivity
- Drafts are automatically promoted when consultation is completed
- Only one active draft per consultation allowed

## Workflow Diagrams

### Consultation Creation Workflow

```
[Start Consultation]
        ↓
[Create Draft Record]
        ↓
[Progressive Data Entry] ←→ [Auto-Save Draft]
        ↓
[Validation Check]
        ↓
[Save as Consultation] → [Create Version 1]
        ↓
[Mark as Completed]
        ↓
[Set completed_at timestamp]
```

### Draft Auto-Save Workflow

```
[User Enters Data]
        ↓
[30-second timer expires]
        ↓
[Check for changes]
        ↓
    [Changes?] → No → [Reset timer]
        ↓ Yes
[Save to Draft]
        ↓
[Update draft timestamp]
        ↓
[Reset timer]
```

### Version Tracking Workflow

```
[Consultation Updated]
        ↓
[Compare with current version]
        ↓
[Significant changes?] → No → [Update in place]
        ↓ Yes
[Create new version record]
        ↓
[Copy current data to version]
        ↓
[Record changed fields]
        ↓
[Generate change summary]
        ↓
[Update consultation]
```

## Integration Patterns

### Repository Pattern
- **Interface-based design** for easy testing and swapping implementations
- **Transaction management** for atomic operations across multiple tables
- **Error handling** with proper error wrapping and context propagation
- **Performance optimization** with efficient queries and proper indexing

### Service Layer Pattern
- **Business logic encapsulation** separate from data access
- **Validation** at the service boundary
- **Status management** with controlled state transitions
- **Event handling** for status changes and lifecycle events

### REST API Pattern
- **Resource-based URLs** following REST conventions
- **HTTP status codes** indicating operation results
- **Content negotiation** with JSON request/response formats
- **Error responses** with structured error information

### Database Design Patterns
- **JSONB storage** for flexible nested data structures (PostgreSQL)
- **TEXT fallback** for SQLite compatibility
- **Proper indexing** on query fields (user_id, status, timestamps)
- **Foreign key constraints** ensuring data integrity

## Performance Considerations

### Database Optimization
- **Indexes** on frequently queried fields (user_id, status, created_at)
- **JSONB operators** for efficient nested data queries
- **Pagination** to handle large result sets
- **Connection pooling** for efficient database access

### Caching Strategy
- **Service-level caching** for frequently accessed consultations
- **Query result caching** for expensive operations
- **Cache invalidation** on data updates
- **Redis integration** for distributed caching

### Scaling Considerations
- **Horizontal scaling** through stateless service design
- **Database partitioning** by user_id for large datasets
- **Read replicas** for query performance
- **Microservice architecture** for independent scaling

## Security Considerations

### Authentication & Authorization
- **JWT token validation** for API access
- **User context injection** for ownership checks
- **Role-based access control** for admin functions
- **Session management** with proper token expiration

### Data Protection
- **Input validation** to prevent injection attacks
- **SQL injection prevention** through parameterized queries
- **XSS protection** through proper output encoding
- **Rate limiting** to prevent abuse

### Audit Trail
- **Version history** for change tracking
- **User attribution** for all modifications
- **Timestamp tracking** for temporal analysis
- **Immutable version records** for audit compliance

## Error Handling

### Error Categories
- **Validation Errors**: Invalid input data or format
- **Business Rule Violations**: Status transition errors, ownership violations
- **Not Found Errors**: Consultation or draft not found
- **Conflict Errors**: Concurrent modification attempts
- **System Errors**: Database connection issues, internal server errors

### Error Response Format
```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {
    "field_name": "Specific field error"
  },
  "request_id": "uuid-for-debugging"
}
```

### Recovery Strategies
- **Automatic retry** for transient database errors
- **Graceful degradation** when non-critical services fail
- **Circuit breaker pattern** for external service calls
- **Detailed logging** for debugging and monitoring

## Testing Strategy

### Unit Testing
- **Repository mocking** for isolated service testing
- **Business logic validation** with comprehensive test cases
- **Error scenario testing** for proper error handling
- **Edge case coverage** for boundary conditions

### Integration Testing
- **End-to-end workflows** testing complete user journeys
- **Database integration** with real database operations
- **API testing** with HTTP request/response validation
- **Performance testing** under load conditions

### Test Data Management
- **Realistic fixtures** representing actual business scenarios
- **Data cleanup** between test runs
- **Isolated test environments** preventing test interference
- **Automated test execution** in CI/CD pipelines