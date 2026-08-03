import nextConfig from 'eslint-config-next';

const config = [
  ...nextConfig,
  {
    ignores: ['.next/**', '.open-next/**', 'node_modules/**', 'tsconfig.tsbuildinfo'],
  },
];

export default config;
