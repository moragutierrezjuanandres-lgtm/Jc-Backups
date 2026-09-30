package main

import (
	"context"
	_ "embed"
	"flag"
	"fmt"
	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/svc"
	"jcevnzl/backup-agent/internal/service"
	"jcevnzl/backup-agent/internal/ui"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"
)

// Restic is bundled so the operator only needs one executable.
//
//go:embed restic.exe
var resticBinary []byte

func main() {
	config := flag.String("config", filepath.Join(os.Getenv("ProgramData"), "JCEnterprise", "backup-agent", "config.dpapi"), "protected configuration path")
	portal := flag.String("portal", "https://www.jcevnzl.space", "portal URL")
	restic := flag.String("restic", "restic.exe", "Restic executable")
	install := flag.Bool("install", false, "install Isabella as a Windows service")
	journal := flag.String("journal", filepath.Join(os.Getenv("ProgramData"), "JCEnterprise", "backup-agent", "journal.jsonl"), "journal path")
	cache := flag.String("cache", filepath.Join(os.Getenv("ProgramData"), "JCEnterprise", "backup-agent", "cache"), "cache path")
	serviceMode := flag.Bool("service", false, "run without opening the interactive Isabella UI")
	flag.Parse()
	if *install {
		if !windows.GetCurrentProcessToken().IsElevated() {
			self, err := os.Executable()
			if err != nil {
				log.Fatal(err)
			}
			verb, _ := windows.UTF16PtrFromString("runas")
			file, _ := windows.UTF16PtrFromString(self)
			args, _ := windows.UTF16PtrFromString("-install")
			if err := windows.ShellExecute(0, verb, file, args, nil, 1); err != nil {
				log.Fatal(err)
			}
			return
		}
		installService()
		return
	}
	if !*serviceMode {
		resp, err := http.Get("http://127.0.0.1:18443/health")
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == 200 {
				_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", "http://127.0.0.1:18443").Start()
				return
			}
		}
		self, err := os.Executable()
		if err != nil {
			log.Fatal(err)
		}
		if err := exec.Command(self, "-install").Start(); err != nil {
			log.Fatal(err)
		}
		return
	}
	if *restic == "restic.exe" {
		*restic = filepath.Join(os.Getenv("ProgramData"), "JCEnterprise", "backup-agent", "restic.exe")
		_ = os.MkdirAll(filepath.Dir(*restic), 0700)
		if _, err := os.Stat(*restic); err != nil {
			_ = os.WriteFile(*restic, resticBinary, 0700)
		}
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	run := func(ctx context.Context, ready chan<- struct{}) error {
		app, err := ui.New(*config, *portal)
		if err != nil {
			return err
		}
		workerDone := make(chan error, 1)
		workerCtx, cancel := context.WithCancel(ctx)
		defer cancel()
		go func() {
			s := service.Service{ConfigPath: *config, JournalPath: *journal, ResticPath: *restic, CacheDir: *cache}
			workerDone <- s.Run(workerCtx)
		}()
		err = app.ServeReady(workerCtx, ready)
		cancel()
		<-workerDone
		return err
	}
	managed, err := svc.IsWindowsService()
	if err != nil {
		log.Fatal(err)
	}
	if managed {
		if err := svc.Run("JCEnterpriseIsabella", &serviceHandler{run: run}); err != nil {
			log.Fatal(err)
		}
		return
	}
	if err := run(ctx, make(chan struct{})); err != nil {
		log.Fatal(err)
	}
}

func installServiceLegacy() {
	root := filepath.Join(os.Getenv("ProgramFiles"), "JC Enterprise", "Backup Agent")
	data := filepath.Join(os.Getenv("ProgramData"), "JCEnterprise", "backup-agent")
	_ = os.MkdirAll(root, 0700)
	_ = os.MkdirAll(data, 0700)
	self, err := os.Executable()
	if err != nil {
		log.Fatal(err)
	}
	target := filepath.Join(root, "jc-backup.exe")
	src, err := os.ReadFile(self)
	if err != nil {
		log.Fatal(err)
	}
	if err = os.WriteFile(target, src, 0700); err != nil {
		log.Fatal(err)
	}
	resticTarget := filepath.Join(root, "restic.exe")
	if _, err = os.Stat(resticTarget); os.IsNotExist(err) {
		if err = os.WriteFile(resticTarget, resticBinary, 0700); err != nil {
			log.Fatal(err)
		}
	}
	bin := fmt.Sprintf("\"%s\" -service -portal \"https://www.jcevnzl.space\" -restic \"%s\"", target, resticTarget)
	_ = exec.Command("sc.exe", "stop", "JCEnterpriseIsabella").Run()
	_ = exec.Command("sc.exe", "delete", "JCEnterpriseIsabella").Run()
	if err = exec.Command("sc.exe", "create", "JCEnterpriseIsabella", "binPath=", bin, "start=", "delayed-auto", "DisplayName=", "JC Enterprise Isabella").Run(); err != nil {
		log.Fatal(err)
	}
	_ = exec.Command("sc.exe", "description", "JCEnterpriseIsabella", "Servicio de respaldos Isabella para JC Enterprise").Run()
	_ = exec.Command("sc.exe", "failure", "JCEnterpriseIsabella", "actions=", "restart/60000/restart/60000/0/0", "reset=", "86400").Run()
	if err = exec.Command("sc.exe", "start", "JCEnterpriseIsabella").Run(); err != nil {
		log.Fatal(err)
	}
	log.Printf("Isabella instalada. Interfaz: http://127.0.0.1:18443")
	for i := 0; i < 30; i++ {
		resp, err := http.Get("http://127.0.0.1:18443/health")
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == 200 {
				_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", "http://127.0.0.1:18443").Start()
				return
			}
		}
		time.Sleep(time.Second)
	}
	log.Fatal("El servicio no respondió; revisa el registro de instalación.")
}
