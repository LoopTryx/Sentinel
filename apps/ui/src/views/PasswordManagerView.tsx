import PageMascot from '../components/PageMascot';
import {useDemoState} from '../demo-bridge';
import ConnectedVault from './ConnectedVault';
import './password-manager.css';
export default function PasswordManagerView(){
 const {state,error}=useDemoState();
 return state?<ConnectedVault state={state}/>:<section className="panel"><div className="page-mascot-heading"><h2 className="page-title">Passwords</h2><PageMascot page="password"/></div><p role="status">{error||'Connecting to the local account workspace…'}</p></section>;
}
