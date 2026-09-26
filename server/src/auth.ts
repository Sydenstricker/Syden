import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { SignJWT, jwtVerify } from 'jose';
import { config } from './config.js';
import type { User } from './db.js';

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(expected, actual);
}

/**
 * O token leva o número da sessão junto. Como um token assinado não pode ser apagado depois de sair
 * daqui, é comparando esse número com o que está no banco que o servidor consegue derrubar sessões:
 * basta o número do banco mudar e todo token antigo deixa de valer no pedido seguinte.
 */
export function signSession(user: User, sessionVersion: number): Promise<string> {
  return new SignJWT({ username: user.username, sv: sessionVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(config.jwtSecret);
}

export type Sessao = { userId: number; sessionVersion: number };

/** Lê o token. Devolve null se ele for inválido, adulterado ou vencido. */
export async function verifySession(token: string | undefined): Promise<Sessao | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, config.jwtSecret);
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId)) return null;
    // Tokens emitidos antes desta mudança não têm o número; valem como sessão 1, que é o padrão do banco.
    return { userId, sessionVersion: typeof payload.sv === 'number' ? payload.sv : 1 };
  } catch {
    return null;
  }
}
