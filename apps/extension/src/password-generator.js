// Rejection sampling avoids modulo bias. No storage, network or site actions.
export function generatePassword(length, random = crypto) {
  if (!Number.isInteger(length) || length < 12 || length > 48) throw new Error('Choose a length from 12 to 48.');
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%*-_+?';
  const cutoff = 256 - (256 % alphabet.length);
  let password = '';
  // Bound faulty providers too; native crypto normally finishes in one or two batches.
  for (let attempt = 0; attempt < 32 && password.length < length; attempt++) {
    const bytes = random.getRandomValues(new Uint8Array(64));
    for (const byte of bytes) {
      if (byte < cutoff) password += alphabet[byte % alphabet.length];
      if (password.length === length) break;
    }
  }
  if (password.length !== length) throw new Error('Password generation unavailable. Try again.');
  return password;
}
