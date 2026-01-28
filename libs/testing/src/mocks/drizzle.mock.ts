/**
 * Mock implementations for Drizzle ORM query builders
 *
 * Provides chainable mock query builders for unit testing repositories
 * without requiring a real database connection.
 */

/**
 * Type for mock query builder methods
 */
type MockQueryBuilder = Record<string, jest.Mock>;

/**
 * Creates a chainable mock Drizzle query builder for testing
 *
 * All methods return the builder for chaining except terminal methods
 * (returning, where for selects, from for selects, groupBy).
 * Configure return values on terminal methods for specific test cases.
 *
 * @example
 * const mockDb = createMockDrizzleQueryBuilder();
 * mockDb.returning.mockResolvedValue([mockJob]);
 * // Now mockDb.insert().values({}).returning() will resolve to [mockJob]
 */
export function createMockDrizzleQueryBuilder(): MockQueryBuilder {
  const builder: MockQueryBuilder = {};

  // All methods return builder for chaining
  builder.insert = jest.fn().mockReturnValue(builder);
  builder.values = jest.fn().mockReturnValue(builder);
  builder.returning = jest.fn();
  builder.select = jest.fn().mockReturnValue(builder);
  builder.from = jest.fn().mockReturnValue(builder);
  builder.where = jest.fn().mockReturnValue(builder);
  builder.update = jest.fn().mockReturnValue(builder);
  builder.set = jest.fn().mockReturnValue(builder);
  builder.delete = jest.fn().mockReturnValue(builder);
  builder.onConflictDoNothing = jest.fn().mockReturnValue(builder);
  builder.groupBy = jest.fn();

  return builder;
}

export type MockDrizzleQueryBuilder = ReturnType<
  typeof createMockDrizzleQueryBuilder
>;
