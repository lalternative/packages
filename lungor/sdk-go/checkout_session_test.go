package sdk

import (
	"errors"
	"net/http"
	"testing"
)

func TestCheckoutSession_ReadsHowTheCheckoutEnded(t *testing.T) {
	srv, rec := server(t, 200, map[string]any{
		"session_id":     "sess-1",
		"status":         "failed",
		"paid":           false,
		"failure_reason": "insufficient_funds",
		"plan_id":        "plan-1",
		"expires_at":     "2026-09-09T12:00:00Z",
		"created_at":     "2026-09-09T10:00:00Z",
	})
	c := New(srv.URL, "k")

	got, err := c.CheckoutSession(ctx(), "sess-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rec.method != http.MethodGet || rec.path != "/api/v1/finance/checkout/sess-1" {
		t.Fatalf("%s %s", rec.method, rec.path)
	}
	if got.Status != CheckoutFailed || got.Paid || got.FailureReason != "insufficient_funds" {
		t.Fatalf("session = %+v", got)
	}
	if !got.Status.Final() {
		t.Fatal("a refusal is final")
	}
	if got.ExpiresAt.IsZero() || got.CreatedAt.IsZero() {
		t.Fatalf("dates not parsed: %+v", got)
	}
}

func TestCheckoutSession_PaidIsWhatOpensAccess(t *testing.T) {
	srv, _ := server(t, 200, map[string]any{
		"session_id": "sess-1", "status": "completed", "paid": true,
		"subscription_id": "sub-1", "subscription_status": "active",
	})
	c := New(srv.URL, "k")

	got, err := c.CheckoutSession(ctx(), "sess-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !got.Paid || got.SubscriptionID != "sub-1" || got.SubscriptionStatus != "active" {
		t.Fatalf("session = %+v", got)
	}
}

// The provider's notification can land after the payer does: a page that read
// "redirected" as a failure would refuse someone whose card was accepted.
func TestCheckoutStatus_InFlightIsNotFinal(t *testing.T) {
	for _, s := range []CheckoutStatus{CheckoutPending, CheckoutRedirected} {
		if s.Final() {
			t.Fatalf("%s must keep the page polling", s)
		}
	}
	for _, s := range []CheckoutStatus{CheckoutCompleted, CheckoutFailed, CheckoutCanceled, CheckoutExpired} {
		if !s.Final() {
			t.Fatalf("%s must stop the page polling", s)
		}
	}
}

// Another app's session and a missing one read alike, and neither is an outage.
func TestCheckoutSession_UnknownIsNotFound(t *testing.T) {
	srv, _ := server(t, 404, map[string]any{"message": "checkout session not found"})
	c := New(srv.URL, "k")

	_, err := c.CheckoutSession(ctx(), "sess-x")
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("err = %v, want ErrNotFound", err)
	}
}

func TestCheckoutSession_RefusesAnEmptyID(t *testing.T) {
	c := New("https://lungor", "k")
	if _, err := c.CheckoutSession(ctx(), ""); !errors.Is(err, ErrBadRequest) {
		t.Fatalf("err = %v, want ErrBadRequest", err)
	}
}
