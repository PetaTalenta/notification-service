# Start script untuk Notification Service

Write-Host "Starting ATMA Notification Service..." -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "Error: .env file not found!" -ForegroundColor Red
    Write-Host "Please copy .env.example to .env and configure it." -ForegroundColor Yellow
    exit 1
}

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Failed to install dependencies!" -ForegroundColor Red
        exit 1
    }
}

# Check for vulnerabilities
Write-Host "Checking for vulnerabilities..." -ForegroundColor Yellow
$auditResult = npm audit --audit-level=high 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: High severity vulnerabilities found!" -ForegroundColor Yellow
    Write-Host "Running npm audit fix..." -ForegroundColor Yellow
    npm audit fix --force
}

# Create logs directory if it doesn't exist
if (-not (Test-Path "logs")) {
    Write-Host "Creating logs directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path "logs" -Force | Out-Null
}

# Run tests first
Write-Host "Running tests..." -ForegroundColor Yellow
npm test
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Tests failed! Please fix issues before starting service." -ForegroundColor Red
    exit 1
}

Write-Host "All tests passed!" -ForegroundColor Green

# Start the service
Write-Host ""
Write-Host "Starting service in development mode..." -ForegroundColor Cyan
Write-Host "Service will be available at: http://localhost:3005" -ForegroundColor Green
Write-Host "Health check: http://localhost:3005/health" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop the service" -ForegroundColor Yellow
Write-Host "=======================================" -ForegroundColor Cyan

npm run dev
