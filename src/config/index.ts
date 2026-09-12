import type { ServerFramework } from '../core/types.ts';

function parseArg(flag: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${flag}=`));
  if (arg) {
    return arg.split('=')[1];
  }
  return undefined;
}

function resolveFramework(): ServerFramework {
  const cliFramework = parseArg('framework');
  if (cliFramework && (cliFramework === 'express' || cliFramework === 'elysia')) {
    return cliFramework;
  }

  const envFramework = process.env.FRAMEWORK?.toLowerCase();
  if (envFramework === 'express' || envFramework === 'elysia') {
    return envFramework;
  }

  return 'elysia'; // Default high-performance framework
}

export const config = {
  framework: resolveFramework(),
  port: parseInt(parseArg('port') || process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
};
