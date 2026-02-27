package note

import "app/pkg"

type schema struct {
	title    string
	category string
	content  string
}

func validate(s *schema) error {
	var errors pkg.ValidationErrors
	if s.title == "" {
		errors = append(errors, pkg.ValidationError{
			Field:   "title",
			Tag:     "required",
			Message: "Title is required",
		})
	}
	if s.title != "" && len(s.title) < 3 {
		errors = append(errors, pkg.ValidationError{
			Field:   "title",
			Tag:     "min3",
			Message: "Title must be at least 3 characters long",
		})
	}
	if s.title != "" && len(s.title) > 100 {
		errors = append(errors, pkg.ValidationError{
			Field:   "title",
			Tag:     "max100",
			Message: "Title must be at most 100 characters long",
		})
	}
	if s.category == "" {
		errors = append(errors, pkg.ValidationError{
			Field:   "category",
			Tag:     "required",
			Message: "Category is required",
		})
	}
	if s.content == "" {
		errors = append(errors, pkg.ValidationError{
			Field:   "content",
			Tag:     "required",
			Message: "Content is required",
		})
	}
	if s.content != "" && len(s.content) < 10 {
		errors = append(errors, pkg.ValidationError{
			Field:   "content",
			Tag:     "min10",
			Message: "Content must be at least 10 characters long",
		})
	}
	if s.content != "" && len(s.content) > 1000 {
		errors = append(errors, pkg.ValidationError{
			Field:   "content",
			Tag:     "max1000",
			Message: "Content must be at most 1000 characters long",
		})
	}

	if len(errors) == 0 {
		return nil
	}
	return errors
}
