package ui

import (
 "encoding/json"
 "html/template"
 "io"
 "net/http"
 "jcevnzl/backup-agent/internal/service"
)

var statusTemplate=template.Must(template.New("status").Parse(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Isabella · Estado</title><style>body{background:#11141a;color:#eee;font:16px system-ui;max-width:850px;margin:40px auto;padding:20px}section{background:#1b2028;border-radius:16px;padding:20px;margin:20px 0}a{color:#edaa97}li{margin:12px 0}</style><h1>Isabella · Estado del equipo</h1><a href="/">Volver al asistente</a><p>Información recibida del portal para este equipo. <a href="/status">Actualizar</a></p><section><h2>{{.Device.Label}}</h2><p>Estado: {{.Device.Status}} · Última conexión: {{.Device.LastSeenAt}}</p></section><section><h2>Ejecuciones recientes</h2><ul>{{range .Runs}}<li>{{.CreatedAt}} · {{.Status}} · Intentos: {{.Attempts}}</li>{{else}}<li>Aún no hay ejecuciones registradas.</li>{{end}}</ul></section><section><h2>Alertas</h2><ul>{{range .Alerts}}<li>{{.Message}}</li>{{else}}<li>El portal no registra alertas activas.</li>{{end}}</ul></section><section><h2>Copias verificadas</h2><ul>{{range .Snapshots}}<li>{{.VerifiedAt}} · {{.ID}}</li>{{else}}<li>Aún no hay copias verificadas.</li>{{end}}</ul></section></html>`))

func (a *App) status(w http.ResponseWriter,r *http.Request){
 if !a.authorized(r){http.Redirect(w,r,"/",303);return}
 cfg,err:=service.LoadConfig(a.ConfigPath);if err!=nil||cfg.Token==""{http.Error(w,"Primero vincula este equipo.",409);return}
 req,err:=http.NewRequestWithContext(r.Context(),"GET",a.PortalURL+"/api/backup-agent/status",nil);if err!=nil{http.Error(w,"Portal no válido",500);return};req.Header.Set("Authorization","Bearer "+cfg.Token)
 resp,err:=a.HTTP.Do(req);if err!=nil{http.Error(w,"No pude consultar el portal. Comprueba Internet.",502);return};defer resp.Body.Close()
 if resp.StatusCode!=200{http.Error(w,"El portal no permite consultar este equipo. Puede estar revocado o pendiente de configuración.",resp.StatusCode);return}
 var data struct {
  Device struct{Label string `json:"label"`; Status string `json:"status"`; LastSeenAt string `json:"lastSeenAt"`} `json:"device"`
  Runs []struct{Status string `json:"status"`; CreatedAt string `json:"created_at"`; Attempts int `json:"attempts_started"`} `json:"runs"`
  Alerts []struct{Message string `json:"message"`} `json:"alerts"`
  Snapshots []struct{ID string `json:"snapshot_id"`; VerifiedAt string `json:"verified_at"`} `json:"snapshots"`
 }
 if json.NewDecoder(io.LimitReader(resp.Body,1<<20)).Decode(&data)!=nil{http.Error(w,"Respuesta del portal no válida",502);return}
 _=statusTemplate.Execute(w,data)
}
