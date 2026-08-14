import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getSmtpEnvStatus = createServerFn({ method: "GET" })
  .handler(async () => {
    return {
      host: !!process.env.SMTP_HOST,
      port: !!process.env.SMTP_PORT,
      user: !!process.env.SMTP_USER,
      pass: !!process.env.SMTP_PASSWORD,
      from: !!process.env.SMTP_FROM,
      values: {
        host: process.env.SMTP_HOST || "MISSING",
        port: process.env.SMTP_PORT || "MISSING",
        user: process.env.SMTP_USER || "MISSING",
      }
    };
  });
