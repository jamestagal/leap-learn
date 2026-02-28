package h5p

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"path"
	"strconv"
	"strings"
)

// FlexInt handles JSON values that may be either a number or a string-encoded number.
// H5P's h5p.json and library.json files inconsistently encode version numbers
// as strings ("1") or integers (1) depending on the content type.
type FlexInt int

func (fi *FlexInt) UnmarshalJSON(data []byte) error {
	// Try number first
	var n int
	if err := json.Unmarshal(data, &n); err == nil {
		*fi = FlexInt(n)
		return nil
	}
	// Try string
	var s string
	if err := json.Unmarshal(data, &s); err == nil {
		n, err := strconv.Atoi(s)
		if err != nil {
			return fmt.Errorf("FlexInt: cannot parse %q as int: %w", s, err)
		}
		*fi = FlexInt(n)
		return nil
	}
	return fmt.Errorf("FlexInt: cannot unmarshal %s", string(data))
}

// H5PManifest represents the h5p.json file inside an .h5p package
type H5PManifest struct {
	Title          string              `json:"title"`
	MachineName    string              `json:"machineName,omitempty"`
	MajorVersion   FlexInt             `json:"majorVersion"`
	MinorVersion   FlexInt             `json:"minorVersion"`
	PatchVersion   FlexInt             `json:"patchVersion"`
	Runnable       FlexInt             `json:"runnable,omitempty"`
	PreloadedDependencies []LibraryDep `json:"preloadedDependencies,omitempty"`
	DynamicDependencies   []LibraryDep `json:"dynamicDependencies,omitempty"`
	EditorDependencies    []LibraryDep `json:"editorDependencies,omitempty"`
}

// LibraryJSON represents a library.json file inside an .h5p package
type LibraryJSON struct {
	Title          string       `json:"title"`
	MachineName    string       `json:"machineName"`
	MajorVersion   FlexInt      `json:"majorVersion"`
	MinorVersion   FlexInt      `json:"minorVersion"`
	PatchVersion   FlexInt      `json:"patchVersion"`
	Runnable       FlexInt      `json:"runnable"`
	Description    string       `json:"description,omitempty"`
	PreloadedDependencies []LibraryDep `json:"preloadedDependencies,omitempty"`
	DynamicDependencies   []LibraryDep `json:"dynamicDependencies,omitempty"`
	EditorDependencies    []LibraryDep `json:"editorDependencies,omitempty"`
}

// LibraryDep represents a dependency reference in h5p.json or library.json
type LibraryDep struct {
	MachineName  string  `json:"machineName"`
	MajorVersion FlexInt `json:"majorVersion"`
	MinorVersion FlexInt `json:"minorVersion"`
}

// ExtractedLibrary represents a single library extracted from an .h5p package
type ExtractedLibrary struct {
	LibraryJSON LibraryJSON
	Files       map[string][]byte // relative path -> file content
	DirName     string            // directory name in the zip (e.g. "H5P.Accordion-1.0")
}

// ExtractedPackage represents the full result of extracting an .h5p file
type ExtractedPackage struct {
	Manifest  H5PManifest
	Libraries []ExtractedLibrary
}

// ExtractH5PPackage opens a .h5p zip and extracts the manifest + all libraries
func ExtractH5PPackage(data []byte) (*ExtractedPackage, error) {
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, fmt.Errorf("opening h5p zip: %w", err)
	}

	result := &ExtractedPackage{
		Libraries: make([]ExtractedLibrary, 0),
	}

	// Group files by top-level directory
	dirFiles := make(map[string]map[string][]byte)
	var manifestData []byte

	for _, f := range reader.File {
		if f.FileInfo().IsDir() {
			continue
		}

		rc, err := f.Open()
		if err != nil {
			return nil, fmt.Errorf("opening zip entry %s: %w", f.Name, err)
		}
		content, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			return nil, fmt.Errorf("reading zip entry %s: %w", f.Name, err)
		}

		// h5p.json is at the root of the zip
		if f.Name == "h5p.json" {
			manifestData = content
			continue
		}

		// Everything else is grouped by the first path component (library dir)
		parts := strings.SplitN(f.Name, "/", 2)
		if len(parts) < 2 {
			continue
		}
		dirName := parts[0]
		relPath := parts[1]

		if dirFiles[dirName] == nil {
			dirFiles[dirName] = make(map[string][]byte)
		}
		dirFiles[dirName][relPath] = content
	}

	// Parse manifest
	if manifestData != nil {
		if err := json.Unmarshal(manifestData, &result.Manifest); err != nil {
			return nil, fmt.Errorf("parsing h5p.json: %w", err)
		}
	}

	// Parse each library directory
	for dirName, files := range dirFiles {
		libJSONData, ok := files["library.json"]
		if !ok {
			// Not a library directory (could be content/)
			continue
		}

		var libJSON LibraryJSON
		if err := json.Unmarshal(libJSONData, &libJSON); err != nil {
			return nil, fmt.Errorf("parsing library.json in %s: %w", dirName, err)
		}

		result.Libraries = append(result.Libraries, ExtractedLibrary{
			LibraryJSON: libJSON,
			Files:       files,
			DirName:     dirName,
		})
	}

	return result, nil
}

// StorageKey returns the R2/S3 key for a library file
func LibraryStorageKey(machineName string, majorVersion, minorVersion, patchVersion int, filePath string) string {
	version := fmt.Sprintf("%d.%d.%d", majorVersion, minorVersion, patchVersion)
	return path.Join("h5p-libraries", "extracted", machineName+"-"+version, filePath)
}

// PackageStorageKey returns the R2/S3 key for the original .h5p package
func PackageStorageKey(machineName string, majorVersion, minorVersion, patchVersion int) string {
	version := fmt.Sprintf("%d.%d.%d", majorVersion, minorVersion, patchVersion)
	return path.Join("h5p-libraries", "packages", machineName+"-"+version+".h5p")
}
