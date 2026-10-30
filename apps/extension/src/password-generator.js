// Rejection sampling avoids modulo bias. No storage, network or site actions.
export function generatePassword(length, random = crypto, options) {
  if (!Number.isInteger(length) || length < 12 || length > 48) throw new Error('Choose a length from 12 to 48.');
  const groups={lower:'abcdefghijkmnopqrstuvwxyz',upper:'ABCDEFGHJKLMNPQRSTUVWXYZ',numbers:'23456789',symbols:'!@#$%*-_+?'};
  if(options&&(!Object.keys(options).every(k=>Object.hasOwn(groups,k)&&typeof options[k]==='boolean')))throw new Error('Invalid character options.');
  const selected=Object.entries(groups).filter(([k])=>!options||options[k]===true).map(([,v])=>v);
  const alphabet=selected.join('');if(!alphabet)throw new Error('Select a character group.');
  const cutoff = 256 - (256 % alphabet.length);
  let password = '';
  // Bound faulty providers too; native crypto normally finishes in one or two batches.
  for (let attempt = 0; attempt < 128 && password.length < length; attempt++) {
    const bytes = random.getRandomValues(new Uint8Array(64));
    for (const byte of bytes) {
      if (byte < cutoff) password += alphabet[byte % alphabet.length];
      if (password.length === length) break;
    }
    if(options&&password.length===length&&!selected.every(group=>[...password].some(c=>group.includes(c))))password='';
  }
  if (password.length !== length) throw new Error('Password generation unavailable. Try again.');
  return password;
}
