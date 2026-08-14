import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sendEmail, generateEmailTemplate } from "./email.server";
import { logger } from "./logger";

export const testSmtpConnection = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ email: z.string().email() }).parse(data))
  .handler(async ({ data }) => {
    logger.info("smtp.test.started", { to: data.email });

    const html = generateEmailTemplate({
      title: "Teste de Conexão SMTP",
      message: "Se você recebeu este e-mail, as configurações do servidor SMTP (Gmail) estão funcionando corretamente no HSM Gestão.",
      details: [
        { label: "Servidor", value: process.env.SMTP_HOST || "Não configurado" },
        { label: "Usuário", value: process.env.SMTP_USER || "Não configurado" },
        { label: "Porta", value: process.env.SMTP_PORT || "587" },
      ]
    });

    const result = await sendEmail({
      to: data.email,
      subject: "HSM Gestão — Teste de SMTP",
      html,
    });

    if (result.success) {
      return { ok: true, message: "E-mail de teste enviado com sucesso!" };
    } else {
      return { 
        ok: false, 
        message: "Falha ao enviar e-mail.", 
        error: (result.error as Error)?.message || "Erro desconhecido"
      };
    }
  });
