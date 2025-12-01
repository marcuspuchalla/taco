import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import com.upokecenter.cbor.CBORObject;
import com.upokecenter.cbor.CBORType;
import com.upokecenter.numbers.EInteger;
import com.upokecenter.numbers.EDecimal;
import com.upokecenter.numbers.EFloat;

import java.io.*;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;

public class Server {
    private static final int PORT = 8080;
    private static final String LIBRARY_NAME = "PeterO.Cbor";
    private static final String LIBRARY_VERSION = "4.5.5";

    public static void main(String[] args) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);
        server.createContext("/health", new HealthHandler());
        server.createContext("/decode", new DecodeHandler());
        server.createContext("/encode", new EncodeHandler());
        server.setExecutor(null);
        System.out.printf("CBOR test container (%s %s) listening on port %d%n",
                          LIBRARY_NAME, LIBRARY_VERSION, PORT);
        server.start();
    }

    private static String hexToBytes(String hex, byte[] result) {
        int len = hex.length();
        if (len % 2 != 0) return "Invalid hex length";
        for (int i = 0; i < len / 2; i++) {
            try {
                result[i] = (byte) Integer.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
            } catch (NumberFormatException e) {
                return "Invalid hex character";
            }
        }
        return null;
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    private static Object toJsonSafe(CBORObject obj) {
        if (obj == null || obj.isNull()) return null;
        if (obj.isUndefined()) {
            Map<String, Object> m = new HashMap<>();
            m.put("__cbor_undefined__", true);
            return m;
        }

        CBORType type = obj.getType();
        switch (type) {
            case Boolean:
                return obj.AsBoolean();

            case Integer:
                EInteger ei = obj.AsEIntegerValue();
                // Check if fits in safe integer range
                if (ei.compareTo(EInteger.FromInt64(9007199254740991L)) <= 0 &&
                    ei.compareTo(EInteger.FromInt64(-9007199254740991L)) >= 0) {
                    return ei.ToInt64Checked();
                }
                return ei.toString();

            case FloatingPoint:
                double d = obj.AsDoubleValue();
                if (Double.isNaN(d)) {
                    Map<String, Object> m = new HashMap<>();
                    m.put("__cbor_float__", "NaN");
                    return m;
                }
                if (Double.isInfinite(d)) {
                    Map<String, Object> m = new HashMap<>();
                    m.put("__cbor_float__", d > 0 ? "Infinity" : "-Infinity");
                    return m;
                }
                return d;

            case ByteString:
                Map<String, Object> bytesMap = new HashMap<>();
                bytesMap.put("__cbor_bytes__", bytesToHex(obj.GetByteString()));
                return bytesMap;

            case TextString:
                return obj.AsString();

            case Array:
                List<Object> list = new ArrayList<>();
                for (CBORObject item : obj.getValues()) {
                    list.add(toJsonSafe(item));
                }
                return list;

            case Map:
                Map<String, Object> map = new LinkedHashMap<>();
                for (CBORObject key : obj.getKeys()) {
                    String keyStr;
                    if (key.getType() == CBORType.TextString) {
                        keyStr = key.AsString();
                    } else {
                        keyStr = toJsonString(toJsonSafe(key));
                    }
                    map.put(keyStr, toJsonSafe(obj.get(key)));
                }
                return map;

            default:
                // Check for tagged values
                if (obj.isTagged()) {
                    Map<String, Object> tagMap = new HashMap<>();
                    tagMap.put("__cbor_tag__", obj.getMostOuterTag().ToInt64Checked());
                    tagMap.put("__cbor_value__", toJsonSafe(obj.UntagOne()));
                    return tagMap;
                }
                return obj.toString();
        }
    }

    @SuppressWarnings("unchecked")
    private static CBORObject fromJsonSafe(Object value) {
        if (value == null) return CBORObject.Null;

        if (value instanceof Map) {
            Map<String, Object> m = (Map<String, Object>) value;
            if (m.containsKey("__cbor_bytes__")) {
                String hex = (String) m.get("__cbor_bytes__");
                byte[] bytes = new byte[hex.length() / 2];
                hexToBytes(hex, bytes);
                return CBORObject.FromObject(bytes);
            }
            if (m.containsKey("__cbor_float__")) {
                String f = (String) m.get("__cbor_float__");
                if ("NaN".equals(f)) return CBORObject.FromObject(Double.NaN);
                if ("Infinity".equals(f)) return CBORObject.FromObject(Double.POSITIVE_INFINITY);
                if ("-Infinity".equals(f)) return CBORObject.FromObject(Double.NEGATIVE_INFINITY);
            }
            if (m.containsKey("__cbor_undefined__")) {
                return CBORObject.Undefined;
            }

            CBORObject map = CBORObject.NewMap();
            for (Map.Entry<String, Object> entry : m.entrySet()) {
                map.set(entry.getKey(), fromJsonSafe(entry.getValue()));
            }
            return map;
        }

        if (value instanceof List) {
            CBORObject arr = CBORObject.NewArray();
            for (Object item : (List<?>) value) {
                arr.Add(fromJsonSafe(item));
            }
            return arr;
        }

        if (value instanceof String) return CBORObject.FromObject((String) value);
        if (value instanceof Boolean) return CBORObject.FromObject((Boolean) value);
        if (value instanceof Integer) return CBORObject.FromObject((Integer) value);
        if (value instanceof Long) return CBORObject.FromObject((Long) value);
        if (value instanceof Double) return CBORObject.FromObject((Double) value);

        return CBORObject.FromObject(value.toString());
    }

    private static String toJsonString(Object obj) {
        if (obj == null) return "null";
        if (obj instanceof String) return "\"" + escapeJson((String) obj) + "\"";
        if (obj instanceof Number || obj instanceof Boolean) return obj.toString();
        if (obj instanceof List) {
            StringBuilder sb = new StringBuilder("[");
            boolean first = true;
            for (Object item : (List<?>) obj) {
                if (!first) sb.append(",");
                sb.append(toJsonString(item));
                first = false;
            }
            sb.append("]");
            return sb.toString();
        }
        if (obj instanceof Map) {
            StringBuilder sb = new StringBuilder("{");
            boolean first = true;
            for (Map.Entry<?, ?> entry : ((Map<?, ?>) obj).entrySet()) {
                if (!first) sb.append(",");
                sb.append("\"").append(escapeJson(entry.getKey().toString())).append("\":");
                sb.append(toJsonString(entry.getValue()));
                first = false;
            }
            sb.append("}");
            return sb.toString();
        }
        return "\"" + escapeJson(obj.toString()) + "\"";
    }

    private static String escapeJson(String s) {
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    private static void sendResponse(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private static String readBody(HttpExchange exchange) throws IOException {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(exchange.getRequestBody(), StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
            return sb.toString();
        }
    }

    static class HealthHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String response = String.format(
                "{\"status\":\"ok\",\"library\":\"%s\",\"version\":\"%s\",\"language\":\"java\"}",
                LIBRARY_NAME, LIBRARY_VERSION);
            sendResponse(exchange, 200, response);
        }
    }

    static class DecodeHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equals(exchange.getRequestMethod())) {
                sendResponse(exchange, 405, "{\"success\":false,\"error\":\"Method not allowed\"}");
                return;
            }

            String body = readBody(exchange);
            CBORObject request = CBORObject.FromJSONString(body);
            if (!request.ContainsKey("hex")) {
                sendResponse(exchange, 400, "{\"success\":false,\"error\":\"Missing \\\"hex\\\" field\"}");
                return;
            }

            String hex = request.get("hex").AsString();
            long start = System.nanoTime();

            try {
                byte[] bytes = new byte[hex.length() / 2];
                String error = hexToBytes(hex, bytes);
                if (error != null) {
                    sendResponse(exchange, 200, "{\"success\":false,\"error\":\"" + error + "\"}");
                    return;
                }

                CBORObject decoded = CBORObject.DecodeFromBytes(bytes);
                double duration = (System.nanoTime() - start) / 1_000_000.0;

                Object result = toJsonSafe(decoded);
                String response = String.format(
                    "{\"success\":true,\"result\":%s,\"duration_ms\":%.3f}",
                    toJsonString(result), duration);
                sendResponse(exchange, 200, response);

            } catch (Exception e) {
                sendResponse(exchange, 200,
                    "{\"success\":false,\"error\":\"" + escapeJson(e.getMessage()) + "\"}");
            }
        }
    }

    static class EncodeHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equals(exchange.getRequestMethod())) {
                sendResponse(exchange, 405, "{\"success\":false,\"error\":\"Method not allowed\"}");
                return;
            }

            String body = readBody(exchange);
            CBORObject request = CBORObject.FromJSONString(body);
            if (!request.ContainsKey("value")) {
                sendResponse(exchange, 400, "{\"success\":false,\"error\":\"Missing \\\"value\\\" field\"}");
                return;
            }

            long start = System.nanoTime();

            try {
                CBORObject value = fromJsonSafe(toJsonSafe(request.get("value")));
                byte[] encoded = value.EncodeToBytes();
                double duration = (System.nanoTime() - start) / 1_000_000.0;

                String response = String.format(
                    "{\"success\":true,\"hex\":\"%s\",\"duration_ms\":%.3f}",
                    bytesToHex(encoded), duration);
                sendResponse(exchange, 200, response);

            } catch (Exception e) {
                sendResponse(exchange, 200,
                    "{\"success\":false,\"error\":\"" + escapeJson(e.getMessage()) + "\"}");
            }
        }
    }
}
