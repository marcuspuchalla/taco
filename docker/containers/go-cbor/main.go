package main

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/big"
	"net/http"
	"reflect"
	"time"

	"github.com/fxamacker/cbor/v2"
)

const (
	PORT            = ":8080"
	LIBRARY_NAME    = "fxamacker-cbor"
	LIBRARY_VERSION = "2.7.0"
)

// toJsonSafe converts Go values to JSON-safe representations
func toJsonSafe(value interface{}) interface{} {
	if value == nil {
		return nil
	}

	v := reflect.ValueOf(value)
	switch v.Kind() {
	case reflect.Slice:
		if v.Type().Elem().Kind() == reflect.Uint8 {
			// Byte slice -> hex string
			bytes := value.([]byte)
			return map[string]interface{}{"__cbor_bytes__": hex.EncodeToString(bytes)}
		}
		// Regular slice -> array
		result := make([]interface{}, v.Len())
		for i := 0; i < v.Len(); i++ {
			result[i] = toJsonSafe(v.Index(i).Interface())
		}
		return result

	case reflect.Map:
		result := make(map[string]interface{})
		for _, key := range v.MapKeys() {
			k := key.Interface()
			var keyStr string
			switch kt := k.(type) {
			case string:
				keyStr = kt
			default:
				keyBytes, _ := json.Marshal(toJsonSafe(k))
				keyStr = string(keyBytes)
			}
			result[keyStr] = toJsonSafe(v.MapIndex(key).Interface())
		}
		return result

	case reflect.Float32, reflect.Float64:
		f := v.Float()
		if math.IsNaN(f) {
			return map[string]interface{}{"__cbor_float__": "NaN"}
		}
		if math.IsInf(f, 1) {
			return map[string]interface{}{"__cbor_float__": "Infinity"}
		}
		if math.IsInf(f, -1) {
			return map[string]interface{}{"__cbor_float__": "-Infinity"}
		}
		return f

	case reflect.Ptr:
		if v.IsNil() {
			return nil
		}
		return toJsonSafe(v.Elem().Interface())

	case reflect.Interface:
		if v.IsNil() {
			return nil
		}
		return toJsonSafe(v.Elem().Interface())
	}

	// Handle big.Int
	if bigInt, ok := value.(*big.Int); ok {
		// Check if it fits in safe integer range
		if bigInt.IsInt64() {
			i := bigInt.Int64()
			if i >= -9007199254740991 && i <= 9007199254740991 {
				return i
			}
		}
		return bigInt.String()
	}

	// Handle cbor.Tag
	if tag, ok := value.(cbor.Tag); ok {
		return map[string]interface{}{
			"__cbor_tag__":   tag.Number,
			"__cbor_value__": toJsonSafe(tag.Content),
		}
	}

	return value
}

// fromJsonSafe converts JSON-safe representations back to Go values
func fromJsonSafe(value interface{}) interface{} {
	if value == nil {
		return nil
	}

	switch v := value.(type) {
	case map[string]interface{}:
		if hexStr, ok := v["__cbor_bytes__"].(string); ok {
			bytes, _ := hex.DecodeString(hexStr)
			return bytes
		}
		if floatStr, ok := v["__cbor_float__"].(string); ok {
			switch floatStr {
			case "NaN":
				return math.NaN()
			case "Infinity":
				return math.Inf(1)
			case "-Infinity":
				return math.Inf(-1)
			}
		}
		if _, ok := v["__cbor_undefined__"]; ok {
			return nil // Go doesn't have undefined, use nil
		}

		result := make(map[string]interface{})
		for k, val := range v {
			result[k] = fromJsonSafe(val)
		}
		return result

	case []interface{}:
		result := make([]interface{}, len(v))
		for i, val := range v {
			result[i] = fromJsonSafe(val)
		}
		return result
	}

	return value
}

type HealthResponse struct {
	Status   string `json:"status"`
	Library  string `json:"library"`
	Version  string `json:"version"`
	Language string `json:"language"`
}

type DecodeRequest struct {
	Hex string `json:"hex"`
}

type DecodeResponse struct {
	Success    bool        `json:"success"`
	Result     interface{} `json:"result,omitempty"`
	Error      string      `json:"error,omitempty"`
	DurationMs float64     `json:"duration_ms,omitempty"`
}

type EncodeRequest struct {
	Value interface{} `json:"value"`
}

type EncodeResponse struct {
	Success    bool    `json:"success"`
	Hex        string  `json:"hex,omitempty"`
	Error      string  `json:"error,omitempty"`
	DurationMs float64 `json:"duration_ms,omitempty"`
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(HealthResponse{
		Status:   "ok",
		Library:  LIBRARY_NAME,
		Version:  LIBRARY_VERSION,
		Language: "go",
	})
}

func decodeHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != "POST" {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(DecodeResponse{Success: false, Error: "Method not allowed"})
		return
	}

	var req DecodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(DecodeResponse{Success: false, Error: "Invalid JSON"})
		return
	}

	if req.Hex == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(DecodeResponse{Success: false, Error: "Missing \"hex\" field"})
		return
	}

	start := time.Now()

	bytes, err := hex.DecodeString(req.Hex)
	if err != nil {
		json.NewEncoder(w).Encode(DecodeResponse{Success: false, Error: fmt.Sprintf("Invalid hex: %v", err)})
		return
	}

	var result interface{}
	if err := cbor.Unmarshal(bytes, &result); err != nil {
		json.NewEncoder(w).Encode(DecodeResponse{Success: false, Error: err.Error()})
		return
	}

	duration := float64(time.Since(start).Nanoseconds()) / 1_000_000

	json.NewEncoder(w).Encode(DecodeResponse{
		Success:    true,
		Result:     toJsonSafe(result),
		DurationMs: duration,
	})
}

func encodeHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != "POST" {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(EncodeResponse{Success: false, Error: "Method not allowed"})
		return
	}

	var req EncodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(EncodeResponse{Success: false, Error: "Invalid JSON"})
		return
	}

	start := time.Now()

	value := fromJsonSafe(req.Value)
	bytes, err := cbor.Marshal(value)
	if err != nil {
		json.NewEncoder(w).Encode(EncodeResponse{Success: false, Error: err.Error()})
		return
	}

	duration := float64(time.Since(start).Nanoseconds()) / 1_000_000

	json.NewEncoder(w).Encode(EncodeResponse{
		Success:    true,
		Hex:        hex.EncodeToString(bytes),
		DurationMs: duration,
	})
}

func main() {
	http.HandleFunc("/health", healthHandler)
	http.HandleFunc("/decode", decodeHandler)
	http.HandleFunc("/encode", encodeHandler)

	log.Printf("CBOR test container (%s %s) listening on port %s\n", LIBRARY_NAME, LIBRARY_VERSION, PORT)
	log.Fatal(http.ListenAndServe(PORT, nil))
}
