# Test script untuk Notification Service
# Pastikan service sudah berjalan di port 3005

$baseUrl = "http://localhost:3005"
$serviceKey = "internal_service_secret_key_change_in_production"
$headers = @{
    'X-Internal-Service' = 'true'
    'X-Service-Key' = $serviceKey
    'Content-Type' = 'application/json'
}

Write-Host "🧪 Testing Notification Service..." -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# Test 1: Health Check
Write-Host "`n1. Testing Health Check..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/health" -Method GET
    $content = $response.Content | ConvertFrom-Json
    if ($content.success -eq $true) {
        Write-Host "✅ Health check passed" -ForegroundColor Green
        Write-Host "   Status: $($content.status)" -ForegroundColor Gray
        Write-Host "   Connections: $($content.connections.total)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Health check failed" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Health check error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Service Status (with auth)
Write-Host "`n2. Testing Service Status..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/notifications/status" -Method GET -Headers $headers
    $content = $response.Content | ConvertFrom-Json
    if ($content.success -eq $true) {
        Write-Host "✅ Service status check passed" -ForegroundColor Green
        Write-Host "   Status: $($content.status)" -ForegroundColor Gray
        Write-Host "   Connections: $($content.connections.total)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Service status check failed" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Service status error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Analysis Started Notification
Write-Host "`n3. Testing Analysis Started Notification..." -ForegroundColor Yellow
$startedPayload = @{
    userId = "123e4567-e89b-12d3-a456-426614174000"
    jobId = "123e4567-e89b-12d3-a456-426614174001"
    status = "started"
    message = "Test analysis started processing..."
    metadata = @{
        assessmentName = "Test Assessment"
        estimatedProcessingTime = "5-10 minutes"
    }
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/notifications/analysis-started" -Method POST -Headers $headers -Body $startedPayload
    $content = $response.Content | ConvertFrom-Json
    if ($content.success -eq $true) {
        Write-Host "✅ Analysis started notification passed" -ForegroundColor Green
        Write-Host "   Sent: $($content.data.sent)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Analysis started notification failed" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Analysis started error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Analysis Complete Notification
Write-Host "`n4. Testing Analysis Complete Notification..." -ForegroundColor Yellow
$payload = @{
    userId = "123e4567-e89b-12d3-a456-426614174000"
    jobId = "123e4567-e89b-12d3-a456-426614174001"
    resultId = "123e4567-e89b-12d3-a456-426614174002"
    status = "completed"
    message = "Test analysis completed successfully"
    metadata = @{
        assessmentName = "Test Assessment"
        processingTime = "7 minutes"
    }
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/notifications/analysis-complete" -Method POST -Headers $headers -Body $payload
    $content = $response.Content | ConvertFrom-Json
    if ($content.success -eq $true) {
        Write-Host "✅ Analysis complete notification passed" -ForegroundColor Green
        Write-Host "   Sent: $($content.data.sent)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Analysis complete notification failed" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Analysis complete error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: Analysis Failed Notification
Write-Host "`n5. Testing Analysis Failed Notification..." -ForegroundColor Yellow
$failedPayload = @{
    userId = "123e4567-e89b-12d3-a456-426614174000"
    jobId = "123e4567-e89b-12d3-a456-426614174003"
    error = "PROCESSING_ERROR"
    message = "Test analysis failed"
    metadata = @{
        assessmentName = "Test Assessment"
        errorType = "PROCESSING_ERROR"
    }
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/notifications/analysis-failed" -Method POST -Headers $headers -Body $failedPayload
    $content = $response.Content | ConvertFrom-Json
    if ($content.success -eq $true) {
        Write-Host "✅ Analysis failed notification passed" -ForegroundColor Green
        Write-Host "   Sent: $($content.data.sent)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Analysis failed notification failed" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Analysis failed error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: Authentication Test (should fail)
Write-Host "`n5. Testing Authentication (should fail)..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/notifications/status" -Method GET
    Write-Host "❌ Authentication test failed - should have been rejected" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "✅ Authentication properly rejected unauthorized request" -ForegroundColor Green
    } else {
        Write-Host "❌ Unexpected error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 6: Invalid Route (should return 404)
Write-Host "`n6. Testing 404 Handler..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/invalid-route" -Method GET
    Write-Host "❌ 404 test failed - should have returned 404" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host "✅ 404 handler working correctly" -ForegroundColor Green
    } else {
        Write-Host "❌ Unexpected error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n🎉 Testing completed!" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "Service is ready to accept connections!" -ForegroundColor Green
