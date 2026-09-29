package ui

import (
 "encoding/json"
 "net/http"
 "net/http/httptest"
 "net/url"
 "strings"
 "testing"
)

func TestLoginValidatesPasswordAtPortalAndOnlyThenGrantsLocalSession(t *testing.T){
 calls:=0
 portal:=httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  calls++
  if r.URL.Path!="/api/auth/login"||r.Method!="POST"{t.Errorf("unexpected request %s %s",r.Method,r.URL.Path);http.Error(w,"wrong route",404);return}
  var b map[string]string;_ =json.NewDecoder(r.Body).Decode(&b)
  if b["username"]!="admin"||b["password"]!="correct"{http.Error(w,"invalid",401);return}
  http.SetCookie(w,&http.Cookie{Name:"jc_session",Value:"portal-test-session",Path:"/",Secure:true,HttpOnly:true});w.Write([]byte(`{"success":true}`))
 }));defer portal.Close()
 a,err:=New(t.TempDir()+"/config",portal.URL);if err!=nil{t.Fatal(err)};a.HTTP.Transport=portal.Client().Transport
 for _,password:=range []string{"wrong","correct"}{
  form:=url.Values{"csrf":{a.CSRF},"username":{"admin"},"password":{password}}
  r:=httptest.NewRequest("POST","http://127.0.0.1:18443/login",strings.NewReader(form.Encode()));r.Header.Set("Content-Type","application/x-www-form-urlencoded");r.Header.Set("Origin","http://127.0.0.1:18443")
  w:=httptest.NewRecorder();a.Handler().ServeHTTP(w,r)
  granted:=strings.Contains(w.Header().Get("Set-Cookie"),"jc_local_setup=")
  if granted!=(password=="correct"){t.Fatalf("password %q session granted=%v",password,granted)}
 }
 if calls!=2{t.Fatalf("calls=%d",calls)}
 u,_:=url.Parse(portal.URL);if len(a.HTTP.Jar.Cookies(u))!=1{t.Fatal("portal session not retained for code validation")}
}
