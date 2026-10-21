FROM golang:1.24.8-bookworm AS build
# Upstream no longer distributes the old official images. Compile its pinned
# security release directly, following github.com/minio/minio source guidance.
RUN git clone --depth 1 --branch RELEASE.2025-10-15T17-29-55Z https://github.com/minio/minio.git /src
WORKDIR /src
RUN CGO_ENABLED=0 GOMAXPROCS=2 go build -p 2 -trimpath -o /minio .
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*
COPY --from=build /minio /usr/local/bin/minio
RUN mkdir /data && chown 1000:1000 /data
USER 1000:1000
ENTRYPOINT ["minio"]
