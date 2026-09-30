package ui

import (
	"io"
	"jcevnzl/backup-agent/internal/service"
	"net/http"
)

func (a *App) telemetry(w http.ResponseWriter, r *http.Request) {
	if !a.authorized(r) {
		http.Error(w, "Inicia sesión con el portal", 401)
		return
	}
	cfg, err := service.LoadConfig(a.ConfigPath)
	if err != nil || cfg.Token == "" {
		http.Error(w, "Equipo no vinculado", 409)
		return
	}
	req, err := http.NewRequestWithContext(r.Context(), "GET", a.PortalURL+"/api/backup-agent/status", nil)
	if err != nil {
		http.Error(w, "Portal no válido", 500)
		return
	}
	req.Header.Set("Authorization", "Bearer "+cfg.Token)
	reply, err := a.HTTP.Do(req)
	if err != nil {
		http.Error(w, "Portal no disponible", 502)
		return
	}
	defer reply.Body.Close()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(reply.StatusCode)
	_, _ = io.Copy(w, io.LimitReader(reply.Body, 1<<20))
}
