package file

import (
	"app/pkg"
	"service-core/storage/query"
)

func validate(params query.InsertFileParams, data []byte) error {
	if data == nil {
		return pkg.InternalError{
			Message: "File data is required",
			Err:     nil,
		}
	}

	// Min size
	if len(data) < 1 {
		return pkg.InternalError{
			Message: "File size is too small. Min size is 1 byte",
			Err:     nil,
		}
	}

	// Max size 10 MB
	if len(data) > 10*1024*1024 {
		return pkg.InternalError{
			Message: "File size is too large. Max size is 10 MB",
			Err:     nil,
		}
	}

	// File name
	if params.FileName == "" {
		return pkg.InternalError{
			Message: "File name is required",
			Err:     nil,
		}
	}

	// File type
	if params.ContentType == "" {
		return pkg.InternalError{
			Message: "File content type is required",
			Err:     nil,
		}
	}

	return nil
}
