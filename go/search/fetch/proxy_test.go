package fetch

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
)

// resetProxy keeps one test's configuration from leaking into the next: the
// proxy is deployment-wide state by design.
func resetProxy(t *testing.T) {
	t.Helper()
	t.Cleanup(func() { UseProxy("") })
}

func TestFetchGoesThroughTheProxy(t *testing.T) {
	resetProxy(t)

	var proxied atomic.Int32
	proxy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// An HTTP proxy is addressed with an absolute-URI request line, which
		// is what tells a proxied call from a direct one.
		if !r.URL.IsAbs() {
			t.Errorf("proxy got %q, want an absolute-URI request", r.URL)
		}
		proxied.Add(1)
		w.Write([]byte(`<html><body><article><p>Le corps de l'article, assez long pour que readability le garde comme contenu principal de la page.</p></article></body></html>`))
	}))
	defer proxy.Close()

	if err := UseProxy(proxy.URL); err != nil {
		t.Fatalf("UseProxy: %v", err)
	}

	page, err := FetchStatic(context.Background(), "http://example.com/a", 6000, nil)
	if err != nil {
		t.Fatalf("FetchStatic: %v", err)
	}
	if proxied.Load() != 1 {
		t.Fatalf("proxy hits = %d, want 1", proxied.Load())
	}
	if !strings.Contains(page.Text, "Le corps de l'article") {
		t.Errorf("got text %q, want the proxied content", page.Text)
	}
}

func TestNoProxyFetchesDirectly(t *testing.T) {
	resetProxy(t)

	var direct atomic.Int32
	origin := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.IsAbs() {
			t.Errorf("origin got an absolute-URI request %q, want a direct one", r.URL)
		}
		direct.Add(1)
		w.Write([]byte(`<html><body><article><p>Le corps de l'article, assez long pour que readability le garde comme contenu principal de la page.</p></article></body></html>`))
	}))
	defer origin.Close()

	if err := UseProxy(""); err != nil {
		t.Fatalf("UseProxy: %v", err)
	}

	if _, err := FetchStatic(context.Background(), origin.URL, 6000, nil); err != nil {
		t.Fatalf("FetchStatic: %v", err)
	}
	if direct.Load() != 1 {
		t.Errorf("direct hits = %d, want 1", direct.Load())
	}
}

// A typo in a deployment's configuration must be loud at boot rather than
// silently fetching direct and being refused by every publisher.
func TestUseProxyRefusesAnUnparseableURL(t *testing.T) {
	resetProxy(t)

	if err := UseProxy("://nope"); err == nil {
		t.Fatal("want an error for an unparseable proxy URL")
	}
	if got := ProxyState(); got != "unset" {
		t.Errorf("ProxyState = %q, want it left unset after a refused value", got)
	}
}

func TestProxyStateNeverLeaksCredentials(t *testing.T) {
	resetProxy(t)

	const secret = "sup3r-s3cret-passw0rd"
	if err := UseProxy("http://spuser:" + secret + "@gate.decodo.com:7000"); err != nil {
		t.Fatalf("UseProxy: %v", err)
	}

	got := ProxyState()
	if strings.Contains(got, secret) || strings.Contains(got, "spuser") {
		t.Fatalf("ProxyState leaked credentials: %q", got)
	}
	if want := "set(http://gate.decodo.com)"; got != want {
		t.Errorf("ProxyState = %q, want %q", got, want)
	}
}

func TestRedactProxySecrets(t *testing.T) {
	resetProxy(t)

	const secret = "sup3r-s3cret-passw0rd"
	if err := UseProxy("http://spuser:" + secret + "@gate.decodo.com:7000"); err != nil {
		t.Fatalf("UseProxy: %v", err)
	}

	msg := "unable to connect to proxy http://spuser:" + secret + "@gate.decodo.com:7000 (407)"
	got := RedactProxySecrets(msg)
	if strings.Contains(got, secret) {
		t.Fatalf("password survived redaction: %q", got)
	}
	if !strings.Contains(got, "gate.decodo.com") {
		t.Errorf("host should survive so the message stays diagnosable: %q", got)
	}
}

func TestRedactProxySecretsLeavesCleanTextAlone(t *testing.T) {
	resetProxy(t)

	const clean = "fetch page: status 403"
	if got := RedactProxySecrets(clean); got != clean {
		t.Errorf("got %q, want %q", got, clean)
	}
}
