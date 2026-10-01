package main

import (
	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/svc/mgr"
	"testing"
)

func TestInstallerConfigIsValidForExistingService(t *testing.T) {
	config := installerServiceConfig()
	if config.ServiceType != windows.SERVICE_WIN32_OWN_PROCESS {
		t.Fatalf("Windows ChangeServiceConfig rejects service type %d", config.ServiceType)
	}
	if config.StartType != mgr.StartAutomatic || !config.DelayedAutoStart {
		t.Fatal("service must start automatically after boot")
	}
}
