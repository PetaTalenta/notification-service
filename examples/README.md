# WebSocket Implementation Examples

Direktori ini berisi contoh implementasi WebSocket client untuk berbagai framework.

## Available Examples

Saat ini belum ada contoh implementasi. Silakan refer ke [WEBSOCKET_MANUAL.md](../WEBSOCKET_MANUAL.md) untuk panduan implementasi.

## Framework Support

Manual mendukung implementasi untuk:
- React (dengan hooks)
- Vue.js (dengan composables)
- Angular (dengan services)
- Vanilla JavaScript

## Quick Reference

### Basic Connection Flow
1. Install `socket.io-client`
2. Connect ke `https://api.chhrone.web.id` (Production) atau `http://localhost:3000` (Development)
3. Emit `authenticate` dengan JWT token
4. Listen untuk notification events

### Key Events
- `analysis-started`: Analisis dimulai
- `analysis-complete`: Analisis selesai
- `analysis-failed`: Analisis gagal

Untuk detail lengkap, lihat [WEBSOCKET_MANUAL.md](../WEBSOCKET_MANUAL.md).
