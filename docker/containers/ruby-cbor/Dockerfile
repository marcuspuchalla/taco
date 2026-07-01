# The cbor gem (0.5.9, 2016) no longer builds unpatched: it references
# rb_cFixnum/rb_cBignum — C symbols removed when Ruby unified Fixnum/Bignum
# into Integer — and its extconf.rb overwrites $CFLAGS, so environment flags
# cannot fix it. Pin alpine 3.19 (GCC 13, which keeps the gem's other legacy-C
# issues as warnings rather than GCC 14 hard errors), then fetch the gem, patch
# its C source to use rb_cInteger, and install the rebuilt gem. server.rb loads
# it with a plain `require 'cbor'`, so no bundler step is needed.
FROM ruby:3.1-alpine3.19
RUN apk add --no-cache build-base
WORKDIR /app
RUN gem fetch cbor -v 0.5.9.0 \
 && gem unpack cbor-0.5.9.0.gem --target /tmp \
 && gem specification cbor-0.5.9.0.gem --ruby > /tmp/cbor-0.5.9.0/cbor.gemspec \
 && sed -i 's/rb_cFixnum/rb_cInteger/g; s/rb_cBignum/rb_cInteger/g' /tmp/cbor-0.5.9.0/ext/cbor/*.c \
 && cd /tmp/cbor-0.5.9.0 \
 && gem build cbor.gemspec \
 && gem install cbor-0.5.9.0.gem --local --no-document \
 && rm -rf /tmp/cbor-0.5.9.0 /app/cbor-0.5.9.0.gem
COPY server.rb ./
EXPOSE 8080
HEALTHCHECK --interval=5s --timeout=5s --start-period=10s --retries=10 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
CMD ["ruby", "server.rb"]
