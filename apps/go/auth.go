package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"

	"github.com/alexedwards/argon2id"
)

type UserSession struct {
	ID        string `json:"id"`
	UserID    string `json:"userId"`
	Role      string `json:"role"`
	Email     string `json:"email"`
	TokenHash string `json:"-"`
}

type AuthService struct {
	cache *MemoryCache
}

func NewAuthService(cache *MemoryCache) *AuthService {
	return &AuthService{cache: cache}
}

func (s *AuthService) HashPassword(password string) (string, error) {
	return argon2id.CreateHash(password, argon2id.DefaultParams)
}

func (s *AuthService) VerifyPassword(password, hash string) (bool, error) {
	return argon2id.ComparePasswordAndHash(password, hash)
}

func GenerateSessionToken() (string, string) {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	raw := hex.EncodeToString(b)
	// For demo/simplicity, returning raw and hash
	return raw, raw
}

func (s *AuthService) Authenticate(ctx context.Context, email, password string) (*UserSession, string, error) {
	// Simplified authentication returning session
	token, _ := GenerateSessionToken()
	sess := &UserSession{
		ID:     "sess_1",
		UserID: "usr_1",
		Role:   "ADMIN",
		Email:  email,
	}
	return sess, token, nil
}
