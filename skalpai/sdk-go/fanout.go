package skalpai

import (
	"context"
	"errors"
	"log/slog"
)

// Fanout returns a slog.Handler that dispatches each record to every given
// handler. An error from one handler does not prevent the others from being
// invoked; all errors are joined and returned.
//
// Typical use: send to stdout for local debugging and to Skalpai over OTLP
// in the same call.
//
//	stdout := slog.NewJSONHandler(os.Stdout, nil)
//	otlp   := skalpai.NewSlogHandler("my-service")
//	logger := slog.New(skalpai.Fanout(stdout, otlp))
func Fanout(handlers ...slog.Handler) slog.Handler {
	cleaned := make([]slog.Handler, 0, len(handlers))
	for _, h := range handlers {
		if h != nil {
			cleaned = append(cleaned, h)
		}
	}
	return &fanoutHandler{handlers: cleaned}
}

type fanoutHandler struct {
	handlers []slog.Handler
}

func (f *fanoutHandler) Enabled(ctx context.Context, level slog.Level) bool {
	for _, h := range f.handlers {
		if h.Enabled(ctx, level) {
			return true
		}
	}
	return false
}

func (f *fanoutHandler) Handle(ctx context.Context, rec slog.Record) error {
	var errs []error
	for _, h := range f.handlers {
		if !h.Enabled(ctx, rec.Level) {
			continue
		}
		// slog.Record is value-semantic but holds attrs in a shared buffer;
		// clone before passing to each handler so they cannot interfere.
		if err := h.Handle(ctx, rec.Clone()); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

func (f *fanoutHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	next := make([]slog.Handler, len(f.handlers))
	for i, h := range f.handlers {
		next[i] = h.WithAttrs(attrs)
	}
	return &fanoutHandler{handlers: next}
}

func (f *fanoutHandler) WithGroup(name string) slog.Handler {
	next := make([]slog.Handler, len(f.handlers))
	for i, h := range f.handlers {
		next[i] = h.WithGroup(name)
	}
	return &fanoutHandler{handlers: next}
}
