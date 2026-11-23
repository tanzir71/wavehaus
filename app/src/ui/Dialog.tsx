import { useEffect,useId,useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { Icon } from './Icon';
export function Dialog({title,onClose,children}:{title:string;onClose:()=>void;children:ComponentChildren}){const ref=useRef<HTMLDialogElement>(null),id=useId();useEffect(()=>{ref.current?.showModal();return()=>ref.current?.close();},[]);return <dialog ref={ref} class="sheet" aria-labelledby={id} onCancel={e=>{e.preventDefault();onClose();}}><header><h2 id={id}>{title}</h2><button class="icon-button" aria-label={`Close ${title}`} onClick={onClose}><Icon name="x"/></button></header>{children}</dialog>;}
