import {useEffect,useRef} from 'react';
import PasswordView from './PasswordView';
export default function ReplacementPopup({onUse,onClose}:{onUse:(password:string)=>void;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const el=dialog.current;if(el?.showModal)el.showModal();else el?.setAttribute('open','');return()=>el?.close?.();},[]);
 return <dialog ref={dialog} className="pm-generator pm-original-tools" aria-labelledby="generator-title" onCancel={e=>{e.preventDefault();onClose();}}><div className="pm-list-heading"><h3 id="generator-title">Generator & checker</h3><button className="pm-icon-button" aria-label="Close generator" onClick={onClose}>×</button></div><PasswordView onUse={onUse}/></dialog>;
}
