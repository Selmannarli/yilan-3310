import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.shotparti.app",
  appName: "SHOT!",
  webDir: "dist-mobile",
  android: {
    backgroundColor: "#0d0911",
    allowMixedContent: false,
  },
};

export default config;
