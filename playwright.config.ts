import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./web/test",
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL:
      process.env.LAB_TEST_URL ?? "http://127.0.0.1:5175/tinygpu-trace-lab/",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      args: [
        "--enable-webgl",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: process.env.LAB_TEST_URL
    ? undefined
    : {
        command: "npm run dev -- --port 5175 --strictPort",
        url: "http://127.0.0.1:5175/tinygpu-trace-lab/",
        reuseExistingServer: !process.env.CI,
      },
});
