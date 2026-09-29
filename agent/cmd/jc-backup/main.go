package main

import (
 "context"
 "flag"
 "log"
 "os"
 "os/signal"
 "path/filepath"
 "syscall"
 "jcevnzl/backup-agent/internal/service"
 "jcevnzl/backup-agent/internal/ui"
)

func main(){
 config:=flag.String("config",filepath.Join(os.Getenv("ProgramData"),"JCEnterprise","backup-agent","config.dpapi"),"protected configuration path")
 portal:=flag.String("portal","https://www.jcevnzl.space","portal URL")
 restic:=flag.String("restic","restic.exe","Restic executable")
 journal:=flag.String("journal",filepath.Join(os.Getenv("ProgramData"),"JCEnterprise","backup-agent","journal.jsonl"),"journal path")
 cache:=flag.String("cache",filepath.Join(os.Getenv("ProgramData"),"JCEnterprise","backup-agent","cache"),"cache path")
 flag.Parse()
 ctx,stop:=signal.NotifyContext(context.Background(),os.Interrupt,syscall.SIGTERM);defer stop()
 app,err:=ui.New(*config,*portal);if err!=nil{log.Fatal(err)}
 go func(){if err:=app.Serve(ctx);err!=nil{log.Printf("interfaz Isabella: %v",err)}}()
 go func(){s:=service.Service{ConfigPath:*config,JournalPath:*journal,ResticPath:*restic,CacheDir:*cache};if err:=s.Run(ctx);err!=nil{log.Printf("servicio de respaldos: %v",err)}}()
 <-ctx.Done()
}
