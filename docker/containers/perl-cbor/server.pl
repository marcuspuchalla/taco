#!/usr/bin/env perl
# CBOR Test Container - Perl with CBOR::XS

use strict;
use warnings;
no warnings 'numeric';  # Suppress numeric warnings for binary data
use IO::Socket::INET;
use JSON::XS;
use CBOR::XS;
use Time::HiRes qw(gettimeofday tv_interval);
use POSIX qw(INFINITY);
use Encode qw(decode_utf8);

my $PORT = 8080;
my $LIBRARY_NAME = 'CBOR::XS';
my $LIBRARY_VERSION = '1.87';

sub to_json_safe {
    my ($value) = @_;
    return undef unless defined $value;

    my $ref = ref($value);

    # Handle JSON::XS::Boolean or Types::Serialiser::Boolean
    if ($ref eq 'JSON::XS::Boolean' || $ref eq 'Types::Serialiser::Boolean') {
        return $value ? JSON::XS::true : JSON::XS::false;
    }

    if (!$ref) {
        # Scalar - could be number or string
        # Check for special floats (use eval to avoid warnings)
        my $is_nan = eval { $value != $value };
        if ($is_nan) {
            return { '__cbor_float__' => 'NaN' };
        }
        my $is_inf = eval { $value == POSIX::INFINITY };
        if ($is_inf) {
            return { '__cbor_float__' => 'Infinity' };
        }
        my $is_neginf = eval { $value == -POSIX::INFINITY };
        if ($is_neginf) {
            return { '__cbor_float__' => '-Infinity' };
        }
        # Check for big integers
        if ($value =~ /^-?\d+$/ && (length($value) > 15 || abs($value) > 9007199254740991)) {
            return "$value";  # Return as string
        }
        return $value;
    }

    if ($ref eq 'ARRAY') {
        return [map { to_json_safe($_) } @$value];
    }

    if ($ref eq 'HASH') {
        my %result;
        for my $key (keys %$value) {
            my $key_str = ref($key) ? encode_json(to_json_safe($key)) : $key;
            $result{$key_str} = to_json_safe($value->{$key});
        }
        return \%result;
    }

    if ($ref eq 'CBOR::XS::Tagged') {
        return {
            '__cbor_tag__' => $value->tag,
            '__cbor_value__' => to_json_safe($value->value)
        };
    }

    # Byte strings are returned as blessed refs
    if (UNIVERSAL::isa($value, 'CBOR::XS::bytes')) {
        return { '__cbor_bytes__' => unpack('H*', $$value) };
    }

    # Handle other refs
    if ($ref eq 'SCALAR') {
        if (defined $$value && $$value eq '') {
            return { '__cbor_undefined__' => JSON::XS::true };
        }
        return $$value;
    }

    return "$value";  # Stringify unknown types
}

sub from_json_safe {
    my ($value) = @_;
    return undef unless defined $value;

    my $ref = ref($value);

    if ($ref eq 'HASH') {
        if (exists $value->{'__cbor_bytes__'}) {
            my $bytes = pack('H*', $value->{'__cbor_bytes__'});
            return \$bytes;
        }
        if (exists $value->{'__cbor_float__'}) {
            my $f = $value->{'__cbor_float__'};
            return 'NaN' + 0 if $f eq 'NaN';
            return POSIX::INFINITY if $f eq 'Infinity';
            return -POSIX::INFINITY if $f eq '-Infinity';
        }
        if (exists $value->{'__cbor_undefined__'}) {
            return \undef;
        }

        my %result;
        for my $key (keys %$value) {
            $result{$key} = from_json_safe($value->{$key});
        }
        return \%result;
    }

    if ($ref eq 'ARRAY') {
        return [map { from_json_safe($_) } @$value];
    }

    return $value;
}

sub handle_health {
    return {
        status => 'ok',
        library => $LIBRARY_NAME,
        version => $LIBRARY_VERSION,
        language => 'perl'
    };
}

sub handle_decode {
    my ($body) = @_;

    unless (exists $body->{hex}) {
        return { success => JSON::XS::false, error => 'Missing "hex" field' };
    }

    my $hex = $body->{hex};
    my $start = [gettimeofday];
    my $result;

    eval {
        my $bytes = pack('H*', $hex);
        my $cbor = CBOR::XS->new;
        my $decoded = $cbor->decode($bytes);
        my $duration = tv_interval($start) * 1000;

        $result = {
            success => JSON::XS::true,
            result => to_json_safe($decoded),
            duration_ms => $duration
        };
    };
    if ($@) {
        my $error = $@;
        $error =~ s/\s+at\s+\S+\s+line\s+\d+.*//s;
        return { success => JSON::XS::false, error => $error };
    }
    return $result;
}

sub handle_encode {
    my ($body) = @_;

    unless (exists $body->{value}) {
        return { success => JSON::XS::false, error => 'Missing "value" field' };
    }

    my $start = [gettimeofday];
    my $result;

    eval {
        my $value = from_json_safe($body->{value});
        my $cbor = CBOR::XS->new;
        my $encoded = $cbor->encode($value);
        my $duration = tv_interval($start) * 1000;

        $result = {
            success => JSON::XS::true,
            hex => unpack('H*', $encoded),
            duration_ms => $duration
        };
    };
    if ($@) {
        my $error = $@;
        $error =~ s/\s+at\s+\S+\s+line\s+\d+.*//s;
        return { success => JSON::XS::false, error => $error };
    }
    return $result;
}

sub parse_request {
    my ($client) = @_;

    my $request_line = <$client>;
    return undef unless $request_line;

    my ($method, $path) = split(' ', $request_line);

    my %headers;
    while (my $line = <$client>) {
        last if $line eq "\r\n";
        if ($line =~ /^([^:]+):\s*(.+)\r\n/) {
            $headers{lc($1)} = $2;
        }
    }

    my $body = '';
    if (my $len = $headers{'content-length'}) {
        read($client, $body, $len);
    }

    return { method => $method, path => $path, body => $body };
}

sub send_response {
    my ($client, $status, $data) = @_;

    my $json;
    eval {
        $json = encode_json($data);
    };
    if ($@) {
        $json = '{"success":false,"error":"JSON encoding error"}';
    }

    my $response = "HTTP/1.1 $status OK\r\n";
    $response .= "Content-Type: application/json\r\n";
    $response .= "Content-Length: " . length($json) . "\r\n";
    $response .= "Connection: close\r\n";
    $response .= "\r\n";
    $response .= $json;

    print $client $response;
}

# Main server loop
my $server = IO::Socket::INET->new(
    LocalAddr => '0.0.0.0',
    LocalPort => $PORT,
    Listen => 10,
    Reuse => 1,
    Proto => 'tcp'
) or die "Cannot create socket: $!\n";

print "CBOR test container ($LIBRARY_NAME $LIBRARY_VERSION) listening on port $PORT\n";

while (my $client = $server->accept()) {
    my $request = parse_request($client);
    next unless $request;

    my $result;
    my $status = 200;

    if ($request->{method} eq 'GET' && $request->{path} eq '/health') {
        $result = handle_health();
    }
    elsif ($request->{method} eq 'POST' && $request->{path} eq '/decode') {
        my $body = eval { decode_json($request->{body}) } || {};
        $result = handle_decode($body);
        $status = 400 if !$result->{success} && !exists $body->{hex};
    }
    elsif ($request->{method} eq 'POST' && $request->{path} eq '/encode') {
        my $body = eval { decode_json($request->{body}) } || {};
        $result = handle_encode($body);
        $status = 400 if !$result->{success} && !exists $body->{value};
    }
    else {
        $result = { error => 'Not found' };
        $status = 404;
    }

    send_response($client, $status, $result);
    close($client);
}
