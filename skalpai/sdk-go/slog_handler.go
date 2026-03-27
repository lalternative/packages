package skalpai

import (
	"context"
	"log/slog"

	otellog "go.opentelemetry.io/otel/log"
	"go.opentelemetry.io/otel/log/global"
)

// EnableSlogBridge redirects slog.Default() (and stdlib log) to the OTEL
// LoggerProvider. Call this after Init(). Logs still appear on stdout.
func EnableSlogBridge(serviceName string) {
	fallback := slog.Default().Handler()
	slog.SetDefault(slog.New(&slogHandler{
		fallback: fallback,
		logger:   global.GetLoggerProvider().Logger(serviceName),
	}))
}

type slogHandler struct {
	fallback slog.Handler
	logger   otellog.Logger
	attrs    []slog.Attr
}

func (h *slogHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return h.fallback.Enabled(ctx, level)
}

func (h *slogHandler) Handle(ctx context.Context, rec slog.Record) error {
	_ = h.fallback.Handle(ctx, rec)

	var otelRec otellog.Record
	otelRec.SetTimestamp(rec.Time)
	otelRec.SetBody(otellog.StringValue(rec.Message))
	otelRec.SetSeverity(slogLevelToOTEL(rec.Level))
	otelRec.SetSeverityText(rec.Level.String())

	attrs := make([]otellog.KeyValue, 0, rec.NumAttrs()+len(h.attrs))
	rec.Attrs(func(a slog.Attr) bool {
		attrs = append(attrs, otellog.String(a.Key, a.Value.String()))
		return true
	})
	for _, a := range h.attrs {
		attrs = append(attrs, otellog.String(a.Key, a.Value.String()))
	}
	otelRec.AddAttributes(attrs...)

	h.logger.Emit(ctx, otelRec)
	return nil
}

func (h *slogHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &slogHandler{
		fallback: h.fallback.WithAttrs(attrs),
		logger:   h.logger,
		attrs:    append(h.attrs, attrs...),
	}
}

func (h *slogHandler) WithGroup(name string) slog.Handler {
	return &slogHandler{
		fallback: h.fallback.WithGroup(name),
		logger:   h.logger,
		attrs:    h.attrs,
	}
}

func slogLevelToOTEL(level slog.Level) otellog.Severity {
	switch {
	case level >= slog.LevelError:
		return otellog.SeverityError
	case level >= slog.LevelWarn:
		return otellog.SeverityWarn
	case level >= slog.LevelInfo:
		return otellog.SeverityInfo
	default:
		return otellog.SeverityDebug
	}
}
