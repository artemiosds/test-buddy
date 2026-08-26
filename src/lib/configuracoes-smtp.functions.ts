import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureMaster } from "./authz.server";

const MASCARA = "••••••••";

const formSchema = z.object({
  smtp_host: z.string().trim().min(1, "Informe o servidor SMTP"),
  smtp_port: z.number().int().min(1).max(65535),
  smtp_user: z.string().trim().min(1, "Informe o usuário de autenticação"),
  smtp_password: z.string().default(""),
  smtp_from_email: z.string().trim().email("E-mail do remetente inválido").or(z.literal("")),
  smtp_from_name: z.string().trim().default("HSM Gestão — SMS Oriximiná"),
  smtp_secure: z.boolean().default(false),
  smtp_ativo: z.boolean().default(true),
});

export const obterConfiguracaoSMTP = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureMaster(context.supabase, context.userId);
    const { lerConfigSmtpDb } = await import("./configuracoes-smtp.server");
    const row = await lerConfigSmtpDb();

    if (row) {
      return {
        existe: true as const,
        origem: "banco" as const,
        tem_senha_salva: !!row.smtp_password,
        smtp_host: row.smtp_host ?? "",
        smtp_port: row.smtp_port ?? 587,
        smtp_user: row.smtp_user ?? "",
        smtp_password: row.smtp_password ? MASCARA : "",
        smtp_from_email: row.smtp_from_email ?? "",
        smtp_from_name: row.smtp_from_name ?? "",
        smtp_secure: !!row.smtp_secure,
        smtp_ativo: !!row.smtp_ativo,
        updated_at: row.updated_at ?? null,
      };
    }

    const host = process.env.SMTP_HOST || process.env.VITE_SMTP_HOST || "";
    const user = process.env.SMTP_USER || process.env.VITE_SMTP_USER || "";
    const port = Number(process.env.SMTP_PORT || process.env.VITE_SMTP_PORT || 587);
    const temSenhaEnv = !!(process.env.SMTP_PASSWORD || process.env.VITE_SMTP_PASSWORD);

    return {
      existe: false as const,
      origem: "env" as const,
      tem_senha_salva: temSenhaEnv,
      smtp_host: host,
      smtp_port: port || 587,
      smtp_user: user,
      smtp_password: temSenhaEnv ? MASCARA : "",
      smtp_from_email: process.env.SMTP_FROM || process.env.VITE_SMTP_FROM || user,
      smtp_from_name: process.env.SMTP_FROM_NAME || "HSM Gestão — SMS Oriximiná",
      smtp_secure: port === 465,
      smtp_ativo: true,
      updated_at: null as string | null,
    };
  });

export const salvarConfiguracaoSMTP = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => formSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureMaster(context.supabase, context.userId);
    const { lerConfigSmtpDb, CHAVE_SMTP } = await import("./configuracoes-smtp.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const atual = await lerConfigSmtpDb();
    const senhaInformada = data.smtp_password?.trim() ?? "";
    const manterSenha = senhaInformada === "" || senhaInformada === MASCARA;

    let senhaFinal = manterSenha ? (atual?.smtp_password ?? null) : senhaInformada;
    if (manterSenha && !atual?.smtp_password) {
      // primeiro salvamento: herda a senha do ambiente, se houver
      senhaFinal = process.env.SMTP_PASSWORD || process.env.VITE_SMTP_PASSWORD || null;
    }

    const payload = {
      chave: CHAVE_SMTP,
      smtp_host: data.smtp_host,
      smtp_port: data.smtp_port,
      smtp_user: data.smtp_user,
      smtp_password: senhaFinal,
      smtp_from_email: data.smtp_from_email || data.smtp_user,
      smtp_from_name: data.smtp_from_name || "HSM Gestão — SMS Oriximiná",
      smtp_secure: data.smtp_secure,
      smtp_ativo: data.smtp_ativo,
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    };

    const { error } = await supabaseAdmin
      .from("configuracoes_sistema" as never)
      .upsert(payload as never, { onConflict: "chave" });

    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const testarConexaoSMTP = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => formSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureMaster(context.supabase, context.userId);
    const { lerConfigSmtpDb, criarTransporter } = await import("./configuracoes-smtp.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const senhaInformada = data.smtp_password?.trim() ?? "";
    let senha = senhaInformada;
    if (senha === "" || senha === MASCARA) {
      const atual = await lerConfigSmtpDb();
      senha =
        atual?.smtp_password ||
        process.env.SMTP_PASSWORD ||
        process.env.VITE_SMTP_PASSWORD ||
        "";
    }
    if (!senha) {
      return { sucesso: false as const, erro: "Nenhuma senha informada nem salva anteriormente.", codigo: "SEM_SENHA" };
    }

    const { data: usuario } = await supabaseAdmin
      .from("usuarios")
      .select("email, nome_completo")
      .eq("id", context.userId)
      .maybeSingle();

    const destino = (usuario?.email as string | undefined) ?? "";
    if (!destino.includes("@")) {
      return { sucesso: false as const, erro: "Seu usuário não possui e-mail cadastrado para receber o teste.", codigo: "SEM_DESTINO" };
    }

    const remetente = data.smtp_from_email || data.smtp_user;
    const transporter = criarTransporter({
      host: data.smtp_host,
      port: data.smtp_port,
      secure: data.smtp_secure,
      user: data.smtp_user,
      pass: senha,
    });

    try {
      await transporter.verify();
      await transporter.sendMail({
        from: `"${data.smtp_from_name || "HSM Gestão"}" <${remetente}>`,
        to: destino,
        subject: "HSM Gestão — Teste de configuração SMTP",
        text: "Conexão SMTP validada com sucesso pelo painel de Configurações do Sistema.",
        html: `<p>Olá${usuario?.nome_completo ? `, <strong>${usuario.nome_completo}</strong>` : ""}.</p>
               <p>A conexão com o servidor <strong>${data.smtp_host}:${data.smtp_port}</strong> foi validada e este e-mail de teste foi enviado com sucesso.</p>
               <p style="color:#718096;font-size:12px">${new Date().toLocaleString("pt-BR")}</p>`,
      });
      return {
        sucesso: true as const,
        mensagem: `Conexão estabelecida e e-mail de teste enviado para ${destino}.`,
      };
    } catch (error) {
      const e = error as { message?: string; code?: string; responseCode?: number };
      return {
        sucesso: false as const,
        erro: e?.message ?? "Falha desconhecida ao conectar no servidor SMTP.",
        codigo: e?.code ?? (e?.responseCode ? String(e.responseCode) : "ERRO"),
      };
    }
  });
