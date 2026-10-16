export function generateReplacement(length:number,upper:boolean,digits:boolean,symbols:boolean,random:Pick<Crypto,'getRandomValues'>=crypto){
 if(!Number.isInteger(length)||length<12||length>48)throw new Error('Choose a length from 12 to 48.');
 let chars='abcdefghijkmnopqrstuvwxyz';if(upper)chars+='ABCDEFGHJKLMNPQRSTUVWXYZ';if(digits)chars+='23456789';if(symbols)chars+='!@#$%^&*-_=+?';
 const cutoff=256-256%chars.length;let result='';
 for(let round=0;round<128&&result.length<length;round++){const bytes=random.getRandomValues(new Uint8Array(64));for(const byte of bytes)if(byte<cutoff&&result.length<length)result+=chars[byte%chars.length];}
 if(result.length!==length)throw new Error('Random generation unavailable');return result;
}
