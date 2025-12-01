using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Text;
using System.Text.Json;
using PeterO.Cbor;

class Server
{
    const int Port = 8080;
    const string LibraryName = "PeterO.Cbor";
    const string LibraryVersion = "4.5.5";

    static void Main(string[] args)
    {
        var listener = new HttpListener();
        listener.Prefixes.Add($"http://*:{Port}/");
        listener.Start();
        Console.WriteLine($"CBOR test container ({LibraryName} {LibraryVersion}) listening on port {Port}");

        while (true)
        {
            var context = listener.GetContext();
            try
            {
                HandleRequest(context);
            }
            catch (Exception ex)
            {
                SendResponse(context.Response, 500,
                    JsonSerializer.Serialize(new { success = false, error = ex.Message }));
            }
        }
    }

    static void HandleRequest(HttpListenerContext context)
    {
        var request = context.Request;
        var response = context.Response;

        if (request.HttpMethod == "GET" && request.Url?.AbsolutePath == "/health")
        {
            HandleHealth(response);
        }
        else if (request.HttpMethod == "POST" && request.Url?.AbsolutePath == "/decode")
        {
            HandleDecode(request, response);
        }
        else if (request.HttpMethod == "POST" && request.Url?.AbsolutePath == "/encode")
        {
            HandleEncode(request, response);
        }
        else
        {
            SendResponse(response, 404, JsonSerializer.Serialize(new { error = "Not found" }));
        }
    }

    static void HandleHealth(HttpListenerResponse response)
    {
        var result = new { status = "ok", library = LibraryName, version = LibraryVersion, language = "csharp" };
        SendResponse(response, 200, JsonSerializer.Serialize(result));
    }

    static void HandleDecode(HttpListenerRequest request, HttpListenerResponse response)
    {
        using var reader = new StreamReader(request.InputStream, request.ContentEncoding);
        var body = reader.ReadToEnd();

        using var doc = JsonDocument.Parse(body);
        if (!doc.RootElement.TryGetProperty("hex", out var hexElement))
        {
            SendResponse(response, 400,
                JsonSerializer.Serialize(new { success = false, error = "Missing \"hex\" field" }));
            return;
        }

        var hex = hexElement.GetString();
        if (string.IsNullOrEmpty(hex))
        {
            SendResponse(response, 200,
                JsonSerializer.Serialize(new { success = false, error = "Empty hex string" }));
            return;
        }

        var sw = Stopwatch.StartNew();
        try
        {
            var bytes = HexToBytes(hex);
            var decoded = CBORObject.DecodeFromBytes(bytes);
            sw.Stop();

            var result = ToJsonSafe(decoded);
            var responseObj = new Dictionary<string, object?>
            {
                ["success"] = true,
                ["result"] = result,
                ["duration_ms"] = sw.Elapsed.TotalMilliseconds
            };
            SendResponse(response, 200, JsonSerializer.Serialize(responseObj));
        }
        catch (Exception ex)
        {
            SendResponse(response, 200,
                JsonSerializer.Serialize(new { success = false, error = ex.Message }));
        }
    }

    static void HandleEncode(HttpListenerRequest request, HttpListenerResponse response)
    {
        using var reader = new StreamReader(request.InputStream, request.ContentEncoding);
        var body = reader.ReadToEnd();

        using var doc = JsonDocument.Parse(body);
        if (!doc.RootElement.TryGetProperty("value", out var valueElement))
        {
            SendResponse(response, 400,
                JsonSerializer.Serialize(new { success = false, error = "Missing \"value\" field" }));
            return;
        }

        var sw = Stopwatch.StartNew();
        try
        {
            var cbor = FromJsonSafe(valueElement);
            var bytes = cbor.EncodeToBytes();
            sw.Stop();

            var responseObj = new Dictionary<string, object>
            {
                ["success"] = true,
                ["hex"] = BytesToHex(bytes),
                ["duration_ms"] = sw.Elapsed.TotalMilliseconds
            };
            SendResponse(response, 200, JsonSerializer.Serialize(responseObj));
        }
        catch (Exception ex)
        {
            SendResponse(response, 200,
                JsonSerializer.Serialize(new { success = false, error = ex.Message }));
        }
    }

    static object? ToJsonSafe(CBORObject obj)
    {
        if (obj.IsNull) return null;
        if (obj.IsUndefined) return new Dictionary<string, object> { ["__cbor_undefined__"] = true };

        switch (obj.Type)
        {
            case CBORType.Boolean:
                return obj.AsBoolean();

            case CBORType.Integer:
                var ei = obj.AsEIntegerValue();
                if (ei.CompareTo(9007199254740991) <= 0 && ei.CompareTo(-9007199254740991) >= 0)
                    return (long)obj.AsInt64Value();
                return ei.ToString();

            case CBORType.FloatingPoint:
                var d = obj.AsDoubleValue();
                if (double.IsNaN(d)) return new Dictionary<string, object> { ["__cbor_float__"] = "NaN" };
                if (double.IsPositiveInfinity(d)) return new Dictionary<string, object> { ["__cbor_float__"] = "Infinity" };
                if (double.IsNegativeInfinity(d)) return new Dictionary<string, object> { ["__cbor_float__"] = "-Infinity" };
                return d;

            case CBORType.ByteString:
                return new Dictionary<string, object> { ["__cbor_bytes__"] = BytesToHex(obj.GetByteString()) };

            case CBORType.TextString:
                return obj.AsString();

            case CBORType.Array:
                var list = new List<object?>();
                foreach (var item in obj.Values)
                    list.Add(ToJsonSafe(item));
                return list;

            case CBORType.Map:
                var dict = new Dictionary<string, object?>();
                foreach (var key in obj.Keys)
                {
                    string keyStr;
                    if (key.Type == CBORType.TextString)
                        keyStr = key.AsString();
                    else
                        keyStr = JsonSerializer.Serialize(ToJsonSafe(key));
                    dict[keyStr] = ToJsonSafe(obj[key]);
                }
                return dict;

            default:
                if (obj.IsTagged)
                {
                    return new Dictionary<string, object?>
                    {
                        ["__cbor_tag__"] = (long)obj.MostOuterTag.ToInt64Checked(),
                        ["__cbor_value__"] = ToJsonSafe(obj.UntagOne())
                    };
                }
                return obj.ToString();
        }
    }

    static CBORObject FromJsonSafe(JsonElement elem)
    {
        switch (elem.ValueKind)
        {
            case JsonValueKind.Null:
                return CBORObject.Null;

            case JsonValueKind.True:
                return CBORObject.True;

            case JsonValueKind.False:
                return CBORObject.False;

            case JsonValueKind.String:
                return CBORObject.FromObject(elem.GetString());

            case JsonValueKind.Number:
                if (elem.TryGetInt64(out var l)) return CBORObject.FromObject(l);
                return CBORObject.FromObject(elem.GetDouble());

            case JsonValueKind.Array:
                var arr = CBORObject.NewArray();
                foreach (var item in elem.EnumerateArray())
                    arr.Add(FromJsonSafe(item));
                return arr;

            case JsonValueKind.Object:
                if (elem.TryGetProperty("__cbor_bytes__", out var bytesHex))
                    return CBORObject.FromObject(HexToBytes(bytesHex.GetString()!));
                if (elem.TryGetProperty("__cbor_float__", out var floatStr))
                {
                    var s = floatStr.GetString();
                    if (s == "NaN") return CBORObject.FromObject(double.NaN);
                    if (s == "Infinity") return CBORObject.FromObject(double.PositiveInfinity);
                    if (s == "-Infinity") return CBORObject.FromObject(double.NegativeInfinity);
                }
                if (elem.TryGetProperty("__cbor_undefined__", out _))
                    return CBORObject.Undefined;

                var map = CBORObject.NewMap();
                foreach (var prop in elem.EnumerateObject())
                    map.Set(prop.Name, FromJsonSafe(prop.Value));
                return map;

            default:
                return CBORObject.Null;
        }
    }

    static byte[] HexToBytes(string hex)
    {
        var bytes = new byte[hex.Length / 2];
        for (int i = 0; i < bytes.Length; i++)
            bytes[i] = Convert.ToByte(hex.Substring(i * 2, 2), 16);
        return bytes;
    }

    static string BytesToHex(byte[] bytes)
    {
        var sb = new StringBuilder(bytes.Length * 2);
        foreach (var b in bytes)
            sb.Append(b.ToString("x2"));
        return sb.ToString();
    }

    static void SendResponse(HttpListenerResponse response, int statusCode, string body)
    {
        response.StatusCode = statusCode;
        response.ContentType = "application/json";
        var buffer = Encoding.UTF8.GetBytes(body);
        response.ContentLength64 = buffer.Length;
        response.OutputStream.Write(buffer, 0, buffer.Length);
        response.OutputStream.Close();
    }
}
