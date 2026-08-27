import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/** Runs before every UI test file. Domain tests do not load this. */

afterEach(() => {
  cleanup();
});
