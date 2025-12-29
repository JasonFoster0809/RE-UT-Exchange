const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api'

export function getToken(){
  return localStorage.getItem('token') || ''
}
export function setToken(t){
  if(t) localStorage.setItem('token', t)
  else localStorage.removeItem('token')
}

async function req(path, {method='GET', body, auth=false} = {}){
  const headers = {'Content-Type':'application/json'}
  if(auth){
    const t = getToken()
    if(t) headers['Authorization'] = `Bearer ${t}`
  }
  const res = await fetch(`${API_BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(()=> ({}))
  if(!res.ok){
    const msg = data?.error || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return data
}

export const api = {
  // Admin
  adminUsers: () => req('/admin/users', {auth:true}),
  adminSetUserRole: (id, role) => req(`/admin/users/${id}/role`, {method:'PUT', body:{role}, auth:true}),
  adminItems: () => req('/admin/items', {auth:true}),
  adminSetItemStatus: (id, status) => req(`/admin/items/${id}/status`, {method:'PUT', body:{status}, auth:true}),
  adminSwaps: () => req('/admin/swaps', {auth:true}),

  health: () => req('/health'),
  register: (payload) => req('/auth/register', {method:'POST', body: payload}),
  login: (payload) => req('/auth/login', {method:'POST', body: payload}),
  me: () => req('/me', {auth:true}),

  listItems: (params={}) => {
    const qs = new URLSearchParams(params).toString()
    return req(`/items${qs ? `?${qs}` : ''}`)
  },
  getItem: (id) => req(`/items/${id}`),
  createItem: (payload) => req('/items', {method:'POST', body: payload, auth:true}),
  updateItem: (id, payload) => req(`/items/${id}`, {method:'PUT', body: payload, auth:true}),
  deleteItem: (id) => req(`/items/${id}`, {method:'DELETE', auth:true}),

  createSwap: (payload) => req('/swaps', {method:'POST', body: payload, auth:true}),
  mySwaps: () => req('/swaps/mine', {auth:true}),
  incomingSwaps: () => req('/swaps/incoming', {auth:true}),
  setSwapStatus: (id, status) => req(`/swaps/${id}/status`, {method:'PUT', body:{status}, auth:true}),
  listMessages: (swapId) => req(`/swaps/${swapId}/messages`, {auth:true}),
  sendMessage: (swapId, body) => req(`/swaps/${swapId}/messages`, {method:'POST', body:{body}, auth:true}),
}
