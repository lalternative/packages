package skalpai

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRedactQuery(t *testing.T) {
	cases := []struct {
		name string
		raw  string
		cfg  RedactionConfig
		want string
	}{
		{
			name: "empty",
			raw:  "",
			want: "",
		},
		{
			name: "single sensitive",
			raw:  "token=abc",
			want: "token=REDACTED",
		},
		{
			name: "single non-sensitive",
			raw:  "page=2",
			want: "page=2",
		},
		{
			name: "mixed",
			raw:  "token=abc&page=2&api_key=xyz",
			want: "token=REDACTED&page=2&api_key=REDACTED",
		},
		{
			name: "case variant upper",
			raw:  "TOKEN=abc",
			want: "TOKEN=REDACTED",
		},
		{
			name: "case variant title",
			raw:  "Token=abc",
			want: "Token=REDACTED",
		},
		{
			name: "case variant mixed",
			raw:  "tOkEn=abc",
			want: "tOkEn=REDACTED",
		},
		{
			name: "repeated keys",
			raw:  "token=a&token=b",
			want: "token=REDACTED&token=REDACTED",
		},
		{
			// A param name without "=" carries no value, but its presence is
			// itself information we want to neutralize. We rewrite it to
			// "<name>=REDACTED" so the log can't be used to detect whether
			// the sensitive param was present-but-empty vs present-with-value.
			name: "key without equals",
			raw:  "token",
			want: "token=REDACTED",
		},
		{
			name: "substring not matched",
			raw:  "user_key_id=42",
			want: "user_key_id=42",
		},
		{
			// %41%50%49_KEY -> "API_KEY" -> lowercase "api_key" -> hit.
			name: "url-encoded sensitive key",
			raw:  "%41%50%49_KEY=abc",
			want: "%41%50%49_KEY=REDACTED",
		},
		{
			name: "disabled passthrough",
			raw:  "token=abc",
			cfg:  RedactionConfig{Disabled: true},
			want: "token=abc",
		},
		{
			name: "empty non-nil sensitive keys disables matching",
			raw:  "token=abc",
			cfg:  RedactionConfig{SensitiveKeys: []string{}},
			want: "token=abc",
		},
		{
			name: "custom keys and replacement",
			raw:  "magic_link=xxx&token=abc",
			cfg: RedactionConfig{
				SensitiveKeys: []string{"magic_link"},
				Replacement:   "***",
			},
			want: "magic_link=***&token=abc",
		},
		{
			name: "preserves order of params",
			raw:  "a=1&token=t&b=2&api_key=k&c=3",
			want: "a=1&token=REDACTED&b=2&api_key=REDACTED&c=3",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := RedactQuery(tc.raw, tc.cfg)
			if got != tc.want {
				t.Fatalf("RedactQuery(%q) = %q, want %q", tc.raw, got, tc.want)
			}
		})
	}
}

func TestWrapHTTPHandlerRedactsAccessLogQuery(t *testing.T) {
	prev := slog.Default()
	t.Cleanup(func() { slog.SetDefault(prev) })

	var buf bytes.Buffer
	slog.SetDefault(slog.New(slog.NewJSONHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})))

	h := WrapHTTPHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}), HTTPMiddlewareConfig{ServiceName: "test-service", EmitAccessLogs: true})

	req := httptest.NewRequest(http.MethodGet, "/reset?token=eyJhbGc&page=2", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	out := buf.String()
	if out == "" {
		t.Fatal("expected an access log entry, got empty output")
	}
	if strings.Contains(out, "eyJhbGc") {
		t.Fatalf("expected sensitive value to be redacted, got: %s", out)
	}

	var entry map[string]any
	if err := json.Unmarshal(bytes.TrimSpace(buf.Bytes()), &entry); err != nil {
		t.Fatalf("could not parse log entry: %v\nraw: %s", err, out)
	}
	q, _ := entry["url.query"].(string)
	if q != "token=REDACTED&page=2" {
		t.Fatalf("url.query = %q, want %q", q, "token=REDACTED&page=2")
	}
}
