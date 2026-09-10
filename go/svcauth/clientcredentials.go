package svcauth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// ClientCredentials obtains tokens for a service from the identity provider's
// token endpoint and hands out the current one until it is about to expire.
type ClientCredentials struct {
	TokenURL     string
	ClientID     string
	ClientSecret string
	Audience     []string
	Scopes       []string
	// Client defaults to one with a ten-second timeout.
	Client *http.Client

	mu      sync.Mutex
	token   string
	expires time.Time
	now     func() time.Time
}

// HydraClientCredentials points at an Ory Hydra issuer by its public URL.
func HydraClientCredentials(issuerURL, clientID, clientSecret string, audience []string, scopes []string) *ClientCredentials {
	return &ClientCredentials{
		TokenURL:     strings.TrimRight(issuerURL, "/") + "/oauth2/token",
		ClientID:     clientID,
		ClientSecret: clientSecret,
		Audience:     audience,
		Scopes:       scopes,
	}
}

// Tokens are renewed this long before they expire, so a request in flight
// never carries one that lapses on the way.
const renewMargin = 30 * time.Second

var ErrTokenRefused = errors.New("svcauth: token endpoint refused the client")

// Token returns a bearer token valid for at least renewMargin.
func (c *ClientCredentials) Token(ctx context.Context) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.now == nil {
		c.now = time.Now
	}
	if c.token != "" && c.now().Add(renewMargin).Before(c.expires) {
		return c.token, nil
	}
	tok, ttl, err := c.fetch(ctx)
	if err != nil {
		return "", err
	}
	c.token = tok
	c.expires = c.now().Add(ttl)
	if ttl <= renewMargin {
		c.expires = c.now()
	}
	return tok, nil
}

type tokenResponse struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int64  `json:"expires_in"`
	Error       string `json:"error"`
	Description string `json:"error_description"`
}

func (c *ClientCredentials) fetch(ctx context.Context) (string, time.Duration, error) {
	if c.TokenURL == "" || c.ClientID == "" || c.ClientSecret == "" {
		return "", 0, errors.New("svcauth: client credentials need TokenURL, ClientID and ClientSecret")
	}
	form := url.Values{"grant_type": {"client_credentials"}}
	if len(c.Scopes) > 0 {
		form.Set("scope", strings.Join(c.Scopes, " "))
	}
	for _, a := range c.Audience {
		form.Add("audience", a)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.TokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", 0, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.SetBasicAuth(url.QueryEscape(c.ClientID), url.QueryEscape(c.ClientSecret))
	client := c.Client
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", 0, fmt.Errorf("svcauth: token endpoint: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return "", 0, fmt.Errorf("svcauth: token endpoint: %w", err)
	}
	var tr tokenResponse
	if err := json.Unmarshal(body, &tr); err != nil {
		return "", 0, fmt.Errorf("svcauth: token endpoint: status %d, unreadable body", resp.StatusCode)
	}
	if resp.StatusCode != http.StatusOK || tr.AccessToken == "" {
		return "", 0, fmt.Errorf("%w: %s %s", ErrTokenRefused, tr.Error, tr.Description)
	}
	return tr.AccessToken, time.Duration(tr.ExpiresIn) * time.Second, nil
}

// Authorize sets the bearer header on an outgoing request.
func (c *ClientCredentials) Authorize(req *http.Request) error {
	tok, err := c.Token(req.Context())
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+tok)
	return nil
}
