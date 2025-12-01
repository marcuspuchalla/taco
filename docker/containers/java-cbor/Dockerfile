FROM maven:3.9-eclipse-temurin-17-alpine AS builder
WORKDIR /app
COPY pom.xml ./
RUN mvn dependency:go-offline
COPY Server.java ./src/main/java/
RUN mvn package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/*.jar ./app.jar
COPY --from=builder /app/target/lib ./lib
EXPOSE 8080
HEALTHCHECK --interval=5s --timeout=3s --start-period=15s --retries=10 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/health || exit 1
CMD ["java", "-cp", "app.jar:lib/*", "Server"]
