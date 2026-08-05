import { generateKeyPair, exportSPKI, exportPKCS8 } from 'jose'

export async function gerarParDeChaves() {
  const { publicKey, privateKey } = await generateKeyPair('RS256', {
    modulusLength: 2048,
    extractable: true,
  })

  const publicKeyPem = await exportSPKI(publicKey)
  const privateKeyPem = await exportPKCS8(privateKey)

  return { publicKeyPem, privateKeyPem }
}
