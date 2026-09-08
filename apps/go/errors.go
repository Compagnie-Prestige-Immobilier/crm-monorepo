package main

type AppError struct {
	Status    int         `json:"-"`
	Code      string      `json:"code"`
	Message   string      `json:"message"`
	RequestId string      `json:"requestId,omitempty"`
	Errors    []FieldError `json:"errors,omitempty"`
}

type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

func (e *AppError) Error() string {
	return e.Message
}
