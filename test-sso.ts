
import { SignJWT, jwtVerify } from "jose";

async function testSSO() {
  const privateKey = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDpp5RSM933Fykd
IHqX0bh15lLEdgP7u/j35R9pvJdCFlFvpfagVRBobB/hq/AXvREqVF4d28C5iZdq
WEFtxxD1RpwyHCa7YgYrrPBs/TFcfBng3ZsywNm05Ntxy4A6U7hLqdtfE5yiMrs7
QAnO18SNWkmjmpEH06JtlDfK3jMhBqOpCsmoS7gyC5vIg7P7BCfmYJgo+rKQD5/3
JUcvMlFpXGMI5tBmHPtM+nY6SVnLRPKOs+TG2z5Z2A6P1nCF5CaKzBRu/a3rFlc9
wE3yg8n+uhaXymmLM1LrbfBXHtPjjwPQgticmC+Ee6H5EHfUS8Dq05uSMdnTZoCF
PSxXeNxpAgMBAAECggEAAO7fq3wl3/IEO6CZvoKw1514d7PUSMx3NXTk19UXI/5B
0uNgLHxMQfoN5d+KS/mHJtq8LUNZWKDIbYRZfTVaeV9lNGci7ufcQQD0FC4DVtco
Qb537UEgrzkWFUNsEGTma1koXGUeYKCOrr+Axvf3gs/j4fNSkiwKsWfkEdC4y6k9
HhvP2K6D6JXxtfQWRMUwb8hnuihPqsGePdVBjXihCymWk8bzohTeZWe+vZFFvtZ8
m6q8RTJe/OGJEZBSIzyM/G+AYKmMB9/c5rrjJXlkkDeQQVbdRhfCIJRvZVwwSyzh
4i5KlnnB7rrREwX7dFkGo6ZIJkIvsuJPFY6eWoBJQQKBgQD1lA4mC5ImnlgAGvs2
x+X6+n8qEu7fSktca1FVU+ObkSnCsfKH/M40og9ZeH6yeMRkPMpLonUAwx7kLewu
/ojFgMkwSWlEcqc6sWQbd3rxlTkoad/j4C3WnrJ/MfD3KPXyv5lWHNtiyIed1ls8
2ghDCBeSFXsWWWRqKfxKjIetEQKBgQDzkfxNfPZJsZ/dNFVauWGSurGZqRwHDDZh
wNAJDiflfPBsCEtsu6HimkK69rT91XQ4F/mixcMlYL10FJZfvZFkv2nVJstu+zpZ
NeSozrxL8S1vf0GTBgLTL6cyT1+mrx9y0WEtaWRCcvJqIHqeQv2tJ1Xo5cCkG4B2
BNDrIYiZ2QKBgCoLEvEIghkCeuZpuCCE0KbLRAIcA7FOsuA7r00Ac7Mqgw/GD1Og
wFzace5LZsV/T4ApuCiCw61BuoQuKIVTJm9JwSf3KYKCbobp382kAvRhK8vzdFU7
CB36RWzpS+vEo3bPvpyzjAu5cR5gmHYujcOMGxzzeIM3Aq36SispLAFBAoGBALLo
BhS8twMGT1BhwlgzVrI6I32ks4uRstg2khg0p6VvEgGoTg59+7jAakd+Mw9HnGgf
ZCPlcyOfXUlIXfPRAFyqJIiGSGMqcX9ZkK1VvQVjD2aYaIgfoC+TDxJrLuz2MPlb
Ri/e+9+7IshFNwvMVRy8iePZ7pgcA02s1+/936JxAoGBAMIstgKVdvMz7DkSwbPU
EpkuNGR/Rkhd/i2Sh0hW7XBe3RVesEwvALa3M1ooXzvvCvVtboLDw//7PjP17B9k
gzlrYcEKNLst41S92XT7ZF7iO2XQe0gtobYvQusd+htNW7AQfCGZTTqfIJCWhqW1
u4CJ80dHI9T6oQA6mBFlUIm3
-----END PRIVATE KEY-----`;

  const issuer = "https://gestao-saude-sms-oriximina.vercel.app";
  const audience = "plantao-inteligente";
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    iss: issuer,
    aud: audience,
    iat: now,
    exp: now + 300,
    sub: "test-user",
    name: "Test User"
  };

  const secretKey = new TextEncoder().encode(privateKey);
  
  try {
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt(now)
      .setExpirationTime(now + 300)
      .sign(secretKey);
    
    console.log("Token gerado com sucesso!");
    console.log("Token:", token);
    
    // Validar localmente
    const { payload: verifiedPayload } = await jwtVerify(token, secretKey, {
      issuer,
      audience
    });
    
    console.log("Validação local OK!");
    console.log("Payload verificado:", JSON.stringify(verifiedPayload));
  } catch (err) {
    console.error("Erro no teste:", err);
  }
}

testSSO();
