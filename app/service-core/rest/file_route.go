package rest

import (
	"app/pkg"
	"app/pkg/auth"
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/google/uuid"
)

func (h *Handler) handleFilesCollection(w http.ResponseWriter, r *http.Request) {
	token := extractAccessToken(r)

	switch r.Method {
	case http.MethodGet:
		user, err := h.authService.Auth(token, auth.GetFiles)
		if err != nil {
			writeResponse(h.cfg, w, r, nil, err)
			return
		}

		files, err := h.fileService.GetFiles(r.Context(), user.ID)
		writeResponse(h.cfg, w, r, files, err)
		return

	case http.MethodPost:
		user, err := h.authService.Auth(token, auth.UploadFile)
		if err != nil {
			writeResponse(h.cfg, w, r, nil, err)
			return
		}

		err = r.ParseMultipartForm(h.cfg.MaxFileSize)
		if err != nil {
			writeResponse(h.cfg, w, r, nil, pkg.InternalError{Message: "Error parsing multipart form", Err: err})
			return
		}

		uploadedFiles := r.MultipartForm.File["files"]
		if len(uploadedFiles) == 0 {
			writeResponse(h.cfg, w, r, nil, pkg.InternalError{Message: "No files uploaded", Err: errors.New("no files uploaded")})
			return
		}

		err = h.fileService.UploadFiles(r.Context(), user.ID, uploadedFiles)
		writeResponse(h.cfg, w, r, "", err)
		return

	case http.MethodOptions:
		writeResponse(h.cfg, w, r, nil, nil)
		return

	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
}

func (h *Handler) handleFileResource(w http.ResponseWriter, r *http.Request) {
	token := extractAccessToken(r)

	fileIDStr := r.PathValue("id")
	id, err := uuid.Parse(fileIDStr)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.InternalError{Message: "Error parsing file ID", Err: err})
		return
	}

	switch r.Method {
	case http.MethodGet:
		_, errAuth := h.authService.Auth(token, auth.DownloadFile)
		if errAuth != nil {
			writeResponse(h.cfg, w, r, nil, errAuth)
			return
		}

		fileInfo, dataBytes, errDownload := h.fileService.DownloadFile(r.Context(), id)
		if errDownload != nil {
			writeResponse(h.cfg, w, r, nil, errDownload)
			return
		}

		fileSizeStr := strconv.FormatInt(fileInfo.FileSize, 10)
		w.Header().Set("Content-Disposition", "attachment; filename="+fileInfo.FileName)
		w.Header().Set("Content-Type", fileInfo.ContentType)
		w.Header().Set("Content-Length", fileSizeStr)
		w.WriteHeader(http.StatusOK)

		_, errWrite := w.Write(dataBytes)
		if errWrite != nil {
			slog.Error("Error writing file data", "error", errWrite)
		}
		return

	case http.MethodDelete:
		_, errAuth := h.authService.Auth(token, auth.RemoveFile)
		if errAuth != nil {
			writeResponse(h.cfg, w, r, nil, errAuth)
			return
		}

		errRemove := h.fileService.RemoveFile(r.Context(), id)
		writeResponse(h.cfg, w, r, nil, errRemove)
		return

	case http.MethodOptions:
		writeResponse(h.cfg, w, r, nil, nil)
		return

	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
}
