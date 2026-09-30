package main

import (
	"context"
	"golang.org/x/sys/windows/svc"
	"time"
)

type serviceHandler struct {
	run func(context.Context, chan<- struct{}) error
}

func (h *serviceHandler) Execute(_ []string, requests <-chan svc.ChangeRequest, statuses chan<- svc.Status) (bool, uint32) {
	statuses <- svc.Status{State: svc.StartPending, WaitHint: 10000}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	ready := make(chan struct{})
	done := make(chan error, 1)
	go func() { done <- h.run(ctx, ready) }()
	select {
	case err := <-done:
		if err != nil {
			return true, 1
		}
		return false, 0
	case <-ready:
	case <-time.After(30 * time.Second):
		cancel()
		return true, 2
	}
	current := svc.Status{State: svc.Running, Accepts: svc.AcceptStop | svc.AcceptShutdown}
	statuses <- current
	for {
		select {
		case err := <-done:
			if err != nil {
				return true, 1
			}
			return false, 0
		case request := <-requests:
			switch request.Cmd {
			case svc.Interrogate:
				statuses <- current
			case svc.Stop, svc.Shutdown:
				statuses <- svc.Status{State: svc.StopPending, WaitHint: 15000}
				cancel()
				select {
				case err := <-done:
					if err != nil {
						return true, 1
					}
					return false, 0
				case <-time.After(15 * time.Second):
					return true, 3
				}
			}
		}
	}
}
