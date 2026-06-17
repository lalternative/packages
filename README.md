# packages

Standalone SDKs and shared packages for the Skalpai platform.

## skalpai/

| Package | Description |
| --- | --- |
| `sdk-go` | Go SDK — `go get github.com/lalternative/packages/skalpai/sdk-go` |
| `sdk-browser` | Browser SDK (`@digstack/skalpai-sdk-browser`) |
| `sdk-node` | Node SDK (`@digstack/skalpai-sdk-node`) |
| `sdk-feedback-widget` | Vanilla feedback widget (`@digstack/skalpai-feedback-widget`) |
| `sdk-react` | React wrapper for the feedback widget (`@digstack/skalpai-sdk-react`) |
| `waitlist` | Waitlist widget (`@digstack/skalpai-waitlist`) |

JS packages form a single pnpm workspace (`pnpm-workspace.yaml`). `sdk-react`
depends on `sdk-feedback-widget` via `workspace:*`.
