# Development
FROM golang:1.25-bookworm AS dev
WORKDIR /app

# Install Go dependencies
RUN go install github.com/air-verse/air@v1.61.7

# Copy all module and workspace files to leverage Docker cache
COPY go.work go.work.sum ./
COPY go.mod go.sum ./
COPY ./service-admin/go.mod ./service-admin/go.sum ./service-admin/
COPY ./service-core/go.mod ./service-core/go.sum ./service-core/
COPY ./content-service/go.mod ./content-service/go.sum ./content-service/

COPY ./service-core/public.pem /public.pem
COPY ./service-core/private.pem /private.pem

# Download Go modules
RUN go work sync
RUN cd service-core && go mod download

COPY . .

WORKDIR ./service-core

CMD ["air", "-c", ".air.toml"]

# Build
FROM golang:1.25-bookworm AS build
WORKDIR /

ARG TARGETOS
ARG TARGETARCH

COPY go.work go.work.sum ./
COPY go.mod go.sum ./
COPY ./service-admin/go.mod ./service-admin/go.sum ./service-admin/
COPY ./service-core/go.mod ./service-core/go.sum ./service-core/
COPY ./content-service/go.mod ./content-service/go.sum ./content-service/
RUN go work sync
RUN cd service-core && go mod download

COPY . .

RUN GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -v -o /app ./service-core

# Production
FROM debian:bookworm-slim AS prod
WORKDIR /

# Install tls certificates
RUN apt-get update && apt-get install -y ca-certificates curl && rm -rf /var/lib/apt/lists/*

COPY --from=build /app /app
COPY --from=build /service-core/private.pem /private.pem
COPY --from=build /service-core/public.pem /public.pem

CMD ["/app"]
