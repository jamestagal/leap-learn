#!/bin/bash

# Comprehensive test script for Consultation Domain
# This script runs all types of tests with proper setup and reporting

set -e

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_ROOT="$PROJECT_ROOT/app/service-core"
REPORT_DIR="$PROJECT_ROOT/test-reports"
COVERAGE_DIR="$REPORT_DIR/coverage"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
RUN_UNIT=${RUN_UNIT:-true}
RUN_INTEGRATION=${RUN_INTEGRATION:-true}
RUN_PERFORMANCE=${RUN_PERFORMANCE:-false}
RUN_LINT=${RUN_LINT:-true}
RUN_SECURITY=${RUN_SECURITY:-true}
VERBOSE=${VERBOSE:-false}
COVERAGE_THRESHOLD=${COVERAGE_THRESHOLD:-80}

# Database configuration for tests
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-gofast_test}
DB_USER=${DB_USER:-test}
DB_PASSWORD=${DB_PASSWORD:-test}

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Run comprehensive tests for the Consultation Domain.

OPTIONS:
    -h, --help              Show this help message
    -u, --unit-only         Run only unit tests
    -i, --integration-only  Run only integration tests
    -p, --performance       Run performance tests
    -l, --lint-only         Run only linting
    -s, --security-only     Run only security scans
    -v, --verbose           Enable verbose output
    --no-lint              Skip linting
    --no-security          Skip security scans
    --coverage-threshold   Set coverage threshold (default: 80)
    --clean                Clean test artifacts before running

ENVIRONMENT VARIABLES:
    DB_HOST                Database host (default: localhost)
    DB_PORT                Database port (default: 5432)
    DB_NAME                Database name (default: gofast_test)
    DB_USER                Database user (default: test)
    DB_PASSWORD            Database password (default: test)

EXAMPLES:
    # Run all tests
    $0

    # Run only unit tests with verbose output
    $0 --unit-only --verbose

    # Run integration tests with custom database
    DB_HOST=test-db.example.com $0 --integration-only

    # Run performance tests
    $0 --performance

    # Clean and run all tests
    $0 --clean
EOF
}

log() {
    local level=$1
    shift
    case $level in
        INFO)  echo -e "${BLUE}[INFO]${NC} $*" ;;
        WARN)  echo -e "${YELLOW}[WARN]${NC} $*" ;;
        ERROR) echo -e "${RED}[ERROR]${NC} $*" ;;
        SUCCESS) echo -e "${GREEN}[SUCCESS]${NC} $*" ;;
    esac
}

verbose_log() {
    if [[ "$VERBOSE" == "true" ]]; then
        log INFO "$@"
    fi
}

check_dependencies() {
    log INFO "Checking dependencies..."

    # Check Go
    if ! command -v go &> /dev/null; then
        log ERROR "Go is not installed"
        exit 1
    fi

    # Check required Go tools
    local tools=("golangci-lint" "gosec" "sqlc")
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log WARN "$tool is not installed, attempting to install..."
            case $tool in
                golangci-lint)
                    curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b $(go env GOPATH)/bin
                    ;;
                gosec)
                    go install github.com/securecodewarrior/gosec/v2/cmd/gosec@latest
                    ;;
                sqlc)
                    go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
                    ;;
            esac
        fi
    done
}

setup_test_environment() {
    log INFO "Setting up test environment..."

    # Create report directories
    mkdir -p "$REPORT_DIR" "$COVERAGE_DIR"

    # Set up test database environment
    export DATABASE_PROVIDER=postgres
    export POSTGRES_HOST=$DB_HOST
    export POSTGRES_PORT=$DB_PORT
    export POSTGRES_DB=$DB_NAME
    export POSTGRES_USER=$DB_USER
    export POSTGRES_PASSWORD=$DB_PASSWORD
    export SERVICE_ENV=test
    export LOG_LEVEL=warn

    # Generate test JWT keys if they don't exist
    if [[ ! -f "$PROJECT_ROOT/keys/private.key" ]]; then
        log INFO "Generating JWT keys for testing..."
        mkdir -p "$PROJECT_ROOT/keys"
        openssl genrsa -out "$PROJECT_ROOT/keys/private.key" 2048
        openssl rsa -in "$PROJECT_ROOT/keys/private.key" -pubout -out "$PROJECT_ROOT/keys/public.key"
    fi

    export JWT_SECRET_KEY="$PROJECT_ROOT/keys/private.key"
    export JWT_PUBLIC_KEY="$PROJECT_ROOT/keys/public.key"
}

wait_for_database() {
    log INFO "Waiting for database to be ready..."
    local retries=30
    local count=0

    while [[ $count -lt $retries ]]; do
        if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" &> /dev/null; then
            log SUCCESS "Database is ready"
            return 0
        fi

        count=$((count + 1))
        verbose_log "Waiting for database... ($count/$retries)"
        sleep 2
    done

    log ERROR "Database is not available after $retries attempts"
    return 1
}

setup_database() {
    log INFO "Setting up test database..."

    # Check if database exists, create if not
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
        log INFO "Creating test database: $DB_NAME"
        createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
    fi

    # Run migrations
    log INFO "Running database migrations..."
    cd "$PROJECT_ROOT"
    for f in migrations/*.sql; do
        log INFO "Applying $f..."
        PGHOST="$DB_HOST" PGPORT="$DB_PORT" PGDATABASE="$DB_NAME" PGUSER="$DB_USER" PGPASSWORD="$DB_PASSWORD" psql < "$f"
    done

    # Generate SQLC code
    if [[ -f "$SERVICE_ROOT/sqlc.yaml" ]]; then
        log INFO "Generating SQLC code..."
        cd "$SERVICE_ROOT"
        sqlc generate
    fi
}

run_unit_tests() {
    log INFO "Running unit tests..."

    cd "$SERVICE_ROOT"

    local test_args=()
    test_args+=("-v")
    test_args+=("-race")
    test_args+=("-coverprofile=$COVERAGE_DIR/unit.out")
    test_args+=("-covermode=atomic")

    if [[ "$VERBOSE" == "true" ]]; then
        test_args+=("-v")
    fi

    # Run unit tests for consultation domain
    local packages=(
        "./domain/consultation/..."
        "./rest/*consultation*"
    )

    for package in "${packages[@]}"; do
        verbose_log "Testing package: $package"
        if ! go test "${test_args[@]}" "$package"; then
            log ERROR "Unit tests failed for package: $package"
            return 1
        fi
    done

    # Generate coverage report
    if [[ -f "$COVERAGE_DIR/unit.out" ]]; then
        go tool cover -html="$COVERAGE_DIR/unit.out" -o "$COVERAGE_DIR/unit.html"

        # Check coverage threshold
        local coverage_percent
        coverage_percent=$(go tool cover -func="$COVERAGE_DIR/unit.out" | grep total | awk '{print substr($3, 1, length($3)-1)}')

        if (( $(echo "$coverage_percent < $COVERAGE_THRESHOLD" | bc -l) )); then
            log WARN "Coverage $coverage_percent% is below threshold $COVERAGE_THRESHOLD%"
        else
            log SUCCESS "Coverage $coverage_percent% meets threshold $COVERAGE_THRESHOLD%"
        fi
    fi

    log SUCCESS "Unit tests completed"
}

run_integration_tests() {
    log INFO "Running integration tests..."

    # Ensure database is ready
    wait_for_database
    setup_database

    cd "$SERVICE_ROOT"

    local test_args=()
    test_args+=("-tags=integration")
    test_args+=("-v")
    test_args+=("-coverprofile=$COVERAGE_DIR/integration.out")
    test_args+=("-covermode=atomic")

    if [[ "$VERBOSE" == "true" ]]; then
        test_args+=("-v")
    fi

    # Run integration tests
    if ! go test "${test_args[@]}" "./integration/..."; then
        log ERROR "Integration tests failed"
        return 1
    fi

    # Generate coverage report
    if [[ -f "$COVERAGE_DIR/integration.out" ]]; then
        go tool cover -html="$COVERAGE_DIR/integration.out" -o "$COVERAGE_DIR/integration.html"
    fi

    log SUCCESS "Integration tests completed"
}

run_performance_tests() {
    log INFO "Running performance tests..."

    # Ensure database is ready
    wait_for_database
    setup_database

    cd "$SERVICE_ROOT"

    # Run benchmarks
    local bench_args=()
    bench_args+=("-bench=.")
    bench_args+=("-benchmem")
    bench_args+=("-run=^$")  # Don't run regular tests
    bench_args+=("-tags=integration")

    # Run benchmarks and save results
    if ! go test "${bench_args[@]}" "./domain/consultation/..." > "$REPORT_DIR/benchmarks.txt"; then
        log ERROR "Performance tests failed"
        return 1
    fi

    log SUCCESS "Performance tests completed"
}

run_linting() {
    log INFO "Running code linting..."

    cd "$SERVICE_ROOT"

    # Run golangci-lint
    if ! golangci-lint run --out-format=json > "$REPORT_DIR/lint.json"; then
        log ERROR "Linting failed"
        return 1
    fi

    # Generate readable report
    golangci-lint run --out-format=colored-line-number > "$REPORT_DIR/lint.txt" || true

    log SUCCESS "Linting completed"
}

run_security_scan() {
    log INFO "Running security scan..."

    cd "$SERVICE_ROOT"

    # Run gosec
    if ! gosec -fmt=json -out="$REPORT_DIR/security.json" ./...; then
        log ERROR "Security scan failed"
        return 1
    fi

    # Generate readable report
    gosec -fmt=text -out="$REPORT_DIR/security.txt" ./... || true

    # Run vulnerability check
    if command -v govulncheck &> /dev/null; then
        log INFO "Running vulnerability check..."
        govulncheck ./... > "$REPORT_DIR/vulnerabilities.txt" || true
    fi

    log SUCCESS "Security scan completed"
}

generate_combined_coverage() {
    log INFO "Generating combined coverage report..."

    cd "$SERVICE_ROOT"

    # Combine coverage files if they exist
    local coverage_files=()
    [[ -f "$COVERAGE_DIR/unit.out" ]] && coverage_files+=("$COVERAGE_DIR/unit.out")
    [[ -f "$COVERAGE_DIR/integration.out" ]] && coverage_files+=("$COVERAGE_DIR/integration.out")

    if [[ ${#coverage_files[@]} -gt 0 ]]; then
        # Merge coverage files
        echo "mode: atomic" > "$COVERAGE_DIR/combined.out"
        for file in "${coverage_files[@]}"; do
            tail -n +2 "$file" >> "$COVERAGE_DIR/combined.out"
        done

        # Generate HTML report
        go tool cover -html="$COVERAGE_DIR/combined.out" -o "$COVERAGE_DIR/combined.html"

        # Calculate total coverage
        local total_coverage
        total_coverage=$(go tool cover -func="$COVERAGE_DIR/combined.out" | grep total | awk '{print substr($3, 1, length($3)-1)}')
        log SUCCESS "Total coverage: $total_coverage%"
    fi
}

generate_test_report() {
    log INFO "Generating test report..."

    cat > "$REPORT_DIR/summary.md" << EOF
# Consultation Domain Test Report

Generated: $(date)

## Test Summary

### Coverage Results
EOF

    # Add coverage information
    if [[ -f "$COVERAGE_DIR/combined.out" ]]; then
        echo "" >> "$REPORT_DIR/summary.md"
        echo "#### Combined Coverage" >> "$REPORT_DIR/summary.md"
        go tool cover -func="$COVERAGE_DIR/combined.out" | tail -1 >> "$REPORT_DIR/summary.md"
    fi

    # Add benchmark results
    if [[ -f "$REPORT_DIR/benchmarks.txt" ]]; then
        echo "" >> "$REPORT_DIR/summary.md"
        echo "### Performance Benchmarks" >> "$REPORT_DIR/summary.md"
        echo '```' >> "$REPORT_DIR/summary.md"
        cat "$REPORT_DIR/benchmarks.txt" >> "$REPORT_DIR/summary.md"
        echo '```' >> "$REPORT_DIR/summary.md"
    fi

    log SUCCESS "Test report generated: $REPORT_DIR/summary.md"
}

cleanup() {
    if [[ "${CLEAN_ARTIFACTS:-false}" == "true" ]]; then
        log INFO "Cleaning up test artifacts..."
        rm -rf "$REPORT_DIR"
    fi
}

main() {
    local unit_only=false
    local integration_only=false
    local performance=false
    local lint_only=false
    local security_only=false
    local clean_artifacts=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                usage
                exit 0
                ;;
            -u|--unit-only)
                unit_only=true
                RUN_INTEGRATION=false
                RUN_LINT=false
                RUN_SECURITY=false
                shift
                ;;
            -i|--integration-only)
                integration_only=true
                RUN_UNIT=false
                RUN_LINT=false
                RUN_SECURITY=false
                shift
                ;;
            -p|--performance)
                RUN_PERFORMANCE=true
                shift
                ;;
            -l|--lint-only)
                lint_only=true
                RUN_UNIT=false
                RUN_INTEGRATION=false
                RUN_SECURITY=false
                shift
                ;;
            -s|--security-only)
                security_only=true
                RUN_UNIT=false
                RUN_INTEGRATION=false
                RUN_LINT=false
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            --no-lint)
                RUN_LINT=false
                shift
                ;;
            --no-security)
                RUN_SECURITY=false
                shift
                ;;
            --coverage-threshold)
                COVERAGE_THRESHOLD="$2"
                shift 2
                ;;
            --clean)
                clean_artifacts=true
                shift
                ;;
            *)
                log ERROR "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done

    # Clean artifacts if requested
    if [[ "$clean_artifacts" == "true" ]]; then
        rm -rf "$REPORT_DIR"
    fi

    # Set up environment
    check_dependencies
    setup_test_environment

    # Run tests based on configuration
    local exit_code=0

    if [[ "$RUN_UNIT" == "true" ]]; then
        run_unit_tests || exit_code=1
    fi

    if [[ "$RUN_INTEGRATION" == "true" ]]; then
        run_integration_tests || exit_code=1
    fi

    if [[ "$RUN_PERFORMANCE" == "true" ]]; then
        run_performance_tests || exit_code=1
    fi

    if [[ "$RUN_LINT" == "true" ]]; then
        run_linting || exit_code=1
    fi

    if [[ "$RUN_SECURITY" == "true" ]]; then
        run_security_scan || exit_code=1
    fi

    # Generate reports
    generate_combined_coverage
    generate_test_report

    # Summary
    if [[ $exit_code -eq 0 ]]; then
        log SUCCESS "All tests completed successfully!"
        log INFO "Reports available in: $REPORT_DIR"
    else
        log ERROR "Some tests failed. Check reports in: $REPORT_DIR"
    fi

    cleanup
    exit $exit_code
}

# Handle script interruption
trap cleanup EXIT INT TERM

# Run main function
main "$@"