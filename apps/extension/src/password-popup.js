// Same React vault and generator components as the native console.
const panel=document.querySelector('[data-panel=passwords]');
const frame=document.createElement('iframe');frame.title='Sentinel password manager';frame.src=chrome.runtime.getURL('src/console-ui/vault-console.html');frame.referrerPolicy='no-referrer';frame.style.cssText='display:block;width:100%;height:100%;min-height:0;border:0;background:transparent;color-scheme:normal;border-radius:16px';panel.replaceChildren(frame);
const embedded=window.top!==window;document.documentElement.classList.add(embedded?'vault-embedded':'vault-mode');
function resize(){const main=panel.closest('main');const available=main?.getBoundingClientRect().height||window.innerHeight-190;frame.style.height=Math.max(240,Math.floor(available)-4)+'px';}resize();window.addEventListener('resize',resize);if(typeof ResizeObserver!=='undefined')new ResizeObserver(resize).observe(panel.closest('main')||panel);
function switchPanel(){window.parent.postMessage({kind:'sentinel-panel-size',wide:document.querySelector('[data-view=passwords]')?.getAttribute('aria-pressed')==='true',view:document.querySelector('[data-view][aria-pressed=true]')?.dataset.view||'home'},'*');resize();}
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>queueMicrotask(switchPanel)));switchPanel();
