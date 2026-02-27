package email

import (
	"app/pkg"
	"net/mail"
	"service-core/storage/query"
)

func validate(data query.InsertEmailParams) error {
	var errors pkg.ValidationErrors
	if data.EmailTo == "" {
		errors = append(errors, pkg.ValidationError{
			Field: "email_to",
			Tag:   "required",
			Message: "Email address is required",
		})
	}
	_, err := mail.ParseAddress(data.EmailTo)
	if data.EmailTo != "" && err != nil {
		errors = append(errors, pkg.ValidationError{
			Field: "email_to",
			Tag:   "email",
			Message: "Invalid email address",
		})
	}

	if data.EmailSubject == "" {
		errors = append(errors, pkg.ValidationError{
			Field: "email_subject",
			Tag:   "required",
			Message: "Email subject is required",
		})
	}
	if data.EmailSubject != "" && len(data.EmailSubject) > 100 {
		errors = append(errors, pkg.ValidationError{
			Field: "email_subject",
			Tag:   "max100",
			Message: "Email subject exceeds maximum length of 100 characters",
		})
	}

	if data.EmailBody == "" {
		errors = append(errors, pkg.ValidationError{
			Field: "email_body",
			Tag:   "required",
			Message: "Email body is required",
		})
	}

	if data.EmailBody != "" && len(data.EmailBody) > 50000 {
		errors = append(errors, pkg.ValidationError{
			Field: "email_body",
			Tag:   "max50000",
			Message: "Email body exceeds maximum length of 50000 characters",
		})
	}

	if len(errors) > 0 {
		return errors
	}
	return nil
}
