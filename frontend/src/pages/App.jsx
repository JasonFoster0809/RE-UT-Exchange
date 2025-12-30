import React, { useEffect, useMemo, useState, useRef } from 'react'
import { api, getToken, setToken } from '../lib/api.js'

// --- UTILS ---
function timeAgo(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString + (dateString.endsWith('Z') ? '' : 'Z'))
  const seconds = Math.floor((new Date() - date) / 1000)
  if (seconds < 60) return "Vừa xong"
  const intervals = { năm: 31536000, tháng: 2592000, ngày: 86400, giờ: 3600, phút: 60 }
  for (const [unit, value] of Object.entries(intervals)) {
    const count = Math.floor(seconds / value)
    if (count >= 1) return `${count} ${unit} trước`
  }
  return "Vừa xong"
}

const Avatar = ({name, size=32}) => <img src={`https://ui-avatars.com/api/?name=${name}&background=random&color=fff&size=${size*2}`} style={{width:size, height:size, borderRadius:'50%', objectFit:'cover', border:'2px solid white', boxShadow:'0 2px 4px rgba(0,0,0,0.1)'}} alt=""/>

// --- TOAST ---
const ToastContext = React.createContext()
function ToastProvider({children}){
  const [toasts, setToasts] = useState([])
  const addToast = (msg, type='info') => {
    const id = Date.now(); setToasts(p => [...p, {id, msg, type}])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000)
  }
  return <ToastContext.Provider value={addToast}>{children}<div className="toast-container">{toasts.map(t=><div key={t.id} className="toast">{t.msg}</div>)}</div></ToastContext.Provider>
}
const useToast = () => React.useContext(ToastContext)

// --- COMPONENTS ---

function Header({user, setView, onLogout, onEditProfile}){
    return (
        <div className="header">
            <div className="brand" onClick={()=>setView('market')}>
                <span>BK</span> Exchange
            </div>
            <div style={{display:'flex', gap:10, alignItems:'center'}}>
                {user ? (
                    <>
                        <button className="btn" onClick={()=>setView('swaps')}>💬 Chat</button>
                        <button className="btn" onClick={()=>setView('saved')}>❤️ Lưu</button>
                        
                        <div className="profile-badge" onClick={onEditProfile} title="Sửa hồ sơ">
                            <Avatar name={user.full_name} size={36} />
                            <div className="profile-info">
                                <div className="profile-name">{user.full_name || "User"}</div>
                                <div className="profile-role">{user.role==='admin'?'Quản trị viên':'Thành viên'}</div>
                            </div>
                        </div>

                        {user.role==='admin' && <button className="btn" onClick={()=>setView('admin')}>Admin</button>}
                        <button className="btn" onClick={onLogout} style={{background:'rgba(255,0,0,0.2)', border:'none', color:'white'}}>Exit</button>
                    </>
                ) : (
                    <button className="btn" style={{background:'white', color:'var(--primary)', fontWeight:'bold'}} onClick={()=>window.dispatchEvent(new Event('openAuth'))}>
                        Đăng nhập / Đăng ký
                    </button>
                )}
            </div>
        </div>
    )
}

function CategoryBar({current, setFilter}){
    const cats = [
        {id:'', name:'Tất cả', icon:'🏫'},
        {id:'book', name:'Sách/Giáo trình', icon:'📚'},
        {id:'tool', name:'Dụng cụ học tập', icon:'📐'},
        {id:'device', name:'Điện tử/Máy tính', icon:'💻'},
        {id:'fashion', name:'Đồng phục/Áo', icon:'👕'},
        {id:'other', name:'Đồ linh tinh', icon:'📦'},
    ]
    return (
        <div className="cat-scroll">
            {cats.map(c => (
                <div key={c.id} className={`cat-item ${current===c.id?'active':''}`} onClick={()=>setFilter(p=>({...p, type:c.id}))}>
                    <div className="cat-icon">{c.icon}</div>
                    <div className="cat-name">{c.name}</div>
                </div>
            ))}
        </div>
    )
}

function FilterBar({filter, setFilter}){
    return (
        <div className="filter-bar">
            <div className="filter-group">
                <span className="filter-label">Sắp xếp:</span>
                <select className="input" style={{marginBottom:0, padding:6}} value={filter.sort||'new'} onChange={e=>setFilter(p=>({...p, sort:e.target.value}))}>
                    <option value="new">Mới nhất</option>
                    <option value="price_asc">Giá thấp đến cao</option>
                    <option value="price_desc">Giá cao đến thấp</option>
                    <option value="old">Cũ nhất</option>
                </select>
            </div>
            <div className="filter-group">
                <span className="filter-label">Giá:</span>
                <input className="input" type="number" style={{marginBottom:0, padding:6, width:80}} placeholder="Min" value={filter.min_price||''} onChange={e=>setFilter(p=>({...p, min_price:e.target.value}))} />
                <span>-</span>
                <input className="input" type="number" style={{marginBottom:0, padding:6, width:80}} placeholder="Max" value={filter.max_price||''} onChange={e=>setFilter(p=>({...p, max_price:e.target.value}))} />
            </div>
        </div>
    )
}

function SkeletonCard(){
    return (
        <div className="skeleton-card">
            <div className="skeleton skeleton-thumb"></div>
            <div style={{padding:10}}>
                <div className="skeleton skeleton-line"></div>
                <div className="skeleton skeleton-line short"></div>
            </div>
        </div>
    )
}

function ProductCard({item, isLiked, onToggleLike, onClick}){
    return (
        <div className="product-card" onClick={onClick}>
            <div className="product-thumb">
                {item.image_url ? <img src={item.image_url} alt="" /> : <span>📷</span>}
                <button className={`heart-btn ${isLiked?'liked':''}`} onClick={(e)=>{e.stopPropagation(); onToggleLike(item)}}>
                    {isLiked ? '♥' : '♡'}
                </button>
            </div>
            <div className="product-info">
                <div className="product-title">
                    {item.exchange_mode==='request' && <span style={{color:'var(--primary)', fontWeight:'bold'}}>[CẦN MUA] </span>}
                    {item.title}
                </div>
                <div className="product-price">
                    {item.price ? Number(item.price).toLocaleString() + ' đ' : (item.exchange_mode==='donate'?'🎁 Tặng miễn phí':'✨ Trao đổi')}
                </div>
                <div className="product-meta">
                    <div style={{display:'flex', alignItems:'center'}}>
                        <Avatar name={item.owner_name} size={16} /> 
                        <span style={{marginLeft:6, maxWidth:80, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{item.owner_name}</span>
                    </div>
                    <span>{timeAgo(item.created_at)}</span>
                </div>
                {item.is_trusted && <div style={{fontSize:10, color:'green', marginTop:2}}>✅ Uy tín</div>}
            </div>
        </div>
    )
}

function Modal({children, onClose}){
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e=>e.stopPropagation()}>
                <button onClick={onClose} style={{float:'right', border:'none', background:'none', fontSize:24, cursor:'pointer', color:'#999'}}>✕</button>
                {children}
            </div>
        </div>
    )
}

function AuthForm({onAuthed}){
    const [isLogin, setIsLogin] = useState(true)
    const [form, setForm] = useState({full_name:'', email:'', password:''})
    const toast = useToast()

    async function submit(){
        try {
            const res = isLogin ? await api.login(form) : await api.register(form)
            setToken(res.token); onAuthed(res.user); toast('Đăng nhập thành công')
        } catch(e){ toast(e.message) }
    }
    return (
        <div>
            <div className="h2" style={{textAlign:'center'}}>{isLogin?'Đăng nhập':'Đăng ký'}</div>
            <div style={{textAlign:'center', color:'#666', marginBottom:20}}>Sử dụng email Bách Khoa để tăng uy tín</div>
            
            {!isLogin && <input className="input" placeholder="Họ và tên" value={form.full_name} onChange={e=>setForm({...form, full_name:e.target.value})}/>}
            <input className="input" placeholder="Email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/>
            <input className="input" type="password" placeholder="Mật khẩu" value={form.password} onChange={e=>setForm({...form, password:e.target.value})}/>
            
            <button className="btn primary" style={{width:'100%', padding:12, fontSize:'1rem'}} onClick={submit}>
                {isLogin?'ĐĂNG NHẬP':'ĐĂNG KÝ'}
            </button>
            
            <div style={{textAlign:'center', marginTop:20, fontSize:14}}>
                <span style={{color:'var(--primary)', cursor:'pointer', fontWeight:'bold'}} onClick={()=>setIsLogin(!isLogin)}>
                    {isLogin ? 'Chưa có tài khoản? Đăng ký ngay' : 'Đã có tài khoản? Đăng nhập'}
                </span>
            </div>
        </div>
    )
}

function EditProfileForm({user, onSaved, onClose}){
    const [name, setName] = useState(user.full_name)
    const toast = useToast()
    async function save(){
        try {
            const res = await api.updateMe({full_name: name})
            toast('Cập nhật thành công'); 
            onSaved(res.user) 
        } catch(e){ toast(e.message) }
    }
    return (
        <div>
            <div className="h2">Sửa hồ sơ</div>
            <div style={{display:'flex', justifyContent:'center', marginBottom:20}}>
                <Avatar name={name} size={80} />
            </div>
            <label className="form-label">Họ và tên hiển thị:</label>
            <input className="input" value={name} onChange={e=>setName(e.target.value)} />
            <button className="btn primary" onClick={save} style={{width:'100%', marginTop:10}}>Lưu thay đổi</button>
        </div>
    )
}

function PostItemForm({onSaved, onClose, editing}){
    const [form, setForm] = useState({type:'book', title:'', description:'', category:'', condition:'good', exchange_mode:'sell', price:'', image_url:''})
    const [uploading, setUploading] = useState(false)
    const toast = useToast()
    
    useEffect(()=>{ if(editing) setForm(editing) }, [editing])

    // --- XỬ LÝ UPLOAD ẢNH ---
    async function handleFile(e){
        const file = e.target.files[0]
        if(!file) return
        setUploading(true)
        try {
            const data = new FormData()
            data.append('file', file)
            const res = await api.uploadImage(data)
            setForm(prev => ({...prev, image_url: res.url}))
            toast('Đã tải ảnh lên!')
        } catch(err) {
            toast('Lỗi upload: ' + err.message)
        } finally {
            setUploading(false)
        }
    }
    // ------------------------

    async function save(){
        try {
            const pl = {...form}; if(pl.price) pl.price = Number(pl.price); else delete pl.price
            if(editing) await api.updateItem(editing.id, pl); else await api.createItem(pl)
            toast('Đã đăng tin thành công!'); onSaved()
        } catch(e){ toast(e.message) }
    }
    return (
        <div>
            <div className="h2" style={{textAlign:'center'}}>{editing?'Sửa tin':'Đăng tin mới'}</div>
            
            <label style={{fontWeight:'bold', display:'block', marginBottom:4}}>Ảnh sản phẩm:</label>
            <div style={{marginBottom:16, textAlign:'center'}}>
                {form.image_url ? (
                    <div style={{position:'relative', display:'inline-block'}}>
                        <img src={form.image_url} style={{height:150, borderRadius:8, border:'1px solid #ddd'}} />
                        <button style={{position:'absolute', top:5, right:5, background:'red', color:'white', border:'none', borderRadius:'50%', width:24, height:24, cursor:'pointer'}} onClick={()=>setForm({...form, image_url:''})}>✕</button>
                    </div>
                ) : (
                    <div style={{border:'2px dashed #ccc', padding:20, borderRadius:8, cursor:'pointer', background:'#f9f9f9'}} onClick={()=>document.getElementById('fileInput').click()}>
                        {uploading ? 'Đang tải lên...' : '📷 Chọn ảnh / Chụp ảnh'}
                    </div>
                )}
                <input id="fileInput" type="file" accept="image/*" style={{display:'none'}} onChange={handleFile} />
            </div>

            <label style={{fontWeight:'bold', display:'block', marginBottom:4}}>Bạn muốn làm gì?</label>
            <select className="input" value={form.exchange_mode} onChange={e=>setForm({...form, exchange_mode:e.target.value})}>
                <option value="sell">Cần bán</option>
                <option value="swap">Muốn trao đổi</option>
                <option value="donate">Tặng miễn phí</option>
                <option value="request">Cần mua / Cần tìm</option>
            </select>

            <label style={{fontWeight:'bold', display:'block', marginBottom:4}}>Danh mục:</label>
            <select className="input" value={form.type} onChange={e=>setForm({...form, type:e.target.value})}>
                <option value="book">Sách / Giáo trình</option>
                <option value="tool">Dụng cụ học tập</option>
                <option value="device">Thiết bị điện tử</option>
                <option value="fashion">Đồng phục / Thời trang</option>
                <option value="other">Khác</option>
            </select>

            <input className="input" placeholder="Tiêu đề (VD: Sách Giải tích 1 còn mới)" value={form.title} onChange={e=>setForm({...form, title:e.target.value})}/>
            
            {form.exchange_mode !== 'donate' && form.exchange_mode !== 'swap' && (
                <input className="input" type="number" placeholder="Giá mong muốn (VNĐ)" value={form.price} onChange={e=>setForm({...form, price:e.target.value})}/>
            )}
            
            <textarea className="input" style={{height:100}} placeholder="Mô tả chi tiết (Tình trạng, nơi giao dịch...)" value={form.description} onChange={e=>setForm({...form, description:e.target.value})}/>
            
            <button className="btn primary" style={{width:'100%', padding:12}} onClick={save} disabled={uploading}>
                {uploading ? 'Đang xử lý ảnh...' : (editing?'CẬP NHẬT':'ĐĂNG TIN')}
            </button>
        </div>
    )
}

function ProductDetail({item, user, onClose, onChat, onDelete, onEdit}){
    const isMine = user && Number(user.id) === Number(item.owner_id)
    return (
        <div>
            <div style={{height:250, background:'#f8f9fa', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20, borderRadius:8, border:'1px solid #eee'}}>
                {item.image_url ? <img src={item.image_url} style={{height:'100%', objectFit:'contain'}}/> : <span style={{fontSize:60, color:'#ddd'}}>📷</span>}
            </div>
            
            <div className="h2" style={{marginBottom:8, fontSize:'1.3rem'}}>{item.title}</div>
            <div style={{color:'var(--price-red)', fontWeight:'bold', fontSize:'1.4rem', marginBottom:16}}>
                {item.price ? Number(item.price).toLocaleString()+' đ' : (item.exchange_mode==='donate'?'Tặng miễn phí':'Trao đổi')}
            </div>
            
            <div style={{background:'#f0f8ff', padding:12, borderRadius:8, display:'flex', alignItems:'center', gap:12, marginBottom:20}}>
                <Avatar name={item.owner_name} size={40} />
                <div>
                    <div><strong>{item.owner_name}</strong> {item.is_trusted && '✅'}</div>
                    <div style={{fontSize:12, color:'#666'}}>Thành viên Bách Khoa • Hoạt động {timeAgo(item.created_at)}</div>
                </div>
            </div>
            
            <p style={{whiteSpace:'pre-line', marginBottom:24, lineHeight:1.6, color:'#444'}}>{item.description}</p>
            
            {isMine ? (
                <div style={{display:'flex', gap:10}}>
                    <button className="btn" style={{flex:1}} onClick={()=>onEdit(item)}>Sửa tin</button>
                    <button className="btn" style={{flex:1, color:'red', borderColor:'red'}} onClick={()=>onDelete(item)}>Xóa tin</button>
                </div>
            ) : (
                <button className="btn primary" style={{width:'100%', padding:14, fontSize:'1.1rem'}} onClick={()=>onChat(item)}>
                    💬 CHAT VỚI NGƯỜI BÁN
                </button>
            )}
        </div>
    )
}

function ZaloChat({user}){
    const [convos, setConvos] = useState([])
    const [activeId, setActiveId] = useState(null)
    const [msgs, setMsgs] = useState([])
    const [txt, setTxt] = useState('')
    const bottomRef = useRef(null)

    useEffect(()=>{ loadConvos() }, [])
    useEffect(()=>{ if(activeId) loadMsgs(activeId) }, [activeId])
    useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}) }, [msgs])

    async function loadConvos(){ const res = await api.getConversations(); setConvos(res.conversations) }
    async function loadMsgs(pid){ const res = await api.getPartnerMessages(pid); setMsgs(res.messages) }
    async function send(){ if(!txt.trim()) return; await api.sendPartnerMessage(activeId, txt); setTxt(''); loadMsgs(activeId); loadConvos() }

    const activePartner = convos.find(c => c.partner_id === activeId)

    return (
        <div className="zalo-layout">
            <div className={`zalo-sidebar ${activeId ? 'hide-mobile' : ''}`}>
                <div className="zalo-search"><input className="input" placeholder="Tìm kiếm bạn bè..." style={{border:'none', background:'transparent', padding:0, marginBottom:0}} /></div>
                <div className="zalo-list">
                    {convos.map(c => (
                        <div key={c.partner_id} className={`zalo-item ${activeId===c.partner_id?'active':''}`} onClick={()=>setActiveId(c.partner_id)}>
                            <Avatar name={c.partner_name} size={48} />
                            <div className="zalo-info">
                                <div className="zalo-name">{c.partner_name}</div>
                                <div className="zalo-last-msg">{c.last_message}</div>
                            </div>
                            <div style={{fontSize:10, color:'#888'}}>{timeAgo(c.last_time)}</div>
                        </div>
                    ))}
                    {convos.length===0 && <div style={{padding:20, textAlign:'center', color:'#999'}}>Chưa có tin nhắn</div>}
                </div>
            </div>
            
            <div className={`zalo-main ${!activeId ? 'hide-mobile' : ''}`}>
                {activeId ? (
                    <>
                        <div className="zalo-header">
                            <button className="btn" style={{marginRight:10, padding:'4px 10px'}} onClick={()=>setActiveId(null)}>⬅</button>
                            <Avatar name={activePartner?.partner_name} />
                            <div>{activePartner?.partner_name}</div>
                        </div>
                        <div className="zalo-messages">
                            {msgs.map((m, i) => {
                                const isMe = Number(m.sender_id) === Number(user.id)
                                const showContext = i===0 || msgs[i-1].item_title !== m.item_title
                                return (
                                    <React.Fragment key={m.id}>
                                        {showContext && m.item_title && <div style={{textAlign:'center', fontSize:11, color:'#888', margin:'10px 0'}}>--- Trao đổi về: {m.item_title} ---</div>}
                                        <div className={`msg-bubble ${isMe?'me':'them'}`}>
                                            <div>{m.body}</div>
                                            <span className="msg-meta">{timeAgo(m.created_at)}</span>
                                        </div>
                                    </React.Fragment>
                                )
                            })}
                            <div ref={bottomRef}></div>
                        </div>
                        <div className="zalo-input-area">
                            <input className="input" style={{marginBottom:0}} value={txt} onChange={e=>setTxt(e.target.value)} placeholder="Nhập tin nhắn..." onKeyDown={e=>e.key==='Enter'&&send()} />
                            <button className="btn primary" onClick={send}>Gửi</button>
                        </div>
                    </>
                ) : (
                    <div style={{display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#999', flexDirection:'column'}}>
                        <div style={{fontSize:50}}>👋</div>
                        <div>Chọn một hội thoại để bắt đầu</div>
                    </div>
                )}
            </div>
        </div>
    )
}

function AdminPanel({user}){
    const [tab, setTab] = useState('items'); const [stats, setStats] = useState({}); const [data, setData] = useState([]); const [loading, setLoading] = useState(false)
    async function load(){ setLoading(true); try{ const s=await api.adminStats(); setStats(s); const d=await (tab==='items'?api.adminItems():tab==='users'?api.adminUsers():api.adminSwaps()); setData(d.items||d.users||d.swaps||[]) }finally{setLoading(false)} }
    async function toggleStatus(id, current){ const next = current==='available'?'hidden':'available'; if(!confirm(`Đổi status?`))return; await api.adminSetItemStatus(id, next); load() }
    async function toggleRole(id, current){ const next = current==='user'?'admin':'user'; if(!confirm(`Đổi role?`))return; await api.adminSetUserRole(id, next); load() }
    useEffect(()=>{if(user?.role==='admin')load()},[user, tab])
    return (
        <div className="fade-in">
            <div className="h2">Admin Dashboard</div>
            <div className="stats-grid">
                <div className="stat-card"><div className="stat-value">{stats.users||0}</div><div className="stat-label">User</div></div>
                <div className="stat-card"><div className="stat-value">{stats.items||0}</div><div className="stat-label">Item</div></div>
                <div className="stat-card"><div className="stat-value">{stats.swaps||0}</div><div className="stat-label">Swap</div></div>
            </div>
            <div className="card">
                <div className="row" style={{marginBottom:16}}><button className={`btn ${tab==='items'?'primary':''}`} onClick={()=>setTab('items')}>Items</button><button className={`btn ${tab==='users'?'primary':''}`} onClick={()=>setTab('users')}>Users</button><button className={`btn ${tab==='swaps'?'primary':''}`} onClick={()=>setTab('swaps')}>Swaps</button></div>
                {loading ? <div style={{padding:20}}>Loading...</div> : <div style={{maxHeight:500, overflow:'auto'}}>{data.map(d=><div key={d.id} style={{padding:'12px 0', borderBottom:'1px solid #eee', display:'flex', justifyContent:'space-between'}}><div>#{d.id} {d.title||d.full_name||d.item_title} <span className="badge">{d.status||d.role}</span></div> {tab==='items'&&<button className="btn small" onClick={()=>toggleStatus(d.id, d.status)}>Ẩn/Hiện</button>} {tab==='users'&&<button className="btn small" onClick={()=>toggleRole(d.id, d.role)}>Quyền</button>}</div>)}</div>}
            </div>
        </div>
    )
}

// --- MAIN APP ---
export default function App(){
    return <ToastProvider><Main /></ToastProvider>
}

function Main(){
    const [user, setUser] = useState(null)
    const [view, setView] = useState('market')
    const [items, setItems] = useState([])
    const [wishlist, setWishlist] = useState([])
    const [filter, setFilter] = useState({q:'', type:'', sort:'new', min_price:'', max_price:''})
    const [loading, setLoading] = useState(false)
    
    // Modal states
    const [showAuth, setShowAuth] = useState(false)
    const [showPost, setShowPost] = useState(false)
    const [showProfile, setShowProfile] = useState(false)
    const [detailItem, setDetailItem] = useState(null)
    const [editItem, setEditItem] = useState(null)

    const toast = useToast()

    useEffect(() => {
        const handler = () => setShowAuth(true)
        window.addEventListener('openAuth', handler)
        return () => window.removeEventListener('openAuth', handler)
    }, [])

    useEffect(()=>{ loadUser(); }, [])
    useEffect(()=>{ loadItems() }, [filter]) 

    async function loadUser(){ 
        if(!getToken()) return;
        try{ const r=await api.me(); setUser(r.user); const w=await api.getWishlist(); setWishlist(w.ids||[]) }catch(e){setToken(null)}
    }
    async function loadItems(){
        setLoading(true)
        try{ const r = await api.listItems(filter); setItems(r.items) }catch(e){}
        finally{ setLoading(false) }
    }

    async function toggleLike(item){
        if(!user) return setShowAuth(true)
        try{ await api.toggleWishlist(item.id); const w=await api.getWishlist(); setWishlist(w.ids||[]) }catch(e){}
    }

    async function requestChat(item){
        if(!user) return setShowAuth(true)
        const msg = prompt('Nhập lời nhắn cho người bán:', 'Chào bạn, mình quan tâm món này.')
        if(msg) {
            await api.createSwap({item_id: item.id, message: msg})
            toast('Đã gửi tin nhắn'); setDetailItem(null); setView('swaps')
        }
    }

    const displayItems = items.filter(i => {
        if(view==='saved') return wishlist.includes(i.id)
        if(view==='mine') return Number(i.owner_id) === Number(user?.id)
        return true
    })

    return (
        <div>
            <Header user={user} setView={setView} onLogout={()=>{setToken(null); setUser(null); window.location.reload()}} onEditProfile={()=>setShowProfile(true)} />
            
            <div className="container">
                {view==='market' && (
                    <>
                        <CategoryBar current={filter.type} setFilter={setFilter} />
                        <FilterBar filter={filter} setFilter={setFilter} />
                    </>
                )}
                
                {view==='swaps' ? <div className="card" style={{padding:0, overflow:'hidden'}}><ZaloChat user={user} /></div> : view==='admin' ? <AdminPanel user={user}/> : (
                    <>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
                            <h3 style={{margin:0, color:'#555'}}>
                                {view==='saved' ? '❤️ Tin đã lưu' : view==='mine' ? '👤 Tin của tôi' : 'Tin đăng mới nhất'}
                            </h3>
                            {view==='market' && (
                                <input style={{padding:'6px 12px', border:'1px solid #ddd', borderRadius:20, width:150}} 
                                       placeholder="🔍 Tìm kiếm..." 
                                       onChange={e=>setFilter(p=>({...p, q:e.target.value}))} />
                            )}
                        </div>

                        {loading ? (
                            <div className="product-grid">
                                {[1,2,3,4,5,6].map(i => <SkeletonCard key={i}/>)}
                            </div>
                        ) : (
                            <div className="product-grid">
                                {displayItems.map(item => (
                                    <ProductCard 
                                        key={item.id} 
                                        item={item} 
                                        isLiked={wishlist.includes(item.id)}
                                        onToggleLike={toggleLike}
                                        onClick={()=>setDetailItem(item)}
                                    />
                                ))}
                            </div>
                        )}
                        {!loading && displayItems.length===0 && <div style={{textAlign:'center', marginTop:50, color:'#999'}}>Chưa có tin đăng nào.</div>}
                    </>
                )}
            </div>

            {view!=='swaps' && view!=='admin' && (
                <button className="fab" onClick={()=>{ if(!user) setShowAuth(true); else setShowPost(true) }}>
                    <span>✏️</span> ĐĂNG TIN
                </button>
            )}

            {showAuth && <Modal onClose={()=>setShowAuth(false)}><AuthForm onAuthed={(u)=>{setUser(u); setShowAuth(false); loadUser()}} /></Modal>}
            {(showPost || editItem) && <Modal onClose={()=>{setShowPost(false); setEditItem(null)}}><PostItemForm editing={editItem} onClose={()=>{setShowPost(false); setEditItem(null)}} onSaved={()=>{setShowPost(false); setEditItem(null); loadItems()}} /></Modal>}
            {showProfile && <Modal onClose={()=>setShowProfile(false)}><EditProfileForm user={user} onClose={()=>setShowProfile(false)} onSaved={(u)=>{setUser(u); setShowProfile(false)}} /></Modal>}
            {detailItem && <Modal onClose={()=>setDetailItem(null)}><ProductDetail item={detailItem} user={user} onClose={()=>setDetailItem(null)} onChat={requestChat} onDelete={async (i)=>{if(confirm('Xóa?')){await api.deleteItem(i.id); setDetailItem(null); loadItems()}}} onEdit={(i)=>{setEditItem(i); setDetailItem(null)}} /></Modal>}
        </div>
    )
}