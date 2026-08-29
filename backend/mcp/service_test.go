package mcp

import (
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"vectile/backend/services"
)

// TestStartServerServesSSE boots the MCPService on a loopback port and checks
// that the SSE endpoint answers with an event-stream. This validates the
// service lifecycle (Start/Status/Stop) and the transport wiring without
// needing a database or an embedding model.
func TestStartServerServesSSE(t *testing.T) {
	const port = 39123
	core := &services.Core{}
	svc := NewMCPService(core)

	url, err := svc.StartServer(port)
	if err != nil {
		t.Fatalf("StartServer: %v", err)
	}
	defer svc.StopServer()

	wantURL := fmt.Sprintf("http://127.0.0.1:%d/sse", port)
	if url != wantURL {
		t.Fatalf("url = %q, want %q", url, wantURL)
	}
	st := svc.GetMCPStatus()
	if !st.Running || st.Port != port || st.URL != wantURL {
		t.Fatalf("status = %+v", st)
	}

	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		t.Fatalf("GET %s: %v", url, err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	if ct := resp.Header.Get("Content-Type"); !strings.HasPrefix(ct, "text/event-stream") {
		t.Fatalf("content-type = %q, want text/event-stream", ct)
	}

	if err := svc.StopServer(); err != nil {
		t.Fatalf("StopServer: %v", err)
	}
	if st := svc.GetMCPStatus(); st.Running {
		t.Fatal("expected stopped after StopServer")
	}
}
