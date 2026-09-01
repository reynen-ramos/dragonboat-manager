import { describeAdapterContract } from '../adapterContract';
import { invalidateCache } from './db';
import { mockAdapter } from './index';

describeAdapterContract('mock', () => mockAdapter, () => {
  localStorage.clear();
  invalidateCache();
});
