use ciborium::value::Value;
use serde_json::{json, Value as JsonValue};
use std::io::{self, Read};

/// Convert CBOR Value to JSON with special markers for type preservation
fn cbor_to_json(value: Value) -> JsonValue {
    match value {
        Value::Integer(i) => {
            // Convert to i128 for safe handling
            let num = i128::from(i);
            // Check if it fits in JavaScript safe integer range
            if num > 9007199254740991 || num < -9007199254740991 {
                json!(num.to_string())
            } else {
                json!(num)
            }
        }
        Value::Bytes(bytes) => {
            // Use special marker for byte strings
            json!({
                "__cbor_bytes__": hex::encode(&bytes)
            })
        }
        Value::Float(f) => {
            // Handle special float values
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
            // Preserve tag information
            json!({
                "__cbor_tag__": tag,
                "__cbor_value__": cbor_to_json(*inner)
            })
        }
        _ => json!(null),
    }
}

/// Convert JSON to CBOR Value
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
            if let Ok(i) = s.parse::<i64>() {
                Value::Integer(i.into())
            } else {
                // For very large integers, keep as text (will be handled by test comparison)
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

            // Regular map
            let mut map = Vec::new();
            for (k, v) in obj {
                map.push((Value::Text(k), json_to_cbor(v)));
            }
            Value::Map(map)
        }
    }
}

fn main() -> io::Result<()> {
    let args: Vec<String> = std::env::args().collect();

    if args.len() < 2 {
        let error = json!({
            "success": false,
            "error": "Usage: cbor_bridge <encode|decode>"
        });
        println!("{}", error);
        return Ok(());
    }

    let action = &args[1];

    match action.as_str() {
        "decode" => {
            // Read hex string from stdin
            let mut hex_input = String::new();
            io::stdin().read_to_string(&mut hex_input)?;
            let hex_input = hex_input.trim();

            // Decode hex to bytes
            let bytes = match hex::decode(hex_input) {
                Ok(b) => b,
                Err(e) => {
                    let error = json!({
                        "success": false,
                        "error": format!("Invalid hex: {}", e)
                    });
                    println!("{}", error);
                    return Ok(());
                }
            };

            // Parse CBOR
            let value: Value = match ciborium::from_reader(&bytes[..]) {
                Ok(v) => v,
                Err(e) => {
                    let error = json!({
                        "success": false,
                        "error": format!("CBOR parse error: {}", e)
                    });
                    println!("{}", error);
                    return Ok(());
                }
            };

            // Convert to JSON
            let json_value = cbor_to_json(value);
            let result = json!({
                "success": true,
                "result": json_value
            });

            println!("{}", result);
        }
        "encode" => {
            // Read JSON from stdin
            let mut json_input = String::new();
            io::stdin().read_to_string(&mut json_input)?;

            // Parse JSON
            let json_value: JsonValue = match serde_json::from_str(&json_input) {
                Ok(v) => v,
                Err(e) => {
                    let error = json!({
                        "success": false,
                        "error": format!("Invalid JSON: {}", e)
                    });
                    println!("{}", error);
                    return Ok(());
                }
            };

            // Convert to CBOR
            let cbor_value = json_to_cbor(json_value);

            // Encode CBOR
            let mut bytes = Vec::new();
            if let Err(e) = ciborium::into_writer(&cbor_value, &mut bytes) {
                let error = json!({
                    "success": false,
                    "error": format!("CBOR encode error: {}", e)
                });
                println!("{}", error);
                return Ok(());
            }

            // Convert to hex
            let hex_output = hex::encode(&bytes);
            let result = json!({
                "success": true,
                "result": hex_output
            });

            println!("{}", result);
        }
        _ => {
            let error = json!({
                "success": false,
                "error": format!("Unknown action: {}", action)
            });
            println!("{}", error);
        }
    }

    Ok(())
}
