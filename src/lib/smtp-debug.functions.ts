import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getSmtpEnvStatus = createServerFn({ method: "GET" })
  .handler(async () => {
    return {
      host: !!(process.env.SMTP_HOST || process.env.VITE_SMTP_HOST),
      port: !!(process.env.SMTP_PORT || process.env.VITE_SMTP_PORT),
      user: !!(process.env.SMTP_USER || process.env.VITE_SMTP_USER),
      pass: !!(process.env.SMTP_PASSWORD || process.env.VITE_SMTP_PASSWORD),
      from: !!(process.env.SMTP_FROM || process.env.VITE_SMTP_FROM),
      values: {
        host: process.env.SMTP_HOST || process.env.VITE_SMTP_HOST || "MISSING",
        port: process.env.SMTP_PORT || process.env.VITE_SMTP_PORT || "MISSING",
        user: process.env.SMTP_USER || process.env.VITE_SMTP_USER || "MISSING",
      }
    };
  });
