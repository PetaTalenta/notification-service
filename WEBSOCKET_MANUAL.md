# Manual Koneksi WebSocket - ATMA Notification Service

## Overview

ATMA Notification Service menyediakan real-time notifications melalui WebSocket menggunakan Socket.IO. Service ini mengirimkan notifikasi untuk status analisis (started, completed, failed) kepada user yang sedang terhubung.

## Server Information

- **Service Name**: notification-service
- **Internal Port**: 3005
- **External Access**: Via API Gateway
- **Production WebSocket URL**: `https://api.chhrone.web.id`
- **Development WebSocket URL**: `http://localhost:3000`
- **Production HTTP Base URL**: `https://api.chhrone.web.id/api/notifications`
- **Development HTTP Base URL**: `http://localhost:3000/api/notifications`
- **Direct URL**: `http://localhost:3005` (langsung ke notification service - deprecated)
- **Protocol**: Socket.IO v4.7.2
- **Authentication**: JWT Token required (payload `{ id, email, iat, exp }`)
- **CORS**: Enabled untuk semua origins
- **Timeout**: 10 detik untuk autentikasi setelah connect

**⚠️ Important:** Gunakan API Gateway sebagai entry point untuk semua koneksi. Koneksi langsung ke notification service masih didukung untuk backward compatibility, tetapi tidak direkomendasikan.

## Konsep Dasar

### 1. Flow Koneksi
1. **Connect** ke server WebSocket
2. **Authenticate** dengan JWT token dalam 10 detik
3. **Listen** untuk events notifikasi
4. **Handle** disconnect dan reconnection

### 2. Authentication Flow
- Setelah connect, dalam 10 detik emit event `authenticate` dengan payload: `{ token: "<JWT>" }`
- Server akan respond dengan `authenticated` (sukses) atau `auth_error` (gagal) dan pada kegagalan koneksi akan diputus oleh server
- Token harus valid dan belum expired (akan mengirimkan error `Token expired` jika kedaluwarsa)
- User yang berhasil akan di-join ke room `user:{userId}` untuk notifikasi personal

### 3. Event Types
- **analysis-started**: Analisis dimulai
- **analysis-complete**: Analisis selesai dengan hasil
- **analysis-failed**: Analisis gagal dengan error message

## Implementasi Frontend

### 1. Install Dependency
```bash
npm install socket.io-client
```

### 2. Basic Setup
- Import socket.io-client
- Connect ke `https://api.chhrone.web.id` (Production) atau `http://localhost:3000` (Development)
- Set autoConnect: false untuk kontrol manual
- Setelah event `connect`, emit `authenticate` dengan payload `{ token: "<JWT>" }`

### 3. Event Handling
- Listen untuk `authenticated` dan `auth_error`
- Listen untuk notification events: `analysis-started`, `analysis-complete`, `analysis-failed`
- Handle `disconnect` dan `reconnect` events

### 4. JWT Token Requirements
Token harus berisi payload dengan field:
- `id`: User UUID
- `email`: User email
- `iat`: Issued at timestamp
- `exp`: Expiration timestamp

## Data Structure Events

### 1. Analysis Started Event
```
Event: 'analysis-started'
Data: {
  jobId: "uuid",
  status: "started",
  message: "Your analysis has started processing...",
  metadata: {
    assessmentName: "Assessment Name",
    estimatedProcessingTime: "5-10 minutes"
  },
  timestamp: "2024-01-01T12:00:00.000Z"
}
```

### 2. Analysis Complete Event
```
Event: 'analysis-complete'
Data: {
  jobId: "uuid",
  resultId: "uuid",
  status: "completed",
  message: "Your analysis is ready!",
  metadata: {
    assessmentName: "Assessment Name",
    processingTime: "7 minutes"
  },
  timestamp: "2024-01-01T12:00:00.000Z"
}
```

### 3. Analysis Failed Event
```
Event: 'analysis-failed'
Data: {
  jobId: "uuid",
  error: "Error message",
  message: "Analysis failed. Please try again.",
  metadata: {
    assessmentName: "Assessment Name",
    errorType: "PROCESSING_ERROR"
  },
  timestamp: "2024-01-01T12:00:00.000Z"
}
```

### 4. Authentication Events
```
Event: 'authenticated'
Data: {
  success: true,
  userId: "uuid",
  email: "user@example.com"
}

Event: 'auth_error'
Data: {
  message: "Token required" | "Authentication timeout" | "Invalid token" | "Token expired"
}
```

Catatan: Pada `auth_error`, server akan memutus koneksi socket.

## Connection Management

### 1. Connection States
- **Disconnected**: Belum connect atau terputus
- **Connected**: Terhubung tapi belum authenticated
- **Authenticated**: Terhubung dan sudah authenticated, siap menerima notifikasi

### 2. Reconnection Strategy
- Socket.IO otomatis melakukan reconnection
- Setelah reconnect, perlu authenticate ulang
- Default: 5 attempts dengan delay 1-5 detik

### 3. Error Handling
- **Authentication timeout**: Jika tidak authenticate dalam 10 detik, server akan mengirim `auth_error` lalu memutus koneksi
- **Invalid token**: Token tidak valid; untuk token kedaluwarsa, pesan akan berupa `Token expired`
- **Connection lost**: Network issues atau server restart

## Configuration Options

### Socket.IO Client Options
```javascript
{
  autoConnect: false,           // Manual connection control
  transports: ['websocket', 'polling'], // Transport methods
  reconnection: true,           // Enable auto-reconnection
  reconnectionAttempts: 5,      // Max reconnection attempts
  reconnectionDelay: 1000,      // Initial delay between attempts
  reconnectionDelayMax: 5000,   // Maximum delay between attempts
  timeout: 20000,               // Connection timeout
  forceNew: false              // Reuse existing connection
}
```

### Environment Variables
- **Production**: `https://api.chhrone.web.id`
- **Development**: `http://localhost:3000` (via API Gateway)
- **Direct Access**: `http://localhost:3005` (deprecated)
- **JWT Secret**: `JWT_SECRET` (wajib sama dengan service lain agar verifikasi token berhasil)
- **Ping/Timeout**: `SOCKET_PING_TIMEOUT` dan `SOCKET_PING_INTERVAL` (opsional; default 60000/25000 ms)
- **CORS**: Sudah dikonfigurasi allow all origins untuk dev


## Internal HTTP Endpoints (untuk layanan internal)

Semua endpoint di bawah ini diakses via API Gateway base URL: `/api/notifications/*` dan membutuhkan headers:
- `X-Internal-Service: true`
- `X-Service-Key: <INTERNAL_SERVICE_KEY>`

### POST /analysis-started
Body:
- `userId` (UUID, required)
- `jobId` (UUID, required)
- `status` ("started", required)
- `message` (string, optional)
- `metadata` (object, optional: `assessmentName`, `estimatedProcessingTime`)

### POST /analysis-complete
Body:
- `userId` (UUID, required)
- `jobId` (UUID, required)
- `resultId` (UUID, required)
- `status` ("completed", required)
- `message` (string, optional)
- `metadata` (object, optional: `assessmentName`, `processingTime`)

### POST /analysis-failed
Body:
- `userId` (UUID, required)
- `jobId` (UUID, required)
- `error` (string, required)
- `message` (string, optional)
- `metadata` (object, optional: `assessmentName`, `errorType`)

### GET /status
- Mengembalikan ringkasan koneksi dan status service.

Catatan: Endpoint HTTP di atas ditujukan untuk komunikasi antar-service (mis. analysis-worker -> notification-service) dan tidak untuk diakses langsung dari frontend.

## Testing & Debugging

### 1. Manual Testing
- Connect ke `https://api.chhrone.web.id` (Production) atau `http://localhost:3000` (Development) dengan Socket.IO client
- Test authentication dengan valid JWT token
- Verify events diterima dengan benar

### 2. Debug Mode
- Enable debug dengan `localStorage.debug = 'socket.io-client:socket'`
- Monitor network tab untuk WebSocket connections
- Check console logs untuk connection events

### 3. Health Check Endpoint
- `GET https://api.chhrone.web.id/api/notifications/health` (Production)
- `GET http://localhost:3000/api/notifications/health` (Development)
- `GET http://localhost:3005/health` (direct ke notification service - deprecated)
- Response berisi connection count, consumer status, dan service status

## Production Considerations

### 1. Environment Setup
- Set proper SOCKET_URL untuk production
- Configure CORS origins untuk security
- Use HTTPS/WSS untuk production

### 2. Token Management
- Handle token expiry dengan refresh mechanism
- Implement graceful logout dengan socket disconnect
- Store token securely (httpOnly cookies recommended)

### 3. Performance
- Implement connection pooling
- Handle memory leaks dengan proper cleanup
- Monitor connection count dan resource usage

## Troubleshooting

### Common Issues
1. **CORS Error**: Service sudah dikonfigurasi allow all origins untuk development
2. **Authentication Timeout**: Emit `authenticate` dalam 10 detik setelah connect
3. **Token Invalid/Expired**: Pastikan JWT token valid; jika kedaluwarsa, server mengirim `Token expired`
4. **Connection Failed**: Periksa service berjalan di port 3005

### Debug Steps
1. Check service status: `GET https://api.chhrone.web.id/api/notifications/health` (Production) atau `GET http://localhost:3000/api/notifications/health` (Development)
2. Enable debug mode: `localStorage.debug = 'socket.io-client:socket'`
3. Monitor network tab untuk WebSocket connections
4. Verify JWT token payload (`id`, `email`) dan `exp`

## Framework Integration

### React
- Gunakan `useEffect` untuk lifecycle management
- Implement custom hook untuk reusable logic
- Handle state dengan `useState` untuk connection status dan notifications

### Vue.js
- Gunakan `onMounted`/`onUnmounted` untuk lifecycle
- Implement composable dengan `ref` untuk reactive state
- Watch token changes untuk re-authentication

### Angular
- Create service dengan dependency injection
- Use `BehaviorSubject` untuk reactive state management
- Implement proper cleanup dalam `ngOnDestroy`

### Vanilla JavaScript
- Use event listeners untuk socket events
- Manage DOM updates manually
- Store connection reference globally atau dalam module

## Frontend Best Practices

### 1. Connection Management
- Gunakan satu koneksi per user session
- Disconnect saat user logout atau component unmount
- Handle reconnection dengan re-authentication

### 2. State Management
- Track connection status (disconnected/connected/authenticated)
- Store notifications dalam state/store
- Clear notifications saat tidak diperlukan

### 3. Error Handling
- Handle authentication errors dengan redirect ke login
- Show user-friendly messages untuk connection issues
- Implement retry mechanism untuk failed connections

### 4. Performance
- Debounce rapid notifications
- Limit notification history untuk prevent memory issues
- Use efficient rendering untuk notification list

## Implementation Checklist untuk Frontend

### ✅ Basic Setup
- [ ] Install `socket.io-client`
- [ ] Setup connection ke `https://api.chhrone.web.id` (Production) atau `http://localhost:3000` (Development)
- [ ] Implement authentication dengan JWT token
- [ ] Handle connection states

### ✅ Event Handling
- [ ] Listen untuk `analysis-started` events
- [ ] Listen untuk `analysis-complete` events
- [ ] Listen untuk `analysis-failed` events
- [ ] Handle authentication events (`authenticated`, `auth_error`)

### ✅ UI Components
- [ ] Connection status indicator
- [ ] Notification display component
- [ ] Notification actions (mark as read, dismiss)
- [ ] Error message display

### ✅ State Management
- [ ] Track connection status
- [ ] Store notifications array
- [ ] Handle notification lifecycle
- [ ] Integrate dengan app state management

### ✅ Production Ready
- [ ] Environment variables untuk WebSocket URL
- [ ] Error boundaries untuk WebSocket errors
- [ ] Graceful degradation jika WebSocket tidak tersedia
- [ ] Token refresh handling
