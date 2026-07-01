FROM ruby:3.2-alpine
RUN apk add --no-cache build-base
WORKDIR /app
COPY Gemfile ./
# The 2016-era `cbor` gem (0.5.9) references rb_cFixnum/rb_cBignum, C symbols
# removed when Ruby unified Fixnum/Bignum into Integer, and its native code
# trips Alpine GCC 14's now-fatal -Werror=incompatible-pointer-types. Map the
# removed constants to rb_cInteger and demote the strict checks to warnings so
# the extension compiles on a modern Ruby/Alpine toolchain.
ENV CFLAGS="-Drb_cFixnum=rb_cInteger -Drb_cBignum=rb_cInteger -fpermissive -Wno-error=incompatible-pointer-types -Wno-error=implicit-function-declaration -Wno-error=int-conversion"
RUN bundle install
COPY server.rb ./
EXPOSE 8080
HEALTHCHECK --interval=5s --timeout=5s --start-period=10s --retries=10 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
CMD ["ruby", "server.rb"]
