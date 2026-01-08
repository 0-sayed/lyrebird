// Increase Jest's default timeout for NestJS module initialization and cleanup
// Default 5s can be insufficient for complex module dependency injection
jest.setTimeout(10000);
