import {t} from './i18n';
import './search-clear.css';
export function SearchClearButton({value,onClear}){
 if(!value)return null;
 return <button type="button" className="search-clear" aria-label={t('Tyhjennä haku')} title={t('Tyhjennä haku')} onPointerDown={event=>event.preventDefault()} onClick={event=>{const input=event.currentTarget.closest('form')?.querySelector('input');onClear();input?.focus();}}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></button>;
}
