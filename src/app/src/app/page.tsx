'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './lib/supabase'

type Status = 'Планування'|'В процесі'|'Готово'|'Потрібна увага'|'Завершено'
type Priority = 'Низький'|'Середній'|'Високий'|'Критичний'
type EventType = 'Весілля'|'Корпоратив'|'День народження'|'Ювілей'|'Банкет'|'Конференція'|'Інше'
interface Event { id:string; title:string; type:EventType; date:string; guests:number; budget:number; status:Status; clientName:string; progress:number; hall:string; notes:string }
interface Task  { id:string; title:string; description:string; assignee:string; deadline:string; status:'Відкрита'|'Виконано'; priority:Priority; eventTitle:string }
interface Client{ id:string; name:string; phone:string; email:string; notes:string; debt:number }
interface Contractor{ id:string; name:string; category:string; phone:string; price:string; rating:number; available:boolean; notes:string }
interface Payment{ id:string; description:string; amount:number; type:'Дохід'|'Витрата'; date:string; status:'Оплачено'|'Очікується'; eventTitle:string }
interface ChatMsg{ role:'user'|'assistant'; content:string }

const uid = () => Math.random().toString(36).slice(2,9)
const todayStr = () => new Date().toISOString().split('T')[0]
const fmtDate = (d:string) => d ? new Date(d+'T00:00:00').toLocaleDateString('uk-UA',{day:'2-digit',month:'short'}) : '—'
const fmtMoney = (n:number) => n ? n.toLocaleString('uk-UA')+' грн' : '—'
const initials = (name:string) => name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)

const DEF_EVENTS:Event[] = [
  {id:uid(),title:'Весілля Коваленко',type:'Весілля',date:'2025-08-28',guests:120,budget:180000,status:'В процесі',clientName:'Олексій Коваленко',progress:67,hall:'Зал А',notes:''},
  {id:uid(),title:'Корпоратив ТехСтарт',type:'Корпоратив',date:'2025-07-17',guests:80,budget:95000,status:'Планування',clientName:'Марина Петренко',progress:40,hall:'Зал Б',notes:''},
]
const DEF_TASKS:Task[] = [
  {id:uid(),title:'Підтвердити меню — Коваленко',description:'Кейтеринг «Смак»',assignee:'Я',deadline:todayStr(),status:'Відкрита',priority:'Критичний',eventTitle:'Весілля Коваленко'},
  {id:uid(),title:'Нагадати клієнту про оплату',description:'Борг 15 000 грн',assignee:'Я',deadline:todayStr(),status:'Відкрита',priority:'Критичний',eventTitle:''},
]
const DEF_CLIENTS:Client[] = [
  {id:uid(),name:'Олексій Коваленко',phone:'+380671234567',email:'kovalenko@email.com',notes:'Весілля 28 серпня',debt:54000},
  {id:uid(),name:'Василь Мороз',phone:'+380509876543',email:'moroz@email.com',notes:'Ювілей у вересні',debt:15000},
]
const DEF_CONTRACTORS:Contractor[] = [
  {id:uid(),name:'DJ Макс',category:'DJ',phone:'+380671112233',price:'від 8 000 грн',rating:5,available:true,notes:'Надійний'},
  {id:uid(),name:'Артур Кравець',category:'Фотограф',phone:'+380954445566',price:'від 15 000 грн',rating:4,available:true,notes:''},
]

const CHIP:Record<string,{bg:string,tx:string,bd:string}> = {
  'Весілля':{bg:'#EEEDFE',tx:'#3C3489',bd:'#AFA9EC'},
  'Корпоратив':{bg:'#E6F1FB',tx:'#0C447C',bd:'#85B7EB'},
  'День народження':{bg:'#FAEEDA',tx:'#633806',bd:'#EF9F27'},
  'Ювілей':{bg:'#FBEAF0',tx:'#72243E',bd:'#ED93B1'},
  'Банкет':{bg:'#E1F5EE',tx:'#085041',bd:'#5DCAA5'},
  'Конференція':{bg:'#E6F1FB',tx:'#0C447C',bd:'#85B7EB'},
  'Інше':{bg:'#F1EFE8',tx:'#444441',bd:'#B4B2A9'},
  'Планування':{bg:'#EEEDFE',tx:'#3C3489',bd:'#AFA9EC'},
  'В процесі':{bg:'#FAEEDA',tx:'#633806',bd:'#EF9F27'},
  'Готово':{bg:'#EAF3DE',tx:'#27500A',bd:'#97C459'},
  'Завершено':{bg:'#E6F1FB',tx:'#0C447C',bd:'#85B7EB'},
  'Потрібна увага':{bg:'#FCEBEB',tx:'#791F1F',bd:'#F09595'},
  'Критичний':{bg:'#FCEBEB',tx:'#791F1F',bd:'#F09595'},
  'Високий':{bg:'#FAEEDA',tx:'#633806',bd:'#EF9F27'},
  'Середній':{bg:'#E6F1FB',tx:'#0C447C',bd:'#85B7EB'},
  'Низький':{bg:'#EAF3DE',tx:'#27500A',bd:'#97C459'},
  'Відкрита':{bg:'#FAEEDA',tx:'#633806',bd:'#EF9F27'},
  'Виконано':{bg:'#EAF3DE',tx:'#27500A',bd:'#97C459'},
  'Оплачено':{bg:'#EAF3DE',tx:'#27500A',bd:'#97C459'},
  'Очікується':{bg:'#FAEEDA',tx:'#633806',bd:'#EF9F27'},
  'DJ':{bg:'#EEEDFE',tx:'#3C3489',bd:'#AFA9EC'},
  'Фотограф':{bg:'#E6F1FB',tx:'#0C447C',bd:'#85B7EB'},
  'Декоратор':{bg:'#FBEAF0',tx:'#72243E',bd:'#ED93B1'},
  'Кейтеринг':{bg:'#E1F5EE',tx:'#085041',bd:'#5DCAA5'},
  'Ведучий':{bg:'#FAEEDA',tx:'#633806',bd:'#EF9F27'},
  'Музикант':{bg:'#FAECE7',tx:'#712B13',bd:'#F0997B'},
  'Технік':{bg:'#F1EFE8',tx:'#444441',bd:'#B4B2A9'},
  'Відеограф':{bg:'#E6F1FB',tx:'#0C447C',bd:'#85B7EB'},
  'Транспорт':{bg:'#EAF3DE',tx:'#27500A',bd:'#97C459'},
  'Дохід':{bg:'#EAF3DE',tx:'#27500A',bd:'#97C459'},
  'Витрата':{bg:'#FCEBEB',tx:'#791F1F',bd:'#F09595'},
}
const getChip=(l:string)=>CHIP[l]||{bg:'#F1EFE8',tx:'#444441',bd:'#B4B2A9'}
const AV_COLORS=[{bg:'#EEEDFE',tx:'#534AB7'},{bg:'#E6F1FB',tx:'#185FA5'},{bg:'#E1F5EE',tx:'#0F6E56'},{bg:'#FAEEDA',tx:'#854F0B'},{bg:'#FBEAF0',tx:'#993556'}]

const s={
  card:{background:'#fff',border:'0.5px solid rgba(0,0,0,0.12)',borderRadius:12,padding:'14px 16px'} as React.CSSProperties,
  mcard:{background:'#f5f5f3',borderRadius:8,padding:'12px 14px'} as React.CSSProperties,
}

function Chip({label,small}:{label:string,small?:boolean}){
  const c=getChip(label)
  return <span style={{display:'inline-block',background:c.bg,color:c.tx,border:`0.5px solid ${c.bd}`,borderRadius:20,padding:small?'2px 8px':'3px 10px',fontSize:small?10:12,fontWeight:500,whiteSpace:'nowrap'}}>{label}</span>
}
function Stars({n}:{n:number}){return <span style={{color:'#EF9F27',fontSize:13,letterSpacing:-1}}>{'★'.repeat(n)}{'☆'.repeat(5-n)}</span>}
function PBar({v}:{v:number}){
  const col=v>=80?'#639922':v>=50?'#EF9F27':'#E24B4A'
  return <div style={{height:4,background:'rgba(0,0,0,0.08)',borderRadius:2,overflow:'hidden',marginTop:4}}><div style={{width:`${v}%`,height:'100%',background:col,borderRadius:2}}/></div>
}
function Btn({onClick,children,primary,small,style}:{onClick?:()=>void,children:React.ReactNode,primary?:boolean,small?:boolean,style?:React.CSSProperties}){
  return <button onClick={onClick} style={{display:'inline-flex',alignItems:'center',gap:5,padding:small?'5px 10px':'7px 14px',fontSize:small?11:13,borderRadius:8,border:primary?'none':'0.5px solid rgba(0,0,0,0.18)',background:primary?'#7F77DD':'#fff',color:primary?'#fff':'#1a1a1a',cursor:'pointer',fontWeight:500,...style}}>{children}</button>
}
function Avatar({name,i}:{name:string,i:number}){
  const c=AV_COLORS[i%AV_COLORS.length]
  return <div style={{width:36,height:36,borderRadius:'50%',background:c.bg,color:c.tx,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:500,flexShrink:0}}>{initials(name)}</div>
}
function MCard({label,value,delta,deltaOk}:{label:string,value:string,delta?:string,deltaOk?:boolean}){
  return <div style={s.mcard}><div style={{fontSize:11,color:'#666',marginBottom:5}}>{label}</div><div style={{fontSize:22,fontWeight:500}}>{value}</div>{delta&&<div style={{fontSize:11,marginTop:3,color:deltaOk===false?'#854F0B':deltaOk?'#27500A':'#666'}}>{delta}</div>}</div>
}
function Modal({title,onClose,children,wide}:{title:string,onClose:()=>void,children:React.ReactNode,wide?:boolean}){
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'#fff',borderRadius:12,padding:20,width:'100%',maxWidth:wide?600:460,maxHeight:'85vh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <div style={{fontSize:16,fontWeight:500}}>{title}</div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',fontSize:22,lineHeight:1,color:'#666'}}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
function Fl({label,children}:{label:string,children:React.ReactNode}){
  return <div style={{marginBottom:10}}><div style={{fontSize:12,color:'#666',marginBottom:3}}>{label}</div>{children}</div>
}
const fi:React.CSSProperties={width:'100%',padding:'7px 10px',fontSize:13,borderRadius:8,border:'0.5px solid rgba(0,0,0,0.18)',background:'#fff',color:'#1a1a1a',boxSizing:'border-box'}
function ModalFooter({onClose,onSave}:{onClose:()=>void,onSave:()=>void}){
  return <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:14}}><Btn onClick={onClose}>Скасувати</Btn><Btn primary onClick={onSave}>Зберегти</Btn></div>
}

async function callAI(messages:{role:string,content:string}[],system?:string):Promise<string>{
  const body:Record<string,unknown>={model:'claude-sonnet-4-6',max_tokens:1000,messages}
  if(system) body.system=system
  const res=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
  const data=await res.json()
  return data.content?.map((c:{text?:string})=>c.text||'').join('')||''
}

function AiPage({events,tasks,clients,contractors}:{events:Event[],tasks:Task[],clients:Client[],contractors:Contractor[]}){
  const [messages,setMessages]=useState<ChatMsg[]>([{role:'assistant',content:'Привіт! Я твій AI операційний директор. Задавай питання — проаналізую ситуацію, підготую план або напишу повідомлення клієнту.'}])
  const [input,setInput]=useState('')
  const [loading,setLoading]=useState(false)
  const [insights,setInsights]=useState<{attention:string[],risks:string[],suggestion:string}|null>(null)
  const [insightsLoading,setInsightsLoading]=useState(false)
  const bottomRef=useRef<HTMLDivElement>(null)
  const inputRef=useRef<HTMLInputElement>(null)
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:'smooth'})},[messages])

  const ctx=()=>{
    const active=events.filter(e=>e.status!=='Завершено')
    const overdue=tasks.filter(t=>t.deadline<todayStr()&&t.status!=='Виконано').length
    return `Ти — персональний AI операційний директор івент-бізнесу. Відповідай українською. Будь конкретним.
СТАН: активних подій ${active.length}, задач ${tasks.filter(t=>t.status!=='Виконано').length}, прострочених ${overdue}, клієнтів ${clients.length}
ПОДІЇ: ${active.slice(0,5).map(e=>`${e.title} ${fmtDate(e.date)} ${e.guests}ос. ${e.status} ${e.progress}%`).join(' | ')}
ЗАДАЧІ: ${tasks.filter(t=>t.status!=='Виконано').slice(0,8).map(t=>`[${t.priority}] ${t.title} ${fmtDate(t.deadline)}`).join(' | ')}`
  }

  const send=async()=>{
    if(!input.trim()||loading) return
    const text=input.trim();setInput('');setLoading(true)
    const newMessages:ChatMsg[]=[...messages,{role:'user',content:text}]
    setMessages(newMessages)
    try{
      const reply=await callAI(newMessages.map(m=>({role:m.role,content:m.content})),ctx())
      setMessages(p=>[...p,{role:'assistant',content:reply}])
    }catch{setMessages(p=>[...p,{role:'assistant',content:'Помилка з\'єднання.'}])}
    setLoading(false)
  }

  const loadInsights=async()=>{
    setInsightsLoading(true)
    const active=events.filter(e=>e.status!=='Завершено')
    const overdue=tasks.filter(t=>t.deadline<todayStr()&&t.status!=='Виконано').length
    try{
      const raw=await callAI([{role:'user',content:`Операційний директор івент-компанії. Щоденний брифінг.
Подій: ${active.length}, прострочених: ${overdue}, боржників: ${clients.filter(c=>c.debt>0).length}
Події: ${active.slice(0,4).map(e=>`${e.title} ${fmtDate(e.date)} ${e.progress}%`).join(', ')}
Задачі: ${tasks.filter(t=>t.status!=='Виконано'&&t.deadline<=todayStr()).slice(0,5).map(t=>`[${t.priority}] ${t.title}`).join(', ')}
ТІЛЬКИ JSON: {"attention":["..","..",".."],"risks":["..",".."],"suggestion":".."}`}])
      setInsights(JSON.parse(raw.replace(/```json|```/g,'').trim()))
    }catch{
      setInsights({attention:['Перевір прострочені задачі','Уточни готовність найближчої події','Перевір борги клієнтів'],risks:['Затримки підрядників'],suggestion:'Сфокусуйся на найближчій події'})
    }
    setInsightsLoading(false)
  }

  const QUICK=['Проаналізуй стан бізнесу','Що зробити сьогодні?','Напиши нагадування клієнту про оплату','Сформуй план підготовки до весілля']

  return(
    <div style={{display:'grid',gridTemplateColumns:'1fr 280px',gap:16,alignItems:'start'}}>
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {insightsLoading?(
          <div style={{background:'#EEEDFE',border:'0.5px solid #AFA9EC',borderRadius:12,padding:'14px 16px',color:'#534AB7',fontSize:13}}>AI аналізує...</div>
        ):insights?(
          <div style={{background:'#EEEDFE',border:'0.5px solid #AFA9EC',borderRadius:12,padding:'14px 16px'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
              <span style={{background:'#7F77DD',color:'#fff',fontSize:10,fontWeight:500,padding:'2px 8px',borderRadius:20}}>AI Аналіз</span>
              <span style={{fontSize:13,fontWeight:500,color:'#3C3489'}}>На що звернути увагу сьогодні</span>
              <button onClick={()=>setInsights(null)} style={{marginLeft:'auto',background:'none',border:'none',cursor:'pointer',color:'#534AB7',fontSize:16}}>↺</button>
            </div>
            {insights.attention.map((a,i)=><div key={i} style={{display:'flex',gap:8,marginBottom:6,fontSize:12,color:'#534AB7',lineHeight:1.5}}><span>⚡</span><span>{a}</span></div>)}
            {insights.risks.length>0&&<div style={{marginTop:10,paddingTop:10,borderTop:'0.5px solid #AFA9EC'}}>
              <div style={{fontSize:10,fontWeight:500,color:'#534AB7',marginBottom:6,textTransform:'uppercase'}}>Ризики</div>
              {insights.risks.map((r,i)=><div key={i} style={{fontSize:12,color:'#534AB7',marginBottom:4}}>⚠ {r}</div>)}
            </div>}
            {insights.suggestion&&<div style={{marginTop:10,paddingTop:10,borderTop:'0.5px solid #AFA9EC',fontSize:13,color:'#3C3489',fontWeight:500}}>💡 {insights.suggestion}</div>}
          </div>
        ):(
          <div style={{background:'#EEEDFE',border:'0.5px solid #AFA9EC',borderRadius:12,padding:'14px 16px'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
              <span style={{background:'#7F77DD',color:'#fff',fontSize:10,fontWeight:500,padding:'2px 8px',borderRadius:20}}>AI Аналіз</span>
              <span style={{fontSize:13,fontWeight:500,color:'#3C3489'}}>Щоденний брифінг</span>
            </div>
            <div style={{fontSize:13,color:'#534AB7',marginBottom:10}}>AI проаналізує стан бізнесу та підготує рекомендації.</div>
            <Btn primary onClick={loadInsights}>Запустити AI аналіз ↗</Btn>
          </div>
        )}
        <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
          {QUICK.map(q=><button key={q} onClick={()=>{setInput(q);inputRef.current?.focus()}} style={{fontSize:12,padding:'4px 10px',borderRadius:20,border:'0.5px solid rgba(0,0,0,0.15)',background:'#f5f5f3',color:'#555',cursor:'pointer'}}>{q}</button>)}
        </div>
        <div style={{...s.card,padding:0,overflow:'hidden'}}>
          <div style={{height:260,overflowY:'auto',padding:14,display:'flex',flexDirection:'column',gap:10,background:'#f5f5f3'}}>
            {messages.map((m,i)=>(
              <div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'}}>
                <div style={{maxWidth:'88%',padding:'8px 12px',borderRadius:12,fontSize:13,lineHeight:1.6,whiteSpace:'pre-wrap',background:m.role==='user'?'#7F77DD':'#fff',color:m.role==='user'?'#fff':'#1a1a1a',border:m.role==='assistant'?'0.5px solid rgba(0,0,0,0.1)':'none',borderBottomRightRadius:m.role==='user'?3:12,borderBottomLeftRadius:m.role==='assistant'?3:12}}>{m.content}</div>
              </div>
            ))}
            {loading&&<div style={{display:'flex',justifyContent:'flex-start'}}><div style={{padding:'8px 12px',borderRadius:12,background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',fontSize:13,color:'#888'}}>AI думає...</div></div>}
            <div ref={bottomRef}/>
          </div>
          <div style={{display:'flex',gap:8,padding:10,borderTop:'0.5px solid rgba(0,0,0,0.08)'}}>
            <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()} placeholder="Задай питання..." style={{...fi,flex:1}}/>
            <Btn primary onClick={send} style={{flexShrink:0}}>Надіслати</Btn>
          </div>
        </div>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        <div style={s.card}>
          <div style={{fontSize:13,fontWeight:500,marginBottom:10}}>Метрики</div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <MCard label="Активних подій" value={String(events.filter(e=>e.status!=='Завершено').length)} delta="всі під контролем" deltaOk={true}/>
            <MCard label="Відкритих задач" value={String(tasks.filter(t=>t.status!=='Виконано').length)} delta={`прострочених: ${tasks.filter(t=>t.deadline<todayStr()&&t.status!=='Виконано').length}`} deltaOk={tasks.filter(t=>t.deadline<todayStr()&&t.status!=='Виконано').length===0}/>
            <MCard label="Клієнтів" value={String(clients.length)} delta={`${clients.filter(c=>c.debt>0).length} з боргом`} deltaOk={clients.filter(c=>c.debt>0).length===0}/>
            <MCard label="Підрядників" value={String(contractors.length)} delta={`${contractors.filter(c=>c.available).length} вільних`} deltaOk={true}/>
          </div>
        </div>
        <div style={s.card}>
          <div style={{fontSize:13,fontWeight:500,marginBottom:10}}>Найближчі події</div>
          {events.filter(e=>e.status!=='Завершено').slice(0,3).map((e,i)=>(
            <div key={e.id} style={{paddingBottom:10,marginBottom:10,borderBottom:i<2?'0.5px solid rgba(0,0,0,0.08)':'none'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:3}}>
                <span style={{fontSize:13,fontWeight:500}}>{e.title}</span>
                <Chip label={e.status} small/>
              </div>
              <div style={{fontSize:11,color:'#666'}}>{fmtDate(e.date)} · {e.guests} гостей</div>
              <PBar v={e.progress}/>
              <div style={{fontSize:10,color:'#999',marginTop:2}}>{e.progress}% готовності</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function EventsPage({events,setEvents,tasks,setTasks}:{events:Event[],setEvents:(v:Event[])=>void,tasks:Task[],setTasks:(v:Task[])=>void}){
  const [showModal,setShowModal]=useState(false)
  const [genId,setGenId]=useState<string|null>(null)
  const [form,setForm]=useState({title:'',type:'Весілля' as EventType,date:'',guests:'',budget:'',clientName:'',hall:'',status:'Планування' as Status,notes:''})
  const f=(k:string)=>(v:string)=>setForm(p=>({...p,[k]:v}))

  const save=async()=>{
    if(!form.title||!form.date) return
    const item:Event={id:uid(),...form,guests:+form.guests||0,budget:+form.budget||0,progress:0}
    await supabase.from('events').insert({...item,client_name:item.clientName})
    setEvents([item,...events])
    setShowModal(false)
    setForm({title:'',type:'Весілля',date:'',guests:'',budget:'',clientName:'',hall:'',status:'Планування',notes:''})
  }

  const genPlan=async(e:Event)=>{
    setGenId(e.id)
    try{
      const raw=await callAI([{role:'user',content:`Створи план підготовки: ${e.title}, тип: ${e.type}, дата: ${e.date}, гостей: ${e.guests}, бюджет: ${fmtMoney(e.budget)}.
ТІЛЬКИ JSON: {"tasks":[{"title":"..","priority":"Критичний|Високий|Середній|Низький","deadline":"YYYY-MM-DD","description":".."}]}`}])
      const {tasks:newT}=JSON.parse(raw.replace(/```json|```/g,'').trim())
      if(newT?.length){
        const items=newT.map((t:{title:string,priority:Priority,deadline:string,description:string})=>({id:uid(),...t,status:'Відкрита' as const,assignee:'Я',eventTitle:e.title}))
        await supabase.from('tasks').insert(items.map((t:Task)=>({...t,event_title:t.eventTitle})))
        setTasks([...items,...tasks])
        alert(`✅ AI створив ${newT.length} задач для «${e.title}»`)
      }
    }catch{alert('Помилка генерації')}
    setGenId(null)
  }

  const del=async(id:string)=>{
    if(!confirm('Видалити?')) return
    await supabase.from('events').delete().eq('id',id)
    setEvents(events.filter(x=>x.id!==id))
  }

  const updateProgress=async(id:string,val:number)=>{
    await supabase.from('events').update({progress:val}).eq('id',id)
    setEvents(events.map(x=>x.id===id?{...x,progress:val}:x))
  }

  return(
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
        <div><div style={{fontSize:18,fontWeight:500}}>Події</div><div style={{fontSize:13,color:'#666',marginTop:2}}>{events.length} подій</div></div>
        <Btn primary onClick={()=>setShowModal(true)}>+ Нова подія</Btn>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {events.map(e=>(
          <div key={e.id} style={s.card}>
            <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap',marginBottom:5}}>
                  <span style={{fontSize:15,fontWeight:500}}>{e.title}</span>
                  <Chip label={e.type}/><Chip label={e.status}/>
                </div>
                <div style={{fontSize:12,color:'#666',marginBottom:8}}>{fmtDate(e.date)} · {e.guests} гостей · {fmtMoney(e.budget)}{e.hall?' · '+e.hall:''}{e.clientName?' · '+e.clientName:''}</div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{flex:1}}><PBar v={e.progress}/></div>
                  <span style={{fontSize:12,color:'#666',minWidth:32}}>{e.progress}%</span>
                  <input type="range" min={0} max={100} step={1} value={e.progress} style={{width:80}} onChange={ev=>updateProgress(e.id,+ev.target.value)}/>
                </div>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6,alignItems:'flex-end',flexShrink:0}}>
                <Btn small onClick={()=>genPlan(e)}>{genId===e.id?'Генерую...':'AI план ↗'}</Btn>
                <Btn small onClick={()=>del(e.id)}>Видалити</Btn>
              </div>
            </div>
          </div>
        ))}
        {events.length===0&&<div style={{...s.card,textAlign:'center',padding:32,color:'#666'}}>Немає подій. Створи першу!</div>}
      </div>
      {showModal&&<Modal title="Нова подія" onClose={()=>setShowModal(false)} wide>
        <Fl label="Назва *"><input style={fi} value={form.title} onChange={e=>f('title')(e.target.value)} placeholder="Весілля Іваненко"/></Fl>
        <Fl label="Тип"><select style={fi} value={form.type} onChange={e=>f('type')(e.target.value)}>{['Весілля','Корпоратив','День народження','Ювілей','Банкет','Конференція','Інше'].map(o=><option key={o}>{o}</option>)}</select></Fl>
        <Fl label="Дата *"><input style={fi} type="date" value={form.date} onChange={e=>f('date')(e.target.value)}/></Fl>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          <Fl label="Гостей"><input style={fi} type="number" value={form.guests} onChange={e=>f('guests')(e.target.value)}/></Fl>
          <Fl label="Бюджет (грн)"><input style={fi} type="number" value={form.budget} onChange={e=>f('budget')(e.target.value)}/></Fl>
        </div>
        <Fl label="Клієнт"><input style={fi} value={form.clientName} onChange={e=>f('clientName')(e.target.value)} placeholder="Ім'я замовника"/></Fl>
        <Fl label="Зал"><input style={fi} value={form.hall} onChange={e=>f('hall')(e.target.value)} placeholder="Зал А"/></Fl>
        <Fl label="Статус"><select style={fi} value={form.status} onChange={e=>f('status')(e.target.value)}>{['Планування','В процесі','Готово','Потрібна увага'].map(o=><option key={o}>{o}</option>)}</select></Fl>
        <Fl label="Нотатки"><textarea style={{...fi,resize:'vertical'}} rows={2} value={form.notes} onChange={e=>f('notes')(e.target.value)}/></Fl>
        <ModalFooter onClose={()=>setShowModal(false)} onSave={save}/>
      </Modal>}
    </div>
  )
}

function TasksPage({tasks,setTasks,events}:{tasks:Task[],setTasks:(v:Task[])=>void,events:Event[]}){
  const [showModal,setShowModal]=useState(false)
  const [filter,setFilter]=useState('Відкриті')
  const [form,setForm]=useState({title:'',description:'',assignee:'Я',deadline:todayStr(),priority:'Середній' as Priority,eventTitle:''})
  const f=(k:string)=>(v:string)=>setForm(p=>({...p,[k]:v}))

  const save=async()=>{
    if(!form.title) return
    const item:Task={id:uid(),...form,status:'Відкрита' as const}
    await supabase.from('tasks').insert({...item,event_title:item.eventTitle})
    setTasks([item,...tasks])
    setShowModal(false)
    setForm({title:'',description:'',assignee:'Я',deadline:todayStr(),priority:'Середній',eventTitle:''})
  }

  const toggle=async(id:string)=>{
    const t=tasks.find(x=>x.id===id)!
    const ns=t.status==='Виконано'?'Відкрита':'Виконано'
    await supabase.from('tasks').update({status:ns}).eq('id',id)
    setTasks(tasks.map(x=>x.id===id?{...x,status:ns}:x))
  }

  const del=async(id:string)=>{
    if(!confirm('Видалити?')) return
    await supabase.from('tasks').delete().eq('id',id)
    setTasks(tasks.filter(x=>x.id!==id))
  }

  const filters=['Всі','Прострочені','Сьогодні','Відкриті','Виконані']
  const filtered=tasks.filter(t=>{
    if(filter==='Прострочені') return t.deadline<todayStr()&&t.status!=='Виконано'
    if(filter==='Сьогодні') return t.deadline===todayStr()&&t.status!=='Виконано'
    if(filter==='Відкриті') return t.status!=='Виконано'
    if(filter==='Виконані') return t.status==='Виконано'
    return true
  })
  const overdue=tasks.filter(t=>t.deadline<todayStr()&&t.status!=='Виконано').length

  return(
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
        <div><div style={{fontSize:18,fontWeight:500}}>Задачі</div><div style={{fontSize:13,color:'#666',marginTop:2}}>{tasks.filter(t=>t.status!=='Виконано').length} відкритих{overdue>0&&<span style={{color:'#791F1F',marginLeft:8}}> · {overdue} прострочених</span>}</div></div>
        <Btn primary onClick={()=>setShowModal(true)}>+ Нова задача</Btn>
      </div>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:14}}>
        {filters.map(fl=><button key={fl} onClick={()=>setFilter(fl)} style={{padding:'4px 12px',fontSize:12,borderRadius:20,border:'0.5px solid rgba(0,0,0,0.15)',cursor:'pointer',background:filter===fl?'#7F77DD':'#f5f5f3',color:filter===fl?'#fff':'#555',fontWeight:filter===fl?500:400}}>{fl}</button>)}
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {filtered.map(t=>{
          const isOv=t.deadline<todayStr()&&t.status!=='Виконано'
          return <div key={t.id} style={{...s.card,opacity:t.status==='Виконано'?0.6:1}}>
            <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
              <div onClick={()=>toggle(t.id)} style={{width:18,height:18,borderRadius:'50%',border:t.status==='Виконано'?'none':'1.5px solid rgba(0,0,0,0.2)',background:t.status==='Виконано'?'#639922':'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,marginTop:2}}>
                {t.status==='Виконано'&&<span style={{fontSize:10,color:'#fff'}}>✓</span>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                  <span style={{fontSize:13,fontWeight:500,textDecoration:t.status==='Виконано'?'line-through':'none'}}>{t.title}</span>
                  <Chip label={t.priority} small/>{t.eventTitle&&<Chip label={t.eventTitle} small/>}
                </div>
                {t.description&&<div style={{fontSize:12,color:'#666',marginTop:3}}>{t.description}</div>}
                <div style={{fontSize:11,marginTop:4,color:isOv?'#791F1F':'#888'}}>{t.assignee} · {fmtDate(t.deadline)}{isOv&&' ⚠ прострочено'}</div>
              </div>
              <button onClick={()=>del(t.id)} style={{background:'none',border:'none',cursor:'pointer',fontSize:18,color:'#ccc',lineHeight:1}}>×</button>
            </div>
          </div>
        })}
        {filtered.length===0&&<div style={{...s.card,textAlign:'center',padding:28,color:'#666'}}>Немає задач</div>}
      </div>
      {showModal&&<Modal title="Нова задача" onClose={()=>setShowModal(false)}>
        <Fl label="Назва *"><input style={fi} value={form.title} onChange={e=>f('title')(e.target.value)} placeholder="Що потрібно зробити?"/></Fl>
        <Fl label="Опис"><textarea style={{...fi,resize:'vertical'}} rows={2} value={form.description} onChange={e=>f('description')(e.target.value)}/></Fl>
        <Fl label="Пріоритет"><select style={fi} value={form.priority} onChange={e=>f('priority')(e.target.value)}>{['Низький','Середній','Високий','Критичний'].map(o=><option key={o}>{o}</option>)}</select></Fl>
        <Fl label="Дедлайн"><input style={fi} type="date" value={form.deadline} onChange={e=>f('deadline')(e.target.value)}/></Fl>
        <Fl label="Відповідальний"><input style={fi} value={form.assignee} onChange={e=>f('assignee')(e.target.value)}/></Fl>
        <Fl label="Подія"><select style={fi} value={form.eventTitle} onChange={e=>f('eventTitle')(e.target.value)}><option value="">— без події —</option>{events.map(ev=><option key={ev.id}>{ev.title}</option>)}</select></Fl>
        <ModalFooter onClose={()=>setShowModal(false)} onSave={save}/>
      </Modal>}
    </div>
  )
}

function CrmPage({clients,setClients}:{clients:Client[],setClients:(v:Client[])=>void}){
  const [showModal,setShowModal]=useState(false)
  const [aiModal,setAiModal]=useState<{client:Client,msg:string}|null>(null)
  const [form,setForm]=useState({name:'',phone:'',email:'',notes:'',debt:''})
  const f=(k:string)=>(v:string)=>setForm(p=>({...p,[k]:v}))

  const save=async()=>{
    if(!form.name) return
    const item:Client={id:uid(),...form,debt:+form.debt||0}
    await supabase.from('clients').insert(item)
    setClients([item,...clients])
    setShowModal(false)
    setForm({name:'',phone:'',email:'',notes:'',debt:''})
  }

  const genMsg=async(c:Client)=>{
    setAiModal({client:c,msg:'Генерую...'})
    try{
      const msg=await callAI([{role:'user',content:`Напиши ввічливе нагадування про оплату для ${c.name}, сума: ${fmtMoney(c.debt)}. Коротке SMS. Тільки текст.`}])
      setAiModal({client:c,msg})
    }catch{setAiModal({client:c,msg:'Помилка'})}
  }

  const del=async(id:string)=>{
    if(!confirm('Видалити?')) return
    await supabase.from('clients').delete().eq('id',id)
    setClients(clients.filter(x=>x.id!==id))
  }

  return(
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
        <div><div style={{fontSize:18,fontWeight:500}}>CRM клієнтів</div><div style={{fontSize:13,color:'#666',marginTop:2}}>{clients.length} клієнтів · {clients.filter(c=>c.debt>0).length} з боргом</div></div>
        <Btn primary onClick={()=>setShowModal(true)}>+ Новий клієнт</Btn>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:12}}>
        {clients.map((c,i)=>(
          <div key={c.id} style={s.card}>
            <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
              <Avatar name={c.name} i={i}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:500}}>{c.name}</div>
                {c.phone&&<div style={{fontSize:12,color:'#666'}}>{c.phone}</div>}
                {c.email&&<div style={{fontSize:12,color:'#666'}}>{c.email}</div>}
                {c.notes&&<div style={{fontSize:12,color:'#666',marginTop:4}}>{c.notes}</div>}
                {c.debt>0&&<div style={{display:'flex',alignItems:'center',gap:8,marginTop:8}}>
                  <span style={{background:'#FCEBEB',color:'#791F1F',border:'0.5px solid #F09595',borderRadius:20,padding:'2px 8px',fontSize:10,fontWeight:500}}>Борг: {fmtMoney(c.debt)}</span>
                  <button onClick={()=>genMsg(c)} style={{fontSize:11,color:'#534AB7',background:'none',border:'none',cursor:'pointer',textDecoration:'underline'}}>AI нагадування ↗</button>
                </div>}
              </div>
              <button onClick={()=>del(c.id)} style={{background:'none',border:'none',cursor:'pointer',fontSize:18,color:'#ccc'}}>×</button>
            </div>
          </div>
        ))}
        {clients.length===0&&<div style={{...s.card,gridColumn:'1/-1',textAlign:'center',padding:32,color:'#666'}}>Немає клієнтів</div>}
      </div>
      {showModal&&<Modal title="Новий клієнт" onClose={()=>setShowModal(false)}>
        <Fl label="Ім'я *"><input style={fi} value={form.name} onChange={e=>f('name')(e.target.value)} placeholder="Повне ім'я"/></Fl>
        <Fl label="Телефон"><input style={fi} value={form.phone} onChange={e=>f('phone')(e.target.value)} placeholder="+380..."/></Fl>
        <Fl label="Email"><input style={fi} type="email" value={form.email} onChange={e=>f('email')(e.target.value)}/></Fl>
        <Fl label="Сума боргу (грн)"><input style={fi} type="number" value={form.debt} onChange={e=>f('debt')(e.target.value)} placeholder="0"/></Fl>
        <Fl label="Нотатки"><textarea style={{...fi,resize:'vertical'}} rows={2} value={form.notes} onChange={e=>f('notes')(e.target.value)}/></Fl>
        <ModalFooter onClose={()=>setShowModal(false)} onSave={save}/>
      </Modal>}
      {aiModal&&<Modal title={`AI нагадування — ${aiModal.client.name}`} onClose={()=>setAiModal(null)}>
        <div style={{background:'#f5f5f3',borderRadius:8,padding:12,fontSize:13,lineHeight:1.6,whiteSpace:'pre-wrap',marginBottom:12,minHeight:80}}>{aiModal.msg}</div>
        <div style={{display:'flex',gap:8}}>
          <Btn onClick={()=>genMsg(aiModal.client)}>Перегенерувати</Btn>
          <Btn primary onClick={()=>{navigator.clipboard.writeText(aiModal.msg);alert('Скопійовано!')}}>Копіювати</Btn>
        </div>
      </Modal>}
    </div>
  )
}

const CATS=['Всі','DJ','Фотограф','Відеограф','Декоратор','Кейтеринг','Ведучий','Музикант','Технік','Транспорт','Інше']

function ContractorsPage({contractors,setContractors}:{contractors:Contractor[],setContractors:(v:Contractor[])=>void}){
  const [showModal,setShowModal]=useState(false)
  const [cat,setCat]=useState('Всі')
  const [rating,setRating]=useState(5)
  const [form,setForm]=useState({name:'',category:'DJ',phone:'',price:'',notes:''})
  const f=(k:string)=>(v:string)=>setForm(p=>({...p,[k]:v}))

  const save=async()=>{
    if(!form.name) return
    const item:Contractor={id:uid(),...form,rating,available:true}
    await supabase.from('contractors').insert(item)
    setContractors([item,...contractors])
    setShowModal(false)
    setForm({name:'',category:'DJ',phone:'',price:'',notes:''})
    setRating(5)
  }

  const del=async(id:string)=>{
    if(!confirm('Видалити?')) return
    await supabase.from('contractors').delete().eq('id',id)
    setContractors(contractors.filter(x=>x.id!==id))
  }

  const toggleAvail=async(id:string)=>{
    const c=contractors.find(x=>x.id===id)!
    await supabase.from('contractors').update({available:!c.available}).eq('id',id)
    setContractors(contractors.map(x=>x.id===id?{...x,available:!x.available}:x))
  }

  const filtered=cat==='Всі'?contractors:contractors.filter(c=>c.category===cat)

  return(
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
        <div><div style={{fontSize:18,fontWeight:500}}>Підрядники</div><div style={{fontSize:13,color:'#666',marginTop:2}}>{contractors.length} у базі · {contractors.filter(c=>c.available).length} вільних</div></div>
        <Btn primary onClick={()=>setShowModal(true)}>+ Додати</Btn>
      </div>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:14}}>
        {CATS.map(c=><button key={c} onClick={()=>setCat(c)} style={{padding:'4px 12px',fontSize:12,borderRadius:20,border:'0.5px solid rgba(0,0,0,0.15)',cursor:'pointer',background:cat===c?'#7F77DD':'#f5f5f3',color:cat===c?'#fff':'#555'}}>{c}</button>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:12}}>
        {filtered.map((c,i)=>(
          <div key={c.id} style={s.card}>
            <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
              <Avatar name={c.name} i={i+2}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap',marginBottom:3}}>
                  <span style={{fontSize:14,fontWeight:500}}>{c.name}</span><Chip label={c.category} small/>
                </div>
                <Stars n={c.rating}/>
                <div style={{fontSize:12,color:'#666',marginTop:3}}>{c.price}</div>
                {c.phone&&<div style={{fontSize:12,color:'#666'}}>{c.phone}</div>}
                {c.notes&&<div style={{fontSize:12,color:'#666',marginTop:4}}>{c.notes}</div>}
                <div style={{marginTop:8}}>
                  <button onClick={()=>toggleAvail(c.id)} style={{background:'none',border:'none',cursor:'pointer',padding:0}}>
                    <span style={{background:c.available?'#EAF3DE':'#FAEEDA',color:c.available?'#27500A':'#633806',border:`0.5px solid ${c.available?'#97C459':'#EF9F27'}`,borderRadius:20,padding:'2px 8px',fontSize:10,fontWeight:500}}>{c.available?'Вільний':'Зайнятий'}</span>
                  </button>
                </div>
              </div>
              <button onClick={()=>del(c.id)} style={{background:'none',border:'none',cursor:'pointer',fontSize:18,color:'#ccc'}}>×</button>
            </div>
          </div>
        ))}
        {filtered.length===0&&<div style={{...s.card,gridColumn:'1/-1',textAlign:'center',padding:32,color:'#666'}}>Немає підрядників</div>}
      </div>
      {showModal&&<Modal title="Новий підрядник" onClose={()=>setShowModal(false)}>
        <Fl label="Ім'я *"><input style={fi} value={form.name} onChange={e=>f('name')(e.target.value)} placeholder="Ім'я або компанія"/></Fl>
        <Fl label="Категорія"><select style={fi} value={form.category} onChange={e=>f('category')(e.target.value)}>{CATS.slice(1).map(o=><option key={o}>{o}</option>)}</select></Fl>
        <Fl label="Телефон"><input style={fi} value={form.phone} onChange={e=>f('phone')(e.target.value)} placeholder="+380..."/></Fl>
        <Fl label="Ціна"><input style={fi} value={form.price} onChange={e=>f('price')(e.target.value)} placeholder="від 5 000 грн"/></Fl>
        <Fl label={`Рейтинг: ${rating}/5`}><input type="range" min={1} max={5} step={1} value={rating} onChange={e=>setRating(+e.target.value)} style={{width:'100%'}}/></Fl>
        <Fl label="Нотатки"><textarea style={{...fi,resize:'vertical'}} rows={2} value={form.notes} onChange={e=>f('notes')(e.target.value)}/></Fl>
        <ModalFooter onClose={()=>setShowModal(false)} onSave={save}/>
      </Modal>}
    </div>
  )
}

function FinancePage({payments,setPayments,events,clients}:{payments:Payment[],setPayments:(v:Payment[])=>void,events:Event[],clients:Client[]}){
  const [showModal,setShowModal]=useState(false)
  const [report,setReport]=useState('')
  const [reportLoading,setReportLoading]=useState(false)
  const [form,setForm]=useState({description:'',amount:'',type:'Дохід' as 'Дохід'|'Витрата',status:'Очікується' as 'Оплачено'|'Очікується',date:todayStr(),eventTitle:''})
  const f=(k:string)=>(v:string)=>setForm(p=>({...p,[k]:v}))

  const save=async()=>{
    if(!form.description||!form.amount) return
    const item:Payment={id:uid(),...form,amount:+form.amount}
    await supabase.from('payments').insert({...item,event_title:item.eventTitle})
    setPayments([item,...payments])
    setShowModal(false)
    setForm({description:'',amount:'',type:'Дохід',status:'Очікується',date:todayStr(),eventTitle:''})
  }

  const del=async(id:string)=>{
    if(!confirm('Видалити?')) return
    await supabase.from('payments').delete().eq('id',id)
    setPayments(payments.filter(x=>x.id!==id))
  }

  const toggleStatus=async(id:string)=>{
    const p=payments.find(x=>x.id===id)!
    const ns=p.status==='Оплачено'?'Очікується':'Оплачено'
    await supabase.from('payments').update({status:ns}).eq('id',id)
    setPayments(payments.map(x=>x.id===id?{...x,status:ns}:x))
  }

  const income=payments.filter(p=>p.type==='Дохід'&&p.status==='Оплачено').reduce((s,p)=>s+p.amount,0)
  const expense=payments.filter(p=>p.type==='Витрата'&&p.status==='Оплачено').reduce((s,p)=>s+p.amount,0)
  const pending=payments.filter(p=>p.status==='Очікується').reduce((s,p)=>s+p.amount,0)
  const debt=clients.reduce((s,c)=>s+(c.debt||0),0)
  const margin=income>0?Math.round(((income-expense)/income)*100):0

  const genReport=async()=>{
    setReportLoading(true)
    try{
      const r=await callAI([{role:'user',content:`Фінансовий аналіз: доходи ${fmtMoney(income)}, витрати ${fmtMoney(expense)}, прибуток ${fmtMoney(income-expense)}, маржа ${margin}%, борги ${fmtMoney(debt)}. Короткий аналіз та 2-3 рекомендації. Українською.`}])
      setReport(r)
    }catch{setReport('Помилка')}
    setReportLoading(false)
  }

  return(
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
        <div><div style={{fontSize:18,fontWeight:500}}>Фінанси</div><div style={{fontSize:13,color:'#666',marginTop:2}}>Доходи, витрати, аналітика</div></div>
        <div style={{display:'flex',gap:8}}>
          <Btn onClick={genReport}>{reportLoading?'Аналізую...':'AI звіт ↗'}</Btn>
          <Btn primary onClick={()=>setShowModal(true)}>+ Запис</Btn>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
        <MCard label="Доходи" value={`${Math.round(income/1000)}К грн`} delta="оплачено" deltaOk={true}/>
        <MCard label="Витрати" value={`${Math.round(expense/1000)}К грн`} delta={`маржа ${margin}%`}/>
        <MCard label="Прибуток" value={`${Math.round((income-expense)/1000)}К грн`} delta="поточний" deltaOk={income>expense}/>
        <MCard label="Очікується" value={`${Math.round(pending/1000)}К грн`} delta={debt>0?`борг: ${Math.round(debt/1000)}К`:''} deltaOk={debt===0}/>
      </div>
      {(report||reportLoading)&&<div style={{background:'#EEEDFE',border:'0.5px solid #AFA9EC',borderRadius:12,padding:'14px 16px',marginBottom:14}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
          <span style={{background:'#7F77DD',color:'#fff',fontSize:10,fontWeight:500,padding:'2px 8px',borderRadius:20}}>AI Аналіз</span>
          {!reportLoading&&<button onClick={()=>setReport('')} style={{marginLeft:'auto',background:'none',border:'none',cursor:'pointer',color:'#534AB7',fontSize:16}}>×</button>}
        </div>
        <div style={{fontSize:13,color:'#3C3489',lineHeight:1.6,whiteSpace:'pre-wrap'}}>{reportLoading?'Генерую звіт...':report}</div>
      </div>}
      <div style={s.card}>
        <div style={{fontSize:13,fontWeight:500,marginBottom:12}}>Всі записи</div>
        {payments.map(p=>(
          <div key={p.id} style={{display:'flex',gap:10,alignItems:'center',padding:'7px 0',borderBottom:'0.5px solid rgba(0,0,0,0.08)'}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:p.type==='Дохід'?'#639922':'#E24B4A',flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:13}}>{p.description}</div>
              <div style={{fontSize:11,color:'#888'}}>{fmtDate(p.date)}{p.eventTitle?' · '+p.eventTitle:''}</div>
            </div>
            <div style={{fontSize:14,fontWeight:500,color:p.type==='Дохід'?'#27500A':'#791F1F',marginRight:8}}>{p.type==='Дохід'?'+':'-'}{fmtMoney(p.amount)}</div>
            <button onClick={()=>toggleStatus(p.id)} style={{background:'none',border:'none',cursor:'pointer',padding:0,marginRight:8}}><Chip label={p.status} small/></button>
            <button onClick={()=>del(p.id)} style={{background:'none',border:'none',cursor:'pointer',fontSize:18,color:'#ccc'}}>×</button>
          </div>
        ))}
        {payments.length===0&&<div style={{textAlign:'center',padding:24,color:'#666',fontSize:13}}>Немає записів</div>}
      </div>
      {showModal&&<Modal title="Новий запис" onClose={()=>setShowModal(false)}>
        <Fl label="Опис *"><input style={fi} value={form.description} onChange={e=>f('description')(e.target.value)} placeholder="Оплата від клієнта / Витрата на декор"/></Fl>
        <Fl label="Сума (грн) *"><input style={fi} type="number" value={form.amount} onChange={e=>f('amount')(e.target.value)} placeholder="50000"/></Fl>
        <Fl label="Тип"><select style={fi} value={form.type} onChange={e=>f('type')(e.target.value)}><option>Дохід</option><option>Витрата</option></select></Fl>
        <Fl label="Статус"><select style={fi} value={form.status} onChange={e=>f('status')(e.target.value)}><option>Очікується</option><option>Оплачено</option></select></Fl>
        <Fl label="Дата"><input style={fi} type="date" value={form.date} onChange={e=>f('date')(e.target.value)}/></Fl>
        <Fl label="Подія"><select style={fi} value={form.eventTitle} onChange={e=>f('eventTitle')(e.target.value)}><option value="">— без події —</option>{events.map(ev=><option key={ev.id}>{ev.title}</option>)}</select></Fl>
        <ModalFooter onClose={()=>setShowModal(false)} onSave={save}/>
      </Modal>}
    </div>
  )
}

const NAV=[
  {id:'ai',icon:'🤖',label:'AI Асистент'},
  {id:'events',icon:'📅',label:'Події'},
  {id:'tasks',icon:'✅',label:'Задачі'},
  {id:'crm',icon:'👥',label:'Клієнти'},
  {id:'contractors',icon:'💼',label:'Підрядники'},
  {id:'finance',icon:'📊',label:'Фінанси'},
]

export default function App(){
  const [events,setEvents]=useState<Event[]>([])
  const [tasks,setTasks]=useState<Task[]>([])
  const [clients,setClients]=useState<Client[]>([])
  const [contractors,setContractors]=useState<Contractor[]>([])
  const [payments,setPayments]=useState<Payment[]>([])
  const [page,setPage]=useState('ai')
  const [loading,setLoading]=useState(true)

  useEffect(()=>{
    const load=async()=>{
      const [ev,ta,cl,co,pa]=await Promise.all([
        supabase.from('events').select('*').order('created_at',{ascending:false}),
        supabase.from('tasks').select('*').order('created_at',{ascending:false}),
        supabase.from('clients').select('*').order('created_at',{ascending:false}),
        supabase.from('contractors').select('*').order('created_at',{ascending:false}),
        supabase.from('payments').select('*').order('created_at',{ascending:false}),
      ])
      if(ev.data?.length) setEvents(ev.data.map((e:Record<string,unknown>)=>({...e,clientName:e.client_name})) as Event[])
      else{ await supabase.from('events').insert(DEF_EVENTS.map(e=>({...e,client_name:e.clientName}))); setEvents(DEF_EVENTS) }
      if(ta.data?.length) setTasks(ta.data.map((t:Record<string,unknown>)=>({...t,eventTitle:t.event_title})) as Task[])
      else{ await supabase.from('tasks').insert(DEF_TASKS.map(t=>({...t,event_title:t.eventTitle}))); setTasks(DEF_TASKS) }
      if(cl.data?.length) setClients(cl.data as Client[])
      else{ await supabase.from('clients').insert(DEF_CLIENTS); setClients(DEF_CLIENTS) }
      if(co.data?.length) setContractors(co.data as Contractor[])
      else{ await supabase.from('contractors').insert(DEF_CONTRACTORS); setContractors(DEF_CONTRACTORS) }
      if(pa.data?.length) setPayments(pa.data.map((p:Record<string,unknown>)=>({...p,eventTitle:p.event_title})) as Payment[])
      setLoading(false)
    }
    load()
  },[])

  const overdue=tasks.filter(t=>t.deadline<todayStr()&&t.status!=='Виконано').length

  if(loading) return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:12}}>
      <div style={{fontSize:24}}>⚡</div>
      <div style={{fontSize:15,fontWeight:500}}>EventFlow AI</div>
      <div style={{fontSize:13,color:'#888'}}>Завантажую дані...</div>
    </div>
  )

  return(
    <div style={{display:'grid',gridTemplateColumns:'196px 1fr',minHeight:'100vh'}}>
      <div style={{background:'#f0efe8',borderRight:'0.5px solid rgba(0,0,0,0.1)',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'16px 16px 14px',borderBottom:'0.5px solid rgba(0,0,0,0.08)'}}>
          <div style={{fontSize:15,fontWeight:500}}>EventFlow AI</div>
          <div style={{fontSize:11,color:'#888',marginTop:1}}>Операційна система</div>
        </div>
        <nav style={{display:'flex',flexDirection:'column',gap:1,padding:'8px 0',flex:1}}>
          {NAV.map(n=>(
            <button key={n.id} onClick={()=>setPage(n.id)} style={{display:'flex',alignItems:'center',gap:8,padding:'9px 16px',fontSize:13,cursor:'pointer',border:'none',borderLeft:page===n.id?'2px solid #7F77DD':'2px solid transparent',background:page===n.id?'#fff':'transparent',color:page===n.id?'#1a1a1a':'#666',fontWeight:page===n.id?500:400,textAlign:'left',width:'100%'}}>
              <span style={{fontSize:16}}>{n.icon}</span>{n.label}
              {n.id==='tasks'&&overdue>0&&<span style={{marginLeft:'auto',background:'#FCEBEB',color:'#791F1F',fontSize:10,fontWeight:500,padding:'1px 6px',borderRadius:20}}>{overdue}</span>}
            </button>
          ))}
        </nav>
        <div style={{padding:'12px 16px',borderTop:'0.5px solid rgba(0,0,0,0.08)',fontSize:11,color:'#aaa'}}>EventFlow AI v1.0</div>
      </div>
      <div style={{background:'#f5f5f3',padding:20,overflowY:'auto'}}>
        {page==='ai'&&<AiPage events={events} tasks={tasks} clients={clients} contractors={contractors}/>}
        {page==='events'&&<EventsPage events={events} setEvents={setEvents} tasks={tasks} setTasks={setTasks}/>}
        {page==='tasks'&&<TasksPage tasks={tasks} setTasks={setTasks} events={events}/>}
        {page==='crm'&&<CrmPage clients={clients} setClients={setClients}/>}
        {page==='contractors'&&<ContractorsPage contractors={contractors} setContractors={setContractors}/>}
        {page==='finance'&&<FinancePage payments={payments} setPayments={setPayments} events={events} clients={clients}/>}
      </div>
    </div>
  )
}
