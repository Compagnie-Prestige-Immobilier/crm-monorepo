package main

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humago"
	"golang.org/x/time/rate"
)

//go:embed web/dist/*
var webDistFS embed.FS

type HealthResponse struct {
	Status    string    `json:"status" example:"ok"`
	Timestamp time.Time `json:"timestamp"`
}

type BankCaseCorrectionInput struct {
	ID string `path:"id"`
	Body struct {
		Reason  string `json:"reason" required:"true"`
		Details string `json:"details,omitempty"`
	}
}

type BankCaseCorrectionOutput struct {
	Body struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
}

type RenderTemplateInput struct {
	ID string `path:"id"`
	Body struct {
		Variables map[string]string `json:"variables"`
	}
}

type RenderTemplateOutput struct {
	Body struct {
		RenderedText string `json:"renderedText"`
	}
}

func main() {
	mux := http.NewServeMux()

	config := huma.DefaultConfig("CPI Monorepo API v2", "2.0.0")
	api := humago.New(mux, config)

	// Health endpoint
	huma.Register(api, huma.Operation{
		OperationID: "get-health",
		Method:      http.MethodGet,
		Path:        "/health/ready",
		Summary:     "Health check endpoint",
	}, func(ctx context.Context, input *struct{}) (*struct{ Body HealthResponse }, error) {
		resp := &struct{ Body HealthResponse }{}
		resp.Body.Status = "ok"
		resp.Body.Timestamp = time.Now()
		return resp, nil
	})

	// Bank case correction endpoint
	huma.Register(api, huma.Operation{
		OperationID: "post-bank-case-correction",
		Method:      http.MethodPost,
		Path:        "/api/v1/bank-cases/{id}/corrections",
		Summary:     "Submit bank case correction",
	}, func(ctx context.Context, input *BankCaseCorrectionInput) (*BankCaseCorrectionOutput, error) {
		resp := &BankCaseCorrectionOutput{}
		resp.Body.Success = true
		resp.Body.Message = fmt.Sprintf("Correction submitted for bank case %s: %s", input.ID, input.Body.Reason)
		return resp, nil
	})

	// Notification template render endpoint
	huma.Register(api, huma.Operation{
		OperationID: "post-notification-template-render",
		Method:      http.MethodPost,
		Path:        "/api/v1/notification-templates/{id}/render",
		Summary:     "Render notification template",
	}, func(ctx context.Context, input *RenderTemplateInput) (*RenderTemplateOutput, error) {
		resp := &RenderTemplateOutput{}
		resp.Body.RenderedText = fmt.Sprintf("Rendered template %s with %d variables", input.ID, len(input.Body.Variables))
		return resp, nil
	})

	// Embedded SPA Web Static Files
	subFS, err := fs.Sub(webDistFS, "web/dist")
	if err == nil {
		mux.Handle("/", http.FileServer(http.FS(subFS)))
	}

	limiter := NewRateLimiter(rate.Limit(5), 10)
	handler := SecurityAndCorsMiddleware(RateLimitMiddleware(limiter)(mux))

	port := os.Getenv("PORT")
	if port == "" {
		port = "4000"
	}

	fmt.Printf("Starting CPI v2 Go server on port %s...\n", port)
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      handler,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		fmt.Printf("Server failed: %v\n", err)
	}
}
