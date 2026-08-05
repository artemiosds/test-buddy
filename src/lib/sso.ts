import { SignJWT, importPKCS8 } from 'jose'

interface UsuarioSSO {
  id: string
  nome: string
  email: string
  perfil: string
}

export async function gerarTokenSSO(usuario: UsuarioSSO): Promise<string> {
  const privateKeyPem = import.meta.env.VITE_SSO_PRIVATE_KEY || process.env.SSO_PRIVATE_KEY

  if (!privateKeyPem) {
    throw new Error('Chave privada SSO não configurada (SSO_PRIVATE_KEY)')
  }

  const privateKey = await importPKCS8(privateKeyPem, 'RS256')

  const token = await new SignJWT({
    sub:    usuario.id,
    email:  usuario.email,
    nome:   usuario.nome,
    name:   usuario.nome,
    perfil: usuario.perfil,
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer('https://gestao-saude-sms-oriximina.vercel.app')
    .setAudience('plantao-inteligente')
    .setIssuedAt()
    .setExpirationTime('60s')
    .setJti(crypto.randomUUID())
    .sign(privateKey)

  return token
}

export function gerarUrlSSO(token: string): string {
  return `https://plantao-inteligente.vercel.app/auth/sso?token=${token}`
}
