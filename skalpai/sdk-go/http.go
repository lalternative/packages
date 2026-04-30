package skalpai

import (
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	metricapi "go.opentelemetry.io/otel/metric"
)

// HTTPMiddlewareConfig controls the HTTP server telemetry emitted by the SDK.
type HTTPMiddlewareConfig struct {
	ServiceName    string
	RouteExtractor func(*http.Request) string
}

type httpServerInstruments struct {
	requestCount    metricapi.Int64Counter
	requestDuration metricapi.Float64Histogram
	activeRequests  metricapi.Int64UpDownCounter
	responseSize    metricapi.Int64Histogram
}

var (
	httpServerMu                   sync.Mutex
	httpServerInstrumentsByService = map[string]httpServerInstruments{}
)

// NewHTTPMiddleware returns a standard net/http middleware that records
// normalized request count, duration, active request, and response size metrics.
func NewHTTPMiddleware(cfg HTTPMiddlewareConfig) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return WrapHTTPHandler(next, cfg)
	}
}

// WrapHTTPHandler wraps a net/http handler with Skalpai HTTP server metrics.
func WrapHTTPHandler(next http.Handler, cfg HTTPMiddlewareConfig) http.Handler {
	if next == nil {
		next = http.NotFoundHandler()
	}

	serviceName := resolveServiceName(cfg.ServiceName)
	instruments := getHTTPServerInstruments(serviceName)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		baseAttrs := requestAttributes(r, cfg.RouteExtractor, 0)
		instruments.activeRequests.Add(r.Context(), 1, metricapi.WithAttributes(baseAttrs...))
		defer instruments.activeRequests.Add(r.Context(), -1, metricapi.WithAttributes(baseAttrs...))

		startedAt := time.Now()
		recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(recorder, r)

		finalAttrs := requestAttributes(r, cfg.RouteExtractor, recorder.status)
		instruments.requestCount.Add(r.Context(), 1, metricapi.WithAttributes(finalAttrs...))
		instruments.requestDuration.Record(r.Context(), time.Since(startedAt).Seconds(), metricapi.WithAttributes(finalAttrs...))
		instruments.responseSize.Record(r.Context(), recorder.bytes, metricapi.WithAttributes(finalAttrs...))
	})
}

func getHTTPServerInstruments(serviceName string) httpServerInstruments {
	httpServerMu.Lock()
	defer httpServerMu.Unlock()

	if instruments, ok := httpServerInstrumentsByService[serviceName]; ok {
		return instruments
	}

	meter := otel.Meter(serviceName)
	requestCount, _ := meter.Int64Counter(
		"http.server.request.count",
		metricapi.WithDescription("Total number of HTTP server requests."),
		metricapi.WithUnit("{request}"),
	)
	requestDuration, _ := meter.Float64Histogram(
		"http.server.request.duration",
		metricapi.WithDescription("Total HTTP server request duration in seconds."),
		metricapi.WithUnit("s"),
	)
	activeRequests, _ := meter.Int64UpDownCounter(
		"http.server.active_requests",
		metricapi.WithDescription("Current number of in-flight HTTP server requests."),
		metricapi.WithUnit("{request}"),
	)
	responseSize, _ := meter.Int64Histogram(
		"http.server.response.size",
		metricapi.WithDescription("HTTP response size in bytes."),
		metricapi.WithUnit("By"),
	)

	instruments := httpServerInstruments{
		requestCount:    requestCount,
		requestDuration: requestDuration,
		activeRequests:  activeRequests,
		responseSize:    responseSize,
	}
	httpServerInstrumentsByService[serviceName] = instruments
	return instruments
}

func resolveServiceName(serviceName string) string {
	if trimmed := strings.TrimSpace(serviceName); trimmed != "" {
		return trimmed
	}
	if env := strings.TrimSpace(os.Getenv("SKALPAI_SERVICE")); env != "" {
		return env
	}
	if env := strings.TrimSpace(os.Getenv("OTEL_SERVICE_NAME")); env != "" {
		return env
	}
	return "unknown"
}

func requestAttributes(r *http.Request, routeExtractor func(*http.Request) string, statusCode int) []attribute.KeyValue {
	attrs := []attribute.KeyValue{
		attribute.String("http.request.method", r.Method),
		attribute.String("server.address", r.Host),
	}
	if routeExtractor != nil {
		if route := strings.TrimSpace(routeExtractor(r)); route != "" {
			attrs = append(attrs, attribute.String("http.route", route))
		}
	}
	if statusCode > 0 {
		attrs = append(attrs,
			attribute.Int("http.response.status_code", statusCode),
			attribute.String("http.response.status_class", statusClass(statusCode)),
		)
	}
	return attrs
}

func statusClass(statusCode int) string {
	if statusCode <= 0 {
		return "unknown"
	}
	return strconv.Itoa(statusCode/100) + "xx"
}

type statusRecorder struct {
	http.ResponseWriter
	status int
	bytes  int64
}

func (r *statusRecorder) WriteHeader(statusCode int) {
	r.status = statusCode
	r.ResponseWriter.WriteHeader(statusCode)
}

func (r *statusRecorder) Write(p []byte) (int, error) {
	if r.status == 0 {
		r.status = http.StatusOK
	}
	n, err := r.ResponseWriter.Write(p)
	r.bytes += int64(n)
	return n, err
}
