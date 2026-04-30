package skalpai

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestStatusClass(t *testing.T) {
	if got := statusClass(201); got != "2xx" {
		t.Fatalf("statusClass(201) = %q, want 2xx", got)
	}
	if got := statusClass(503); got != "5xx" {
		t.Fatalf("statusClass(503) = %q, want 5xx", got)
	}
}

func TestWrapHTTPHandlerPreservesStatusAndBody(t *testing.T) {
	h := WrapHTTPHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte("ok"))
	}), HTTPMiddlewareConfig{ServiceName: "test-service"})

	req := httptest.NewRequest(http.MethodPost, "/v1/items", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusCreated)
	}
	if rec.Body.String() != "ok" {
		t.Fatalf("body = %q, want ok", rec.Body.String())
	}
}
