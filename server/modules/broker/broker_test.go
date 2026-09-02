package broker

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

const settle = 2 * time.Second

func waitFor(t *testing.T, what string, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(settle)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatalf("timed out waiting for %s", what)
}

// The billing regression: a handler that outlives its client keeps the request
// in flight, and the platform bills it until the request timeout fires.
func TestHandlerReturnsWhenClientDisconnects(t *testing.T) {
	broker := NewBroker(map[string]bool{"http://allowed.test": true})

	ctx, cancel := context.WithCancel(context.Background())
	req := httptest.NewRequest(http.MethodGet, "/", nil).WithContext(ctx)
	req.Header.Set("Origin", "http://allowed.test")

	returned := make(chan struct{})
	go func() {
		defer close(returned)
		broker.ServeHTTP(httptest.NewRecorder(), req)
	}()

	waitFor(t, "the client to register", broker.IsListening)
	cancel()

	select {
	case <-returned:
	case <-time.After(settle):
		t.Fatal("handler did not return after the client disconnected")
	}

	waitFor(t, "the client to be deregistered", func() bool { return !broker.IsListening() })
}

// One client that stops reading must not wedge listen() for everyone else.
func TestStalledClientDoesNotBlockBroker(t *testing.T) {
	broker := NewBroker(nil)

	stalled := broker.AddClient()
	defer broker.RemoveClient(stalled)

	notified := make(chan struct{})
	go func() {
		defer close(notified)
		for i := 0; i < clientBuffer*10; i++ {
			broker.Notify([]byte(`{"track":"x"}`))
		}
	}()
	select {
	case <-notified:
	case <-time.After(settle):
		t.Fatal("Notify wedged behind a client that stopped reading")
	}

	admitted := make(chan chan []byte, 1)
	go func() { admitted <- broker.AddClient() }()
	select {
	case c := <-admitted:
		broker.RemoveClient(c)
	case <-time.After(settle):
		t.Fatal("a new client could not be admitted; listen() is wedged")
	}
}

// Removal closes the client's channel, which is what wakes a parked handler.
func TestRemoveClosesChannelAndTolerartesRepeats(t *testing.T) {
	broker := NewBroker(nil)

	c := broker.AddClient()
	broker.RemoveClient(c)

	select {
	case _, ok := <-c:
		if ok {
			t.Fatal("expected the client channel to be closed")
		}
	case <-time.After(settle):
		t.Fatal("client channel was never closed")
	}

	// A handler reports removal twice (context cancelled, then the deferred
	// call). The second must not close an already-closed channel.
	broker.RemoveClient(c)

	admitted := make(chan chan []byte, 1)
	go func() { admitted <- broker.AddClient() }()
	select {
	case c := <-admitted:
		broker.RemoveClient(c)
	case <-time.After(settle):
		t.Fatal("listen() did not survive a repeated removal")
	}
}

func TestDisallowedOriginIsRejected(t *testing.T) {
	broker := NewBroker(map[string]bool{"http://allowed.test": true})

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Origin", "http://evil.test")
	broker.ServeHTTP(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Fatalf("got status %d, want %d", rr.Code, http.StatusForbidden)
	}
	if broker.IsListening() {
		t.Fatal("a rejected origin must not register as a client")
	}
}
