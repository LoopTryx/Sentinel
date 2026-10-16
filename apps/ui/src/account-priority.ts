export function accountPriority(account:{health:string;reused:boolean}):'high'|'medium'|'low'|'unknown'{
 if(account.reused||['Very weak','Weak'].includes(account.health))return 'high';
 if(account.health==='Stronger')return 'low';
 if(['Moderate','Fair','Good'].includes(account.health))return 'medium';
 return 'unknown';
}
