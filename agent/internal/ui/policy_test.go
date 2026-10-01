package ui

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestRejectedPolicyReturnsToAssistantWithActionableReason(t *testing.T) {
	for _, tc := range []struct {
		status         int
		body, expected string
	}{
		{401, `{"error":"Sesión no válida."}`, "Inicia sesión dentro de Isabella"},
		{400, `{"error":"Hora no válida."}`, "Hora no válida."},
		{403, `{"error":"No tienes acceso a este equipo."}`, "No tienes acceso a este equipo."},
		{500, `{"error":"private server details"}`, "El servidor no pudo guardar"},
	} {
		a := &App{}
		w := httptest.NewRecorder()
		r := httptest.NewRequest("POST", "http://127.0.0.1:18443/policy", nil)
		a.rejectPolicy(w, r, &http.Response{StatusCode: tc.status, Body: ioCloser{strings.NewReader(tc.body)}})
		if w.Code != 303 {
			t.Fatalf("status=%d", w.Code)
		}
		location, _ := url.Parse(w.Header().Get("Location"))
		if !strings.Contains(location.Query().Get("message"), tc.expected) {
			t.Fatalf("message=%s", location.Query().Get("message"))
		}
		if tc.status == 401 && !strings.Contains(w.Header().Get("Set-Cookie"), "Max-Age=0") {
			t.Fatal("expired local session was not cleared")
		}
	}
}

type ioCloser struct{ *strings.Reader }

func (ioCloser) Close() error { return nil }
