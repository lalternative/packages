package fetch

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

const cloudflareChallengeHTML = `<!DOCTYPE html>
<html lang="en-US"><head><title>Just a moment...</title></head>
<body class="no-js">
<div class="main-wrapper"><h1>www.example.com</h1>
<p>Verifying you are human. This may take a few seconds.</p>
<p>www.example.com needs to review the security of your connection before proceeding.</p>
</div>
<script>window._cf_chl_opt={cvId:'3',cZone:'www.example.com'};</script>
<script src="/cdn-cgi/challenge-platform/h/b/orchestrate/chl_page/v1"></script>
</body></html>`

const datadomeChallengeHTML = `<!DOCTYPE html>
<html><head><title>example.com</title></head>
<body><p>Please enable JS and disable any ad blocker</p>
<script>var dd={'rt':'c','cid':'abc','hsh':'def','t':'fe','s':1,'e':'x','host':'geo.captcha-delivery.com'}</script>
<script src="https://ct.captcha-delivery.com/c.js"></script>
</body></html>`

const genericVerifyHTML = `<!DOCTYPE html>
<html><head><title>Verify you are human | example.com</title></head>
<body><h1>Verify you are human</h1>
<p>Complete the check below to continue to the site you requested.</p>
<p>This process is automatic. Your browser will redirect to your requested content shortly.</p>
</body></html>`

const captchaArticleHTML = `<!doctype html>
<html><head><title>Why "verify you are human" walls break the open web</title></head>
<body>
<article>
<h1>Why "verify you are human" walls break the open web</h1>
<p>Every day more publishers put a "please wait, checking your browser" page
between readers and their articles. This piece looks at why that happens and
what it costs, with enough body text that readability keeps it as the main
content of the page rather than a boilerplate shell.</p>
<p>A second paragraph adds more substance so the extracted text comfortably
clears the minimum-length heuristic applied downstream.</p>
</article>
</body></html>`

func serveWithHeader(t *testing.T, html string, key, value string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set(key, value)
		w.Write([]byte(html))
	}))
}

func wantChallenge(t *testing.T, err error, provider string) {
	t.Helper()
	var ce *ChallengeError
	if !errors.As(err, &ce) {
		t.Fatalf("err = %v, want a *ChallengeError", err)
	}
	if ce.Provider != provider {
		t.Errorf("Provider = %q, want %q", ce.Provider, provider)
	}
}

func TestFetchStaticRefusesCloudflareChallenge(t *testing.T) {
	srv := serveHTML(t, cloudflareChallengeHTML)
	defer srv.Close()

	page, err := FetchStatic(context.Background(), srv.URL, 6000, nil)
	if page != nil {
		t.Errorf("page = %+v, want nil for a challenge page", page)
	}
	wantChallenge(t, err, "cloudflare")
}

func TestFetchStaticRefusesCfMitigatedHeaderWhateverTheBody(t *testing.T) {
	srv := serveWithHeader(t, articleHTML, "cf-mitigated", "challenge")
	defer srv.Close()

	_, err := FetchStatic(context.Background(), srv.URL, 6000, nil)
	wantChallenge(t, err, "cloudflare")
}

func TestFetchStaticRefusesDataDomeChallenge(t *testing.T) {
	srv := serveHTML(t, datadomeChallengeHTML)
	defer srv.Close()

	_, err := FetchStatic(context.Background(), srv.URL, 6000, nil)
	wantChallenge(t, err, "datadome")
}

func TestFetchStaticRefusesGenericVerifyInterstitial(t *testing.T) {
	srv := serveHTML(t, genericVerifyHTML)
	defer srv.Close()

	_, err := FetchStatic(context.Background(), srv.URL, 6000, nil)
	wantChallenge(t, err, "unknown")
}

func TestFetchStaticKeepsAnArticleAboutCaptchas(t *testing.T) {
	srv := serveHTML(t, captchaArticleHTML)
	defer srv.Close()

	page, err := FetchStatic(context.Background(), srv.URL, 6000, nil)
	if err != nil {
		t.Fatalf("FetchStatic: %v, want an article that merely mentions a challenge to pass", err)
	}
	if !strings.Contains(page.Text, "more publishers") {
		t.Errorf("Text = %q, want the article body", page.Text)
	}
}

func TestLooksLikeInterstitialNeedsBothTitleAndLittleText(t *testing.T) {
	short := "Complete the check below to continue to the site you requested."
	long := strings.Repeat("A long investigative piece about a banned book. ", 20)

	if !looksLikeInterstitial("Access Denied", short) {
		t.Error("generic title over a couple of sentences should be flagged")
	}
	if looksLikeInterstitial("Access Denied", long) {
		t.Error("generic title over an article's worth of text should pass")
	}
	if looksLikeInterstitial("Weekly recipe: soup", short) {
		t.Error("an ordinary title over little text is a thin page, not a challenge")
	}
}

func TestFetchStaticDoesNotCacheAChallenge(t *testing.T) {
	var hits int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits++
		if hits == 1 {
			w.Write([]byte(cloudflareChallengeHTML))
			return
		}
		w.Write([]byte(articleHTML))
	}))
	defer srv.Close()

	cache := NewMemoryCache(time.Minute)
	if _, err := FetchStatic(context.Background(), srv.URL, 6000, cache); err == nil {
		t.Fatal("1st fetch: want a challenge error")
	}
	page, err := FetchStatic(context.Background(), srv.URL, 6000, cache)
	if err != nil {
		t.Fatalf("2nd fetch: %v, want the article once the challenge clears", err)
	}
	if page.Text == "" {
		t.Error("2nd fetch: empty text, want the article")
	}
}

func TestFetchWithFallbackRendersThroughAChallenge(t *testing.T) {
	srv := serveHTML(t, cloudflareChallengeHTML)
	defer srv.Close()

	r := &fakeRenderer{html: articleHTML}
	page, err := FetchWithFallback(context.Background(), srv.URL, r, 6000, nil)
	if err != nil {
		t.Fatalf("FetchWithFallback: %v, want the rendered article", err)
	}
	if !r.called {
		t.Error("Renderer was not called on a static challenge")
	}
	if page.Text == "" {
		t.Error("Text is empty, want the rendered article")
	}
}

func TestFetchWithFallbackRefusesAChallengeTheRendererCannotClear(t *testing.T) {
	srv := serveHTML(t, cloudflareChallengeHTML)
	defer srv.Close()

	r := &fakeRenderer{html: cloudflareChallengeHTML}
	page, err := FetchWithFallback(context.Background(), srv.URL, r, 6000, nil)
	if page != nil {
		t.Errorf("page = %+v, want nil", page)
	}
	wantChallenge(t, err, "cloudflare")
}

func TestFetchWithFallbackWithoutRendererSurfacesTheChallenge(t *testing.T) {
	srv := serveHTML(t, cloudflareChallengeHTML)
	defer srv.Close()

	_, err := FetchWithFallback(context.Background(), srv.URL, nil, 6000, nil)
	wantChallenge(t, err, "cloudflare")
}

func TestFetchWithFallbackKeepsStaticShellWhenRenderIsAChallenge(t *testing.T) {
	srv := serveHTML(t, jsOnlyShellHTML)
	defer srv.Close()

	r := &fakeRenderer{html: cloudflareChallengeHTML}
	page, err := FetchWithFallback(context.Background(), srv.URL, r, 6000, nil)
	if err != nil {
		t.Fatalf("FetchWithFallback: %v, want the static result when only the render is challenged", err)
	}
	if page == nil {
		t.Fatal("page is nil, want the static shell")
	}
}
