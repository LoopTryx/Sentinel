import {useRef,type ButtonHTMLAttributes,type PointerEvent} from "react";
import "./glass-action-button.css";
/** Owner-supplied glass button, scoped and sized for existing Console actions. */
export default function GlassActionButton({children,onPointerMove,onPointerLeave,...props}:ButtonHTMLAttributes<HTMLButtonElement>){
 const buttonRef=useRef<HTMLButtonElement>(null);
 const move=(event:PointerEvent<HTMLButtonElement>)=>{const button=buttonRef.current;if(button&&!button.disabled){const bounds=button.getBoundingClientRect();if(bounds.width&&bounds.height){button.style.setProperty("--light-x",`${Math.max(0,Math.min(100,(event.clientX-bounds.left)/bounds.width*100))}%`);button.style.setProperty("--light-y",`${Math.max(0,Math.min(100,(event.clientY-bounds.top)/bounds.height*100))}%`);}}onPointerMove?.(event);};
 const leave=(event:PointerEvent<HTMLButtonElement>)=>{buttonRef.current?.style.setProperty("--light-x","50%");buttonRef.current?.style.setProperty("--light-y","12%");onPointerLeave?.(event);};
 return <span className="glass-action-shell"><button type="button" {...props} ref={buttonRef} className={`glass-action-button ${props.className??""}`} onPointerMove={move} onPointerLeave={leave}><span className="glass-action-label">{children}</span></button></span>;
}
