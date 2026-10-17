import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { afterEach } from 'bun:test';

GlobalRegistrator.register({ url: 'http://localhost:3000' });

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, writable: true });

// Imported after the DOM exists. Unmounts everything rendered by a test before the next one.
const { cleanup } = await import('@testing-library/react');
afterEach(() => cleanup());
