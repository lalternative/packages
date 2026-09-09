package sdk

import (
	"testing"
	"time"

	"github.com/lalternative/packages/lungor/sdk-go/internal/wire"
)

// The generated types carry pointers everywhere, because swag emits OpenAPI 2.0
// and 2.0 has no `required`. Those pointers must stop at this boundary: a
// *bool for Entitled would make "not entitled" and "no answer" the same value
// at the call site, where one must degrade and the other must not.
func TestEntitlementFrom_NilVerdictIsNotEntitled(t *testing.T) {
	got := entitlementFrom(wire.FinanceEntitlementResponse{})

	if got.Entitled {
		t.Fatal("a response with no verdict must grant nothing")
	}
	if got.Status != "" || got.Balances != nil {
		t.Fatalf("zero wire type = %+v, want the zero entitlement", got)
	}
}

func TestEntitlementFrom_CopiesEveryField(t *testing.T) {
	entitled, status, cancel := true, "active", true
	balances := map[string]int64{"credit": 2840}
	start, end, pending := "2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z", "solo"

	got := entitlementFrom(wire.FinanceEntitlementResponse{
		Entitled: &entitled, Status: &status, Balances: &balances,
		CurrentPeriodStart: &start, CurrentPeriodEnd: &end,
		CancelAtPeriodEnd: &cancel, PendingPlanCode: &pending, PendingPlanEffectiveAt: &end,
	})

	if !got.Entitled || got.Status != "active" {
		t.Fatalf("entitlement = %+v", got)
	}
	if v, ok := got.Balance("credit"); !ok || v != 2840 {
		t.Fatalf("credit = (%d, %v), want (2840, true)", v, ok)
	}
	if got.CurrentPeriodStart == nil || got.CurrentPeriodStart.Format(time.RFC3339) != start {
		t.Fatalf("period start = %v, want %s", got.CurrentPeriodStart, start)
	}
	if !got.CancelAtPeriodEnd || got.PendingPlanCode != "solo" {
		t.Fatalf("cancel/pending = %v/%q", got.CancelAtPeriodEnd, got.PendingPlanCode)
	}
	if got.PendingPlanEffectiveAt == nil || got.PendingPlanEffectiveAt.Format(time.RFC3339) != end {
		t.Fatalf("pending effective at = %v, want %s", got.PendingPlanEffectiveAt, end)
	}
}

// A garbled date is absent, never a zero time that would read as year one.
func TestEntitlementFrom_UnparseableDatesAreAbsent(t *testing.T) {
	bad := "yesterday"
	got := entitlementFrom(wire.FinanceEntitlementResponse{
		CurrentPeriodStart: &bad, CurrentPeriodEnd: &bad, PendingPlanEffectiveAt: &bad,
	})
	if got.CurrentPeriodStart != nil || got.CurrentPeriodEnd != nil || got.PendingPlanEffectiveAt != nil {
		t.Fatalf("dates = %+v, want all absent", got)
	}
}

func TestBillingURL_JoinsTheOriginWithThePath(t *testing.T) {
	for _, origin := range []string{"https://app.example", "https://app.example/"} {
		if got := BillingURL(origin); got != "https://app.example/billing" {
			t.Fatalf("BillingURL(%q) = %q", origin, got)
		}
	}
}

func TestCheckoutFrom_CopiesEveryField(t *testing.T) {
	session, sub, redirect := "s1", "sub1", "https://pay.example/s/1"

	got := checkoutFrom(wire.FinanceCheckoutResponse{
		SessionId: &session, SubscriptionId: &sub, RedirectUrl: &redirect,
	})

	if got.SessionID != "s1" || got.SubscriptionID != "sub1" || got.RedirectURL != redirect {
		t.Fatalf("checkout = %+v", got)
	}
}

func TestCheckoutFrom_EmptyWireIsTheZeroCheckout(t *testing.T) {
	if got := checkoutFrom(wire.FinanceCheckoutResponse{}); got != (Checkout{}) {
		t.Fatalf("checkout = %+v, want zero", got)
	}
}
