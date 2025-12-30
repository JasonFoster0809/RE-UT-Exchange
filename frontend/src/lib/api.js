const API_URL = 'http://localhost:5000/api'

export function getToken(){ return localStorage.getItem('token') }
export function setToken(token){ 
  if(token) localStorage.setItem('token', token)
  else localStorage.removeItem('token')
}

async function request(method, endpoint, body, isFile=false){
  const headers = {}
  const token = getToken()
  if(token) headers['Authorization'] = `Bearer ${token}`
  
  if(!isFile) headers['Content-Type'] = 'application/json'

  const opts = { method, headers }
  if(body) opts.body = isFile ? body : JSON.stringify(body)

  const res = await fetch(API_URL + endpoint, opts)
  const data = await res.json()
  if(!res.ok) throw new Error(data.error || 'Có lỗi xảy ra')
  return data
}

export const api = {
  register: (data) => request('POST', '/auth/register', data),
  login: (data) => request('POST', '/auth/login', data),
  me: () => request('GET', '/me'),
  updateMe: (data) => request('PUT', '/me', data),

  // UPLOAD ẢNH
  uploadImage: (formData) => request('POST', '/upload', formData, true),

  listItems: (params) => {
    const qs = new URLSearchParams(params).toString()
    return request('GET', `/items?${qs}`)
  },
  createItem: (data) => request('POST', '/items', data),
  updateItem: (id, data) => request('PUT', `/items/${id}`, data),
  deleteItem: (id) => request('DELETE', `/items/${id}`),

  getWishlist: () => request('GET', '/wishlist'),
  toggleWishlist: (id) => request('POST', `/wishlist/${id}`),

  createSwap: (data) => request('POST', '/swaps', data),
  mySwaps: () => request('GET', '/swaps/mine'),
  incomingSwaps: () => request('GET', '/swaps/incoming'),
  
  // ZALO CHAT
  getConversations: () => request('GET', '/chat/conversations'),
  getPartnerMessages: (pid) => request('GET', `/chat/partner/${pid}`),
  sendPartnerMessage: (pid, body) => request('POST', `/chat/partner/${pid}`, {body}),

  adminStats: () => request('GET', '/admin/stats'),
  adminItems: () => request('GET', '/admin/items'),
  adminUsers: () => request('GET', '/admin/users'),
  adminSwaps: () => request('GET', '/admin/swaps'),
  adminSetItemStatus: (id, status) => request('PUT', `/admin/items/${id}/status`, {status}),
  adminSetUserRole: (id, role) => request('PUT', `/admin/users/${id}/role`, {role}),
}