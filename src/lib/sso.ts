import { SignJWT } from "jose";

export interface UsuarioSSO {
  id: string;
  nome: string;
  email: string;
  perfil?: string;
}

/**
 * Gera um token JWT assinado com o algoritmo HS256 para autenticação SSO.
 * Compatível com o servidor backend do Plantão Inteligente.
 */
export async function gerarTokenSSO(usuario: UsuarioSSO): Promise<string> {
  // 1. Tenta obter o segredo simétrico de várias fontes (Browser/Vite/Node/Deno) com fallback de contingência
  const jwtSecret =
    (typeof process !== "undefined" && process.env?.SSO_JWT_SECRET) ||
    (typeof process !== "undefined" && process.env?.VITE_SSO_JWT_SECRET);

  if (!jwtSecret) {
    throw new Error("Chave secreta SSO não configurada no servidor (SSO_JWT_SECRET ausente).");
  }

  // 2. Converte a chave secreta string em bytes para o algoritmo HS256 da lib jose
  const secretKey = new TextEncoder().encode(jwtSecret);

  // 3. Assina o token com as claims exigidas pelo provedor 'hsm' no Plantão Inteligente
  const token = await new SignJWT({
    sub: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    name: usuario.nome,
    perfil: usuario.perfil || "profissional",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("https://gestao-saude-sms-oriximina.vercel.app")
    .setAudience("plantao-inteligente")
    .setIssuedAt()
    .setExpirationTime("300s") // Válido por 5 minutos
    .setJti(crypto.randomUUID()) // Identificador único contra ataques de replay
    .sign(secretKey);

  return token;
}

/**
 * Monta a URL de redirecionamento SSO incluindo o token e o slug do provedor ('hsm').
 */
export function gerarUrlSSO(token: string): string {
  return `https://plantao-inteligente.vercel.app/auth/sso?token=${token}&provider=hsm`;
}
