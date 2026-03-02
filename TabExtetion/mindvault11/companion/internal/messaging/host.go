// Package messaging implements the Chrome Native Messaging host protocol.
// Messages are length-prefixed JSON objects sent over stdin/stdout.
// See: https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging
package messaging

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"os"
)

// Message is a generic native messaging envelope.
type Message struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// Response is sent back to the extension.
type Response struct {
	Type  string `json:"type"`
	OK    bool   `json:"ok"`
	Data  any    `json:"data,omitempty"`
	Error string `json:"error,omitempty"`
}

// Host handles the native messaging stdin/stdout protocol.
type Host struct {
	in  io.Reader
	out io.Writer
}

// NewHost creates a Host reading from stdin and writing to stdout.
func NewHost() *Host {
	return &Host{in: os.Stdin, out: os.Stdout}
}

// Run enters the read loop. Blocks until EOF or error.
// TODO(step-12): implement full dispatch logic for sync, auth, etc.
func (h *Host) Run() error {
	for {
		msg, err := h.readMessage()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return fmt.Errorf("read message: %w", err)
		}

		resp := h.dispatch(msg)
		if err := h.writeResponse(resp); err != nil {
			return fmt.Errorf("write response: %w", err)
		}
	}
}

// dispatch routes a message to the correct handler.
func (h *Host) dispatch(msg *Message) Response {
	switch msg.Type {
	case "ping":
		return Response{Type: "pong", OK: true, Data: "pong"}
	case "getToken":
		// Extension asks for the REST API token to use in future HTTP calls
		// TODO(step-12): return actual token
		return Response{Type: "getToken", OK: false, Error: "not yet implemented"}
	default:
		return Response{Type: "error", OK: false, Error: "unknown message type: " + msg.Type}
	}
}

// readMessage reads one length-prefixed JSON message from stdin.
// Chrome native messaging format: 4-byte LE uint32 length + JSON body.
func (h *Host) readMessage() (*Message, error) {
	var length uint32
	if err := binary.Read(h.in, binary.LittleEndian, &length); err != nil {
		return nil, err
	}
	if length == 0 || length > 1024*1024 {
		return nil, fmt.Errorf("invalid message length: %d", length)
	}
	body := make([]byte, length)
	if _, err := io.ReadFull(h.in, body); err != nil {
		return nil, err
	}
	var msg Message
	if err := json.Unmarshal(body, &msg); err != nil {
		return nil, fmt.Errorf("unmarshal: %w", err)
	}
	return &msg, nil
}

// writeResponse sends a length-prefixed JSON response to stdout.
func (h *Host) writeResponse(resp Response) error {
	body, err := json.Marshal(resp)
	if err != nil {
		return err
	}
	length := uint32(len(body))
	if err := binary.Write(h.out, binary.LittleEndian, length); err != nil {
		return err
	}
	_, err = h.out.Write(body)
	return err
}
