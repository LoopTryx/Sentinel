export function parseConnectionCode(value){
 const match=/^sentinel:([1-9]\d{3,4}):([a-f0-9]{64})$/.exec(String(value).trim());
 if(!match)return null;
 const port=Number(match[1]);return port>=1024&&port<=65535?{port,token:match[2]}:null;
}
