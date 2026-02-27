# WebKit Feature Specification: Feedback Portal, Freemium System & Early Interest Capture

## Version 1.0 - January 2026

---

## Executive Summary

This specification covers three interconnected features designed to support WebKit's beta launch and growth:

1. **Freemium Flag System** - Reward beta testers with full enterprise access without payment obligations
2. **Feedback Portal** - AI-powered feedback collection with GitHub integration and status tracking
3. **Early Interest Capture** - Landing page signup flow that seamlessly converts to freemium accounts

These features work together: early signups → freemium beta testers → feedback contributors → product improvements → paid conversions.

---

## Table of Contents

1. [Freemium Flag System](#1-freemium-flag-system)
2. [Feedback Portal](#2-feedback-portal)
3. [Early Interest Capture](#3-early-interest-capture)
4. [Database Schema](#4-database-schema)
5. [API Specifications](#5-api-specifications)
6. [Implementation Checklist](#6-implementation-checklist)

---

## 1. Freemium Flag System

### 1.1 Overview

Enable enterprise-tier access for beta testers without payment processing. The system uses a flag-based approach that bypasses billing while maintaining full feature access.

### 1.2 Database Changes

```sql
-- Add freemium columns to agencies table
ALTER TABLE agencies ADD COLUMN is_freemium BOOLEAN DEFAULT FALSE;
ALTER TABLE agencies ADD COLUMN freemium_reason VARCHAR(50);
ALTER TABLE agencies ADD COLUMN freemium_expires_at TIMESTAMPTZ;
ALTER TABLE agencies ADD COLUMN freemium_granted_at TIMESTAMPTZ;
ALTER TABLE agencies ADD COLUMN freemium_granted_by VARCHAR(255);

-- Create enum type for freemium reasons
CREATE TYPE freemium_reason_type AS ENUM (
  'beta_tester',      -- Early beta program participants
  'partner',          -- Strategic partners
  'promotional',      -- Time-limited promotions
  'early_signup',     -- Landing page early interest signups
  'referral_reward',  -- Referral program rewards
  'internal'          -- Internal/demo accounts
);

-- Index for freemium queries
CREATE INDEX idx_agencies_freemium ON agencies(is_freemium) WHERE is_freemium = TRUE;
CREATE INDEX idx_agencies_freemium_expires ON agencies(freemium_expires_at) WHERE freemium_expires_at IS NOT NULL;
```

### 1.3 Business Logic

```go
// service-core/domain/subscription/freemium.go

type FreemiumConfig struct {
    IsFreemium       bool
    FreemiumReason   string
    FreemiumExpires  *time.Time
}

// GetEffectiveTier returns the tier to use for limit checks
func (s *SubscriptionService) GetEffectiveTier(agencyID uuid.UUID) (string, error) {
    agency, err := s.agencyRepo.GetByID(agencyID)
    if err != nil {
        return "", err
    }
    
    // Check freemium status
    if agency.IsFreemium {
        // Check if freemium has expired
        if agency.FreemiumExpiresAt != nil && time.Now().After(*agency.FreemiumExpiresAt) {
            // Freemium expired - revert to actual subscription tier
            return agency.SubscriptionTier, nil
        }
        // Active freemium - treat as enterprise
        return "enterprise", nil
    }
    
    return agency.SubscriptionTier, nil
}

// GetResourceLimit returns the limit for a resource based on effective tier
func (s *SubscriptionService) GetResourceLimit(agencyID uuid.UUID, resource string) (int, error) {
    tier, err := s.GetEffectiveTier(agencyID)
    if err != nil {
        return 0, err
    }
    
    // Freemium enterprise gets unlimited (represented as -1 or MaxInt)
    if tier == "enterprise" {
        return -1, nil // -1 = unlimited
    }
    
    return s.tierLimits[tier][resource], nil
}

// GrantFreemium grants freemium status to an agency
func (s *SubscriptionService) GrantFreemium(
    agencyID uuid.UUID, 
    reason string, 
    expiresAt *time.Time,
    grantedBy string,
) error {
    return s.agencyRepo.Update(agencyID, map[string]interface{}{
        "is_freemium":         true,
        "freemium_reason":     reason,
        "freemium_expires_at": expiresAt,
        "freemium_granted_at": time.Now(),
        "freemium_granted_by": grantedBy,
        "subscription_tier":   "enterprise", // Set base tier to enterprise
    })
}

// RevokeFreemium removes freemium status
func (s *SubscriptionService) RevokeFreemium(agencyID uuid.UUID, newTier string) error {
    return s.agencyRepo.Update(agencyID, map[string]interface{}{
        "is_freemium":       false,
        "subscription_tier": newTier,
    })
}
```

### 1.4 Tier Limits Reference

```go
var TierLimits = map[string]map[string]int{
    "starter": {
        "proposals_per_month": 5,
        "clients":             10,
        "team_members":        1,
        "storage_mb":          500,
        "ai_generations":      10,
    },
    "growth": {
        "proposals_per_month": 20,
        "clients":             50,
        "team_members":        3,
        "storage_mb":          2000,
        "ai_generations":      50,
    },
    "enterprise": {
        "proposals_per_month": -1, // unlimited
        "clients":             -1,
        "team_members":        -1,
        "storage_mb":          10000,
        "ai_generations":      -1,
    },
}
```

### 1.5 Admin Interface

Add freemium management to service-admin:

```html
<!-- service-admin/web/templates/agencies/edit.html -->
<div class="freemium-section">
  <h3>Freemium Status</h3>
  
  <label class="checkbox">
    <input type="checkbox" name="is_freemium" 
           hx-post="/admin/agencies/{{ .Agency.ID }}/freemium/toggle"
           hx-swap="outerHTML"
           {{ if .Agency.IsFreemium }}checked{{ end }}>
    Enable Freemium Access
  </label>
  
  {{ if .Agency.IsFreemium }}
  <div class="freemium-details">
    <select name="freemium_reason">
      <option value="beta_tester" {{ if eq .Agency.FreemiumReason "beta_tester" }}selected{{ end }}>Beta Tester</option>
      <option value="partner" {{ if eq .Agency.FreemiumReason "partner" }}selected{{ end }}>Partner</option>
      <option value="promotional" {{ if eq .Agency.FreemiumReason "promotional" }}selected{{ end }}>Promotional</option>
      <option value="early_signup" {{ if eq .Agency.FreemiumReason "early_signup" }}selected{{ end }}>Early Signup</option>
      <option value="referral_reward" {{ if eq .Agency.FreemiumReason "referral_reward" }}selected{{ end }}>Referral Reward</option>
    </select>
    
    <input type="date" name="freemium_expires_at" 
           value="{{ .Agency.FreemiumExpiresAt | formatDate }}"
           placeholder="No expiry (leave blank for permanent)">
    
    <p class="meta">
      Granted: {{ .Agency.FreemiumGrantedAt | formatDateTime }}
      by {{ .Agency.FreemiumGrantedBy }}
    </p>
  </div>
  {{ end }}
</div>
```

### 1.6 Freemium Expiry Cron Job

```go
// service-core/jobs/freemium_expiry.go

func (j *FreemiumExpiryJob) Run() error {
    // Find all agencies with expired freemium
    expiredAgencies, err := j.agencyRepo.FindExpiredFreemium()
    if err != nil {
        return err
    }
    
    for _, agency := range expiredAgencies {
        // Determine fallback tier (default to starter)
        fallbackTier := "starter"
        
        // Send notification email
        j.emailService.Send(agency.OwnerEmail, "freemium_expired", map[string]interface{}{
            "agency_name":   agency.Name,
            "expired_at":    agency.FreemiumExpiresAt,
            "fallback_tier": fallbackTier,
            "upgrade_url":   j.config.AppURL + "/settings/billing",
        })
        
        // Revoke freemium
        j.subscriptionService.RevokeFreemium(agency.ID, fallbackTier)
        
        j.logger.Info("Freemium expired", 
            "agency_id", agency.ID, 
            "reason", agency.FreemiumReason)
    }
    
    return nil
}
```

---

## 2. Feedback Portal

### 2.1 Overview

A dedicated feedback system allowing beta testers (and later all users) to submit bugs, feature requests, and general feedback. The system uses AI classification and integrates directly with GitHub for issue management.

### 2.2 Feature Requirements

#### Core Features
- [ ] Submit feedback with type classification (bug, feature, question, other)
- [ ] Auto-capture system/browser information for bug reports
- [ ] Screenshot/file attachment support
- [ ] AI-powered classification and formatting
- [ ] GitHub issue creation with proper labels and formatting
- [ ] Status tracking with user notifications
- [ ] Upvoting system for feature prioritization

#### User Experience
- [ ] Simple, focused submission form
- [ ] Real-time status updates
- [ ] View own submissions and their status
- [ ] Vote on other users' feature requests
- [ ] Receive notifications when status changes

#### Admin Features
- [ ] View all feedback with filtering/sorting
- [ ] Manual classification override
- [ ] Link feedback to GitHub issues
- [ ] Bulk actions (close, merge, archive)
- [ ] Analytics dashboard

### 2.3 Database Schema

```sql
-- Feedback submissions table
CREATE TABLE feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    submitted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Classification
    type VARCHAR(20) NOT NULL DEFAULT 'other',  -- bug, feature, question, other
    status VARCHAR(20) NOT NULL DEFAULT 'submitted',  -- submitted, triaged, in_progress, shipped, closed, wont_fix
    priority VARCHAR(10),  -- critical, high, medium, low
    
    -- Content
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    
    -- System info (for bugs)
    system_info JSONB,
    
    -- AI classification
    ai_classification JSONB,
    ai_classified_at TIMESTAMPTZ,
    
    -- GitHub integration
    github_issue_url VARCHAR(500),
    github_issue_number INTEGER,
    github_synced_at TIMESTAMPTZ,
    
    -- Attachments
    attachments JSONB DEFAULT '[]'::jsonb,
    
    -- Metadata
    vote_count INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT TRUE,  -- Can other users see this?
    admin_notes TEXT,
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_feedback_agency ON feedback(agency_id);
CREATE INDEX idx_feedback_type ON feedback(type);
CREATE INDEX idx_feedback_status ON feedback(status);
CREATE INDEX idx_feedback_votes ON feedback(vote_count DESC);
CREATE INDEX idx_feedback_created ON feedback(created_at DESC);

-- Feedback votes table
CREATE TABLE feedback_votes (
    feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (feedback_id, user_id)
);

-- Feedback comments (for discussions)
CREATE TABLE feedback_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_admin_reply BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feedback_comments_feedback ON feedback_comments(feedback_id);

-- Feedback status history (audit trail)
CREATE TABLE feedback_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    changed_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feedback_history_feedback ON feedback_status_history(feedback_id);
```

### 2.4 System Info Capture

```typescript
// service-client/src/lib/utils/system-info.ts

export interface SystemInfo {
  browser: {
    name: string;
    version: string;
    userAgent: string;
  };
  os: {
    name: string;
    version: string;
  };
  screen: {
    width: number;
    height: number;
    pixelRatio: number;
  };
  viewport: {
    width: number;
    height: number;
  };
  timezone: string;
  language: string;
  currentUrl: string;
  timestamp: string;
  connectionType?: string;
}

export function captureSystemInfo(): SystemInfo {
  const ua = navigator.userAgent;
  
  // Parse browser info
  const browserInfo = parseBrowser(ua);
  const osInfo = parseOS(ua);
  
  return {
    browser: {
      name: browserInfo.name,
      version: browserInfo.version,
      userAgent: ua,
    },
    os: {
      name: osInfo.name,
      version: osInfo.version,
    },
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      pixelRatio: window.devicePixelRatio || 1,
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    currentUrl: window.location.href,
    timestamp: new Date().toISOString(),
    connectionType: (navigator as any).connection?.effectiveType,
  };
}

function parseBrowser(ua: string): { name: string; version: string } {
  // Browser detection logic
  if (ua.includes('Firefox/')) {
    return { name: 'Firefox', version: ua.match(/Firefox\/([\d.]+)/)?.[1] || 'unknown' };
  }
  if (ua.includes('Chrome/') && !ua.includes('Edg/')) {
    return { name: 'Chrome', version: ua.match(/Chrome\/([\d.]+)/)?.[1] || 'unknown' };
  }
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
    return { name: 'Safari', version: ua.match(/Version\/([\d.]+)/)?.[1] || 'unknown' };
  }
  if (ua.includes('Edg/')) {
    return { name: 'Edge', version: ua.match(/Edg\/([\d.]+)/)?.[1] || 'unknown' };
  }
  return { name: 'Unknown', version: 'unknown' };
}

function parseOS(ua: string): { name: string; version: string } {
  if (ua.includes('Windows NT')) {
    const version = ua.match(/Windows NT ([\d.]+)/)?.[1] || 'unknown';
    return { name: 'Windows', version };
  }
  if (ua.includes('Mac OS X')) {
    const version = ua.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g, '.') || 'unknown';
    return { name: 'macOS', version };
  }
  if (ua.includes('Linux')) {
    return { name: 'Linux', version: 'unknown' };
  }
  if (ua.includes('Android')) {
    const version = ua.match(/Android ([\d.]+)/)?.[1] || 'unknown';
    return { name: 'Android', version };
  }
  if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) {
    const version = ua.match(/OS ([\d_]+)/)?.[1]?.replace(/_/g, '.') || 'unknown';
    return { name: 'iOS', version };
  }
  return { name: 'Unknown', version: 'unknown' };
}
```

### 2.5 AI Classification Service

```go
// service-core/domain/feedback/classifier.go

type FeedbackClassification struct {
    Type            string   `json:"type"`             // bug, feature, question, other
    Priority        string   `json:"priority"`         // critical, high, medium, low
    Labels          []string `json:"labels"`           // github labels
    Summary         string   `json:"summary"`          // Clean summary for GitHub title
    FormattedBody   string   `json:"formatted_body"`   // Markdown body for GitHub issue
    SimilarIssues   []string `json:"similar_issues"`   // Potential duplicate issue numbers
    Confidence      float64  `json:"confidence"`       // Classification confidence 0-1
}

type FeedbackClassifier struct {
    anthropicClient *anthropic.Client
    githubClient    *github.Client
    config          *ClassifierConfig
}

func (c *FeedbackClassifier) Classify(feedback *Feedback) (*FeedbackClassification, error) {
    // First, check for similar existing issues
    similarIssues, err := c.findSimilarIssues(feedback.Title, feedback.Description)
    if err != nil {
        // Log but don't fail - classification can continue
        c.logger.Warn("Failed to find similar issues", "error", err)
    }
    
    // Build classification prompt
    prompt := c.buildClassificationPrompt(feedback, similarIssues)
    
    // Call Claude API
    response, err := c.anthropicClient.CreateMessage(context.Background(), anthropic.MessageRequest{
        Model:     "claude-sonnet-4-20250514",
        MaxTokens: 1024,
        System:    classificationSystemPrompt,
        Messages: []anthropic.Message{
            {Role: "user", Content: prompt},
        },
    })
    if err != nil {
        return nil, fmt.Errorf("classification failed: %w", err)
    }
    
    // Parse structured response
    var classification FeedbackClassification
    if err := json.Unmarshal([]byte(response.Content[0].Text), &classification); err != nil {
        return nil, fmt.Errorf("failed to parse classification: %w", err)
    }
    
    classification.SimilarIssues = similarIssues
    
    return &classification, nil
}

const classificationSystemPrompt = `You are a feedback classifier for WebKit, a SaaS proposal generator for web design agencies. Analyze user feedback and classify it.

Return a JSON object with:
- type: "bug" | "feature" | "question" | "other"
- priority: "critical" | "high" | "medium" | "low"
  - critical: Data loss, security issues, complete feature broken
  - high: Major feature broken, significant user impact
  - medium: Feature works but has issues, workarounds exist
  - low: Minor issues, cosmetic, nice-to-have improvements
- labels: Array of relevant labels from: ["bug", "feature", "enhancement", "documentation", "ui/ux", "performance", "security", "api", "consultation", "proposal", "pdf", "ai", "billing", "integration"]
- summary: Clean, concise title for GitHub issue (max 80 chars)
- formatted_body: Well-formatted markdown for GitHub issue body including:
  - Description section
  - Steps to reproduce (for bugs)
  - Expected vs actual behavior (for bugs)
  - System info (if provided)
  - User context
- confidence: Your confidence in the classification (0.0 to 1.0)

Be concise but thorough. Prioritize user impact.`

func (c *FeedbackClassifier) buildClassificationPrompt(feedback *Feedback, similarIssues []string) string {
    var sb strings.Builder
    
    sb.WriteString(fmt.Sprintf("Title: %s\n\n", feedback.Title))
    sb.WriteString(fmt.Sprintf("Description:\n%s\n\n", feedback.Description))
    
    if feedback.SystemInfo != nil {
        sb.WriteString("System Info:\n")
        sb.WriteString(fmt.Sprintf("- Browser: %s %s\n", feedback.SystemInfo.Browser.Name, feedback.SystemInfo.Browser.Version))
        sb.WriteString(fmt.Sprintf("- OS: %s %s\n", feedback.SystemInfo.OS.Name, feedback.SystemInfo.OS.Version))
        sb.WriteString(fmt.Sprintf("- Screen: %dx%d\n", feedback.SystemInfo.Screen.Width, feedback.SystemInfo.Screen.Height))
        sb.WriteString(fmt.Sprintf("- URL: %s\n", feedback.SystemInfo.CurrentURL))
        sb.WriteString("\n")
    }
    
    if len(similarIssues) > 0 {
        sb.WriteString("Potentially similar existing issues:\n")
        for _, issue := range similarIssues {
            sb.WriteString(fmt.Sprintf("- %s\n", issue))
        }
        sb.WriteString("\nConsider if this might be a duplicate.\n")
    }
    
    return sb.String()
}
```

### 2.6 GitHub Integration Service

```go
// service-core/domain/feedback/github.go

type GitHubService struct {
    client     *github.Client
    owner      string
    repo       string
    config     *GitHubConfig
}

type GitHubConfig struct {
    Owner           string
    Repo            string
    Token           string
    DefaultLabels   []string
    LabelMapping    map[string]string  // Internal type -> GitHub label
}

func (s *GitHubService) CreateIssue(feedback *Feedback, classification *FeedbackClassification) (*github.Issue, error) {
    // Build labels
    labels := s.buildLabels(classification)
    
    // Build issue body
    body := s.buildIssueBody(feedback, classification)
    
    // Create issue
    issue, _, err := s.client.Issues.Create(context.Background(), s.owner, s.repo, &github.IssueRequest{
        Title:  github.String(classification.Summary),
        Body:   github.String(body),
        Labels: &labels,
    })
    if err != nil {
        return nil, fmt.Errorf("failed to create GitHub issue: %w", err)
    }
    
    return issue, nil
}

func (s *GitHubService) buildIssueBody(feedback *Feedback, classification *FeedbackClassification) string {
    var sb strings.Builder
    
    // Classification header
    sb.WriteString(classification.FormattedBody)
    sb.WriteString("\n\n---\n\n")
    
    // Metadata section
    sb.WriteString("### Metadata\n\n")
    sb.WriteString(fmt.Sprintf("- **Feedback ID**: `%s`\n", feedback.ID))
    sb.WriteString(fmt.Sprintf("- **Agency**: %s\n", feedback.AgencyName))
    sb.WriteString(fmt.Sprintf("- **Submitted by**: %s\n", feedback.SubmittedByEmail))
    sb.WriteString(fmt.Sprintf("- **Priority**: %s\n", classification.Priority))
    sb.WriteString(fmt.Sprintf("- **Submitted**: %s\n", feedback.CreatedAt.Format(time.RFC3339)))
    
    // System info for bugs
    if feedback.Type == "bug" && feedback.SystemInfo != nil {
        sb.WriteString("\n### System Information\n\n")
        sb.WriteString(fmt.Sprintf("- **Browser**: %s %s\n", feedback.SystemInfo.Browser.Name, feedback.SystemInfo.Browser.Version))
        sb.WriteString(fmt.Sprintf("- **OS**: %s %s\n", feedback.SystemInfo.OS.Name, feedback.SystemInfo.OS.Version))
        sb.WriteString(fmt.Sprintf("- **Screen**: %dx%d @ %gx\n", 
            feedback.SystemInfo.Screen.Width, 
            feedback.SystemInfo.Screen.Height,
            feedback.SystemInfo.Screen.PixelRatio))
        sb.WriteString(fmt.Sprintf("- **Viewport**: %dx%d\n", feedback.SystemInfo.Viewport.Width, feedback.SystemInfo.Viewport.Height))
        sb.WriteString(fmt.Sprintf("- **Timezone**: %s\n", feedback.SystemInfo.Timezone))
        sb.WriteString(fmt.Sprintf("- **URL**: %s\n", feedback.SystemInfo.CurrentURL))
    }
    
    // Attachments
    if len(feedback.Attachments) > 0 {
        sb.WriteString("\n### Attachments\n\n")
        for _, att := range feedback.Attachments {
            sb.WriteString(fmt.Sprintf("- [%s](%s)\n", att.Filename, att.URL))
        }
    }
    
    // Similar issues note
    if len(classification.SimilarIssues) > 0 {
        sb.WriteString("\n### Potentially Related Issues\n\n")
        for _, issue := range classification.SimilarIssues {
            sb.WriteString(fmt.Sprintf("- %s\n", issue))
        }
    }
    
    // Footer
    sb.WriteString("\n---\n")
    sb.WriteString("*This issue was automatically created from user feedback via WebKit Feedback Portal*")
    
    return sb.String()
}

func (s *GitHubService) buildLabels(classification *FeedbackClassification) []string {
    labels := make([]string, 0)
    
    // Add type label
    switch classification.Type {
    case "bug":
        labels = append(labels, "bug")
    case "feature":
        labels = append(labels, "enhancement")
    case "question":
        labels = append(labels, "question")
    }
    
    // Add priority label
    labels = append(labels, fmt.Sprintf("priority:%s", classification.Priority))
    
    // Add classification labels
    labels = append(labels, classification.Labels...)
    
    // Add source label
    labels = append(labels, "feedback-portal")
    
    return labels
}

// SyncIssueStatus syncs GitHub issue status back to feedback
func (s *GitHubService) SyncIssueStatus(feedbackID uuid.UUID, issueNumber int) error {
    issue, _, err := s.client.Issues.Get(context.Background(), s.owner, s.repo, issueNumber)
    if err != nil {
        return err
    }
    
    var status string
    switch *issue.State {
    case "open":
        // Check for specific labels to determine detailed status
        for _, label := range issue.Labels {
            switch *label.Name {
            case "in-progress":
                status = "in_progress"
            case "triaged":
                status = "triaged"
            }
        }
        if status == "" {
            status = "triaged"
        }
    case "closed":
        // Check if shipped or won't fix
        for _, label := range issue.Labels {
            if *label.Name == "wontfix" {
                status = "wont_fix"
                break
            }
        }
        if status == "" {
            status = "shipped"
        }
    }
    
    return s.feedbackRepo.UpdateStatus(feedbackID, status)
}
```

### 2.7 GitHub Webhook Handler

```go
// service-core/rest/webhooks/github.go

func (h *GitHubWebhookHandler) HandleIssueEvent(c *gin.Context) {
    payload, err := github.ValidatePayload(c.Request, []byte(h.webhookSecret))
    if err != nil {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
        return
    }
    
    event, err := github.ParseWebHook(github.WebHookType(c.Request), payload)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "failed to parse webhook"})
        return
    }
    
    switch e := event.(type) {
    case *github.IssuesEvent:
        h.handleIssuesEvent(e)
    case *github.IssueCommentEvent:
        h.handleIssueCommentEvent(e)
    }
    
    c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *GitHubWebhookHandler) handleIssuesEvent(e *github.IssuesEvent) {
    // Find feedback by GitHub issue number
    feedback, err := h.feedbackRepo.FindByGitHubIssue(*e.Issue.Number)
    if err != nil {
        h.logger.Debug("No feedback found for issue", "issue_number", *e.Issue.Number)
        return
    }
    
    var newStatus string
    switch *e.Action {
    case "closed":
        // Check for wontfix label
        newStatus = "shipped"
        for _, label := range e.Issue.Labels {
            if *label.Name == "wontfix" {
                newStatus = "wont_fix"
                break
            }
        }
    case "reopened":
        newStatus = "in_progress"
    case "labeled":
        // Handle specific label additions
        if e.Label != nil {
            switch *e.Label.Name {
            case "in-progress":
                newStatus = "in_progress"
            case "triaged":
                newStatus = "triaged"
            }
        }
    }
    
    if newStatus != "" && newStatus != feedback.Status {
        // Update status
        h.feedbackService.UpdateStatus(feedback.ID, newStatus, nil, "GitHub sync")
        
        // Notify user
        h.notificationService.SendFeedbackStatusUpdate(feedback, newStatus)
    }
}
```

### 2.8 Duplicate Detection Service

```go
// service-core/domain/feedback/duplicates.go

type DuplicateDetector struct {
    githubClient *github.Client
    owner        string
    repo         string
}

func (d *DuplicateDetector) FindSimilarIssues(title, description string) ([]string, error) {
    // Search for similar open issues
    query := fmt.Sprintf("repo:%s/%s is:open %s", d.owner, d.repo, extractKeywords(title))
    
    results, _, err := d.githubClient.Search.Issues(context.Background(), query, &github.SearchOptions{
        Sort:  "updated",
        Order: "desc",
        ListOptions: github.ListOptions{
            PerPage: 5,
        },
    })
    if err != nil {
        return nil, err
    }
    
    var similar []string
    for _, issue := range results.Issues {
        similar = append(similar, fmt.Sprintf("#%d: %s", *issue.Number, *issue.Title))
    }
    
    return similar, nil
}

func extractKeywords(text string) string {
    // Remove common words and extract key terms
    stopWords := map[string]bool{
        "the": true, "a": true, "an": true, "is": true, "are": true,
        "was": true, "were": true, "be": true, "been": true, "being": true,
        "have": true, "has": true, "had": true, "do": true, "does": true,
        "did": true, "will": true, "would": true, "could": true, "should": true,
        "can": true, "may": true, "might": true, "must": true, "shall": true,
        "i": true, "you": true, "he": true, "she": true, "it": true, "we": true,
        "they": true, "this": true, "that": true, "these": true, "those": true,
    }
    
    words := strings.Fields(strings.ToLower(text))
    var keywords []string
    
    for _, word := range words {
        word = strings.Trim(word, ".,!?;:\"'")
        if len(word) > 2 && !stopWords[word] {
            keywords = append(keywords, word)
        }
    }
    
    // Take first 5 keywords
    if len(keywords) > 5 {
        keywords = keywords[:5]
    }
    
    return strings.Join(keywords, " ")
}
```

### 2.9 Upvoting System

```go
// service-core/domain/feedback/voting.go

func (s *FeedbackService) Vote(feedbackID, userID uuid.UUID) error {
    // Check if already voted
    exists, err := s.voteRepo.Exists(feedbackID, userID)
    if err != nil {
        return err
    }
    if exists {
        return ErrAlreadyVoted
    }
    
    // Create vote
    if err := s.voteRepo.Create(feedbackID, userID); err != nil {
        return err
    }
    
    // Increment vote count
    return s.feedbackRepo.IncrementVotes(feedbackID)
}

func (s *FeedbackService) Unvote(feedbackID, userID uuid.UUID) error {
    // Check if voted
    exists, err := s.voteRepo.Exists(feedbackID, userID)
    if err != nil {
        return err
    }
    if !exists {
        return ErrNotVoted
    }
    
    // Delete vote
    if err := s.voteRepo.Delete(feedbackID, userID); err != nil {
        return err
    }
    
    // Decrement vote count
    return s.feedbackRepo.DecrementVotes(feedbackID)
}

func (s *FeedbackService) GetTopFeatureRequests(limit int) ([]*Feedback, error) {
    return s.feedbackRepo.FindByTypeOrderedByVotes("feature", limit)
}
```

### 2.10 Status Notification Service

```go
// service-core/domain/feedback/notifications.go

type StatusNotificationService struct {
    emailService *email.Service
    config       *NotificationConfig
}

func (s *StatusNotificationService) SendFeedbackStatusUpdate(feedback *Feedback, newStatus string) error {
    // Get status display info
    statusInfo := s.getStatusInfo(newStatus)
    
    // Get user
    user, err := s.userRepo.GetByID(feedback.SubmittedBy)
    if err != nil {
        return err
    }
    
    // Send email
    return s.emailService.Send(email.SendOptions{
        To:       user.Email,
        Template: "feedback_status_update",
        Data: map[string]interface{}{
            "user_name":       user.Name,
            "feedback_title":  feedback.Title,
            "feedback_id":     feedback.ID,
            "old_status":      s.getStatusInfo(feedback.Status).DisplayName,
            "new_status":      statusInfo.DisplayName,
            "status_message":  statusInfo.Message,
            "feedback_url":    fmt.Sprintf("%s/feedback/%s", s.config.AppURL, feedback.ID),
            "resolution_note": feedback.ResolutionNotes,
        },
    })
}

type StatusInfo struct {
    DisplayName string
    Message     string
    Emoji       string
}

func (s *StatusNotificationService) getStatusInfo(status string) StatusInfo {
    statusMap := map[string]StatusInfo{
        "submitted": {
            DisplayName: "Submitted",
            Message:     "We've received your feedback and will review it shortly.",
            Emoji:       "📥",
        },
        "triaged": {
            DisplayName: "Under Review",
            Message:     "Your feedback is being reviewed by our team.",
            Emoji:       "👀",
        },
        "in_progress": {
            DisplayName: "In Progress",
            Message:     "Great news! We're actively working on this.",
            Emoji:       "🔨",
        },
        "shipped": {
            DisplayName: "Shipped! 🎉",
            Message:     "This has been implemented and is now live.",
            Emoji:       "🚀",
        },
        "closed": {
            DisplayName: "Closed",
            Message:     "This feedback has been addressed.",
            Emoji:       "✅",
        },
        "wont_fix": {
            DisplayName: "Won't Fix",
            Message:     "After review, we've decided not to implement this at this time.",
            Emoji:       "🚫",
        },
    }
    
    if info, ok := statusMap[status]; ok {
        return info
    }
    return StatusInfo{DisplayName: status, Message: "", Emoji: ""}
}
```

### 2.11 Frontend Components

```svelte
<!-- service-client/src/routes/(app)/feedback/+page.svelte -->
<script lang="ts">
  import { captureSystemInfo, type SystemInfo } from '$lib/utils/system-info';
  import { feedbackService } from '$lib/services/feedback.service';
  
  let feedbackType = $state<'bug' | 'feature' | 'question' | 'other'>('feature');
  let title = $state('');
  let description = $state('');
  let screenshot = $state<File | null>(null);
  let systemInfo = $state<SystemInfo | null>(null);
  let isSubmitting = $state(false);
  let showSuccess = $state(false);
  let similarIssues = $state<string[]>([]);
  
  // Auto-capture system info for bugs
  $effect(() => {
    if (feedbackType === 'bug') {
      systemInfo = captureSystemInfo();
    } else {
      systemInfo = null;
    }
  });
  
  // Check for duplicates as user types title
  let debounceTimer: ReturnType<typeof setTimeout>;
  $effect(() => {
    if (title.length > 10) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const similar = await feedbackService.checkDuplicates(title);
        similarIssues = similar;
      }, 500);
    }
  });
  
  async function handleSubmit() {
    isSubmitting = true;
    
    try {
      const formData = new FormData();
      formData.append('type', feedbackType);
      formData.append('title', title);
      formData.append('description', description);
      
      if (systemInfo) {
        formData.append('system_info', JSON.stringify(systemInfo));
      }
      
      if (screenshot) {
        formData.append('screenshot', screenshot);
      }
      
      await feedbackService.submit(formData);
      showSuccess = true;
      
      // Reset form
      title = '';
      description = '';
      screenshot = null;
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      isSubmitting = false;
    }
  }
  
  async function captureScreenshot() {
    // Use browser's screenshot API if available
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();
      
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      
      stream.getTracks().forEach(track => track.stop());
      
      canvas.toBlob((blob) => {
        if (blob) {
          screenshot = new File([blob], 'screenshot.png', { type: 'image/png' });
        }
      }, 'image/png');
    } catch (error) {
      console.error('Screenshot capture failed:', error);
    }
  }
</script>

<div class="feedback-form max-w-2xl mx-auto p-6">
  <h1 class="text-2xl font-bold mb-6">Submit Feedback</h1>
  
  {#if showSuccess}
    <div class="alert alert-success mb-6">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      <div>
        <h3 class="font-bold">Thank you!</h3>
        <p>Your feedback has been submitted. We'll notify you of any updates.</p>
      </div>
      <button class="btn btn-sm" onclick={() => showSuccess = false}>Submit Another</button>
    </div>
  {:else}
    <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      <!-- Feedback Type -->
      <div class="form-control mb-4">
        <label class="label">
          <span class="label-text font-medium">What type of feedback is this?</span>
        </label>
        <div class="flex gap-2 flex-wrap">
          {#each [
            { value: 'bug', label: '🐛 Bug Report', desc: 'Something isn\'t working' },
            { value: 'feature', label: '✨ Feature Request', desc: 'I have an idea' },
            { value: 'question', label: '❓ Question', desc: 'I need help' },
            { value: 'other', label: '💬 Other', desc: 'General feedback' }
          ] as option}
            <button
              type="button"
              class="btn btn-outline flex-1 min-w-[140px] {feedbackType === option.value ? 'btn-primary' : ''}"
              onclick={() => feedbackType = option.value as typeof feedbackType}
            >
              <span class="block">{option.label}</span>
            </button>
          {/each}
        </div>
      </div>
      
      <!-- Title -->
      <div class="form-control mb-4">
        <label class="label">
          <span class="label-text font-medium">Title</span>
        </label>
        <input
          type="text"
          bind:value={title}
          placeholder={feedbackType === 'bug' ? 'Brief description of the issue' : 'Brief description of your request'}
          class="input input-bordered w-full"
          required
        />
      </div>
      
      <!-- Similar Issues Warning -->
      {#if similarIssues.length > 0}
        <div class="alert alert-warning mb-4">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 class="font-bold">Similar feedback found</h3>
            <p class="text-sm">Consider upvoting an existing item instead:</p>
            <ul class="text-sm mt-1">
              {#each similarIssues as issue}
                <li>• {issue}</li>
              {/each}
            </ul>
          </div>
        </div>
      {/if}
      
      <!-- Description -->
      <div class="form-control mb-4">
        <label class="label">
          <span class="label-text font-medium">
            {feedbackType === 'bug' ? 'Steps to reproduce' : 'Description'}
          </span>
        </label>
        <textarea
          bind:value={description}
          placeholder={feedbackType === 'bug' 
            ? '1. Go to...\n2. Click on...\n3. See error...\n\nExpected: ...\nActual: ...'
            : 'Describe your idea or feedback in detail...'}
          class="textarea textarea-bordered w-full min-h-[150px]"
          required
        ></textarea>
      </div>
      
      <!-- Screenshot (for bugs) -->
      {#if feedbackType === 'bug'}
        <div class="form-control mb-4">
          <label class="label">
            <span class="label-text font-medium">Screenshot (optional)</span>
          </label>
          <div class="flex gap-2">
            <button type="button" class="btn btn-outline" onclick={captureScreenshot}>
              📷 Capture Screen
            </button>
            <input
              type="file"
              accept="image/*"
              class="file-input file-input-bordered flex-1"
              onchange={(e) => screenshot = e.currentTarget.files?.[0] || null}
            />
          </div>
          {#if screenshot}
            <div class="mt-2 p-2 bg-base-200 rounded">
              <span class="text-sm">📎 {screenshot.name}</span>
              <button type="button" class="btn btn-xs btn-ghost ml-2" onclick={() => screenshot = null}>✕</button>
            </div>
          {/if}
        </div>
        
        <!-- System Info Display -->
        {#if systemInfo}
          <div class="collapse collapse-arrow bg-base-200 mb-4">
            <input type="checkbox" />
            <div class="collapse-title text-sm font-medium">
              System info will be automatically included
            </div>
            <div class="collapse-content text-xs">
              <pre class="overflow-auto">{JSON.stringify(systemInfo, null, 2)}</pre>
            </div>
          </div>
        {/if}
      {/if}
      
      <!-- Submit -->
      <div class="form-control mt-6">
        <button
          type="submit"
          class="btn btn-primary"
          disabled={isSubmitting || !title || !description}
        >
          {#if isSubmitting}
            <span class="loading loading-spinner"></span>
            Submitting...
          {:else}
            Submit Feedback
          {/if}
        </button>
      </div>
    </form>
  {/if}
</div>
```

```svelte
<!-- service-client/src/routes/(app)/feedback/list/+page.svelte -->
<script lang="ts">
  import { feedbackService, type Feedback } from '$lib/services/feedback.service';
  import { page } from '$app/state';
  
  let { data } = $props();
  let feedbackList = $state<Feedback[]>(data.feedback);
  let filter = $state<'all' | 'bug' | 'feature'>('all');
  let sortBy = $state<'newest' | 'votes'>('newest');
  let userVotes = $state<Set<string>>(new Set(data.userVotes));
  
  const filteredFeedback = $derived(() => {
    let filtered = feedbackList;
    
    if (filter !== 'all') {
      filtered = filtered.filter(f => f.type === filter);
    }
    
    if (sortBy === 'votes') {
      filtered = [...filtered].sort((a, b) => b.voteCount - a.voteCount);
    } else {
      filtered = [...filtered].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
    
    return filtered;
  });
  
  async function toggleVote(feedbackId: string) {
    const hasVoted = userVotes.has(feedbackId);
    
    try {
      if (hasVoted) {
        await feedbackService.unvote(feedbackId);
        userVotes.delete(feedbackId);
        const idx = feedbackList.findIndex(f => f.id === feedbackId);
        if (idx >= 0) feedbackList[idx].voteCount--;
      } else {
        await feedbackService.vote(feedbackId);
        userVotes.add(feedbackId);
        const idx = feedbackList.findIndex(f => f.id === feedbackId);
        if (idx >= 0) feedbackList[idx].voteCount++;
      }
      userVotes = new Set(userVotes); // Trigger reactivity
    } catch (error) {
      console.error('Vote failed:', error);
    }
  }
  
  function getStatusBadge(status: string) {
    const badges: Record<string, { class: string; label: string }> = {
      submitted: { class: 'badge-ghost', label: 'Submitted' },
      triaged: { class: 'badge-info', label: 'Under Review' },
      in_progress: { class: 'badge-warning', label: 'In Progress' },
      shipped: { class: 'badge-success', label: 'Shipped 🎉' },
      closed: { class: 'badge-neutral', label: 'Closed' },
      wont_fix: { class: 'badge-error', label: 'Won\'t Fix' },
    };
    return badges[status] || { class: 'badge-ghost', label: status };
  }
  
  function getTypeBadge(type: string) {
    const badges: Record<string, { class: string; label: string }> = {
      bug: { class: 'badge-error', label: '🐛 Bug' },
      feature: { class: 'badge-primary', label: '✨ Feature' },
      question: { class: 'badge-info', label: '❓ Question' },
      other: { class: 'badge-ghost', label: '💬 Other' },
    };
    return badges[type] || { class: 'badge-ghost', label: type };
  }
</script>

<div class="feedback-list max-w-4xl mx-auto p-6">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold">Feedback & Feature Requests</h1>
    <a href="/feedback" class="btn btn-primary">Submit Feedback</a>
  </div>
  
  <!-- Filters -->
  <div class="flex gap-4 mb-6">
    <div class="btn-group">
      <button 
        class="btn btn-sm {filter === 'all' ? 'btn-active' : ''}"
        onclick={() => filter = 'all'}
      >All</button>
      <button 
        class="btn btn-sm {filter === 'feature' ? 'btn-active' : ''}"
        onclick={() => filter = 'feature'}
      >Features</button>
      <button 
        class="btn btn-sm {filter === 'bug' ? 'btn-active' : ''}"
        onclick={() => filter = 'bug'}
      >Bugs</button>
    </div>
    
    <select class="select select-sm select-bordered" bind:value={sortBy}>
      <option value="newest">Newest First</option>
      <option value="votes">Most Voted</option>
    </select>
  </div>
  
  <!-- Feedback List -->
  <div class="space-y-4">
    {#each filteredFeedback() as feedback}
      <div class="card bg-base-100 shadow-sm border">
        <div class="card-body p-4">
          <div class="flex gap-4">
            <!-- Vote Button -->
            <div class="flex flex-col items-center">
              <button
                class="btn btn-ghost btn-sm {userVotes.has(feedback.id) ? 'text-primary' : ''}"
                onclick={() => toggleVote(feedback.id)}
              >
                <svg class="w-5 h-5" fill={userVotes.has(feedback.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <span class="font-bold">{feedback.voteCount}</span>
            </div>
            
            <!-- Content -->
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="badge {getTypeBadge(feedback.type).class}">
                  {getTypeBadge(feedback.type).label}
                </span>
                <span class="badge {getStatusBadge(feedback.status).class}">
                  {getStatusBadge(feedback.status).label}
                </span>
              </div>
              
              <h3 class="font-semibold">{feedback.title}</h3>
              <p class="text-sm text-base-content/70 line-clamp-2">{feedback.description}</p>
              
              <div class="flex items-center gap-4 mt-2 text-xs text-base-content/50">
                <span>by {feedback.submittedByName}</span>
                <span>{new Date(feedback.createdAt).toLocaleDateString()}</span>
                {#if feedback.githubIssueUrl}
                  <a href={feedback.githubIssueUrl} target="_blank" class="link">
                    View on GitHub →
                  </a>
                {/if}
              </div>
            </div>
          </div>
        </div>
      </div>
    {/each}
  </div>
</div>
```

---

## 3. Early Interest Capture

### 3.1 Overview

Capture early interest signups from the landing page and seamlessly convert them to freemium beta accounts when they activate.

### 3.2 Flow Options

#### Option A: Database + Resend Notification (Recommended)
- Store signups directly in database
- Send confirmation + welcome emails via Resend
- On account creation, check for matching signup and auto-grant freemium

#### Option B: Resend Audiences
- Add signups to Resend Audience
- Use Resend for email sequences
- Requires manual or webhook-based freemium granting

**Recommendation**: Option A provides better control and seamless account linking.

### 3.3 Database Schema

```sql
-- Early interest signups table
CREATE TABLE early_signups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    company_name VARCHAR(255),
    company_size VARCHAR(50),  -- solo, small (2-5), medium (6-20), large (20+)
    referral_source VARCHAR(100),  -- How did you hear about us?
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending',  -- pending, confirmed, converted, unsubscribed
    confirmation_token VARCHAR(100),
    confirmed_at TIMESTAMPTZ,
    
    -- Conversion tracking
    converted_to_agency_id UUID REFERENCES agencies(id),
    converted_at TIMESTAMPTZ,
    
    -- Marketing
    subscribed_to_updates BOOLEAN DEFAULT TRUE,
    resend_contact_id VARCHAR(100),  -- If synced to Resend
    
    -- Metadata
    ip_address VARCHAR(45),
    user_agent TEXT,
    landing_page_variant VARCHAR(50),
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_early_signups_email ON early_signups(email);
CREATE INDEX idx_early_signups_status ON early_signups(status);
CREATE INDEX idx_early_signups_converted ON early_signups(converted_to_agency_id) WHERE converted_to_agency_id IS NOT NULL;
```

### 3.4 Signup Service

```go
// service-core/domain/earlyaccess/service.go

type EarlyAccessService struct {
    repo           *EarlySignupRepository
    emailService   *email.Service
    resendClient   *resend.Client
    config         *EarlyAccessConfig
}

type SignupRequest struct {
    Email          string `json:"email" validate:"required,email"`
    Name           string `json:"name"`
    CompanyName    string `json:"company_name"`
    CompanySize    string `json:"company_size"`
    ReferralSource string `json:"referral_source"`
    UTMSource      string `json:"utm_source"`
    UTMMedium      string `json:"utm_medium"`
    UTMCampaign    string `json:"utm_campaign"`
}

func (s *EarlyAccessService) CreateSignup(req SignupRequest, ipAddress, userAgent string) (*EarlySignup, error) {
    // Check if already signed up
    existing, _ := s.repo.FindByEmail(req.Email)
    if existing != nil {
        if existing.Status == "confirmed" {
            return nil, ErrAlreadySignedUp
        }
        // Resend confirmation
        return s.resendConfirmation(existing)
    }
    
    // Generate confirmation token
    token := generateSecureToken(32)
    
    // Create signup record
    signup := &EarlySignup{
        ID:                uuid.New(),
        Email:             req.Email,
        Name:              req.Name,
        CompanyName:       req.CompanyName,
        CompanySize:       req.CompanySize,
        ReferralSource:    req.ReferralSource,
        Status:            "pending",
        ConfirmationToken: token,
        IPAddress:         ipAddress,
        UserAgent:         userAgent,
        UTMSource:         req.UTMSource,
        UTMMedium:         req.UTMMedium,
        UTMCampaign:       req.UTMCampaign,
        CreatedAt:         time.Now(),
    }
    
    if err := s.repo.Create(signup); err != nil {
        return nil, err
    }
    
    // Send confirmation email
    if err := s.sendConfirmationEmail(signup); err != nil {
        s.logger.Error("Failed to send confirmation email", "error", err)
        // Don't fail the signup
    }
    
    // Sync to Resend Audience (optional)
    if s.config.SyncToResend {
        go s.syncToResendAudience(signup)
    }
    
    return signup, nil
}

func (s *EarlyAccessService) ConfirmSignup(token string) (*EarlySignup, error) {
    signup, err := s.repo.FindByConfirmationToken(token)
    if err != nil {
        return nil, ErrInvalidToken
    }
    
    if signup.Status == "confirmed" {
        return signup, nil // Already confirmed
    }
    
    // Update status
    signup.Status = "confirmed"
    signup.ConfirmedAt = ptr(time.Now())
    
    if err := s.repo.Update(signup); err != nil {
        return nil, err
    }
    
    // Send welcome email
    if err := s.sendWelcomeEmail(signup); err != nil {
        s.logger.Error("Failed to send welcome email", "error", err)
    }
    
    return signup, nil
}

func (s *EarlyAccessService) sendConfirmationEmail(signup *EarlySignup) error {
    confirmURL := fmt.Sprintf("%s/early-access/confirm?token=%s", s.config.AppURL, signup.ConfirmationToken)
    
    return s.emailService.Send(email.SendOptions{
        To:       signup.Email,
        Template: "early_access_confirmation",
        Data: map[string]interface{}{
            "name":        signup.Name,
            "confirm_url": confirmURL,
        },
    })
}

func (s *EarlyAccessService) sendWelcomeEmail(signup *EarlySignup) error {
    return s.emailService.Send(email.SendOptions{
        To:       signup.Email,
        Template: "early_access_welcome",
        Data: map[string]interface{}{
            "name": signup.Name,
        },
    })
}

// ConvertToAccount is called when an early signup creates a full account
func (s *EarlyAccessService) ConvertToAccount(email string, agencyID uuid.UUID) error {
    signup, err := s.repo.FindByEmail(email)
    if err != nil {
        return nil // Not an early signup, that's fine
    }
    
    if signup.Status != "confirmed" {
        return nil // Not confirmed, don't convert
    }
    
    // Update signup record
    signup.ConvertedToAgencyID = &agencyID
    signup.ConvertedAt = ptr(time.Now())
    signup.Status = "converted"
    
    if err := s.repo.Update(signup); err != nil {
        return err
    }
    
    // Grant freemium status to the agency
    return s.subscriptionService.GrantFreemium(
        agencyID,
        "early_signup",
        nil, // No expiry for early signups
        "system:early_access",
    )
}
```

### 3.5 Account Creation Hook

```go
// service-core/domain/agency/service.go

func (s *AgencyService) CreateAgency(req CreateAgencyRequest) (*Agency, error) {
    // ... existing agency creation logic ...
    
    agency, err := s.repo.Create(...)
    if err != nil {
        return nil, err
    }
    
    // Check if this user was an early signup and convert them
    if err := s.earlyAccessService.ConvertToAccount(req.OwnerEmail, agency.ID); err != nil {
        s.logger.Warn("Failed to convert early signup", "error", err)
        // Don't fail agency creation
    }
    
    return agency, nil
}
```

### 3.6 Landing Page Signup Form

```svelte
<!-- Landing page signup component -->
<script lang="ts">
  import { earlyAccessService } from '$lib/services/early-access.service';
  
  let email = $state('');
  let name = $state('');
  let companyName = $state('');
  let companySize = $state('');
  let referralSource = $state('');
  
  let isSubmitting = $state(false);
  let submitted = $state(false);
  let error = $state<string | null>(null);
  
  // Capture UTM params from URL
  const utm = $derived(() => {
    if (typeof window === 'undefined') return {};
    const params = new URLSearchParams(window.location.search);
    return {
      source: params.get('utm_source') || '',
      medium: params.get('utm_medium') || '',
      campaign: params.get('utm_campaign') || '',
    };
  });
  
  async function handleSubmit() {
    error = null;
    isSubmitting = true;
    
    try {
      await earlyAccessService.signup({
        email,
        name,
        company_name: companyName,
        company_size: companySize,
        referral_source: referralSource,
        utm_source: utm().source,
        utm_medium: utm().medium,
        utm_campaign: utm().campaign,
      });
      
      submitted = true;
    } catch (e: any) {
      if (e.code === 'ALREADY_SIGNED_UP') {
        error = 'You\'re already on the list! Check your email for confirmation.';
      } else {
        error = 'Something went wrong. Please try again.';
      }
    } finally {
      isSubmitting = false;
    }
  }
</script>

<section class="early-access-signup py-16 bg-gradient-to-br from-primary/10 to-secondary/10">
  <div class="container mx-auto px-4 max-w-xl">
    {#if submitted}
      <div class="text-center">
        <div class="text-6xl mb-4">🎉</div>
        <h2 class="text-3xl font-bold mb-4">You're on the list!</h2>
        <p class="text-lg text-base-content/70">
          Check your email to confirm your spot. We'll notify you when WebKit launches.
        </p>
        <div class="mt-6 p-4 bg-base-100 rounded-lg">
          <p class="font-medium">🎁 Early Access Benefit</p>
          <p class="text-sm text-base-content/70">
            As a beta tester, you'll get <strong>free enterprise access</strong> during our beta period.
          </p>
        </div>
      </div>
    {:else}
      <div class="text-center mb-8">
        <h2 class="text-3xl font-bold mb-4">Get Early Access</h2>
        <p class="text-lg text-base-content/70">
          Join our beta program and get free enterprise features
        </p>
      </div>
      
      <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
        {#if error}
          <div class="alert alert-error">
            <span>{error}</span>
          </div>
        {/if}
        
        <div class="form-control">
          <input
            type="email"
            bind:value={email}
            placeholder="Your email address"
            class="input input-bordered input-lg w-full"
            required
          />
        </div>
        
        <div class="grid grid-cols-2 gap-4">
          <div class="form-control">
            <input
              type="text"
              bind:value={name}
              placeholder="Your name"
              class="input input-bordered w-full"
            />
          </div>
          
          <div class="form-control">
            <input
              type="text"
              bind:value={companyName}
              placeholder="Company name"
              class="input input-bordered w-full"
            />
          </div>
        </div>
        
        <div class="grid grid-cols-2 gap-4">
          <div class="form-control">
            <select bind:value={companySize} class="select select-bordered w-full">
              <option value="" disabled>Team size</option>
              <option value="solo">Solo / Freelancer</option>
              <option value="small">Small (2-5)</option>
              <option value="medium">Medium (6-20)</option>
              <option value="large">Large (20+)</option>
            </select>
          </div>
          
          <div class="form-control">
            <select bind:value={referralSource} class="select select-bordered w-full">
              <option value="" disabled>How did you find us?</option>
              <option value="google">Google Search</option>
              <option value="social">Social Media</option>
              <option value="referral">Referral</option>
              <option value="blog">Blog/Article</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        
        <button
          type="submit"
          class="btn btn-primary btn-lg w-full"
          disabled={isSubmitting || !email}
        >
          {#if isSubmitting}
            <span class="loading loading-spinner"></span>
            Joining...
          {:else}
            Join the Beta →
          {/if}
        </button>
        
        <p class="text-xs text-center text-base-content/50">
          No spam, ever. Unsubscribe anytime.
        </p>
      </form>
    {/if}
  </div>
</section>
```

### 3.7 Email Templates

```html
<!-- early_access_confirmation.html -->
<!DOCTYPE html>
<html>
<head>
  <title>Confirm Your Early Access Signup</title>
</head>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
  <h1 style="color: #1a1a1a;">Almost there, {{.name}}! 🎉</h1>
  
  <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
    Thanks for signing up for early access to WebKit. Please confirm your email to secure your spot.
  </p>
  
  <a href="{{.confirm_url}}" style="display: inline-block; background: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0;">
    Confirm My Email
  </a>
  
  <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 30px 0;">
    <h3 style="margin-top: 0; color: #1a1a1a;">🎁 What you'll get:</h3>
    <ul style="color: #4a4a4a; line-height: 1.8;">
      <li><strong>Free enterprise access</strong> during beta</li>
      <li><strong>Early influence</strong> on features we build</li>
      <li><strong>Priority support</strong> from our team</li>
      <li><strong>Lifetime discount</strong> when we launch</li>
    </ul>
  </div>
  
  <p style="color: #888; font-size: 14px;">
    If you didn't sign up for WebKit, you can safely ignore this email.
  </p>
  
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  
  <p style="color: #888; font-size: 12px;">
    WebKit - Professional proposals for web design agencies<br>
    <a href="{{.unsubscribe_url}}" style="color: #888;">Unsubscribe</a>
  </p>
</body>
</html>
```

```html
<!-- early_access_welcome.html -->
<!DOCTYPE html>
<html>
<head>
  <title>Welcome to WebKit Beta!</title>
</head>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
  <h1 style="color: #1a1a1a;">Welcome to the club, {{.name}}! 🚀</h1>
  
  <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
    You're confirmed for early access to WebKit. Here's what happens next:
  </p>
  
  <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 24px; border-radius: 12px; margin: 20px 0;">
    <h2 style="margin-top: 0;">Your Beta Benefits</h2>
    <p style="margin-bottom: 0; opacity: 0.9;">
      When we launch, you'll automatically get <strong>free enterprise access</strong> 
      with no payment required. We'll email you the moment it's ready.
    </p>
  </div>
  
  <h3 style="color: #1a1a1a;">What we're building:</h3>
  <p style="color: #4a4a4a; line-height: 1.6;">
    WebKit turns your discovery calls into professional proposals in minutes. 
    Capture consultation notes, run automated website audits, and generate 
    personalized proposals your clients will love.
  </p>
  
  <h3 style="color: #1a1a1a;">Help shape WebKit:</h3>
  <p style="color: #4a4a4a; line-height: 1.6;">
    As a beta tester, your feedback directly influences what we build. 
    Reply to this email anytime with ideas, frustrations, or feature requests.
  </p>
  
  <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
    We're excited to have you on this journey!
  </p>
  
  <p style="color: #4a4a4a;">
    — Benjamin & the WebKit team
  </p>
  
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  
  <p style="color: #888; font-size: 12px;">
    WebKit - Professional proposals for web design agencies<br>
    <a href="{{.unsubscribe_url}}" style="color: #888;">Unsubscribe</a>
  </p>
</body>
</html>
```

---

## 4. Database Schema (Complete)

```sql
-- ============================================
-- FREEMIUM SYSTEM
-- ============================================

-- Add freemium columns to existing agencies table
ALTER TABLE agencies ADD COLUMN is_freemium BOOLEAN DEFAULT FALSE;
ALTER TABLE agencies ADD COLUMN freemium_reason VARCHAR(50);
ALTER TABLE agencies ADD COLUMN freemium_expires_at TIMESTAMPTZ;
ALTER TABLE agencies ADD COLUMN freemium_granted_at TIMESTAMPTZ;
ALTER TABLE agencies ADD COLUMN freemium_granted_by VARCHAR(255);

CREATE INDEX idx_agencies_freemium ON agencies(is_freemium) WHERE is_freemium = TRUE;
CREATE INDEX idx_agencies_freemium_expires ON agencies(freemium_expires_at) WHERE freemium_expires_at IS NOT NULL;

-- ============================================
-- FEEDBACK PORTAL
-- ============================================

-- Main feedback table
CREATE TABLE feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    submitted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    type VARCHAR(20) NOT NULL DEFAULT 'other',
    status VARCHAR(20) NOT NULL DEFAULT 'submitted',
    priority VARCHAR(10),
    
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    
    system_info JSONB,
    ai_classification JSONB,
    ai_classified_at TIMESTAMPTZ,
    
    github_issue_url VARCHAR(500),
    github_issue_number INTEGER,
    github_synced_at TIMESTAMPTZ,
    
    attachments JSONB DEFAULT '[]'::jsonb,
    
    vote_count INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT TRUE,
    admin_notes TEXT,
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feedback_agency ON feedback(agency_id);
CREATE INDEX idx_feedback_type ON feedback(type);
CREATE INDEX idx_feedback_status ON feedback(status);
CREATE INDEX idx_feedback_votes ON feedback(vote_count DESC);
CREATE INDEX idx_feedback_created ON feedback(created_at DESC);
CREATE INDEX idx_feedback_github ON feedback(github_issue_number) WHERE github_issue_number IS NOT NULL;

-- Votes table
CREATE TABLE feedback_votes (
    feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (feedback_id, user_id)
);

-- Comments table
CREATE TABLE feedback_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_admin_reply BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feedback_comments_feedback ON feedback_comments(feedback_id);

-- Status history table
CREATE TABLE feedback_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    changed_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feedback_history_feedback ON feedback_status_history(feedback_id);

-- ============================================
-- EARLY ACCESS SIGNUPS
-- ============================================

CREATE TABLE early_signups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    company_name VARCHAR(255),
    company_size VARCHAR(50),
    referral_source VARCHAR(100),
    
    status VARCHAR(20) DEFAULT 'pending',
    confirmation_token VARCHAR(100),
    confirmed_at TIMESTAMPTZ,
    
    converted_to_agency_id UUID REFERENCES agencies(id),
    converted_at TIMESTAMPTZ,
    
    subscribed_to_updates BOOLEAN DEFAULT TRUE,
    resend_contact_id VARCHAR(100),
    
    ip_address VARCHAR(45),
    user_agent TEXT,
    landing_page_variant VARCHAR(50),
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_early_signups_email ON early_signups(email);
CREATE INDEX idx_early_signups_status ON early_signups(status);
CREATE INDEX idx_early_signups_token ON early_signups(confirmation_token) WHERE confirmation_token IS NOT NULL;
CREATE INDEX idx_early_signups_converted ON early_signups(converted_to_agency_id) WHERE converted_to_agency_id IS NOT NULL;
```

---

## 5. API Specifications

### 5.1 Feedback Portal APIs

```yaml
# Feedback API Endpoints

# Submit feedback
POST /api/v1/feedback
Content-Type: multipart/form-data
Authorization: Bearer {token}
Body:
  type: string (bug|feature|question|other)
  title: string
  description: string
  system_info: JSON (optional, for bugs)
  screenshot: file (optional)
Response: 201 Created
  {
    "id": "uuid",
    "title": "...",
    "status": "submitted",
    "github_issue_url": "https://github.com/..." (if created)
  }

# List feedback (own + public)
GET /api/v1/feedback
Authorization: Bearer {token}
Query:
  type: string (optional filter)
  status: string (optional filter)
  sort: string (newest|votes, default: newest)
  page: number
  limit: number (default: 20)
Response: 200 OK
  {
    "items": [...],
    "total": 100,
    "page": 1,
    "has_more": true
  }

# Get single feedback
GET /api/v1/feedback/{id}
Authorization: Bearer {token}
Response: 200 OK
  { full feedback object with comments }

# Vote on feedback
POST /api/v1/feedback/{id}/vote
Authorization: Bearer {token}
Response: 200 OK
  { "vote_count": 42 }

# Remove vote
DELETE /api/v1/feedback/{id}/vote
Authorization: Bearer {token}
Response: 200 OK
  { "vote_count": 41 }

# Add comment
POST /api/v1/feedback/{id}/comments
Authorization: Bearer {token}
Body:
  content: string
Response: 201 Created
  { comment object }

# Check for duplicates
GET /api/v1/feedback/duplicates
Authorization: Bearer {token}
Query:
  title: string
Response: 200 OK
  { "similar": ["#123: Title 1", "#456: Title 2"] }

# === Admin Endpoints ===

# List all feedback (admin)
GET /api/v1/admin/feedback
Authorization: Bearer {admin_token}
Query: (extended filters)
Response: 200 OK

# Update feedback status (admin)
PATCH /api/v1/admin/feedback/{id}
Authorization: Bearer {admin_token}
Body:
  status: string
  priority: string
  admin_notes: string
  resolution_notes: string
Response: 200 OK

# Create GitHub issue manually (admin)
POST /api/v1/admin/feedback/{id}/github
Authorization: Bearer {admin_token}
Response: 200 OK
  { "github_issue_url": "..." }

# Sync from GitHub (admin)
POST /api/v1/admin/feedback/{id}/github/sync
Authorization: Bearer {admin_token}
Response: 200 OK
```

### 5.2 Early Access APIs

```yaml
# Early Access API Endpoints

# Create signup
POST /api/v1/early-access/signup
Content-Type: application/json
Body:
  email: string (required)
  name: string
  company_name: string
  company_size: string
  referral_source: string
  utm_source: string
  utm_medium: string
  utm_campaign: string
Response: 201 Created
  { "message": "Check your email to confirm" }
Response: 409 Conflict
  { "error": "ALREADY_SIGNED_UP" }

# Confirm signup
GET /api/v1/early-access/confirm
Query:
  token: string
Response: 302 Redirect to /early-access/confirmed

# Unsubscribe
GET /api/v1/early-access/unsubscribe
Query:
  email: string
  token: string
Response: 200 OK

# === Admin Endpoints ===

# List signups
GET /api/v1/admin/early-access
Authorization: Bearer {admin_token}
Query:
  status: string
  page: number
  limit: number
Response: 200 OK
  { "items": [...], "total": ... }

# Export signups
GET /api/v1/admin/early-access/export
Authorization: Bearer {admin_token}
Query:
  format: csv|json
Response: 200 OK (file download)
```

### 5.3 Freemium Management APIs

```yaml
# Freemium Admin API Endpoints

# Grant freemium
POST /api/v1/admin/agencies/{id}/freemium
Authorization: Bearer {admin_token}
Body:
  reason: string (beta_tester|partner|promotional|early_signup|referral_reward|internal)
  expires_at: timestamp (optional)
Response: 200 OK

# Revoke freemium
DELETE /api/v1/admin/agencies/{id}/freemium
Authorization: Bearer {admin_token}
Body:
  new_tier: string (starter|growth)
Response: 200 OK

# List freemium agencies
GET /api/v1/admin/agencies/freemium
Authorization: Bearer {admin_token}
Query:
  reason: string
  expiring_before: timestamp
Response: 200 OK
  { "items": [...] }
```

---

## 6. Implementation Checklist

### Phase 1: Freemium Flag System (Day 1)
- [ ] Add database migration for freemium columns
- [ ] Implement `GetEffectiveTier()` function in subscription service
- [ ] Update all limit checks to use effective tier
- [ ] Add `GrantFreemium()` and `RevokeFreemium()` functions
- [ ] Add admin UI for managing freemium status
- [ ] Create freemium expiry cron job
- [ ] Add email template for expiry notification
- [ ] Test: Verify freemium users get enterprise limits
- [ ] Test: Verify expired freemium reverts to actual tier

### Phase 2: Early Interest Capture (Day 2)
- [ ] Create early_signups database table
- [ ] Build landing page signup form component
- [ ] Implement signup service with validation
- [ ] Create confirmation email template
- [ ] Create welcome email template
- [ ] Implement email confirmation flow
- [ ] Hook into account creation to auto-convert
- [ ] Add UTM tracking capture
- [ ] Add admin view for signups
- [ ] Test: Full signup → confirm → convert flow

### Phase 3: Basic Feedback Portal (Days 3-4)
- [ ] Create feedback database tables
- [ ] Build feedback submission form
- [ ] Implement system info capture utility
- [ ] Add screenshot capture functionality
- [ ] Build feedback list view with filtering
- [ ] Implement voting system
- [ ] Add feedback detail view
- [ ] Create comment system
- [ ] Add status display badges
- [ ] Test: Submit, vote, comment flow

### Phase 4: AI Classification (Day 5)
- [ ] Build Claude classification prompt
- [ ] Implement FeedbackClassifier service
- [ ] Add classification to submission flow
- [ ] Store classification results
- [ ] Add duplicate detection logic
- [ ] Show similar issues warning on submit
- [ ] Test: Various feedback types classify correctly

### Phase 5: GitHub Integration (Day 6)
- [ ] Set up GitHub API authentication
- [ ] Implement issue creation service
- [ ] Build issue body formatter
- [ ] Add label mapping
- [ ] Create GitHub webhook handler
- [ ] Implement status sync from GitHub
- [ ] Add manual sync button for admins
- [ ] Test: Feedback → GitHub issue → status sync

### Phase 6: Status Tracking & Notifications (Day 7)
- [ ] Create status history table
- [ ] Implement status change tracking
- [ ] Build notification service
- [ ] Create status update email template
- [ ] Add "shipped" notification
- [ ] Add in-app notification system (optional)
- [ ] Build user's feedback history view
- [ ] Test: Full status lifecycle with notifications

### Phase 7: Admin Dashboard & Polish (Day 8)
- [ ] Build admin feedback list with advanced filters
- [ ] Add bulk actions (close, merge, archive)
- [ ] Create feedback analytics dashboard
- [ ] Add early signup analytics
- [ ] Build freemium analytics
- [ ] Add export functionality
- [ ] Performance optimization
- [ ] Documentation

---

## Appendix A: Configuration

```yaml
# config/feedback.yaml
feedback:
  github:
    owner: "plentify-web-designs"
    repo: "webkit"
    default_labels:
      - "feedback-portal"
    webhook_secret: "${GITHUB_WEBHOOK_SECRET}"
  
  ai:
    model: "claude-sonnet-4-20250514"
    max_tokens: 1024
  
  notifications:
    enabled: true
    from_email: "webkit@plentifywebdesigns.com"
  
  limits:
    max_attachments: 5
    max_attachment_size_mb: 10
    rate_limit_per_hour: 10

early_access:
  sync_to_resend: true
  resend_audience_id: "${RESEND_AUDIENCE_ID}"
  double_opt_in: true

freemium:
  default_tier_on_expiry: "starter"
  expiry_warning_days: 7
```

---

## Appendix B: Metrics to Track

### Feedback Portal Metrics
- Total feedback submitted (by type)
- Feedback resolution time (by priority)
- Vote distribution
- Most requested features
- Bug severity distribution
- User engagement (submissions per user)

### Early Access Metrics
- Signup rate (per day/week)
- Confirmation rate
- Conversion to full account rate
- Source attribution (UTM)
- Company size distribution
- Time to conversion

### Freemium Metrics
- Active freemium accounts (by reason)
- Freemium to paid conversion rate
- Feature usage by freemium users
- Expiry vs renewal rate
- Revenue impact tracking

---

*Document Version: 1.0*  
*Last Updated: January 2026*  
*Author: Generated for Plentify Web Designs*
