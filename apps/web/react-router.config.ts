import type { Config } from "@react-router/dev/config";

export default {
  ssr: true,
  future: {
    unstable_viteEnvironmentApi: true,
    // @ts-expect-error v8_middleware is a valid future flag but types might be outdated
    v8_middleware: true,
  },
} satisfies Config;
