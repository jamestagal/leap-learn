# Development
FROM golang:1.25-bookworm AS dev
WORKDIR /app

# Install node.js
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

COPY ./service-admin/package.json ./service-admin/
COPY ./service-admin/package-lock.json ./service-admin/
RUN cd service-admin && npm install

# Install Go dependencies
RUN go install github.com/air-verse/air@v1.61.7
RUN go install github.com/a-h/templ/cmd/templ@latest

# Copy all module and workspace files to leverage Docker cache
COPY go.work go.work.sum ./
COPY go.mod go.sum ./
COPY ./service-admin/go.mod ./service-admin/go.sum ./service-admin/
COPY ./service-core/go.mod ./service-core/go.sum ./service-core/
COPY ./content-service/go.mod ./content-service/go.sum ./content-service/

COPY ./service-admin/public.pem /public.pem

# Download Go modules
RUN go work sync
RUN cd service-admin && go mod download

COPY . .

WORKDIR ./service-admin

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
RUN cd service-admin && go mod download

COPY . .

RUN GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -v -o /app ./service-admin

# Production
FROM debian:bookworm-slim AS prod
WORKDIR /

# Install tls certificates
RUN apt-get update && apt-get install -y ca-certificates curl && rm -rf /var/lib/apt/lists/*

COPY --from=build /app /app
COPY --from=build /service-admin/public.pem /public.pem
COPY ./service-admin/web/static /web/static

CMD ["/app"]
