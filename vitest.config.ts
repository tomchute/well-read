import { mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(viteConfig, {
  test: {
    include: ['tests/**/*.spec.ts', 'src/**/*.spec.ts'],
  },
});
