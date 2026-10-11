import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Icon } from './Icon'

const focusableSelector='button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({ open, title, subtitle, children, onClose, size = 'md' }:{open:boolean;title:string;subtitle?:string;children:ReactNode;onClose:()=>void;size?:'sm'|'md'|'lg'|'xl'}) {
  const panelRef=useRef<HTMLElement>(null)
  const previousFocus=useRef<HTMLElement|null>(null)
  const closeRef=useRef(onClose)
  closeRef.current=onClose
  const titleId=useId();const subtitleId=useId()
  useEffect(()=>{
    if(!open)return
    previousFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null
    const timer=window.setTimeout(()=>{const panel=panelRef.current;const first=panel?.querySelector<HTMLElement>(focusableSelector);(first??panel)?.focus()},0)
    const keydown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();closeRef.current();return}
      if(event.key!=='Tab'||!panelRef.current)return
      const nodes=[...panelRef.current.querySelectorAll<HTMLElement>(focusableSelector)].filter(x=>x.offsetParent!==null)
      if(!nodes.length){event.preventDefault();panelRef.current.focus();return}
      const first=nodes[0],last=nodes[nodes.length-1]
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    }
    document.addEventListener('keydown',keydown)
    return()=>{window.clearTimeout(timer);document.removeEventListener('keydown',keydown);previousFocus.current?.focus()}
  },[open])
  if (!open) return null
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={subtitle?subtitleId:undefined}>
    <button className="modal-scrim" onClick={onClose} aria-label="Tutup dialog" tabIndex={-1}/>
    <section ref={panelRef} tabIndex={-1} className={`app-modal modal-${size}`}>
      <header className="app-modal-header"><div><h2 id={titleId}>{title}</h2>{subtitle && <p id={subtitleId}>{subtitle}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Tutup dialog"><Icon name="close"/></button></header>
      <div className="app-modal-body">{children}</div>
    </section>
  </div>
}
