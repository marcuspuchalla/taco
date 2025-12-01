#!/usr/bin/env ruby
# CBOR Test Container - Ruby with cbor gem

require 'socket'
require 'json'
require 'cbor'

PORT = 8080
LIBRARY_NAME = 'cbor-ruby'
LIBRARY_VERSION = '0.5.9.8'

def to_json_safe(value)
  case value
  when nil
    nil
  when true, false
    value
  when Integer
    if value > 9007199254740991 || value < -9007199254740991
      value.to_s
    else
      value
    end
  when Float
    if value.nan?
      { '__cbor_float__' => 'NaN' }
    elsif value.infinite? == 1
      { '__cbor_float__' => 'Infinity' }
    elsif value.infinite? == -1
      { '__cbor_float__' => '-Infinity' }
    else
      value
    end
  when String
    if value.encoding == Encoding::ASCII_8BIT || value.encoding == Encoding::BINARY
      { '__cbor_bytes__' => value.unpack1('H*') }
    else
      value.force_encoding('UTF-8')
    end
  when Array
    value.map { |v| to_json_safe(v) }
  when Hash
    result = {}
    value.each do |k, v|
      key_str = k.is_a?(String) ? k : to_json_safe(k).to_json
      result[key_str] = to_json_safe(v)
    end
    result
  when CBOR::Tagged
    {
      '__cbor_tag__' => value.tag,
      '__cbor_value__' => to_json_safe(value.value)
    }
  when CBOR::Simple
    case value.value
    when 22
      nil
    when 23
      { '__cbor_undefined__' => true }
    else
      value.value
    end
  else
    value.to_s
  end
end

def from_json_safe(value)
  case value
  when nil
    nil
  when Hash
    if value.key?('__cbor_bytes__')
      [value['__cbor_bytes__']].pack('H*')
    elsif value.key?('__cbor_float__')
      case value['__cbor_float__']
      when 'NaN' then Float::NAN
      when 'Infinity' then Float::INFINITY
      when '-Infinity' then -Float::INFINITY
      end
    elsif value.key?('__cbor_undefined__')
      CBOR::Simple.new(23)
    else
      result = {}
      value.each { |k, v| result[k] = from_json_safe(v) }
      result
    end
  when Array
    value.map { |v| from_json_safe(v) }
  else
    value
  end
end

def handle_health
  {
    status: 'ok',
    library: LIBRARY_NAME,
    version: LIBRARY_VERSION,
    language: 'ruby'
  }
end

def handle_decode(body)
  unless body['hex']
    return { success: false, error: 'Missing "hex" field' }
  end

  hex = body['hex']
  start_time = Process.clock_gettime(Process::CLOCK_MONOTONIC)

  begin
    bytes = [hex].pack('H*')
    decoded = CBOR.decode(bytes)
    duration = (Process.clock_gettime(Process::CLOCK_MONOTONIC) - start_time) * 1000

    {
      success: true,
      result: to_json_safe(decoded),
      duration_ms: duration
    }
  rescue => e
    { success: false, error: e.message }
  end
end

def handle_encode(body)
  unless body.key?('value')
    return { success: false, error: 'Missing "value" field' }
  end

  start_time = Process.clock_gettime(Process::CLOCK_MONOTONIC)

  begin
    value = from_json_safe(body['value'])
    encoded = CBOR.encode(value)
    duration = (Process.clock_gettime(Process::CLOCK_MONOTONIC) - start_time) * 1000

    {
      success: true,
      hex: encoded.unpack1('H*'),
      duration_ms: duration
    }
  rescue => e
    { success: false, error: e.message }
  end
end

def parse_http_request(client)
  request_line = client.gets
  return nil unless request_line

  method, path, _ = request_line.split(' ')

  headers = {}
  while (line = client.gets) && line != "\r\n"
    key, value = line.split(': ', 2)
    headers[key.downcase] = value.strip if key
  end

  body = ''
  if headers['content-length']
    body = client.read(headers['content-length'].to_i)
  end

  { method: method, path: path, headers: headers, body: body }
end

def send_response(client, status, body)
  json = body.to_json
  response = "HTTP/1.1 #{status} OK\r\n"
  response += "Content-Type: application/json\r\n"
  response += "Content-Length: #{json.bytesize}\r\n"
  response += "Connection: close\r\n"
  response += "\r\n"
  response += json
  client.print response
end

server = TCPServer.new('0.0.0.0', PORT)
puts "CBOR test container (#{LIBRARY_NAME} #{LIBRARY_VERSION}) listening on port #{PORT}"

loop do
  client = server.accept
  begin
    request = parse_http_request(client)
    next unless request

    case [request[:method], request[:path]]
    when ['GET', '/health']
      send_response(client, 200, handle_health)
    when ['POST', '/decode']
      body = JSON.parse(request[:body]) rescue {}
      result = handle_decode(body)
      status = result[:success] == false && !body.key?('hex') ? 400 : 200
      send_response(client, status, result)
    when ['POST', '/encode']
      body = JSON.parse(request[:body]) rescue {}
      result = handle_encode(body)
      status = result[:success] == false && !body.key?('value') ? 400 : 200
      send_response(client, status, result)
    else
      send_response(client, 404, { error: 'Not found' })
    end
  rescue => e
    send_response(client, 500, { success: false, error: e.message })
  ensure
    client.close
  end
end
