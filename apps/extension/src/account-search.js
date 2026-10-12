export function matchesAccount(account, query) {
 const text=String(query).trim().toLocaleLowerCase();
 return [account.name,account.user,account.host].some(value=>String(value??'').toLocaleLowerCase().includes(text));
}
