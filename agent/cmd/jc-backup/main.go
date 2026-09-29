package main

import (
	"context"
	_ "embed"
	"flag"
	"jcevnzl/backup-agent/internal/service"
	"jcevnzl/backup-agent/internal/ui"
	"log"
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
	journal := flag.String("journal", filepath.Join(os.Getenv("ProgramData"), "JCEnterprise", "backup-agent", "journal.jsonl"), "journal path")
	cache := flag.String("cache", filepath.Join(os.Getenv("ProgramData"), "JCEnterprise", "backup-agent", "cache"), "cache path")
	serviceMode := flag.Bool("service", false, "run without opening the interactive Isabella UI")
	flag.Parse()
	if *restic == "restic.exe" {
		*restic = filepath.Join(os.Getenv("ProgramData"), "JCEnterprise", "backup-agent", "restic.exe")
		_ = os.MkdirAll(filepath.Dir(*restic), 0700)
		if _, err := os.Stat(*restic); err != nil {
			_ = os.WriteFile(*restic, resticBinary, 0700)
		}
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if !*serviceMode {
		app, err := ui.New(*config, *portal)
		if err != nil {
			log.Fatal(err)
		}
		go func() {
			if err := app.Serve(ctx); err != nil {
				log.Printf("interfaz Isabella: %v", err)
			}
		}()
	}
	go func() {
		s := service.Service{ConfigPath: *config, JournalPath: *journal, ResticPath: *restic, CacheDir: *cache}
		if err := s.Run(ctx); err != nil {
			log.Printf("servicio de respaldos: %v", err)
		}
	}()
	if !*serviceMode {
		go func() {
			time.Sleep(700 * time.Millisecond)
			_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", "http://127.0.0.1:18443").Start()
		}()
	}
	<-ctx.Done()
}
