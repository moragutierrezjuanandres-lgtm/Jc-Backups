package main

import (
	"fmt"
	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/mgr"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
	"unsafe"
)

func installationError(err error) {
	log.Printf("Instalación: %v", err)
	text, _ := windows.UTF16PtrFromString("No se pudo instalar Isabella: " + err.Error() + "\nConsulta install.log en ProgramData\\JCEnterprise\\backup-agent.")
	title, _ := windows.UTF16PtrFromString("Isabella · Instalación")
	_, _, _ = windows.NewLazySystemDLL("user32.dll").NewProc("MessageBoxW").Call(0, uintptr(unsafe.Pointer(text)), uintptr(unsafe.Pointer(title)), 0x10)
}
func installService() {
	data := filepath.Join(os.Getenv("ProgramData"), "JCEnterprise", "backup-agent")
	if err := os.MkdirAll(data, 0700); err != nil {
		installationError(err)
		return
	}
	file, err := os.OpenFile(filepath.Join(data, "install.log"), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		installationError(err)
		return
	}
	defer file.Close()
	log.SetOutput(file)
	if err := performInstall(); err != nil {
		installationError(err)
		return
	}
	_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", "http://127.0.0.1:18443").Start()
}
func installerServiceConfig() mgr.Config {
	// CreateService supplies this default; UpdateConfig does not, and rejects zero.
	return mgr.Config{ServiceType: windows.SERVICE_WIN32_OWN_PROCESS, ErrorControl: mgr.ErrorNormal, DisplayName: "JC Enterprise Isabella", Description: "Respaldos comprimidos y programados Isabella", StartType: mgr.StartAutomatic, DelayedAutoStart: true}
}
func performInstall() error {
	root := filepath.Join(os.Getenv("ProgramFiles"), "JC Enterprise", "Backup Agent")
	if err := os.MkdirAll(root, 0700); err != nil {
		return err
	}
	manager, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer manager.Disconnect()
	installed, openErr := manager.OpenService("JCEnterpriseIsabella")
	if openErr != nil && openErr != windows.ERROR_SERVICE_DOES_NOT_EXIST {
		return openErr
	}
	if installed != nil {
		defer installed.Close()
		status, err := installed.Query()
		if err != nil {
			return err
		}
		if status.State != svc.Stopped {
			if _, err = installed.Control(svc.Stop); err != nil && err != windows.ERROR_SERVICE_NOT_ACTIVE {
				return err
			}
			deadline := time.Now().Add(30 * time.Second)
			for status.State != svc.Stopped {
				if time.Now().After(deadline) {
					return fmt.Errorf("el servicio anterior no se detuvo")
				}
				time.Sleep(300 * time.Millisecond)
				status, err = installed.Query()
				if err != nil {
					return err
				}
			}
		}
	}
	self, err := os.Executable()
	if err != nil {
		return err
	}
	target := filepath.Join(root, "jc-backup.exe")
	if !strings.EqualFold(self, target) {
		data, err := os.ReadFile(self)
		if err != nil {
			return err
		}
		if err = os.WriteFile(target, data, 0700); err != nil {
			return err
		}
	}
	restic := filepath.Join(root, "restic.exe")
	if err = os.WriteFile(restic, resticBinary, 0700); err != nil {
		return err
	}
	config := installerServiceConfig()
	if installed == nil {
		installed, err = manager.CreateService("JCEnterpriseIsabella", target, config, "-service", "-restic", restic)
		if err != nil {
			return err
		}
		defer installed.Close()
	} else {
		config.BinaryPathName = fmt.Sprintf("%q -service -restic %q", target, restic)
		if err = installed.UpdateConfig(config); err != nil {
			return fmt.Errorf("actualizar configuración del servicio: %w", err)
		}
	}
	if err = installed.SetRecoveryActions([]mgr.RecoveryAction{{Type: mgr.ServiceRestart, Delay: time.Minute}, {Type: mgr.ServiceRestart, Delay: time.Minute}}, 86400); err != nil {
		return fmt.Errorf("configurar reinicio automático: %w", err)
	}
	if err = installed.Start(); err != nil {
		return fmt.Errorf("iniciar servicio: %w", err)
	}
	client := http.Client{Timeout: time.Second}
	for i := 0; i < 30; i++ {
		resp, err := client.Get("http://127.0.0.1:18443/health")
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == 200 {
				log.Print("Servicio instalado y disponible")
				return nil
			}
		}
		time.Sleep(time.Second)
	}
	return fmt.Errorf("el servicio no respondió en 30 segundos")
}
