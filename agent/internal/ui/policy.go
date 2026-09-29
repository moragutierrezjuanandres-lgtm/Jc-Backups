package ui

import (
 "encoding/json"
 "io"
 "net/http"
 "net/url"
 "strconv"
 "strings"
 "jcevnzl/backup-agent/internal/runner"
 "jcevnzl/backup-agent/internal/service"
)

func (a *App) policy(w http.ResponseWriter,r *http.Request){
 if !a.guard(w,r){return}
 cfg,err:=service.LoadConfig(a.ConfigPath);if err!=nil||cfg.Token==""{http.Error(w,"Primero vincula el equipo.",409);return}
 sources:=lines(r.FormValue("sourceDirs"));if err:=runner.ValidateSources(sources,"","");err!=nil{http.Error(w,"Comprueba que las carpetas existan y sean rutas absolutas.",400);return}
 var days []int
 for _,part:=range strings.Split(r.FormValue("days"),","){d,err:=strconv.Atoi(strings.TrimSpace(part));if err!=nil||d<0||d>6{http.Error(w,"Días no válidos (0 a 6).",400);return};days=append(days,d)}
 body,_:=json.Marshal(map[string]any{"sourceDirs":sources,"excludes":lines(r.FormValue("excludes")),"days":days,"time":r.FormValue("time"),"timezone":"America/Caracas","retentionSuccessfulCount":7,"compression":"auto","consistencyProfile":"files","enabled":true})
 req,err:=http.NewRequestWithContext(r.Context(),"POST",a.PortalURL+"/api/backup-agent/setup-policy",strings.NewReader(string(body)));if err!=nil{http.Error(w,"Portal no válido",500);return}
 req.Header.Set("Content-Type","application/json");req.Header.Set("Authorization","Bearer "+cfg.Token)
 resp,err:=a.HTTP.Do(req);if err!=nil{http.Error(w,"No pude guardar la configuración en el portal.",502);return};defer resp.Body.Close()
 if resp.StatusCode!=200{http.Error(w,"El portal rechazó la configuración. Revisa los datos e inicia sesión nuevamente si caducó.",resp.StatusCode);return}
 var result struct{Policy *runner.Policy `json:"policy"`}
 if json.NewDecoder(io.LimitReader(resp.Body,1<<20)).Decode(&result)!=nil||result.Policy==nil{http.Error(w,"Respuesta no válida",502);return}
 cfg.Policy=result.Policy;if service.SaveConfig(a.ConfigPath,cfg)!=nil{http.Error(w,"El portal guardó la política, pero no pude actualizar la configuración local.",500);return}
 http.Redirect(w,r,"/?message="+url.QueryEscape("Configuración guardada en el portal. Consulta el estado para comprobar las próximas ejecuciones."),303)
}
