package main

import (
 "context"
 "errors"
 "testing"
 "time"
 "golang.org/x/sys/windows/svc"
)

func TestSCMStartAndStopWaitsForWorker(t *testing.T) {
 requests:=make(chan svc.ChangeRequest,1); statuses:=make(chan svc.Status,8); ended:=make(chan struct{}); result:=make(chan uint32,1)
 h:=&serviceHandler{run:func(ctx context.Context, ready chan<- struct{})error {close(ready);<-ctx.Done();close(ended);return nil}}
 go func(){_,code:=h.Execute(nil,requests,statuses);result<-code}()
 if s:=<-statuses;s.State!=svc.StartPending {t.Fatalf("first status %v",s)}
 if s:=<-statuses;s.State!=svc.Running {t.Fatalf("ready status %v",s)}
 requests<-svc.ChangeRequest{Cmd:svc.Stop}
 select {case code:=<-result:if code!=0{t.Fatalf("stop exit=%d",code)};case <-time.After(time.Second):t.Fatal("SCM stop did not cancel worker")}
 select {case <-ended:default:t.Fatal("reported stop before worker stopped")}
}

func TestSCMStartupFailureDoesNotReportRunning(t *testing.T) {
 statuses:=make(chan svc.Status,8)
 h:=&serviceHandler{run:func(context.Context,chan<- struct{})error{return errors.New("listen failed")}}
 _,code:=h.Execute(nil,make(chan svc.ChangeRequest),statuses)
 if code==0 {t.Fatal("startup failure reported success")}
 close(statuses);for s:=range statuses {if s.State==svc.Running {t.Fatal("failure reported running")}}
}
