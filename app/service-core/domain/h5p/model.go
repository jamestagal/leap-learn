package h5p

import (
	"encoding/json"

	"github.com/google/uuid"
)

// HubContentType represents a single content type from the H5P Hub API
type HubContentType struct {
	ID                 string            `json:"id"` // machine_name e.g. "H5P.Accordion"
	Version            HubVersion        `json:"version"`
	CoreAPIVersionNeeded HubVersion      `json:"coreApiVersionNeeded"`
	Title              string            `json:"title"`
	Summary            string            `json:"summary"`
	Description        string            `json:"description"`
	Icon               string            `json:"icon"`
	CreatedAt          string            `json:"createdAt"`
	UpdatedAt          string            `json:"updatedAt"`
	IsRecommended      bool              `json:"isRecommended"`
	Popularity         int               `json:"popularity"`
	Screenshots        []HubScreenshot   `json:"screenshots"`
	License            *HubLicense       `json:"license,omitempty"`
	Owner              string            `json:"owner"`
	Example            string            `json:"example"`
	Tutorial           string            `json:"tutorial"`
	Keywords           []string          `json:"keywords"`
	Categories         []string          `json:"categories"`
}

type HubVersion struct {
	Major int `json:"major"`
	Minor int `json:"minor"`
	Patch int `json:"patch"`
}

type HubScreenshot struct {
	URL string `json:"url"`
	Alt string `json:"alt"`
}

type HubLicense struct {
	ID         string              `json:"id"`
	Attributes HubLicenseAttributes `json:"attributes"`
}

type HubLicenseAttributes struct {
	UseCommercially     bool `json:"useCommercially"`
	Modifiable          bool `json:"modifiable"`
	Distributable       bool `json:"distributable"`
	Sublicensable       bool `json:"sublicensable"`
	CanHoldLiable       bool `json:"canHoldLiable"`
	MustIncludeCopyright bool `json:"mustIncludeCopyright"`
	MustIncludeLicense   bool `json:"mustIncludeLicense"`
}

// HubResponse is the top-level response from POST /v1/content-types/
type HubResponse struct {
	ContentTypes []HubContentType `json:"contentTypes"`
}

// HubRegistryResponse is the Catharsis-format response served by our Hub endpoints
type HubRegistryResponse struct {
	ContentTypes []HubContentType `json:"contentTypes"`
	APIVersion   HubVersion       `json:"apiVersion"`
	Outdated     bool             `json:"outdated"`
}

// LibraryInfo is the API response for a single installed library
type LibraryInfo struct {
	ID           uuid.UUID `json:"id"`
	MachineName  string    `json:"machineName"`
	MajorVersion int32     `json:"majorVersion"`
	MinorVersion int32     `json:"minorVersion"`
	PatchVersion int32     `json:"patchVersion"`
	Title        string    `json:"title"`
	Description  string    `json:"description"`
	Icon         string    `json:"icon"`
	Runnable     bool      `json:"runnable"`
	Origin       string    `json:"origin"`
	Installed    bool      `json:"installed"`
}

// ContentTypeCacheEntry combines hub data with local install status.
// Field names MUST match what the H5P editor JS expects (h5peditor-selector-hub.js, h5peditor.js).
type ContentTypeCacheEntry struct {
	ID                 string          `json:"id"`
	MachineName        string          `json:"machineName"`
	Title              string          `json:"title"`
	Summary            string          `json:"summary"`
	Description        string          `json:"description"`
	Icon               string          `json:"icon"`
	MajorVersion       int             `json:"majorVersion"`
	MinorVersion       int             `json:"minorVersion"`
	PatchVersion       int             `json:"patchVersion"`
	IsRecommended      bool            `json:"isRecommended"`
	Popularity         int             `json:"popularity"`
	Screenshots        []HubScreenshot `json:"screenshots"`
	Keywords           []string        `json:"keywords"`
	Categories         []string        `json:"categories"`
	Owner              string          `json:"owner"`
	Example            string          `json:"example"`
	Tutorial           string          `json:"tutorial,omitempty"`
	Installed          bool            `json:"installed"`
	LocalMajorVersion  int             `json:"localMajorVersion,omitempty"`
	LocalMinorVersion  int             `json:"localMinorVersion,omitempty"`
	LocalPatchVersion  int             `json:"localPatchVersion,omitempty"`
	UpdateAvailable    bool            `json:"updateAvailable,omitempty"`
}

// InstallRequest represents a request to install a library from the Hub
type InstallRequest struct {
	MachineName string `json:"machineName"`
}

// EditorLibraryDetail — GET /ajax?action=libraries response for a single library
type EditorLibraryDetail struct {
	Name            string                     `json:"name"`
	Title           string                     `json:"title"`
	Version         HubVersion                 `json:"version"`
	CSS             []string                   `json:"css"`
	JavaScript      []string                   `json:"javascript"`
	Semantics       json.RawMessage            `json:"semantics"`
	Language        any                        `json:"language"`        // JSON string of current lang file, or null
	Languages       []string                   `json:"languages"`
	DefaultLanguage any                        `json:"defaultLanguage"` // JSON string of default lang file, or null
	Translations    map[string]json.RawMessage `json:"translations"`
	UpgradesScript  string                     `json:"upgradesScript,omitempty"`
}

// EditorContentParams — GET /params/:contentId response
type EditorContentParams struct {
	H5P     json.RawMessage `json:"h5p,omitempty"`
	Library string          `json:"library"`
	Params  json.RawMessage `json:"params"`
}

// TempFileResult — POST /ajax?action=files response
type TempFileResult struct {
	Path   string `json:"path"`
	Mime   string `json:"mime"`
	Width  int    `json:"width,omitempty"`
	Height int    `json:"height,omitempty"`
}

// ContentInfo — API response for content items
type ContentInfo struct {
	ID             uuid.UUID `json:"id"`
	Title          string    `json:"title"`
	Slug           string    `json:"slug"`
	Description    string    `json:"description"`
	Status         string    `json:"status"`
	LibraryID      uuid.UUID `json:"libraryId"`
	LibraryName    string    `json:"libraryName"`
	LibraryTitle   string    `json:"libraryTitle"`
	LibraryVersion string    `json:"libraryVersion"`
	CreatedAt      string    `json:"createdAt"`
	UpdatedAt      string    `json:"updatedAt"`
}

// IHubInfo — content-type-cache in editor format
type IHubInfo struct {
	APIVersion   HubVersion              `json:"apiVersion"`
	Details      []any                   `json:"details"`
	Libraries    []ContentTypeCacheEntry `json:"libraries"`
	Outdated     bool                    `json:"outdated"`
	RecentlyUsed []string                `json:"recentlyUsed"`
	User         string                  `json:"user"`
}
