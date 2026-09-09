package main

import (
	"net/http"
	"strings"
	"time"

	"golang.org/x/time/rate"
)

type MiddlewareConfig struct {
	Limiter *rate.Limiter
}

func SecurityAndCorsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

		// Check origin for non-safe HTTP methods
		if r.Method != http.MethodGet && r.Method != http.MethodHead && r.Method != http.MethodOptions {
			origin := r.Header.Get("Origin")
			if origin != "" && !strings.HasPrefix(origin, "http://localhost") && !strings.HasPrefix(origin, "https://") {
				http.Error(w, "Forbidden origin", http.StatusForbidden)
				return
			}
		}

		next.ServeHTTP(w, r)
	})
}

func NewRateLimiter(r rate.Limit, b int) *rate.Limiter {
	return rate.NewLimiter(r, b)
}

func RateLimitMiddleware(limiter *rate.Limiter) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !limiter.Allow() {
				http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func TimeoutMiddleware(d time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.TimeoutHandler(next, d, "Request Timeout")
	}
}
