FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS builder
WORKDIR /app
COPY CborServer.csproj ./
RUN dotnet restore
COPY Program.cs ./
RUN dotnet publish -c Release -o out

FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine
WORKDIR /app
COPY --from=builder /app/out ./
EXPOSE 8080
HEALTHCHECK --interval=5s --timeout=3s --start-period=15s --retries=10 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/health || exit 1
ENTRYPOINT ["dotnet", "CborServer.dll"]
