// Package auth manages the shared-secret token used to authenticate
// REST API requests from the browser extension.
package auth

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

// tokenLength is the number of random bytes (produces 64-char hex string).
const tokenLength = 32

// TokenPath returns the platform-appropriate path to the token file.
//   Windows: %APPDATA%\MindVault\token
//   macOS:   ~/Library/Application Support/MindVault/token
//   Linux:   ~/.local/share/MindVault/token
func TokenPath() string {
	var base string
	switch runtime.GOOS {
	case "windows":
		base = os.Getenv("APPDATA")
	case "darwin":
		home, _ := os.UserHomeDir()
		base = filepath.Join(home, "Library", "Application Support")
	default:
		home, _ := os.UserHomeDir()
		base = filepath.Join(home, ".local", "share")
	}
	return filepath.Join(base, "MindVault", "token")
}

// LoadOrCreateToken reads the token from disk, or generates and saves a new one.
func LoadOrCreateToken() (string, error) {
	path := TokenPath()

	data, err := os.ReadFile(path)
	if err == nil {
		token := strings.TrimSpace(string(data))
		if len(token) == tokenLength*2 {
			return token, nil
		}
	}

	// Generate new token
	token, err := generateToken()
	if err != nil {
		return "", fmt.Errorf("generate token: %w", err)
	}

	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return "", fmt.Errorf("create token dir: %w", err)
	}
	if err := os.WriteFile(path, []byte(token+"\n"), 0600); err != nil {
		return "", fmt.Errorf("write token: %w", err)
	}
	return token, nil
}

// generateToken creates a cryptographically random hex token.
func generateToken() (string, error) {
	b := make([]byte, tokenLength)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
