package spore

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSendEmail_Success(t *testing.T) {
	var capturedAuth, capturedIdempotency, capturedContentType string
	var capturedBody SendEmailRequest

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/emails" || r.Method != http.MethodPost {
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		capturedAuth = r.Header.Get("Authorization")
		capturedIdempotency = r.Header.Get("Idempotency-Key")
		capturedContentType = r.Header.Get("Content-Type")

		body, _ := io.ReadAll(r.Body)
		if err := json.Unmarshal(body, &capturedBody); err != nil {
			t.Fatalf("decode: %v", err)
		}

		w.WriteHeader(http.StatusAccepted)
		_ = json.NewEncoder(w).Encode(SendEmailResult{
			MessageID: "msg_123",
			RFC5322ID: "<abc@example.com>",
			Status:    "queued",
		})
	}))
	defer srv.Close()

	c := NewClient("sk_live_xyz", WithBaseURL(srv.URL))
	res, err := c.SendEmail(context.Background(), SendEmailRequest{
		IdentityID: "id_1",
		From:       "hello@example.com",
		To:         []string{"alice@example.com"},
		Subject:    "Hi",
		HTML:       "<p>Hi!</p>",
	}, WithIdempotencyKey("key-1"))
	if err != nil {
		t.Fatalf("SendEmail: %v", err)
	}

	if capturedAuth != "Bearer sk_live_xyz" {
		t.Errorf("auth: got %q", capturedAuth)
	}
	if capturedIdempotency != "key-1" {
		t.Errorf("idempotency-key: got %q", capturedIdempotency)
	}
	if !strings.HasPrefix(capturedContentType, "application/json") {
		t.Errorf("content-type: got %q", capturedContentType)
	}
	if capturedBody.IdentityID != "id_1" || capturedBody.From != "hello@example.com" {
		t.Errorf("body mismatch: %+v", capturedBody)
	}
	if res.MessageID != "msg_123" || res.Status != "queued" {
		t.Errorf("result mismatch: %+v", res)
	}
}

func TestSendEmail_APIError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnprocessableEntity)
		_, _ = w.Write([]byte(`{"message":"from not allowed"}`))
	}))
	defer srv.Close()

	c := NewClient("sk_live_xyz", WithBaseURL(srv.URL))
	_, err := c.SendEmail(context.Background(), SendEmailRequest{To: []string{"a@b"}})
	if err == nil {
		t.Fatal("expected error")
	}
	apiErr, ok := IsAPIError(err)
	if !ok {
		t.Fatalf("expected APIError, got %T", err)
	}
	if apiErr.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status: got %d", apiErr.StatusCode)
	}
}

func TestSendEmail_NoIdempotencyHeaderWhenUnset(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Idempotency-Key") != "" {
			t.Errorf("expected no Idempotency-Key, got %q", r.Header.Get("Idempotency-Key"))
		}
		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte(`{}`))
	}))
	defer srv.Close()

	c := NewClient("k", WithBaseURL(srv.URL))
	_, err := c.SendEmail(context.Background(), SendEmailRequest{To: []string{"a@b"}})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
