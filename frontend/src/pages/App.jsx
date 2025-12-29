import React, { useEffect, useMemo, useState } from 'react'
import { api, getToken, setToken } from '../lib/api.js'

function Nav({user, onLogout, view, setView}){
  return (
    <div className="nav">
      <div className="row">
        <div className="brand">
          <span style={{fontSize:18}}>📚</span>
          <span>Trao đổi Sách / Dụng cụ</span>
          <span className="badge">MVP</span>
        </div>
      </div>
      <div className="row">
        <button className={"btn" + (view==='market' ? ' primary' : '')} onClick={()=>setView('market')}>Chợ</button>
        <button className={"btn" + (view==='mine' ? ' primary' : '')} onClick={()=>setView('mine')}>Của tôi</button>
        <button className={"btn" + (view==='swaps' ? ' primary' : '')} onClick={()=>setView('swaps')}>Yêu cầu</button>
        {user && (user.role==='admin') && (
          <button className={"btn" + (view==='admin' ? ' primary' : '')} onClick={()=>setView('admin')}>Admin</button>
        )}
        {user ? (
          <>
            <span className="badge">Xin chào, {user.full_name || user.name}</span>
            <button className="btn danger" onClick={onLogout}>Đăng xuất</button>
          </>
        ) : (
          <span className="badge">Chưa đăng nhập</span>
        )}
      </div>
    </div>
  )
}

function AuthCard({onAuthed}){
  const [tab, setTab] = useState('login')
  const [full_name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPwd] = useState('')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')

  async function submit(){
    setErr(''); setOk('')
    try{
      const payload = tab==='register' ? {full_name, email, password} : {email, password}
      const res = tab==='register' ? await api.register(payload) : await api.login(payload)
      setToken(res.token)
      onAuthed(res.user)
      setOk('Xong! Đã đăng nhập.')
    }catch(e){
      setErr(e.message)
    }
  }

  return (
    <div className="card">
      <div className="row" style={{justifyContent:'space-between'}}>
        <div>
          <div className="h1">Tài khoản</div>
          <div className="muted small">Đăng nhập để đăng đồ và gửi yêu cầu trao đổi.</div>
        </div>
        <div className="row">
          <button className={"btn" + (tab==='login' ? ' primary' : '')} onClick={()=>setTab('login')}>Đăng nhập</button>
          <button className={"btn" + (tab==='register' ? ' primary' : '')} onClick={()=>setTab('register')}>Đăng ký</button>
        </div>
      </div>

      <div className="hr"></div>

      <div className="form">
        {tab==='register' && (
          <input className="input" placeholder="Họ tên" value={full_name} onChange={e=>setName(e.target.value)} />
        )}
        <input className="input" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="input" placeholder="Mật khẩu (>= 6 ký tự)" type="password" value={password} onChange={e=>setPwd(e.target.value)} />
        <button className="btn primary" onClick={submit}>Xác nhận</button>
        {err && <div style={{color:'var(--danger)'}}>⚠️ {err}</div>}
        {ok && <div style={{color:'var(--ok)'}}>✅ {ok}</div>}
      </div>
    </div>
  )
}

function ItemCard({item, user, onRequestSwap, onEdit, onDelete}){
  const isMine = user && (Number(item.owner_id) === Number(user.id || user.sub))
  return (
    <div className="item">
      <div className="item-title">
        <strong>{item.title}</strong>
        <span className="pill">{item.type}</span>
      </div>
      {item.description && <div className="muted small">{item.description}</div>}
      <div className="kv">
        <span>Mode: {item.exchange_mode}</span>
        {item.category && <span>Category: {item.category}</span>}
        {item.condition && <span>Condition: {item.condition}</span>}
        {item.price ? <span>Price: {item.price}đ</span> : null}
        <span>Status: {item.status}</span>
      </div>
      <div className="row" style={{justifyContent:'space-between'}}>
        <div className="muted small">Chủ: {item.owner_name || '—'}</div>
        <div className="row">
          {isMine ? (
            <>
              <button className="btn" onClick={()=>onEdit(item)}>Sửa</button>
              <button className="btn danger" onClick={()=>onDelete(item)}>Xóa</button>
            </>
          ) : (
            <button className="btn ok" onClick={()=>onRequestSwap(item)}>Gửi yêu cầu</button>
          )}
        </div>
      </div>
    </div>
  )
}

function CreateOrEditItem({editing, onSaved}){
  const [form, setForm] = useState({
    type:'book',
    title:'',
    description:'',
    category:'',
    condition:'good',
    exchange_mode:'swap',
    price:'',
    image_url:''
  })
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')

  useEffect(()=>{
    if(editing){
      setForm({
        type: editing.type || 'book',
        title: editing.title || '',
        description: editing.description || '',
        category: editing.category || '',
        condition: editing.condition || 'good',
        exchange_mode: editing.exchange_mode || 'swap',
        price: editing.price || '',
        image_url: editing.image_url || ''
      })
    }
  }, [editing])

  function set(k,v){ setForm(p=>({...p,[k]:v})) }

  async function save(){
    setErr(''); setOk('')
    try{
      const payload = {...form}
      if(payload.price === '') delete payload.price
      else payload.price = Number(payload.price)
      if(editing){
        await api.updateItem(editing.id, payload)
        setOk('Đã cập nhật.')
      }else{
        await api.createItem(payload)
        setOk('Đã đăng.')
        setForm({type:'book',title:'',description:'',category:'',condition:'good',exchange_mode:'swap',price:'',image_url:''})
      }
      onSaved?.()
    }catch(e){
      setErr(e.message)
    }
  }

  return (
    <div className="card">
      <div className="h1">{editing ? 'Sửa bài đăng' : 'Đăng món đồ'}</div>
      <div className="muted small">Gợi ý: ghi rõ “swap/donate/lend/sell” để mọi người hiểu nhanh.</div>
      <div className="hr"></div>
      <div className="form">
        <div className="row">
          <select value={form.type} onChange={e=>set('type', e.target.value)}>
            <option value="book">book</option>
            <option value="tool">tool</option>
          </select>
          <select value={form.exchange_mode} onChange={e=>set('exchange_mode', e.target.value)}>
            <option value="swap">swap</option>
            <option value="donate">donate</option>
            <option value="lend">lend</option>
            <option value="sell">sell</option>
          </select>
          <select value={form.condition} onChange={e=>set('condition', e.target.value)}>
            <option value="new">new</option>
            <option value="good">good</option>
            <option value="fair">fair</option>
            <option value="old">old</option>
          </select>
        </div>
        <input className="input" placeholder="Tiêu đề" value={form.title} onChange={e=>set('title', e.target.value)} />
        <input className="input" placeholder="Danh mục (VD: Toán, Tiếng Anh, Arduino...)" value={form.category} onChange={e=>set('category', e.target.value)} />
        <textarea className="input" placeholder="Mô tả (tình trạng, thiếu trang, phụ kiện đi kèm...)" value={form.description} onChange={e=>set('description', e.target.value)} />
        <input className="input" placeholder="Giá (chỉ khi sell) - VND" value={form.price} onChange={e=>set('price', e.target.value)} />
        <input className="input" placeholder="Ảnh (URL) - để trống cũng được" value={form.image_url} onChange={e=>set('image_url', e.target.value)} />
        <button className="btn primary" onClick={save}>{editing ? 'Lưu' : 'Đăng'}</button>
        {err && <div style={{color:'var(--danger)'}}>⚠️ {err}</div>}
        {ok && <div style={{color:'var(--ok)'}}>✅ {ok}</div>}
      </div>
    </div>
  )
}

function SwapPanel({user}){
  const [mine, setMine] = useState([])
  const [incoming, setIncoming] = useState([])
  const [err, setErr] = useState('')
  const [activeSwap, setActiveSwap] = useState(null)
  const [messages, setMessages] = useState([])
  const [msg, setMsg] = useState('')

  async function load(){
    setErr('')
    try{
      const a = await api.mySwaps()
      const b = await api.incomingSwaps()
      setMine(a.swaps || [])
      setIncoming(b.swaps || [])
    }catch(e){
      setErr(e.message)
    }
  }

  async function openChat(s){
    setActiveSwap(s)
    try{
      const res = await api.listMessages(s.id)
      setMessages(res.messages || [])
    }catch(e){
      setErr(e.message)
    }
  }

  async function send(){
    if(!activeSwap) return
    try{
      await api.sendMessage(activeSwap.id, msg)
      setMsg('')
      const res = await api.listMessages(activeSwap.id)
      setMessages(res.messages || [])
    }catch(e){
      setErr(e.message)
    }
  }

  async function setStatus(id, status){
    try{
      await api.setSwapStatus(id, status)
      await load()
      if(activeSwap && activeSwap.id===id){
        setActiveSwap(null)
        setMessages([])
      }
    }catch(e){
      setErr(e.message)
    }
  }

  useEffect(()=>{ if(user) load() }, [user])

  if(!user){
    return <div className="card"><div className="h1">Yêu cầu</div><div className="muted">Đăng nhập để xem.</div></div>
  }

  return (
    <div className="card">
      <div className="h1">Yêu cầu trao đổi</div>
      <div className="muted small">Chủ đồ có quyền Accept/Reject. Người gửi có quyền Cancel.</div>
      <div className="hr"></div>

      {err && <div style={{color:'var(--danger)'}}>⚠️ {err}</div>}

      <div className="grid" style={{gridTemplateColumns:'1fr 1fr'}}>
        <div className="card" style={{padding:12}}>
          <strong>Yêu cầu tôi đã gửi</strong>
          <div className="hr"></div>
          <div className="form">
            {mine.map(s=>(
              <div key={s.id} className="item">
                <div><strong>{s.item_title}</strong></div>
                <div className="muted small">Chủ: {s.owner_name} — Status: {s.status}</div>
                <div className="row">
                  <button className="btn" onClick={()=>openChat(s)}>Chat</button>
                  {s.status==='pending' && <button className="btn danger" onClick={()=>setStatus(s.id,'cancelled')}>Cancel</button>}
                </div>
              </div>
            ))}
            {!mine.length && <div className="muted small">Chưa có.</div>}
          </div>
        </div>

        <div className="card" style={{padding:12}}>
          <strong>Yêu cầu đến đồ của tôi</strong>
          <div className="hr"></div>
          <div className="form">
            {incoming.map(s=>(
              <div key={s.id} className="item">
                <div><strong>{s.item_title}</strong></div>
                <div className="muted small">Người gửi: {s.requester_name} — Status: {s.status}</div>
                <div className="row">
                  <button className="btn" onClick={()=>openChat(s)}>Chat</button>
                  {s.status==='pending' && (
                    <>
                      <button className="btn ok" onClick={()=>setStatus(s.id,'accepted')}>Accept</button>
                      <button className="btn danger" onClick={()=>setStatus(s.id,'rejected')}>Reject</button>
                    </>
                  )}
                  {s.status==='accepted' && <button className="btn ok" onClick={()=>setStatus(s.id,'completed')}>Completed</button>}
                </div>
              </div>
            ))}
            {!incoming.length && <div className="muted small">Chưa có.</div>}
          </div>
        </div>
      </div>

      {activeSwap && (
        <>
          <div className="hr"></div>
          <div className="card" style={{padding:12}}>
            <strong>Chat cho swap #{activeSwap.id}</strong>
            <div className="hr"></div>
            <div className="form">
              <div style={{maxHeight:220, overflow:'auto', border:'1px solid var(--border)', borderRadius:12, padding:10}}>
                {messages.map(m=>(
                  <div key={m.id} style={{marginBottom:8}}>
                    <div className="small muted">{m.sender_name} • {m.created_at}</div>
                    <div>{m.body}</div>
                  </div>
                ))}
                {!messages.length && <div className="muted small">Chưa có tin nhắn.</div>}
              </div>
              <div className="row">
                <input className="input" placeholder="Nhắn gì đó..." value={msg} onChange={e=>setMsg(e.target.value)} />
                <button className="btn primary" onClick={send}>Gửi</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}



function AdminPanel({user}){
  const [tab, setTab] = useState('items')
  const [items, setItems] = useState([])
  const [users, setUsers] = useState([])
  const [swaps, setSwaps] = useState([])
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')

  async function load(){
    setErr(''); setOk('')
    try{
      const [a,b,c] = await Promise.all([api.adminItems(), api.adminUsers(), api.adminSwaps()])
      setItems(a.items || [])
      setUsers(b.users || [])
      setSwaps(c.swaps || [])
    }catch(e){
      setErr(e.message)
    }
  }

  useEffect(()=>{ if(user?.role==='admin') load() }, [user])

  async function setItemStatus(it){
    const status = prompt('Set status: available | reserved | exchanged | hidden', it.status)
    if(!status) return
    try{
      await api.adminSetItemStatus(it.id, status)
      setOk('Đã cập nhật status.')
      await load()
    }catch(e){ setErr(e.message) }
  }

  async function setUserRole(u){
    const role = prompt('Set role: user | admin', u.role)
    if(!role) return
    try{
      await api.adminSetUserRole(u.id, role)
      setOk('Đã cập nhật role.')
      await load()
    }catch(e){ setErr(e.message) }
  }

  if(!user || user.role!=='admin'){
    return <div className="card"><div className="h1">Admin</div><div className="muted">Chỉ admin mới xem được.</div></div>
  }

  return (
    <div className="card">
      <div className="row" style={{justifyContent:'space-between'}}>
        <div>
          <div className="h1">Khu vực Admin (riêng)</div>
          <div className="muted small">Duyệt/ẩn bài, phân quyền, xem swaps.</div>
        </div>
        <div className="row">
          <button className={"btn" + (tab==='items' ? ' primary' : '')} onClick={()=>setTab('items')}>Items</button>
          <button className={"btn" + (tab==='users' ? ' primary' : '')} onClick={()=>setTab('users')}>Users</button>
          <button className={"btn" + (tab==='swaps' ? ' primary' : '')} onClick={()=>setTab('swaps')}>Swaps</button>
          <button className="btn" onClick={load}>Reload</button>
        </div>
      </div>

      <div className="hr"></div>
      {err && <div style={{color:'var(--danger)'}}>⚠️ {err}</div>}
      {ok && <div style={{color:'var(--ok)'}}>✅ {ok}</div>}

      {tab==='items' && (
        <div className="form">
          {items.map(it=>(
            <div key={it.id} className="item">
              <div className="item-title">
                <strong>#{it.id} • {it.title}</strong>
                <span className="pill">{it.status}</span>
              </div>
              <div className="muted small">Owner: {it.owner_name} • {it.owner_email}</div>
              <div className="kv">
                <span>type: {it.type}</span>
                <span>mode: {it.exchange_mode}</span>
                {it.category && <span>cat: {it.category}</span>}
              </div>
              <div className="row">
                <button className="btn" onClick={()=>setItemStatus(it)}>Set status</button>
              </div>
            </div>
          ))}
          {!items.length && <div className="muted small">Chưa có items.</div>}
        </div>
      )}

      {tab==='users' && (
        <div className="form">
          {users.map(u=>(
            <div key={u.id} className="item">
              <div className="item-title">
                <strong>#{u.id} • {u.full_name}</strong>
                <span className="pill">{u.role}</span>
              </div>
              <div className="muted small">{u.email}</div>
              <div className="row">
                <button className="btn" onClick={()=>setUserRole(u)}>Set role</button>
              </div>
            </div>
          ))}
          {!users.length && <div className="muted small">Chưa có users.</div>}
        </div>
      )}

      {tab==='swaps' && (
        <div className="form">
          {swaps.map(s=>(
            <div key={s.id} className="item">
              <div className="item-title">
                <strong>Swap #{s.id} • {s.item_title}</strong>
                <span className="pill">{s.status}</span>
              </div>
              <div className="muted small">Owner: {s.owner_name} • Requester: {s.requester_name}</div>
              {s.message && <div className="small">💬 {s.message}</div>}
            </div>
          ))}
          {!swaps.length && <div className="muted small">Chưa có swaps.</div>}
        </div>
      )}
    </div>
  )
}

export default function App(){
  const [user, setUser] = useState(null)
  const [view, setView] = useState('market')
  const [items, setItems] = useState([])
  const [filters, setFilters] = useState({q:'', type:'', mode:''})
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState(null)

  async function loadUser(){
    if(!getToken()) return setUser(null)
    try{
      const res = await api.me()
      setUser({ id: res.user.sub, full_name: res.user.name, email: res.user.email, role: res.user.role, sub: res.user.sub })
    }catch{
      setToken('')
      setUser(null)
    }
  }

  async function loadItems(){
    setErr('')
    try{
      const res = await api.listItems({
        q: filters.q || undefined,
        type: filters.type || undefined,
        mode: filters.mode || undefined,
        status: 'available'
      })
      setItems(res.items || [])
    }catch(e){
      setErr(e.message)
    }
  }

  useEffect(()=>{ loadUser() }, [])
  useEffect(()=>{ loadItems() }, [filters])

  function logout(){
    setToken('')
    setUser(null)
  }

  async function requestSwap(item){
    if(!user){
      alert('Bạn cần đăng nhập trước.')
      return
    }
    const message = prompt('Nhắn cho chủ đồ (tùy chọn):', 'Mình muốn trao đổi, bạn rảnh lúc nào?')
    try{
      await api.createSwap({item_id: item.id, message: message || ''})
      alert('Đã gửi yêu cầu!')
      setView('swaps')
    }catch(e){
      alert(e.message)
    }
  }

  async function delItem(item){
    if(!confirm('Xóa bài đăng này?')) return
    try{
      await api.deleteItem(item.id)
      await loadItems()
    }catch(e){
      alert(e.message)
    }
  }

  const mineItems = useMemo(()=>{
    if(!user) return []
    return items.filter(i => Number(i.owner_id) === Number(user.id))
  }, [items, user])

  return (
    <div className="container">
      <Nav user={user} onLogout={logout} view={view} setView={setView} />
      <div className="grid">
        <div className="card">
          <div className="row" style={{justifyContent:'space-between'}}>
            <div>
              <div className="h1">{view==='market' ? 'Chợ trao đổi' : view==='mine' ? 'Bài đăng của tôi' : view==='admin' ? 'Admin' : 'Yêu cầu'}</div>
              <div className="muted small">MVP chạy local. Khi cần lên server: upload ảnh + admin duyệt bài + phân quyền.</div>
            </div>
            <div className="row">
              <span className="badge">API: /api</span>
            </div>
          </div>

          {view!=='swaps' && (
            <>
              <div className="hr"></div>
              <div className="row">
                <input className="input" placeholder="Tìm kiếm..." value={filters.q} onChange={e=>setFilters(p=>({...p,q:e.target.value}))} />
                <select value={filters.type} onChange={e=>setFilters(p=>({...p,type:e.target.value}))}>
                  <option value="">All types</option>
                  <option value="book">book</option>
                  <option value="tool">tool</option>
                </select>
                <select value={filters.mode} onChange={e=>setFilters(p=>({...p,mode:e.target.value}))}>
                  <option value="">All modes</option>
                  <option value="swap">swap</option>
                  <option value="donate">donate</option>
                  <option value="lend">lend</option>
                  <option value="sell">sell</option>
                </select>
                <button className="btn" onClick={()=>setFilters({q:'',type:'',mode:''})}>Reset</button>
              </div>
            </>
          )}

          <div className="hr"></div>

          {err && <div style={{color:'var(--danger)'}}>⚠️ {err}</div>}

          {view==='admin' ? (
            <AdminPanel user={user} />
          ) : view==='swaps' ? (
            <SwapPanel user={user} />
          ) : (
            <div className="items">
              {(view==='mine' ? mineItems : items).map(item=>(
                <ItemCard key={item.id}
                  item={item}
                  user={user}
                  onRequestSwap={requestSwap}
                  onEdit={(it)=>{ setEditing(it); setView('mine') }}
                  onDelete={delItem}
                />
              ))}
              {((view==='mine' ? mineItems : items).length===0) && (
                <div className="muted">Chưa có dữ liệu. Hãy đăng 1 món trước 😄</div>
              )}
            </div>
          )}
        </div>

        <div>
          {!user ? (
            <AuthCard onAuthed={(u)=>{ setUser(u); setView('market'); loadUser(); }} />
          ) : (
            <CreateOrEditItem editing={editing} onSaved={()=>{ setEditing(null); loadItems(); }} />
          )}

          <div className="card" style={{marginTop:16}}>
            <div className="h1">Cách vận hành gọn mà “đúng chất”</div>
            <div className="muted small">
              1) Mỗi món ghi rõ tình trạng + ảnh thật.<br/>
              2) Giao nhận ở điểm cố định (VD: sảnh thư viện/ký túc xá).<br/>
              3) Nếu bán: ghi giá rõ + ưu tiên đúng hẹn.<br/>
              4) Có admin duyệt bài để chợ sạch.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
