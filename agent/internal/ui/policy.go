package ui

import (
	"encoding/json"
	"io"
	"jcevnzl/backup-agent/internal/runner"
	"jcevnzl/backup-agent/internal/service"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

func (a *App) policy(w http.ResponseWriter, r *http.Request) {
	if !a.guard(w, r) {
		return
	}
	cfg, err := service.LoadConfig(a.ConfigPath)
	if err != nil || cfg.Token == "" {
		http.Error(w, "Primero vincula el equipo.", 409)
		return
	}
	sources := lines(r.FormValue("sourceDirs"))
	if err := runner.ValidateSources(sources, "", ""); err != nil {
		http.Error(w, "Comprueba que las carpetas existan y sean rutas absolutas.", 400)
		return
	}
	var days []int
	for _, part := range strings.Split(r.FormValue("days"), ",") {
		d, err := strconv.Atoi(strings.TrimSpace(part))
		if err != nil || d < 0 || d > 6 {
			http.Error(w, "Días no válidos (0 a 6).", 400)
			return
		}
		days = append(days, d)
	}
	body, _ := json.Marshal(map[string]any{"sourceDirs": sources, "excludes": lines(r.FormValue("excludes")), "days": days, "time": r.FormValue("time"), "timezone": "America/Caracas", "retentionSuccessfulCount": 7, "compression": "auto", "consistencyProfile": "files", "enabled": true})
	req, err := http.NewRequestWithContext(r.Context(), "POST", a.PortalURL+"/api/backup-agent/setup-policy", strings.NewReader(string(body)))
	if err != nil {
		http.Error(w, "Portal no válido", 500)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.Token)
	resp, err := a.HTTP.Do(req)
	if err != nil {
		http.Error(w, "No pude guardar la configuración en el portal.", 502)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		a.rejectPolicy(w, r, resp)
		return
	}
	var result struct {
		Policy *runner.Policy `json:"policy"`
	}
	if json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&result) != nil || result.Policy == nil {
		http.Error(w, "Respuesta no válida", 502)
		return
	}
	cfg.Policy = result.Policy
	if service.SaveConfig(a.ConfigPath, cfg) != nil {
		http.Error(w, "El portal guardó la política, pero no pude actualizar la configuración local.", 500)
		return
	}
	http.Redirect(w, r, "/?message="+url.QueryEscape("Configuración guardada en el portal. Consulta el estado para comprobar las próximas ejecuciones."), 303)
}

func (a *App) rejectPolicy(w http.ResponseWriter, r *http.Request, resp *http.Response) {
	message := "El servidor no pudo guardar la configuración. Inténtalo nuevamente o consulta el estado del equipo en el portal."
	if resp.StatusCode == http.StatusUnauthorized {
		message = "Inicia sesión dentro de Isabella con tu usuario y contraseña del portal y vuelve a guardar la configuración. La vinculación del equipo se conserva."
		http.SetCookie(w, &http.Cookie{Name: "jc_local_setup", Value: "", Path: "/", HttpOnly: true, SameSite: http.SameSiteStrictMode, MaxAge: -1})
	} else if resp.StatusCode >= 400 && resp.StatusCode < 500 {
		var result struct {
			Error string `json:"error"`
		}
		if json.NewDecoder(io.LimitReader(resp.Body, 8192)).Decode(&result) == nil && result.Error != "" && len(result.Error) <= 1000 {
			message = "No pude guardar la configuración: " + result.Error
		} else {
			message = "No pude guardar la configuración. Comprueba los permisos, las carpetas y el horario en el portal."
		}
	}
	http.Redirect(w, r, "/?message="+url.QueryEscape(message), http.StatusSeeOther)
}
