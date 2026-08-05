import { generateKeyPair, exportSPKI, exportPKCS8 } from 'jose'

/**
 * Gera um par de chaves RSA-256 no formato PEM.
 * Funciona tanto em ambiente Node/Edge quanto no Browser (Web Crypto API).
 */
export async function gerarParDeChaves() {
  // O jose usa a Web Crypto API no browser e a crypto do Node no servidor
  const { publicKey, privateKey } = await generateKeyPair('RS256', {
    modulusLength: 2048,
    extractable: true,
  })

  const publicKeyPem = await exportSPKI(publicKey)
  const privateKeyPem = await exportPKCS8(privateKey)

  return { publicKeyPem, privateKeyPem }
}
