package control

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCancelControlUsesDeviceTokenAndEscapesOccurrence(t *testing.T) {
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer device-token" || r.URL.Query().Get("runId") != "scheduled:1:2026-10-01:10:00" {
			t.Error("missing scope or incorrect occurrence")
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"cancelRequested":true}`))
	}))
	defer s.Close()
	requested, err := (Client{BaseURL: s.URL, Token: "device-token"}).CancelRequested(context.Background(), "scheduled:1:2026-10-01:10:00")
	if err != nil || !requested {
		t.Fatalf("control did not request cancellation: %v %v", requested, err)
	}
}
