package svcauth_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync/atomic"
	"testing"

	"github.com/lalternative/packages/go/svcauth"
)

func tokenEndpoint(t *testing.T, expiresIn int64) (*httptest.Server, *atomic.Int32, *atomic.Value) {
	t.Helper()
	var hits atomic.Int32
	var last atomic.Value
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		if err := r.ParseForm(); err != nil {
			t.Error(err)
		}
		last.Store(r.Form)
		id, secret, ok := r.BasicAuth()
		if !ok || id != "lalter-core" || secret != "s3cret" {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "invalid_client"})
			return
		}
		json.NewEncoder(w).Encode(map[string]any{"access_token": "tok-" + r.Form.Get("audience"), "token_type": "bearer", "expires_in": expiresIn})
	}))
	t.Cleanup(srv.Close)
	return srv, &hits, &last
}

func TestTokenIsFetchedOnceAndReused(t *testing.T) {
	srv, hits, last := tokenEndpoint(t, 900)
	cc := svcauth.HydraClientCredentials(srv.URL+"/issuer", "lalter-core", "s3cret", []string{"tornade"}, []string{"tornade:speak", "tornade:search"})
	cc.TokenURL = srv.URL
	for i := 0; i < 3; i++ {
		tok, err := cc.Token(context.Background())
		if err != nil || tok != "tok-tornade" {
			t.Fatalf("Token: %q, %v", tok, err)
		}
	}
	if hits.Load() != 1 {
		t.Fatalf("token endpoint hit %d times, want 1", hits.Load())
	}
	form := last.Load().(url.Values)
	if form["grant_type"][0] != "client_credentials" || form["scope"][0] != "tornade:speak tornade:search" || form["audience"][0] != "tornade" {
		t.Fatalf("form = %v", form)
	}
}

func TestShortLivedTokenIsRenewed(t *testing.T) {
	srv, hits, _ := tokenEndpoint(t, 10)
	cc := &svcauth.ClientCredentials{TokenURL: srv.URL, ClientID: "lalter-core", ClientSecret: "s3cret"}
	cc.Token(context.Background())
	cc.Token(context.Background())
	if hits.Load() != 2 {
		t.Fatalf("a token expiring inside the renew margin was reused (%d hits)", hits.Load())
	}
}

func TestRefusedClientIsReported(t *testing.T) {
	srv, _, _ := tokenEndpoint(t, 900)
	cc := &svcauth.ClientCredentials{TokenURL: srv.URL, ClientID: "lalter-core", ClientSecret: "wrong"}
	if _, err := cc.Token(context.Background()); !errors.Is(err, svcauth.ErrTokenRefused) {
		t.Fatalf("err = %v", err)
	}
}

func TestAuthorizeSetsTheBearerHeader(t *testing.T) {
	srv, _, _ := tokenEndpoint(t, 900)
	cc := &svcauth.ClientCredentials{TokenURL: srv.URL, ClientID: "lalter-core", ClientSecret: "s3cret", Audience: []string{"tornade"}}
	req := httptest.NewRequest(http.MethodPost, "/speak", nil)
	if err := cc.Authorize(req); err != nil {
		t.Fatal(err)
	}
	if got := req.Header.Get("Authorization"); got != "Bearer tok-tornade" {
		t.Fatalf("Authorization = %q", got)
	}
}
