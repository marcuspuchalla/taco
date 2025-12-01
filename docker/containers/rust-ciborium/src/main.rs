//! CBOR Test Container - Rust with ciborium library
//! Implements the standard HTTP bridge protocol

use ciborium::value::Value;
use serde_json::{json, Value as JsonValue};
use std::io::{Read, Write};
use std::time::Instant;
use tiny_http::{Header, Method, Response, Server};

const PORT: u16 = 8080;
const LIBRARY_NAME: &str = "ciborium";
const LIBRARY_VERSION: &str = "0.2.2";
const LANGUAGE: &str = "rust";

/// Convert CBOR Value to JSON-safe format with type markers
fn cbor_to_json(value: Value) -> JsonValue {
    match value {
        Value::Integer(i) => {
            let num = i128::from(i);
            // Check if it fits in JavaScript safe integer range
            if num > 9007199254740991 || num < -9007199254740991 {
                json!(num.to_string())
            } else {
                json!(num)
            }
        }
        Value::Bytes(bytes) => {
            json!({ "__cbor_bytes__": hex::encode(&bytes) })
        }
        Value::Float(f) => {
            if f.is_nan() {
                json!({"__cbor_float__": "NaN"})
            } else if f.is_infinite() {
                if f.is_sign_positive() {
                    json!({"__cbor_float__": "Infinity"})
                } else {
                    json!({"__cbor_float__": "-Infinity"})
                }
            } else {
                json!(f)
            }
        }
        Value::Text(s) => json!(s),
        Value::Bool(b) => json!(b),
        Value::Null => json!(null),
        Value::Array(arr) => {
            let converted: Vec<JsonValue> = arr.into_iter().map(cbor_to_json).collect();
            json!(converted)
        }
        Value::Map(map) => {
            let mut result = serde_json::Map::new();
            for (k, v) in map {
                let key = match k {
                    Value::Text(s) => s,
                    Value::Integer(i) => i128::from(i).to_string(),
                    Value::Bytes(b) => hex::encode(&b),
                    _ => format!("{:?}", k),
                };
                result.insert(key, cbor_to_json(v));
            }
            json!(result)
        }
        Value::Tag(tag, inner) => {
            json!({
                "__cbor_tag__": tag,
                "__cbor_value__": cbor_to_json(*inner)
            })
        }
        _ => json!(null),
    }
}

/// Convert JSON value to CBOR Value
fn json_to_cbor(value: JsonValue) -> Value {
    match value {
        JsonValue::Null => Value::Null,
        JsonValue::Bool(b) => Value::Bool(b),
        JsonValue::Number(n) => {
            if let Some(i) = n.as_i64() {
                Value::Integer(i.into())
            } else if let Some(f) = n.as_f64() {
                Value::Float(f)
            } else {
                Value::Null
            }
        }
        JsonValue::String(s) => {
            // Check if it's a large integer string
            if let Ok(i) = s.parse::<i128>() {
                if i <= i64::MAX as i128 && i >= i64::MIN as i128 {
                    Value::Integer((i as i64).into())
                } else {
                    // For very large integers, keep as text
                    Value::Text(s)
                }
            } else {
                Value::Text(s)
            }
        }
        JsonValue::Array(arr) => {
            let converted: Vec<Value> = arr.into_iter().map(json_to_cbor).collect();
            Value::Array(converted)
        }
        JsonValue::Object(obj) => {
            // Check for special markers
            if let Some(bytes_hex) = obj.get("__cbor_bytes__") {
                if let Some(hex_str) = bytes_hex.as_str() {
                    if let Ok(bytes) = hex::decode(hex_str) {
                        return Value::Bytes(bytes);
                    }
                }
            }

            if let Some(float_str) = obj.get("__cbor_float__") {
                if let Some(s) = float_str.as_str() {
                    return match s {
                        "NaN" => Value::Float(f64::NAN),
                        "Infinity" => Value::Float(f64::INFINITY),
                        "-Infinity" => Value::Float(f64::NEG_INFINITY),
                        _ => Value::Null,
                    };
                }
            }

            if let (Some(tag), Some(inner)) = (obj.get("__cbor_tag__"), obj.get("__cbor_value__")) {
                if let Some(tag_num) = tag.as_u64() {
                    return Value::Tag(tag_num, Box::new(json_to_cbor(inner.clone())));
                }
            }

            if obj.contains_key("__cbor_undefined__") {
                return Value::Null; // ciborium doesn't have undefined
            }

            // Regular map
            let mut map = Vec::new();
            for (k, v) in obj {
                map.push((Value::Text(k), json_to_cbor(v)));
            }
            Value::Map(map)
        }
    }
}

/// Decode CBOR hex string
fn decode_cbor(hex_string: &str) -> JsonValue {
    let start = Instant::now();

    let bytes = match hex::decode(hex_string) {
        Ok(b) => b,
        Err(e) => {
            return json!({
                "success": false,
                "error": format!("Invalid hex: {}", e)
            });
        }
    };

    let value: Value = match ciborium::from_reader(&bytes[..]) {
        Ok(v) => v,
        Err(e) => {
            return json!({
                "success": false,
                "error": format!("CBOR decode error: {}", e)
            });
        }
    };

    let json_result = cbor_to_json(value);
    let duration_ms = start.elapsed().as_secs_f64() * 1000.0;

    json!({
        "success": true,
        "result": json_result,
        "duration_ms": duration_ms
    })
}

/// Encode value to CBOR hex string
fn encode_cbor(value: JsonValue) -> JsonValue {
    let start = Instant::now();

    let cbor_value = json_to_cbor(value);

    let mut bytes = Vec::new();
    if let Err(e) = ciborium::into_writer(&cbor_value, &mut bytes) {
        return json!({
            "success": false,
            "error": format!("CBOR encode error: {}", e)
        });
    }

    let hex_string = hex::encode(&bytes);
    let duration_ms = start.elapsed().as_secs_f64() * 1000.0;

    json!({
        "success": true,
        "hex": hex_string,
        "duration_ms": duration_ms
    })
}

fn main() {
    let addr = format!("0.0.0.0:{}", PORT);
    let server = Server::http(&addr).expect("Failed to start server");

    println!(
        "CBOR test container ({} {}) listening on port {}",
        LIBRARY_NAME, LIBRARY_VERSION, PORT
    );

    for mut request in server.incoming_requests() {
        let content_type = Header::from_bytes("Content-Type", "application/json").unwrap();

        let response = match (request.method(), request.url()) {
            // Health check
            (&Method::Get, "/health") => {
                let body = json!({
                    "status": "ok",
                    "library": LIBRARY_NAME,
                    "version": LIBRARY_VERSION,
                    "language": LANGUAGE
                });
                Response::from_string(body.to_string()).with_header(content_type)
            }

            // Decode endpoint
            (&Method::Post, "/decode") => {
                let mut body = String::new();
                request.as_reader().read_to_string(&mut body).unwrap_or(0);

                let result = match serde_json::from_str::<JsonValue>(&body) {
                    Ok(json) => {
                        if let Some(hex) = json.get("hex").and_then(|v| v.as_str()) {
                            decode_cbor(hex)
                        } else {
                            json!({"success": false, "error": "Missing \"hex\" field"})
                        }
                    }
                    Err(e) => json!({"success": false, "error": format!("Invalid JSON: {}", e)}),
                };

                Response::from_string(result.to_string()).with_header(content_type)
            }

            // Encode endpoint
            (&Method::Post, "/encode") => {
                let mut body = String::new();
                request.as_reader().read_to_string(&mut body).unwrap_or(0);

                let result = match serde_json::from_str::<JsonValue>(&body) {
                    Ok(json) => {
                        if let Some(value) = json.get("value") {
                            encode_cbor(value.clone())
                        } else {
                            json!({"success": false, "error": "Missing \"value\" field"})
                        }
                    }
                    Err(e) => json!({"success": false, "error": format!("Invalid JSON: {}", e)}),
                };

                Response::from_string(result.to_string()).with_header(content_type)
            }

            // Not found
            _ => {
                let body = json!({"error": "Not found"});
                Response::from_string(body.to_string())
                    .with_header(content_type)
                    .with_status_code(404)
            }
        };

        let _ = request.respond(response);
    }
}
