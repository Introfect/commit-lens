import type { Config } from "@react-router/dev/config";
const base = "/home/";
export default {
  basename: base,
  routeDiscovery: {
    mode: "lazy",
    manifestPath: `${base}`,
  },  
  ssr: true,
  future: {
    unstable_viteEnvironmentApi: true,
  },
} satisfies Config;
