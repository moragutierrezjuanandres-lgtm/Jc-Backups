package service

import (
	"context"
	"jcevnzl/backup-agent/internal/control"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCancellationStopsBackupContextOnlyWhenServerConfirms(t *testing.T) {
	for _, confirmed := range []bool{false, true} {
		s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if confirmed {
				w.Write([]byte(`{"cancelRequested":true}`))
			} else {
				w.WriteHeader(503)
			}
		}))
		ctx, cancel := context.WithCancel(context.Background())
		stopped := checkCancellation(context.Background(), control.Client{BaseURL: s.URL}, "run", cancel)
		if stopped != confirmed || (ctx.Err() != nil) != confirmed {
			t.Errorf("confirmed=%v stopped=%v context=%v", confirmed, stopped, ctx.Err())
		}
		cancel()
		s.Close()
	}
}
