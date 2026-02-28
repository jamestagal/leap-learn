package h5p

import "github.com/google/uuid"

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

// ContentTypeCacheEntry combines hub data with local install status
type ContentTypeCacheEntry struct {
	ID            string          `json:"id"` // machine_name
	Title         string          `json:"title"`
	Summary       string          `json:"summary"`
	Description   string          `json:"description"`
	Icon          string          `json:"icon"`
	MajorVersion  int             `json:"majorVersion"`
	MinorVersion  int             `json:"minorVersion"`
	PatchVersion  int             `json:"patchVersion"`
	IsRecommended bool            `json:"isRecommended"`
	Popularity    int             `json:"popularity"`
	Screenshots   []HubScreenshot `json:"screenshots"`
	Keywords      []string        `json:"keywords"`
	Categories    []string        `json:"categories"`
	Owner         string          `json:"owner"`
	Example       string          `json:"example"`
	Installed     bool            `json:"installed"`
	LocalVersion  string          `json:"localVersion,omitempty"`
	UpdateAvailable bool          `json:"updateAvailable,omitempty"`
}

// InstallRequest represents a request to install a library from the Hub
type InstallRequest struct {
	MachineName string `json:"machineName"`
}
