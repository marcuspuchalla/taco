FROM ruby:3.2-alpine
RUN apk add --no-cache build-base
WORKDIR /app
COPY Gemfile ./
RUN bundle install
COPY server.rb ./
EXPOSE 8080
HEALTHCHECK --interval=5s --timeout=5s --start-period=10s --retries=10 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
CMD ["ruby", "server.rb"]
