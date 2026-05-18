package skalpai

import (
	"net/url"
	"strings"
)

// DefaultSensitiveQueryKeys is the list of query parameter names whose values
// are redacted in access logs by default. Match is case-insensitive and exact
// (not substring) — "key" matches "key" and "KEY" but not "user_key_id".
var DefaultSensitiveQueryKeys = []string{
	"token", "access_token", "refresh_token", "id_token", "jwt",
	"code", "auth_code",
	"api_key", "apikey", "key",
	"secret", "client_secret",
	"password", "passwd", "pwd",
	"authorization", "auth",
	"session", "sid", "session_id",
	"signature", "sig",
}

// RedactionConfig controls how query strings are sanitized before being
// emitted in access logs.
type RedactionConfig struct {
	// Disabled turns off redaction entirely. Default false (redaction ON).
	Disabled bool
	// SensitiveKeys overrides DefaultSensitiveQueryKeys when non-nil.
	// Pass an empty slice to disable key matching while keeping the struct.
	SensitiveKeys []string
	// Replacement is the placeholder written in place of sensitive values.
	// Default "REDACTED".
	Replacement string
}

// RedactQuery returns a sanitized version of rawQuery where the values of any
// parameter whose name matches (case-insensitive, exact) one of cfg.SensitiveKeys
// is replaced with cfg.Replacement. Order of params and unknown keys preserved.
func RedactQuery(rawQuery string, cfg RedactionConfig) string {
	if cfg.Disabled || rawQuery == "" {
		return rawQuery
	}
	keys := cfg.SensitiveKeys
	if keys == nil {
		keys = DefaultSensitiveQueryKeys
	}
	if len(keys) == 0 {
		return rawQuery
	}
	replacement := cfg.Replacement
	if replacement == "" {
		replacement = "REDACTED"
	}

	sensitive := make(map[string]struct{}, len(keys))
	for _, k := range keys {
		sensitive[strings.ToLower(k)] = struct{}{}
	}

	// Parse manually to preserve original ordering & repeated keys.
	parts := strings.Split(rawQuery, "&")
	for i, part := range parts {
		if part == "" {
			continue
		}
		eq := strings.IndexByte(part, '=')
		var name string
		if eq < 0 {
			name = part
		} else {
			name = part[:eq]
		}
		// url-decode the key for matching (handles %20, +, etc.)
		decoded, err := url.QueryUnescape(name)
		if err != nil {
			decoded = name
		}
		if _, hit := sensitive[strings.ToLower(decoded)]; hit {
			parts[i] = name + "=" + replacement
		}
	}
	return strings.Join(parts, "&")
}
