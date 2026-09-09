package fetch

import (
	"net/http"
	"strings"
)

// ChallengeError reports a page that answered 200 OK with a bot-management
// interstitial (a Cloudflare "Just a moment…", a DataDome captcha, …) in
// place of its content. Readability happily extracts a title and a few
// sentences from such a page, so without this check it would be stored,
// indexed and summarised as if it were the article.
type ChallengeError struct {
	Provider string
}

func (e *ChallengeError) Error() string {
	return "fetch page: " + e.Provider + " challenge served instead of the page"
}

// interstitialMaxRunes bounds the extracted text on which an interstitial
// title alone is trusted. A challenge page carries a couple of sentences; an
// article whose title happens to read "Access Denied" carries paragraphs.
const interstitialMaxRunes = 400

var challengeMarkers = []struct {
	provider string
	marker   string
}{
	{"cloudflare", "cf-browser-verification"},
	{"cloudflare", "challenge-platform"},
	{"cloudflare", "_cf_chl_opt"},
	{"cloudflare", "cf_chl_"},
	{"cloudflare", "attention required! | cloudflare"},
	{"datadome", "captcha-delivery.com"},
	{"datadome", "datadome"},
	{"imperva", "_incapsula_resource"},
	{"imperva", "incapsula incident id"},
	{"perimeterx", "px-captcha"},
	{"perimeterx", "perimeterx"},
	{"aws-waf", "awswaf"},
	{"akamai", "errors.edgesuite.net"},
}

var challengeTitles = []string{
	"just a moment",
	"attention required",
	"access denied",
	"verify you are human",
	"verify you are a human",
	"are you a human",
	"bot verification",
	"security check",
	"checking your browser",
	"please wait",
	"one more step",
	"enable javascript and cookies",
}

// detectChallenge recognises a bot-management page from its headers and raw
// markup, before any extraction runs.
func detectChallenge(header http.Header, html string) (provider string, ok bool) {
	if strings.EqualFold(header.Get("cf-mitigated"), "challenge") {
		return "cloudflare", true
	}
	lower := strings.ToLower(html)
	for _, m := range challengeMarkers {
		if strings.Contains(lower, m.marker) {
			return m.provider, true
		}
	}
	return "", false
}

// looksLikeInterstitial catches a challenge page from a vendor with no known
// fingerprint, by its extracted title and how little text sits under it.
func looksLikeInterstitial(title, text string) bool {
	if len([]rune(text)) > interstitialMaxRunes {
		return false
	}
	lower := strings.ToLower(title)
	for _, t := range challengeTitles {
		if strings.Contains(lower, t) {
			return true
		}
	}
	return false
}
