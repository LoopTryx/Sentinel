import {useDemoState} from '../demo-bridge';
import ConnectedVault from './ConnectedVault';
import './password-manager.css';
export default function PasswordManagerView(){
 const {state,error}=useDemoState();
 return state?<ConnectedVault state={state}/>:<section className="panel"><h2 className="page-title">Passwords</h2><p role="status">{error||'Connecting to the local account workspace…'}</p></section>;
}
