// Package handlers — autostart.go
// Windows Task Scheduler integration for companion daemon auto-start at logon.
//
// Endpoints:
//   GET    /autostart  → { "enabled": bool, "platform": string }
//   POST   /autostart  → 204 — register logon task
//   DELETE /autostart  → 204 — remove logon task
//
// Uses schtasks.exe (built into Windows); no admin required (/RL LIMITED).

package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

const taskName = "MindVault Companion Daemon"

// isTaskRegistered reports whether the Task Scheduler logon job exists.
func isTaskRegistered() bool {
	if runtime.GOOS != "windows" {
		return false
	}
	return exec.Command("schtasks", "/Query", "/TN", taskName).Run() == nil
}

// GetAutostart returns the current auto-start registration state.
// GET /autostart → { "enabled": bool, "platform": "windows"|"other" }
func (h *Handler) GetAutostart(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"enabled":  isTaskRegistered(),
		"platform": runtime.GOOS,
	})
}

// EnableAutostart creates a Task Scheduler job to start the daemon at logon.
// POST /autostart → 204 No Content
func (h *Handler) EnableAutostart(w http.ResponseWriter, r *http.Request) {
	if runtime.GOOS != "windows" {
		jsonErr(w, "auto-start is only supported on Windows", http.StatusNotImplemented)
		return
	}

	exe, err := os.Executable()
	if err != nil {
		jsonErr(w, "cannot resolve executable path: "+err.Error(), http.StatusInternalServerError)
		return
	}
	exe, _ = filepath.Abs(exe)

	// /F   — overwrite if task already exists
	// /RL LIMITED — run without elevation (no UAC prompt)
	out, err := exec.Command("schtasks", "/Create",
		"/F", "/TN", taskName,
		"/TR", `"`+exe+`"`,
		"/SC", "ONLOGON",
		"/RL", "LIMITED",
	).CombinedOutput()
	if err != nil {
		jsonErr(w, "schtasks: "+string(out), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// DisableAutostart removes the Task Scheduler logon job (idempotent).
// DELETE /autostart → 204 No Content
func (h *Handler) DisableAutostart(w http.ResponseWriter, r *http.Request) {
	if runtime.GOOS != "windows" {
		jsonErr(w, "auto-start is only supported on Windows", http.StatusNotImplemented)
		return
	}

	if !isTaskRegistered() {
		w.WriteHeader(http.StatusNoContent) // Already removed — idempotent
		return
	}

	out, err := exec.Command("schtasks", "/Delete", "/TN", taskName, "/F").CombinedOutput()
	if err != nil {
		jsonErr(w, "schtasks: "+string(out), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
