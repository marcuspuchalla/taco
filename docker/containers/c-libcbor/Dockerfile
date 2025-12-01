FROM alpine:3.19 AS builder
RUN apk add --no-cache gcc g++ musl-dev cmake make git

# Build libcbor
WORKDIR /build
RUN git clone --depth 1 --branch v0.11.0 https://github.com/PJK/libcbor.git
WORKDIR /build/libcbor
RUN cmake -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=/usr . && \
    make && \
    make install

# Build server
WORKDIR /app
COPY server.c ./
RUN gcc -O2 -o server server.c -lcbor -I/usr/include -L/usr/lib

FROM alpine:3.19
RUN apk add --no-cache libgcc
COPY --from=builder /usr/lib/libcbor* /usr/lib/
COPY --from=builder /app/server /app/server
WORKDIR /app
EXPOSE 8080
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=10 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/health || exit 1
CMD ["./server"]
