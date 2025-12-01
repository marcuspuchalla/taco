FROM perl:5.38-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    wget \
    && rm -rf /var/lib/apt/lists/*
RUN cpan -T CBOR::XS JSON::XS Types::Serialiser
WORKDIR /app
COPY server.pl ./
RUN chmod +x server.pl
EXPOSE 8080
HEALTHCHECK --interval=5s --timeout=5s --start-period=10s --retries=10 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
CMD ["perl", "server.pl"]
