package ui

import (
 "context"
 "crypto/rand"
 "encoding/hex"
 "encoding/json"
 "errors"
 "fmt"
 "html/template"
 "io"
 "net"
 "net/http"
 "net/http/cookiejar"
 "net/url"
 "strings"
 "time"

 "jcevnzl/backup-agent/internal/control"
 "jcevnzl/backup-agent/internal/service"
)

type App struct { ConfigPath string; PortalURL string; HTTP *http.Client; CSRF string; Session string; Clients []struct{ID string `json:"id"`;Name string `json:"name"`} }
func New(configPath,portalURL string)(*App,error){if err:=control.ValidateBaseURL(portalURL);err!=nil{return nil,err};jar,_:=cookiejar.New(nil);client:=&http.Client{Timeout:20*time.Second,Jar:jar};return &App{ConfigPath:configPath,PortalURL:portalURL,HTTP:client,CSRF:random(),Session:random()},nil}
func random()string{b:=make([]byte,32);if _,err:=rand.Read(b);err!=nil{panic(err)};return hex.EncodeToString(b)}
func (a *App) Serve(ctx context.Context)error {
 listener,err:=net.Listen("tcp","127.0.0.1:18443");if err!=nil{return err}
 srv:=&http.Server{Handler:a.Handler(),ReadHeaderTimeout:5*time.Second}
 go func(){<-ctx.Done();closeCtx,cancel:=context.WithTimeout(context.Background(),5*time.Second);defer cancel();_ = srv.Shutdown(closeCtx)}()
 err=srv.Serve(listener);if errors.Is(err,http.ErrServerClosed){return nil};return err
}
func (a *App) Handler()http.Handler{
 mux:=http.NewServeMux();mux.HandleFunc("GET /",a.page);mux.HandleFunc("POST /login",a.login);mux.HandleFunc("POST /enroll",a.enroll);mux.HandleFunc("POST /policy",a.policy)
 return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){w.Header().Set("Cache-Control","no-store");w.Header().Set("X-Frame-Options","DENY");w.Header().Set("Content-Security-Policy","default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'");if r.Host!="127.0.0.1:18443"&&r.Host!="localhost:18443"{http.Error(w,"bad host",400);return};mux.ServeHTTP(w,r)})
}
const pageHTML=`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>JC Respaldos</title><style>body{font:16px system-ui;max-width:680px;margin:3rem auto;padding:1rem;color:#1b2936}label{display:block;margin:1rem 0}input,textarea,select{display:block;width:100%;padding:.65rem;box-sizing:border-box}button{padding:.7rem 1.2rem;background:#136aa2;color:white;border:0;border-radius:4px}section{padding:1rem;border:1px solid #ccd;margin:1rem 0}</style><h1>JC Respaldos</h1>{{if .Message}}<p role="status">{{.Message}}</p>{{end}}<section><h2>Iniciar sesión con el portal</h2><form method="post" action="/login"><input type="hidden" name="csrf" value="{{.CSRF}}"><label>Usuario<input name="username" required autocomplete="username"></label><label>Contraseña<input name="password" type="password" required autocomplete="current-password"></label><button>Ingresar</button></form></section>{{if .Logged}}<section><h2>Vincular este equipo</h2><p>Use el código temporal generado para el cliente en el portal.</p><form method="post" action="/enroll"><input type="hidden" name="csrf" value="{{.CSRF}}"><label>Nombre del equipo<input name="deviceLabel" required></label><label>Código<input name="code" required></label><button>Vincular</button></form></section>{{end}}{{if .Enrolled}}<section><h2>Configuración</h2><p>Cliente {{.ClientID}} · Equipo {{.DeviceLabel}}</p><form method="post" action="/policy"><input type="hidden" name="csrf" value="{{.CSRF}}"><label>Carpetas (una ruta absoluta por línea)<textarea name="sourceDirs" rows="5">{{.Sources}}</textarea></label><label>Exclusiones (una por línea)<textarea name="excludes" rows="3">{{.Excludes}}</textarea></label><label>Días (0=domingo, separados por coma)<input name="days" value="{{.Days}}"></label><label>Hora local HH:mm<input name="time" value="{{.Time}}"></label><label>Zona horaria IANA<input name="timezone" value="{{.Timezone}}"></label><label>Retener copias exitosas<input name="retention" type="number" min="1" max="365" value="{{.Retention}}"></label><button>Guardar política</button></form></section>{{end}}</html>`
var tmpl=template.Must(template.New("page").Parse(pageHTML))
func (a *App) page(w http.ResponseWriter,r *http.Request){c,_:=service.LoadConfig(a.ConfigPath);data:=struct{Message,CSRF,ClientID,DeviceLabel,Sources,Excludes,Days,Time,Timezone string;Retention int;Logged,Enrolled bool}{CSRF:a.CSRF,Logged:a.authorized(r),Enrolled:c.DeviceID!="",ClientID:c.ClientID,DeviceLabel:c.DeviceLabel,Retention:7,Timezone:"America/Caracas"};if c.Policy!=nil{data.Sources=strings.Join(c.Policy.SourceDirs,"\n");data.Excludes=strings.Join(c.Policy.Excludes,"\n");data.Time=c.Policy.Time;data.Timezone=c.Policy.Timezone;data.Retention=c.Policy.RetentionSuccessfulCount;for i,d:=range c.Policy.Days{if i>0{data.Days+=","};data.Days+=fmt.Sprint(d)}};data.Message=r.URL.Query().Get("message");_ = tmpl.Execute(w,data)}
func (a *App) authorized(r *http.Request)bool{c,err:=r.Cookie("jc_local_setup");return err==nil&&c.Value==a.Session}
func (a *App) guard(w http.ResponseWriter,r *http.Request)bool{if !a.authorized(r)||r.FormValue("csrf")!=a.CSRF||r.Header.Get("Origin")!="http://127.0.0.1:18443"{http.Error(w,"unauthorized",403);return false};return true}
func (a *App) login(w http.ResponseWriter,r *http.Request){if r.FormValue("csrf")!=a.CSRF||r.Header.Get("Origin")!="http://127.0.0.1:18443"{http.Error(w,"bad request",403);return};payload,_:=json.Marshal(map[string]string{"username":r.FormValue("username"),"password":r.FormValue("password")});req,_:=http.NewRequestWithContext(r.Context(),"POST",a.PortalURL+"/api/backup-agent/login",strings.NewReader(string(payload)));req.Header.Set("Content-Type","application/json");resp,err:=a.HTTP.Do(req);if err!=nil{http.Error(w,"portal unavailable",502);return};defer resp.Body.Close();if resp.StatusCode!=200{http.Error(w,"invalid credentials",401);return};var result control.LoginResult;if err=json.NewDecoder(io.LimitReader(resp.Body,1<<20)).Decode(&result);err!=nil{http.Error(w,"portal response invalid",502);return};a.Clients=result.Clients;http.SetCookie(w,&http.Cookie{Name:"jc_local_setup",Value:a.Session,Path:"/",HttpOnly:true,SameSite:http.SameSiteStrictMode,MaxAge:900});http.Redirect(w,r,"/?message=Sesión+iniciada",http.StatusSeeOther)}
func (a *App) enroll(w http.ResponseWriter,r *http.Request){if !a.guard(w,r){return};payload,_:=json.Marshal(map[string]string{"code":r.FormValue("code"),"deviceLabel":r.FormValue("deviceLabel")});req,_:=http.NewRequestWithContext(r.Context(),"POST",a.PortalURL+"/api/backup-agent/enroll",strings.NewReader(string(payload)));req.Header.Set("Content-Type","application/json");resp,err:=a.HTTP.Do(req);if err!=nil{http.Error(w,"portal unavailable",502);return};defer resp.Body.Close();if resp.StatusCode!=200&&resp.StatusCode!=201{http.Error(w,"enrollment rejected",resp.StatusCode);return};var enrollment control.Enrollment;if err=json.NewDecoder(io.LimitReader(resp.Body,1<<20)).Decode(&enrollment);err!=nil{http.Error(w,"invalid enrollment response",502);return};if enrollment.Token==""||enrollment.Repository.URL==""||enrollment.Repository.Key==""{http.Error(w,"incomplete enrollment",502);return};cfg:=service.Config{PortalURL:a.PortalURL,DeviceID:enrollment.DeviceID,ClientID:enrollment.ClientID,DeviceLabel:r.FormValue("deviceLabel"),Token:enrollment.Token,Repository:enrollment.Repository};if err=service.SaveConfig(a.ConfigPath,cfg);err!=nil{http.Error(w,"cannot save protected configuration",500);return};http.Redirect(w,r,"/?message=Equipo+vinculado",http.StatusSeeOther)}
func (a *App) policy(w http.ResponseWriter,r *http.Request){if !a.guard(w,r){return};http.Error(w,"policy configuration must be saved in portal until setup endpoint is available",501)}
func lines(v string)[]string{var out []string;for _,line:=range strings.Split(v,"\n"){line=strings.TrimSpace(line);if line!=""{out=append(out,line)}};return out}
func IsLoopbackAddress(raw string)bool{u,e:=url.Parse(raw);return e==nil&&(u.Hostname()=="127.0.0.1"||u.Hostname()=="localhost")}
