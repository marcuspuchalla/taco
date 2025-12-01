/**
 * CBOR Test Container - C with libcbor
 * A simple HTTP server that wraps libcbor for CBOR encode/decode testing
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <cbor.h>
#include <time.h>
#include <ctype.h>

#define PORT 8080
#define BUFFER_SIZE 1048576
#define LIBRARY_NAME "libcbor"
#define LIBRARY_VERSION "0.11.0"

// Helper to convert hex string to bytes
int hex_to_bytes(const char *hex, unsigned char *bytes, size_t *len) {
    size_t hex_len = strlen(hex);
    if (hex_len % 2 != 0) return -1;

    *len = hex_len / 2;
    for (size_t i = 0; i < *len; i++) {
        char byte_str[3] = {hex[i*2], hex[i*2+1], 0};
        char *endptr;
        bytes[i] = (unsigned char)strtol(byte_str, &endptr, 16);
        if (*endptr != '\0') return -1;
    }
    return 0;
}

// Helper to convert bytes to hex string
void bytes_to_hex(const unsigned char *bytes, size_t len, char *hex) {
    for (size_t i = 0; i < len; i++) {
        sprintf(hex + i*2, "%02x", bytes[i]);
    }
    hex[len*2] = '\0';
}

// Forward declaration
void cbor_to_json(cbor_item_t *item, char *buffer, size_t *offset, size_t max_len);

// Escape JSON string
void json_escape_string(const char *str, size_t len, char *buffer, size_t *offset, size_t max_len) {
    *offset += snprintf(buffer + *offset, max_len - *offset, "\"");
    for (size_t i = 0; i < len && *offset < max_len - 10; i++) {
        unsigned char c = str[i];
        if (c == '"') *offset += snprintf(buffer + *offset, max_len - *offset, "\\\"");
        else if (c == '\\') *offset += snprintf(buffer + *offset, max_len - *offset, "\\\\");
        else if (c == '\n') *offset += snprintf(buffer + *offset, max_len - *offset, "\\n");
        else if (c == '\r') *offset += snprintf(buffer + *offset, max_len - *offset, "\\r");
        else if (c == '\t') *offset += snprintf(buffer + *offset, max_len - *offset, "\\t");
        else if (c < 32) *offset += snprintf(buffer + *offset, max_len - *offset, "\\u%04x", c);
        else *offset += snprintf(buffer + *offset, max_len - *offset, "%c", c);
    }
    *offset += snprintf(buffer + *offset, max_len - *offset, "\"");
}

// Convert CBOR item to JSON
void cbor_to_json(cbor_item_t *item, char *buffer, size_t *offset, size_t max_len) {
    if (*offset >= max_len - 100) return;

    switch (cbor_typeof(item)) {
        case CBOR_TYPE_UINT:
            *offset += snprintf(buffer + *offset, max_len - *offset, "%llu",
                (unsigned long long)cbor_get_int(item));
            break;

        case CBOR_TYPE_NEGINT:
            *offset += snprintf(buffer + *offset, max_len - *offset, "%lld",
                -1 - (long long)cbor_get_int(item));
            break;

        case CBOR_TYPE_BYTESTRING: {
            unsigned char *bytes = cbor_bytestring_handle(item);
            size_t len = cbor_bytestring_length(item);
            char *hex = malloc(len * 2 + 1);
            bytes_to_hex(bytes, len, hex);
            *offset += snprintf(buffer + *offset, max_len - *offset,
                "{\"__cbor_bytes__\":\"%s\"}", hex);
            free(hex);
            break;
        }

        case CBOR_TYPE_STRING: {
            unsigned char *str = cbor_string_handle(item);
            size_t len = cbor_string_length(item);
            json_escape_string((char*)str, len, buffer, offset, max_len);
            break;
        }

        case CBOR_TYPE_ARRAY: {
            *offset += snprintf(buffer + *offset, max_len - *offset, "[");
            size_t len = cbor_array_size(item);
            cbor_item_t **items = cbor_array_handle(item);
            for (size_t i = 0; i < len; i++) {
                if (i > 0) *offset += snprintf(buffer + *offset, max_len - *offset, ",");
                cbor_to_json(items[i], buffer, offset, max_len);
            }
            *offset += snprintf(buffer + *offset, max_len - *offset, "]");
            break;
        }

        case CBOR_TYPE_MAP: {
            *offset += snprintf(buffer + *offset, max_len - *offset, "{");
            size_t len = cbor_map_size(item);
            struct cbor_pair *pairs = cbor_map_handle(item);
            for (size_t i = 0; i < len; i++) {
                if (i > 0) *offset += snprintf(buffer + *offset, max_len - *offset, ",");

                // Handle key - convert to string if not already
                if (cbor_typeof(pairs[i].key) == CBOR_TYPE_STRING) {
                    cbor_to_json(pairs[i].key, buffer, offset, max_len);
                } else {
                    // Non-string key - serialize as JSON and use as key
                    char key_buf[1024];
                    size_t key_offset = 0;
                    cbor_to_json(pairs[i].key, key_buf, &key_offset, sizeof(key_buf));
                    *offset += snprintf(buffer + *offset, max_len - *offset, "\"%s\"", key_buf);
                }

                *offset += snprintf(buffer + *offset, max_len - *offset, ":");
                cbor_to_json(pairs[i].value, buffer, offset, max_len);
            }
            *offset += snprintf(buffer + *offset, max_len - *offset, "}");
            break;
        }

        case CBOR_TYPE_TAG: {
            uint64_t tag = cbor_tag_value(item);
            cbor_item_t *tagged = cbor_tag_item(item);
            *offset += snprintf(buffer + *offset, max_len - *offset,
                "{\"__cbor_tag__\":%llu,\"__cbor_value__\":", (unsigned long long)tag);
            cbor_to_json(tagged, buffer, offset, max_len);
            *offset += snprintf(buffer + *offset, max_len - *offset, "}");
            break;
        }

        case CBOR_TYPE_FLOAT_CTRL:
            if (cbor_float_ctrl_is_ctrl(item)) {
                switch (cbor_ctrl_value(item)) {
                    case CBOR_CTRL_FALSE:
                        *offset += snprintf(buffer + *offset, max_len - *offset, "false");
                        break;
                    case CBOR_CTRL_TRUE:
                        *offset += snprintf(buffer + *offset, max_len - *offset, "true");
                        break;
                    case CBOR_CTRL_NULL:
                        *offset += snprintf(buffer + *offset, max_len - *offset, "null");
                        break;
                    case CBOR_CTRL_UNDEF:
                        *offset += snprintf(buffer + *offset, max_len - *offset,
                            "{\"__cbor_undefined__\":true}");
                        break;
                    default:
                        *offset += snprintf(buffer + *offset, max_len - *offset, "null");
                }
            } else {
                double val = cbor_float_get_float(item);
                if (val != val) { // NaN
                    *offset += snprintf(buffer + *offset, max_len - *offset,
                        "{\"__cbor_float__\":\"NaN\"}");
                } else if (val == 1.0/0.0) { // Infinity
                    *offset += snprintf(buffer + *offset, max_len - *offset,
                        "{\"__cbor_float__\":\"Infinity\"}");
                } else if (val == -1.0/0.0) { // -Infinity
                    *offset += snprintf(buffer + *offset, max_len - *offset,
                        "{\"__cbor_float__\":\"-Infinity\"}");
                } else {
                    *offset += snprintf(buffer + *offset, max_len - *offset, "%g", val);
                }
            }
            break;

        default:
            *offset += snprintf(buffer + *offset, max_len - *offset, "null");
    }
}

// Extract JSON string value
char* extract_json_string(const char *json, const char *key) {
    char search[256];
    snprintf(search, sizeof(search), "\"%s\":", key);
    char *start = strstr(json, search);
    if (!start) return NULL;

    start += strlen(search);
    while (*start == ' ' || *start == '\t') start++;

    if (*start == '"') {
        start++;
        char *end = strchr(start, '"');
        if (!end) return NULL;
        size_t len = end - start;
        char *result = malloc(len + 1);
        strncpy(result, start, len);
        result[len] = '\0';
        return result;
    }
    return NULL;
}

// Send HTTP response
void send_response(int client, int status, const char *body) {
    char response[BUFFER_SIZE];
    const char *status_text = status == 200 ? "OK" :
                              status == 400 ? "Bad Request" :
                              status == 404 ? "Not Found" : "Internal Server Error";

    int len = snprintf(response, sizeof(response),
        "HTTP/1.1 %d %s\r\n"
        "Content-Type: application/json\r\n"
        "Content-Length: %zu\r\n"
        "Connection: close\r\n"
        "\r\n%s",
        status, status_text, strlen(body), body);

    send(client, response, len, 0);
}

// Handle health check
void handle_health(int client) {
    char body[512];
    snprintf(body, sizeof(body),
        "{\"status\":\"ok\",\"library\":\"%s\",\"version\":\"%s\",\"language\":\"c\"}",
        LIBRARY_NAME, LIBRARY_VERSION);
    send_response(client, 200, body);
}

// Handle decode request
void handle_decode(int client, const char *body_content) {
    char *hex = extract_json_string(body_content, "hex");
    if (!hex) {
        send_response(client, 400, "{\"success\":false,\"error\":\"Missing \\\"hex\\\" field\"}");
        return;
    }

    struct timespec start, end;
    clock_gettime(CLOCK_MONOTONIC, &start);

    size_t len;
    unsigned char *bytes = malloc(strlen(hex) / 2 + 1);
    if (hex_to_bytes(hex, bytes, &len) != 0) {
        free(bytes);
        free(hex);
        send_response(client, 200, "{\"success\":false,\"error\":\"Invalid hex string\"}");
        return;
    }

    struct cbor_load_result result;
    cbor_item_t *item = cbor_load(bytes, len, &result);
    free(bytes);
    free(hex);

    if (result.error.code != CBOR_ERR_NONE) {
        char error_msg[256];
        snprintf(error_msg, sizeof(error_msg),
            "{\"success\":false,\"error\":\"CBOR decode error at position %zu\"}",
            result.error.position);
        send_response(client, 200, error_msg);
        return;
    }

    clock_gettime(CLOCK_MONOTONIC, &end);
    double duration = (end.tv_sec - start.tv_sec) * 1000.0 +
                      (end.tv_nsec - start.tv_nsec) / 1000000.0;

    char *json_buffer = malloc(BUFFER_SIZE);
    size_t offset = 0;
    offset += snprintf(json_buffer + offset, BUFFER_SIZE - offset,
        "{\"success\":true,\"result\":");
    cbor_to_json(item, json_buffer, &offset, BUFFER_SIZE - 100);
    offset += snprintf(json_buffer + offset, BUFFER_SIZE - offset,
        ",\"duration_ms\":%.3f}", duration);

    cbor_decref(&item);

    send_response(client, 200, json_buffer);
    free(json_buffer);
}

// Handle encode request (simplified - just return error for now)
void handle_encode(int client, const char *body_content) {
    // Encoding from JSON to CBOR is complex - simplified implementation
    send_response(client, 200,
        "{\"success\":false,\"error\":\"Encoding not implemented in C container\"}");
}

// Parse HTTP request
void handle_client(int client) {
    char buffer[BUFFER_SIZE];
    ssize_t bytes_read = recv(client, buffer, sizeof(buffer) - 1, 0);
    if (bytes_read <= 0) {
        close(client);
        return;
    }
    buffer[bytes_read] = '\0';

    // Parse method and path
    char method[16], path[256];
    sscanf(buffer, "%15s %255s", method, path);

    // Find body (after double CRLF)
    char *body = strstr(buffer, "\r\n\r\n");
    if (body) body += 4;

    if (strcmp(method, "GET") == 0 && strcmp(path, "/health") == 0) {
        handle_health(client);
    } else if (strcmp(method, "POST") == 0 && strcmp(path, "/decode") == 0) {
        handle_decode(client, body ? body : "");
    } else if (strcmp(method, "POST") == 0 && strcmp(path, "/encode") == 0) {
        handle_encode(client, body ? body : "");
    } else {
        send_response(client, 404, "{\"error\":\"Not found\"}");
    }

    close(client);
}

int main() {
    int server_fd;
    struct sockaddr_in address;
    int opt = 1;

    if ((server_fd = socket(AF_INET, SOCK_STREAM, 0)) == 0) {
        perror("socket failed");
        exit(EXIT_FAILURE);
    }

    setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons(PORT);

    if (bind(server_fd, (struct sockaddr *)&address, sizeof(address)) < 0) {
        perror("bind failed");
        exit(EXIT_FAILURE);
    }

    if (listen(server_fd, 10) < 0) {
        perror("listen failed");
        exit(EXIT_FAILURE);
    }

    printf("CBOR test container (%s %s) listening on port %d\n",
           LIBRARY_NAME, LIBRARY_VERSION, PORT);

    while (1) {
        int client;
        socklen_t addrlen = sizeof(address);
        if ((client = accept(server_fd, (struct sockaddr *)&address, &addrlen)) < 0) {
            perror("accept failed");
            continue;
        }
        handle_client(client);
    }

    return 0;
}
