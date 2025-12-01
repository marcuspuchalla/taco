FROM php:8.2-cli-alpine
RUN apk add --no-cache gmp gmp-dev && \
    docker-php-ext-install gmp bcmath
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /app
COPY composer.json ./
RUN composer install --no-dev --optimize-autoloader
COPY server.php ./
EXPOSE 8080
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=10 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/health || exit 1
CMD ["php", "server.php"]
