package rest

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/google/uuid"

	"app/pkg"
	"service-core/storage/query"
)

// xapiRequest represents the incoming xAPI statement from the H5P player
type xapiRequest struct {
	ContentID string      `json:"contentId"`
	Verb      string      `json:"verb"`
	Statement interface{} `json:"statement"`
}

func (h *Handler) handleXapiStatement(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Method not allowed"})
		return
	}

	// Parse JWT
	token := extractAccessToken(r)
	if token == "" {
		writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: errors.New("missing access token")})
		return
	}

	claims, err := h.authService.ValidateAccessToken(token)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: errors.New("invalid access token")})
		return
	}

	userID := claims.ID

	// Parse request body
	var req xapiRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Invalid request body"})
		return
	}

	if req.ContentID == "" || req.Verb == "" {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "contentId and verb are required"})
		return
	}

	contentUUID, err := uuid.Parse(req.ContentID)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Invalid contentId"})
		return
	}

	ctx := r.Context()
	store := query.New(h.storage.Conn)

	// Validate content exists and get org_id
	content, err := store.GetH5PContentOrgId(ctx, contentUUID)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Content not found"})
		return
	}

	// Verify user is an org member
	_, err = store.CheckUserOrgMembership(ctx, query.CheckUserOrgMembershipParams{
		UserID:         userID,
		OrganisationID: content.OrgID,
	})
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: errors.New("not a member of this organisation")})
		return
	}

	// Serialize statement to JSON
	statementJSON, err := json.Marshal(req.Statement)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Invalid statement"})
		return
	}

	// Insert xAPI statement (append-only)
	_, err = store.InsertXapiStatement(ctx, query.InsertXapiStatementParams{
		OrgID:     content.OrgID,
		UserID:    userID,
		ContentID: uuid.NullUUID{UUID: contentUUID, Valid: true},
		Verb:      req.Verb,
		Statement: statementJSON,
	})
	if err != nil {
		// Log but don't fail — xAPI is best-effort
		slog.Error("failed to insert xAPI statement", "error", err)
	}

	// For completion/scored verbs, update progress
	if req.Verb == "completed" || req.Verb == "scored" {
		h.updateProgress(ctx, store, userID, contentUUID, content.OrgID, req)
	}

	writeResponse(h.cfg, w, r, map[string]bool{"ok": true}, nil)
}

func (h *Handler) updateProgress(ctx context.Context, store *query.Queries, userID uuid.UUID, contentID uuid.UUID, orgID uuid.UUID, req xapiRequest) {
	// Find all enrolments where this user is enrolled in a course containing this content
	enrolmentRows, err := store.GetEnrolmentsByUserAndContentId(ctx, query.GetEnrolmentsByUserAndContentIdParams{
		UserID:    userID,
		ContentID: uuid.NullUUID{UUID: contentID, Valid: true},
	})
	if err != nil || len(enrolmentRows) == 0 {
		return // No enrolments — content played outside course context
	}

	// Extract score info from statement
	var score, maxScore string
	var scoreValid, maxScoreValid bool
	var completed bool
	var timeSpent int32

	if req.Verb == "completed" {
		completed = true
	}

	// Try to extract score from statement
	if stmtMap, ok := req.Statement.(map[string]interface{}); ok {
		if result, ok := stmtMap["result"].(map[string]interface{}); ok {
			if scoreObj, ok := result["score"].(map[string]interface{}); ok {
				if raw, ok := scoreObj["raw"].(float64); ok {
					score = fmt.Sprintf("%.2f", raw)
					scoreValid = true
				}
				if max, ok := scoreObj["max"].(float64); ok {
					maxScore = fmt.Sprintf("%.2f", max)
					maxScoreValid = true
				}
			}
			if duration, ok := result["duration"].(string); ok {
				timeSpent = parseDuration(duration)
			}
		}
	}

	for _, enrolment := range enrolmentRows {
		// Determine completion value as string for numeric column
		completionStr := "0"
		if completed {
			completionStr = "1"
		}

		// UPSERT progress record for each enrolment
		err := store.UpsertProgressRecord(ctx, query.UpsertProgressRecordParams{
			OrgID:       orgID,
			EnrolmentID: enrolment.ID,
			ContentID:   contentID,
			UserID:      userID,
			Score:       sql.NullString{String: score, Valid: scoreValid},
			MaxScore:    sql.NullString{String: maxScore, Valid: maxScoreValid},
			Completion:  completionStr,
			Completed:   completed,
			TimeSpent:   timeSpent,
		})
		if err != nil {
			slog.Error("failed to upsert progress record", "error", err, "enrolmentId", enrolment.ID)
			continue
		}

		// Check if all items in this enrolment's course are completed
		completedCount, err := store.CountCompletedItemsInEnrolment(ctx, enrolment.ID)
		if err != nil {
			continue
		}
		activeCount, err := store.CountActiveItemsInCourse(ctx, enrolment.CourseID)
		if err != nil {
			continue
		}

		if completedCount >= activeCount && activeCount > 0 {
			_ = store.CompleteEnrolment(ctx, enrolment.ID)
		}
	}
}

// parseDuration converts ISO 8601 duration to seconds (simplified)
func parseDuration(iso string) int32 {
	// Basic parser for PT#H#M#S format
	var total int32
	var num int32
	inTime := false
	for _, c := range iso {
		switch {
		case c == 'P':
			continue
		case c == 'T':
			inTime = true
		case c >= '0' && c <= '9':
			num = num*10 + int32(c-'0')
		case c == 'H' && inTime:
			total += num * 3600
			num = 0
		case c == 'M' && inTime:
			total += num * 60
			num = 0
		case c == 'S' && inTime:
			total += num
			num = 0
		}
	}
	return total
}
