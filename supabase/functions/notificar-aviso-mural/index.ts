import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts"

const json = (data: any, status = 200) => 
  new Response(JSON.stringify(data), { 
    status, 
    headers: { "Content-Type": "application/json" } 
  })

Deno.serve(async (req) => {
  try {
    const { aviso_id } = await req.json()
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: aviso, error: avisoError } = await supabaseAdmin
      .from('avisos_mural')
      .select('*')
      .eq('id', aviso_id)
      .single()

    if (avisoError || !aviso) {
      return json({ ok: false, error: 'aviso_nao_encontrado' }, 404)
    }

    let query = supabaseAdmin.from('profiles')
      .select('user_id, email, nome, role, unidade_id')
      .eq('ativo', true)

    if (aviso.destinatarios?.tipo === 'perfis') {
      query = query.in('role', aviso.destinatarios.valores)
    } else if (aviso.destinatarios?.tipo === 'unidades') {
      query = query.in('unidade_id', aviso.destinatarios.valores)
    }

    const { data: destinatarios, error: destError } = await query
    if (destError) {
      return json({ ok: false, error: 'falha_buscar_destinatarios' }, 500)
    }

    const emailsValidos = destinatarios.filter(
      d => d.email && d.email.includes('@')
    )

    if (emailsValidos.length === 0) {
      return json({ ok: true, message: 'nenhum_destinatario_com_email' })
    }

    const client = new SMTPClient({
      connection: {
        hostname: Deno.env.get('SMTP_HOST')!,
        port: Number(Deno.env.get('SMTP_PORT')),
        tls: true,
        auth: {
          username: Deno.env.get('SMTP_USER')!,
          password: Deno.env.get('SMTP_PASSWORD')!,
        },
      },
    })

    const resultados = []
    for (const destinatario of emailsValidos) {
      try {
        await client.send({
          from: `HSM Gestão — SMS Oriximiná <${Deno.env.get('SMTP_FROM')!}>`,
          to: destinatario.email,
          subject: `📢 ${aviso.tipo === 'urgente' ? '[URGENTE] ' : ''}${aviso.titulo}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
              <div style="background-color: #0056b3; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 20px;">${aviso.titulo}</h1>
              </div>
              <div style="padding: 20px; line-height: 1.6; color: #333;">
                <p>Olá, <strong>${destinatario.nome}</strong>.</p>
                <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #0056b3; margin: 20px 0;">
                  ${aviso.mensagem.replace(/\n/g, '<br>')}
                </div>
                <p style="font-size: 14px; color: #666;">
                  Este é um aviso institucional emitido via HSM Gestão - Secretaria Municipal de Saúde de Oriximiná.
                </p>
                <div style="text-align: center; margin-top: 30px;">
                  <a href="${Deno.env.get('SITE_URL') ?? '#'}" style="background-color: #0056b3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Acessar o Sistema</a>
                </div>
              </div>
              <div style="background-color: #eee; padding: 15px; text-align: center; font-size: 12px; color: #888;">
                &copy; ${new Date().getFullYear()} SMS Oriximiná. Por favor, não responda a este e-mail.
              </div>
            </div>
          `,
        })
        resultados.push({ email: destinatario.email, status: 'enviado' })
      } catch (err) {
        console.error(`Falha ao enviar e-mail para ${destinatario.email}:`, err)
        resultados.push({ email: destinatario.email, status: 'falhou', error: err.message })
      }
    }

    await client.close()

    // Log the action
    await supabaseAdmin.from('action_logs').insert({
      usuario_id: '00000000-0000-0000-0000-000000000000', // System action
      acao: 'notificar_aviso_email',
      entidade: 'avisos_mural',
      entidade_id: aviso_id,
      detalhes: {
        total_destinatarios: emailsValidos.length,
        enviados: resultados.filter(r => r.status === 'enviado').length,
        falhas: resultados.filter(r => r.status === 'falhou').length,
      },
    })

    return json({ ok: true, resultados })
  } catch (err) {
    console.error('Erro na Edge Function:', err)
    return json({ ok: false, error: err.message }, 500)
  }
})
