// Package spore is a minimal Go client for the Spore transactional email API.
//
// Quickstart:
//
//	client := spore.NewClient("sk_live_xxx")
//	_, err := client.SendEmail(ctx, spore.SendEmailRequest{
//	    From:    "hello@example.com",
//	    To:      []string{"alice@example.com"},
//	    Subject: "Hello",
//	    HTML:    "<p>Hi!</p>",
//	})
//
// The server infers which identity to use from the domain of the From
// address. IdentityID is optional and only useful for legacy callers.
package spore

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

const DefaultBaseURL = "https://api.sporee.fr"

type Client struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
}

type Option func(*Client)

func WithBaseURL(u string) Option        { return func(c *Client) { c.baseURL = u } }
func WithHTTPClient(h *http.Client) Option { return func(c *Client) { c.httpClient = h } }

func NewClient(apiKey string, opts ...Option) *Client {
	c := &Client{
		apiKey:     apiKey,
		baseURL:    DefaultBaseURL,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
	for _, o := range opts {
		o(c)
	}
	return c
}

type SendEmailRequest struct {
	// IdentityID is optional and deprecated. When omitted, the server
	// resolves the identity from the domain of From. Provide it only when
	// you have a specific reason to pin the send to an exact identity
	// (legacy code paths, debugging).
	//
	// Deprecated: omit this field and let the server resolve the identity
	// from the From domain.
	IdentityID  string             `json:"identityId,omitempty"`
	From        string             `json:"from"`
	To          []string           `json:"to"`
	Subject     string             `json:"subject"`
	HTML        string             `json:"html,omitempty"`
	Text        string             `json:"text,omitempty"`
	Template    string             `json:"template,omitempty"`
	Locale      string             `json:"locale,omitempty"`
	Variables   map[string]string  `json:"variables,omitempty"`
	Unsubscribe *UnsubscribeOption `json:"unsubscribe,omitempty"`
}

type UnsubscribeOption struct {
	Enabled  bool   `json:"enabled"`
	Category string `json:"category,omitempty"`
}

type SendEmailResult struct {
	MessageID string `json:"messageId"`
	RFC5322ID string `json:"rfc5322Id"`
	Status    string `json:"status"`
}

type SendOption func(*sendOptions)

type sendOptions struct {
	idempotencyKey string
}

func WithIdempotencyKey(k string) SendOption {
	return func(o *sendOptions) { o.idempotencyKey = k }
}

// APIError represents a non-2xx response from the Spore API.
type APIError struct {
	StatusCode int
	Body       string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("spore: api error %d: %s", e.StatusCode, e.Body)
}

func (c *Client) SendEmail(ctx context.Context, req SendEmailRequest, opts ...SendOption) (*SendEmailResult, error) {
	o := &sendOptions{}
	for _, opt := range opts {
		opt(o)
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("spore: marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/emails", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("spore: build request: %w", err)
	}
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")
	if o.idempotencyKey != "" {
		httpReq.Header.Set("Idempotency-Key", o.idempotencyKey)
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("spore: http: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("spore: read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, &APIError{StatusCode: resp.StatusCode, Body: string(respBody)}
	}

	var result SendEmailResult
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("spore: decode response: %w", err)
	}
	return &result, nil
}

// IsAPIError reports whether err is an *APIError and, if so, returns it.
func IsAPIError(err error) (*APIError, bool) {
	var apiErr *APIError
	if errors.As(err, &apiErr) {
		return apiErr, true
	}
	return nil, false
}
