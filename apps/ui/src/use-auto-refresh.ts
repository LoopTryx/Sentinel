import {useEffect,useRef} from 'react';
export function useAutoRefresh(refresh:()=>Promise<void>,period:number,enabled=true){
 const action=useRef(refresh);action.current=refresh;
 useEffect(()=>{if(!enabled)return;let stopped=false;let timer:ReturnType<typeof setTimeout>;
  async function tick(){try{await action.current();}finally{if(!stopped)timer=setTimeout(()=>void tick(),period);}}
  void tick();return()=>{stopped=true;clearTimeout(timer);};
 },[period,enabled]);
}
