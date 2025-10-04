const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock environment variables
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.INTERNAL_SERVICE_KEY = 'test_service_key';
process.env.PORT = '3006'; // Use different port for testing
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

const { app, server } = require('../src/server');

describe('Notification Service', () => {
  afterAll((done) => {
    server.close(done);
  });

  describe('Health Check', () => {
    test('GET /health should return service status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        service: 'notification-service',
        status: 'healthy'
      });

      expect(response.body.connections).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Notification Routes', () => {
    const validHeaders = {
      'X-Internal-Service': 'true',
      'X-Service-Key': 'test_service_key'
    };

    describe('POST /notifications/analysis-started', () => {
      test('should accept valid analysis started notification', async () => {
        const payload = {
          userId: '123e4567-e89b-12d3-a456-426614174000',
          jobId: '123e4567-e89b-12d3-a456-426614174001',
          status: 'started',
          message: 'Your analysis has started processing...',
          metadata: {
            assessmentName: 'Test Assessment',
            estimatedProcessingTime: '5-10 minutes'
          }
        };

        const response = await request(app)
          .post('/notifications/analysis-started')
          .set(validHeaders)
          .send(payload)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          message: 'Notification sent'
        });

        expect(response.body.data).toMatchObject({
          userId: payload.userId,
          jobId: payload.jobId
        });
      });

      test('should reject request without service authentication', async () => {
        const payload = {
          userId: '123e4567-e89b-12d3-a456-426614174000',
          jobId: '123e4567-e89b-12d3-a456-426614174001',
          status: 'started'
        };

        await request(app)
          .post('/notifications/analysis-started')
          .send(payload)
          .expect(401);
      });

      test('should reject invalid payload', async () => {
        const invalidPayload = {
          userId: 'invalid-uuid',
          jobId: '123e4567-e89b-12d3-a456-426614174001',
          status: 'invalid-status'
        };

        await request(app)
          .post('/notifications/analysis-started')
          .set(validHeaders)
          .send(invalidPayload)
          .expect(400);
      });
    });

    describe('POST /notifications/analysis-complete', () => {
      test('should accept valid analysis complete notification', async () => {
        const payload = {
          userId: '123e4567-e89b-12d3-a456-426614174000',
          jobId: '123e4567-e89b-12d3-a456-426614174001',
          resultId: '123e4567-e89b-12d3-a456-426614174002',
          status: 'completed',
          message: 'Analysis completed successfully',
          metadata: {
            assessmentName: 'Test Assessment',
            processingTime: '7 minutes'
          }
        };

        const response = await request(app)
          .post('/notifications/analysis-complete')
          .set(validHeaders)
          .send(payload)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          message: 'Notification sent'
        });

        expect(response.body.data).toMatchObject({
          userId: payload.userId,
          jobId: payload.jobId,
          resultId: payload.resultId
        });
      });

      test('should reject request without service authentication', async () => {
        const payload = {
          userId: '123e4567-e89b-12d3-a456-426614174000',
          jobId: '123e4567-e89b-12d3-a456-426614174001',
          resultId: '123e4567-e89b-12d3-a456-426614174002',
          status: 'completed'
        };

        await request(app)
          .post('/notifications/analysis-complete')
          .send(payload)
          .expect(401);
      });

      test('should reject invalid payload', async () => {
        const invalidPayload = {
          userId: 'invalid-uuid',
          jobId: '123e4567-e89b-12d3-a456-426614174001',
          status: 'completed'
          // missing resultId
        };

        await request(app)
          .post('/notifications/analysis-complete')
          .set(validHeaders)
          .send(invalidPayload)
          .expect(400);
      });
    });

    describe('POST /notifications/analysis-failed', () => {
      test('should accept valid analysis failed notification', async () => {
        const payload = {
          userId: '123e4567-e89b-12d3-a456-426614174000',
          jobId: '123e4567-e89b-12d3-a456-426614174001',
          error: 'PROCESSING_ERROR',
          message: 'Failed to process the file',
          metadata: {
            assessmentName: 'Test Assessment',
            errorType: 'PROCESSING_ERROR'
          }
        };

        const response = await request(app)
          .post('/notifications/analysis-failed')
          .set(validHeaders)
          .send(payload)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          message: 'Notification sent'
        });

        expect(response.body.data).toMatchObject({
          userId: payload.userId,
          jobId: payload.jobId,
          error: payload.error
        });
      });

      test('should reject request without service authentication', async () => {
        const payload = {
          userId: '123e4567-e89b-12d3-a456-426614174000',
          jobId: '123e4567-e89b-12d3-a456-426614174001',
          error: 'PROCESSING_ERROR'
        };

        await request(app)
          .post('/notifications/analysis-failed')
          .send(payload)
          .expect(401);
      });
    });

    describe('GET /notifications/status', () => {
      test('should return service status with authentication', async () => {
        const response = await request(app)
          .get('/notifications/status')
          .set(validHeaders)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          service: 'notification-service',
          status: 'operational'
        });

        expect(response.body.connections).toBeDefined();
        expect(response.body.timestamp).toBeDefined();
      });

      test('should reject request without authentication', async () => {
        await request(app)
          .get('/notifications/status')
          .expect(401);
      });
    });
  });

  describe('404 Handler', () => {
    test('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown-route')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'NOT_FOUND'
        }
      });
    });
  });
});
