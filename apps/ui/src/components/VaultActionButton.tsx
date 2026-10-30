import type {ReactNode} from 'react';
export default function VaultActionButton({destroy=false,disabled,onClick,children}:{destroy?:boolean;disabled:boolean;onClick:()=>void;children:ReactNode}){
 return <button className={`btn vault-action ${destroy?'vault-destroy':'vault-restore'}`} disabled={disabled} onClick={onClick}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path className="vault-action-lid" d="M4 7h16M9 7V4h6v3"/><path d="m6 9 1 11h10l1-11"/>{destroy?<path className="vault-action-paper" d="M10 11v6m4-6v6"/>:<path className="vault-action-paper" d="M12 17V9m-3 3 3-3 3 3"/>}</svg>{children}</button>;
}
