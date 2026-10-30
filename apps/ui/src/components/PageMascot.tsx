import welcome from '../assets/mascots/blue-welcome.png';
import investigate from '../assets/mascots/blue-investigate.png';
import alert from '../assets/mascots/red-alert.png';
import laptop from '../assets/mascots/duo-laptop.png';
import rescue from '../assets/mascots/duo-rescue.png';
import shield from '../assets/mascots/duo-shield.png';
import usb from '../assets/mascots/red-usb.png';
import './page-mascot.css';
const poses={dashboard:welcome,scan:shield,watchtower:investigate,usb,password:laptop,quarantine:rescue,log:alert};
/** Decoration only: never communicates a scan result or a protection guarantee. */
export default function PageMascot({page}:{page:keyof typeof poses}){
 return <img className={`page-mascot page-mascot--${page}`} src={poses[page]} alt="" aria-hidden="true" draggable={false} width={160} height={128} decoding="async"/>;
}
