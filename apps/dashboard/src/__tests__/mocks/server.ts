/**
 * MSW server setup for testing
 *
 * @see https://mswjs.io/docs/integrations/node
 */
import { setupServer } from 'msw/node';

import { handlers } from './api-handlers';

/**
 * MSW server instance for intercepting requests in tests
 *
 * Usage in setup.ts:
 * - beforeAll(() => server.listen())
 * - afterEach(() => server.resetHandlers())
 * - afterAll(() => server.close())
 */
export const server = setupServer(...handlers);
