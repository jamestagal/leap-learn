# Consultation Domain Data Models

## Overview

This document provides detailed specifications for all data models used in the Consultation Domain, including database schemas, Go structs, JSON representations, and validation rules.

## Database Schema

### Tables

#### consultations
Primary table storing consultation records.

```sql
CREATE TABLE consultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_info JSONB NOT NULL DEFAULT '{}',
    business_context JSONB NOT NULL DEFAULT '{}',
    pain_points JSONB NOT NULL DEFAULT '{}',
    goals_objectives JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'archived')),
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX idx_consultations_user_id ON consultations(user_id);
CREATE INDEX idx_consultations_status ON consultations(status);
CREATE INDEX idx_consultations_created_at ON consultations(created_at);
CREATE INDEX idx_consultations_updated_at ON consultations(updated_at);
CREATE INDEX idx_consultations_user_status ON consultations(user_id, status);

-- GIN indexes for JSONB fields (PostgreSQL)
CREATE INDEX idx_consultations_contact_info ON consultations USING GIN (contact_info);
CREATE INDEX idx_consultations_business_context ON consultations USING GIN (business_context);
CREATE INDEX idx_consultations_pain_points ON consultations USING GIN (pain_points);
CREATE INDEX idx_consultations_goals_objectives ON consultations USING GIN (goals_objectives);
```

#### consultation_drafts
Table for storing draft versions during progressive data entry.

```sql
CREATE TABLE consultation_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
    contact_info JSONB NOT NULL DEFAULT '{}',
    business_context JSONB NOT NULL DEFAULT '{}',
    pain_points JSONB NOT NULL DEFAULT '{}',
    goals_objectives JSONB NOT NULL DEFAULT '{}',
    auto_saved BOOLEAN NOT NULL DEFAULT false,
    draft_notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure only one draft per consultation
    UNIQUE(consultation_id)
);

-- Indexes
CREATE INDEX idx_consultation_drafts_consultation_id ON consultation_drafts(consultation_id);
CREATE INDEX idx_consultation_drafts_updated_at ON consultation_drafts(updated_at);
```

#### consultation_versions
Table for storing historical versions of consultations.

```sql
CREATE TABLE consultation_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    contact_info JSONB NOT NULL DEFAULT '{}',
    business_context JSONB NOT NULL DEFAULT '{}',
    pain_points JSONB NOT NULL DEFAULT '{}',
    goals_objectives JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(20) NOT NULL,
    completion_percentage INTEGER NOT NULL,
    change_summary TEXT DEFAULT '',
    changed_fields JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure unique version numbers per consultation
    UNIQUE(consultation_id, version_number)
);

-- Indexes
CREATE INDEX idx_consultation_versions_consultation_id ON consultation_versions(consultation_id);
CREATE INDEX idx_consultation_versions_version_number ON consultation_versions(consultation_id, version_number);
CREATE INDEX idx_consultation_versions_created_at ON consultation_versions(created_at);
```

### SQLite Compatibility

For SQLite deployments, JSONB fields are replaced with TEXT:

```sql
-- SQLite version uses TEXT instead of JSONB
CREATE TABLE consultations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_info TEXT NOT NULL DEFAULT '{}',
    business_context TEXT NOT NULL DEFAULT '{}',
    pain_points TEXT NOT NULL DEFAULT '{}',
    goals_objectives TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'archived')),
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);
```

## Go Data Models

### Core Domain Models

#### Consultation
```go
type Consultation struct {
    query.Consultation
    // Parsed JSONB fields
    ParsedContactInfo      *ContactInfo      `json:"parsed_contact_info,omitempty"`
    ParsedBusinessContext  *BusinessContext  `json:"parsed_business_context,omitempty"`
    ParsedPainPoints       *PainPoints       `json:"parsed_pain_points,omitempty"`
    ParsedGoalsObjectives  *GoalsObjectives  `json:"parsed_goals_objectives,omitempty"`
}
```

#### ContactInfo
```go
type ContactInfo struct {
    BusinessName  string                 `json:"business_name,omitempty" validate:"max=255"`
    ContactPerson string                 `json:"contact_person,omitempty" validate:"max=255"`
    Email         string                 `json:"email,omitempty" validate:"email,max=255"`
    Phone         string                 `json:"phone,omitempty" validate:"max=50"`
    Website       string                 `json:"website,omitempty" validate:"url,max=500"`
    SocialMedia   map[string]interface{} `json:"social_media,omitempty"`
}
```

#### BusinessContext
```go
type BusinessContext struct {
    Industry          string   `json:"industry,omitempty" validate:"max=100"`
    BusinessType      string   `json:"business_type,omitempty" validate:"max=100"`
    TeamSize          *int     `json:"team_size,omitempty" validate:"min=1,max=10000"`
    CurrentPlatform   string   `json:"current_platform,omitempty" validate:"max=100"`
    DigitalPresence   []string `json:"digital_presence,omitempty" validate:"dive,max=50"`
    MarketingChannels []string `json:"marketing_channels,omitempty" validate:"dive,max=50"`
}
```

#### PainPoints
```go
type PainPoints struct {
    PrimaryChallenges      []string     `json:"primary_challenges,omitempty" validate:"dive,max=500"`
    TechnicalIssues        []string     `json:"technical_issues,omitempty" validate:"dive,max=500"`
    UrgencyLevel          UrgencyLevel `json:"urgency_level,omitempty" validate:"oneof=low medium high critical"`
    ImpactAssessment      string       `json:"impact_assessment,omitempty" validate:"max=1000"`
    CurrentSolutionGaps   []string     `json:"current_solution_gaps,omitempty" validate:"dive,max=500"`
}
```

#### GoalsObjectives
```go
type GoalsObjectives struct {
    PrimaryGoals       []string  `json:"primary_goals,omitempty" validate:"dive,max=500"`
    SecondaryGoals     []string  `json:"secondary_goals,omitempty" validate:"dive,max=500"`
    SuccessMetrics     []string  `json:"success_metrics,omitempty" validate:"dive,max=500"`
    KPIs               []string  `json:"kpis,omitempty" validate:"dive,max=500"`
    Timeline           *Timeline `json:"timeline,omitempty"`
    BudgetRange        string    `json:"budget_range,omitempty" validate:"max=50"`
    BudgetConstraints  []string  `json:"budget_constraints,omitempty" validate:"dive,max=500"`
}
```

#### Timeline
```go
type Timeline struct {
    DesiredStart      string   `json:"desired_start,omitempty" validate:"omitempty,datetime=2006-01-02"`
    TargetCompletion  string   `json:"target_completion,omitempty" validate:"omitempty,datetime=2006-01-02"`
    Milestones        []string `json:"milestones,omitempty" validate:"dive,max=200"`
}
```

### Enums and Constants

#### ConsultationStatus
```go
type ConsultationStatus string

const (
    StatusDraft     ConsultationStatus = "draft"
    StatusCompleted ConsultationStatus = "completed"
    StatusArchived  ConsultationStatus = "archived"
)

func (s ConsultationStatus) IsValid() bool {
    switch s {
    case StatusDraft, StatusCompleted, StatusArchived:
        return true
    default:
        return false
    }
}
```

#### UrgencyLevel
```go
type UrgencyLevel string

const (
    UrgencyLow      UrgencyLevel = "low"
    UrgencyMedium   UrgencyLevel = "medium"
    UrgencyHigh     UrgencyLevel = "high"
    UrgencyCritical UrgencyLevel = "critical"
)

func (u UrgencyLevel) IsValid() bool {
    switch u {
    case UrgencyLow, UrgencyMedium, UrgencyHigh, UrgencyCritical:
        return true
    default:
        return false
    }
}
```

### Response Models

#### ConsultationSummary
```go
type ConsultationSummary struct {
    ID                    uuid.UUID          `json:"id"`
    UserID                uuid.UUID          `json:"user_id"`
    BusinessName          string             `json:"business_name,omitempty"`
    ContactPerson         string             `json:"contact_person,omitempty"`
    Email                 string             `json:"email,omitempty"`
    Industry              string             `json:"industry,omitempty"`
    Status                ConsultationStatus `json:"status"`
    CompletionPercentage  int32              `json:"completion_percentage"`
    CreatedAt             time.Time          `json:"created_at"`
    UpdatedAt             time.Time          `json:"updated_at"`
    CompletedAt           *time.Time         `json:"completed_at,omitempty"`
}
```

#### PaginationInfo
```go
type PaginationInfo struct {
    Page       int  `json:"page"`
    Limit      int  `json:"limit"`
    Total      int  `json:"total"`
    TotalPages int  `json:"total_pages"`
    HasNext    bool `json:"has_next"`
    HasPrev    bool `json:"has_prev"`
}
```

## JSON Schema Specifications

### ContactInfo Schema
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "business_name": {
      "type": "string",
      "maxLength": 255,
      "description": "Legal business name"
    },
    "contact_person": {
      "type": "string",
      "maxLength": 255,
      "description": "Primary contact person"
    },
    "email": {
      "type": "string",
      "format": "email",
      "maxLength": 255,
      "description": "Primary email address"
    },
    "phone": {
      "type": "string",
      "maxLength": 50,
      "description": "Primary phone number"
    },
    "website": {
      "type": "string",
      "format": "uri",
      "maxLength": 500,
      "description": "Business website URL"
    },
    "social_media": {
      "type": "object",
      "properties": {
        "linkedin": {"type": "string", "format": "uri"},
        "facebook": {"type": "string", "format": "uri"},
        "instagram": {"type": "string", "format": "uri"},
        "twitter": {"type": "string", "format": "uri"}
      },
      "additionalProperties": true
    }
  },
  "additionalProperties": false
}
```

### BusinessContext Schema
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "industry": {
      "type": "string",
      "maxLength": 100,
      "enum": [
        "Technology", "Healthcare", "Finance", "Retail", "Manufacturing",
        "Education", "Real Estate", "Legal", "Non-Profit", "Government",
        "Entertainment", "Hospitality", "Transportation", "Energy", "Other"
      ]
    },
    "business_type": {
      "type": "string",
      "maxLength": 100,
      "enum": [
        "B2B", "B2C", "B2B2C", "SaaS", "E-commerce", "Service Provider",
        "Consulting", "Agency", "Startup", "Enterprise", "Other"
      ]
    },
    "team_size": {
      "type": "integer",
      "minimum": 1,
      "maximum": 10000
    },
    "current_platform": {
      "type": "string",
      "maxLength": 100,
      "enum": [
        "WordPress", "Shopify", "Squarespace", "Wix", "Custom",
        "Drupal", "Joomla", "Magento", "BigCommerce", "Other", "None"
      ]
    },
    "digital_presence": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": [
          "website", "social-media", "mobile-app", "e-commerce",
          "blog", "email-marketing", "online-advertising", "seo"
        ]
      }
    },
    "marketing_channels": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": [
          "seo", "paid-ads", "social", "email", "content-marketing",
          "referrals", "partnerships", "events", "pr", "direct-sales"
        ]
      }
    }
  },
  "additionalProperties": false
}
```

### PainPoints Schema
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "primary_challenges": {
      "type": "array",
      "items": {
        "type": "string",
        "maxLength": 500
      },
      "maxItems": 10
    },
    "technical_issues": {
      "type": "array",
      "items": {
        "type": "string",
        "maxLength": 500
      },
      "maxItems": 10
    },
    "urgency_level": {
      "type": "string",
      "enum": ["low", "medium", "high", "critical"]
    },
    "impact_assessment": {
      "type": "string",
      "maxLength": 1000
    },
    "current_solution_gaps": {
      "type": "array",
      "items": {
        "type": "string",
        "maxLength": 500
      },
      "maxItems": 10
    }
  },
  "additionalProperties": false
}
```

### GoalsObjectives Schema
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "primary_goals": {
      "type": "array",
      "items": {
        "type": "string",
        "maxLength": 500
      },
      "maxItems": 10
    },
    "secondary_goals": {
      "type": "array",
      "items": {
        "type": "string",
        "maxLength": 500
      },
      "maxItems": 10
    },
    "success_metrics": {
      "type": "array",
      "items": {
        "type": "string",
        "maxLength": 500
      },
      "maxItems": 10
    },
    "kpis": {
      "type": "array",
      "items": {
        "type": "string",
        "maxLength": 500
      },
      "maxItems": 10
    },
    "timeline": {
      "$ref": "#/definitions/Timeline"
    },
    "budget_range": {
      "type": "string",
      "enum": [
        "under-5k", "5k-10k", "10k-25k", "25k-50k", "50k-100k",
        "100k-250k", "250k-500k", "500k+", "tbd"
      ]
    },
    "budget_constraints": {
      "type": "array",
      "items": {
        "type": "string",
        "maxLength": 500
      },
      "maxItems": 10
    }
  },
  "definitions": {
    "Timeline": {
      "type": "object",
      "properties": {
        "desired_start": {
          "type": "string",
          "format": "date"
        },
        "target_completion": {
          "type": "string",
          "format": "date"
        },
        "milestones": {
          "type": "array",
          "items": {
            "type": "string",
            "maxLength": 200
          },
          "maxItems": 20
        }
      }
    }
  },
  "additionalProperties": false
}
```

## Validation Rules

### Field-Level Validation

#### Required Fields
- No fields are strictly required to support progressive data entry
- Business logic determines completion based on meaningful data presence

#### Length Constraints
- `business_name`: Maximum 255 characters
- `contact_person`: Maximum 255 characters
- `email`: Maximum 255 characters, must be valid email format
- `phone`: Maximum 50 characters
- `website`: Maximum 500 characters, must be valid URL format
- Array items: Maximum lengths vary by field (see JSON schema)

#### Format Validation
- `email`: Valid email format (RFC 5322)
- `website`: Valid URL format (RFC 3986)
- `dates`: ISO 8601 date format (YYYY-MM-DD)
- `urgency_level`: Must be one of predefined enum values
- `status`: Must be one of predefined enum values

### Business Logic Validation

#### Completion Percentage Calculation
```go
func (c *Consultation) CalculateCompletionPercentage() int32 {
    totalSections := int32(4)
    completedSections := int32(0)

    // Contact Info: Business name required for completion
    if c.ParsedContactInfo != nil && c.ParsedContactInfo.BusinessName != "" {
        completedSections++
    }

    // Business Context: Industry required for completion
    if c.ParsedBusinessContext != nil && c.ParsedBusinessContext.Industry != "" {
        completedSections++
    }

    // Pain Points: At least one primary challenge required
    if c.ParsedPainPoints != nil && len(c.ParsedPainPoints.PrimaryChallenges) > 0 {
        completedSections++
    }

    // Goals/Objectives: At least one primary goal required
    if c.ParsedGoalsObjectives != nil && len(c.ParsedGoalsObjectives.PrimaryGoals) > 0 {
        completedSections++
    }

    return (completedSections * 100) / totalSections
}
```

#### Status Transition Validation
```go
func ValidateStatusTransition(from, to ConsultationStatus) error {
    switch from {
    case StatusDraft:
        if to == StatusCompleted || to == StatusArchived {
            return nil
        }
    case StatusCompleted:
        if to == StatusDraft || to == StatusArchived {
            return nil
        }
    case StatusArchived:
        return errors.New("cannot change status from archived")
    }
    return fmt.Errorf("invalid status transition from %s to %s", from, to)
}
```

### Cross-Field Validation

#### Timeline Consistency
- `target_completion` must be after `desired_start` when both are provided
- Project timeline should be reasonable (not more than 5 years)

#### Budget Consistency
- `budget_constraints` should be consistent with `budget_range`
- Budget range should align with project goals and scope

## Database Query Patterns

### Common Query Examples

#### List User's Consultations with Filtering
```sql
SELECT
    id, user_id,
    contact_info->>'business_name' as business_name,
    contact_info->>'contact_person' as contact_person,
    business_context->>'industry' as industry,
    status, completion_percentage,
    created_at, updated_at, completed_at
FROM consultations
WHERE user_id = $1
    AND status = ANY($2)  -- Filter by status array
    AND (business_context->>'industry' = $3 OR $3 IS NULL)  -- Industry filter
    AND (contact_info->>'business_name' ILIKE '%' || $4 || '%' OR $4 IS NULL)  -- Search
ORDER BY created_at DESC
LIMIT $5 OFFSET $6;
```

#### Get Consultation with Full Data
```sql
SELECT * FROM consultations WHERE id = $1 AND user_id = $2;
```

#### Create Version on Update
```sql
INSERT INTO consultation_versions (
    consultation_id, user_id, version_number,
    contact_info, business_context, pain_points, goals_objectives,
    status, completion_percentage, change_summary, changed_fields
) VALUES (
    $1, $2, (SELECT COALESCE(MAX(version_number), 0) + 1 FROM consultation_versions WHERE consultation_id = $1),
    $3, $4, $5, $6, $7, $8, $9, $10
);
```

### Performance Optimization

#### Index Usage
- **Primary lookups**: Use primary key index
- **User filtering**: Use idx_consultations_user_id
- **Status filtering**: Use idx_consultations_status
- **Combined filtering**: Use idx_consultations_user_status
- **JSONB queries**: Use GIN indexes for efficient nested field access

#### Query Optimization
- **Pagination**: Always use LIMIT/OFFSET for large result sets
- **Selective fields**: Only fetch required fields for list views
- **Prepared statements**: Use parameterized queries for reuse
- **Connection pooling**: Efficient database connection management