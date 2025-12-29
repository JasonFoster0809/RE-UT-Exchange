# API nhanh

Base: `/api`

## Auth
- POST `/auth/register` {full_name,email,password}
- POST `/auth/login` {email,password}
- GET `/me` (Bearer)

## Items
- GET `/items?status=available&q=&type=book&mode=swap`
- GET `/items/:id`
- POST `/items` (Bearer)
- PUT `/items/:id` (Bearer)
- DELETE `/items/:id` (Bearer)

## Swaps
- POST `/swaps` (Bearer) {item_id,message}
- GET `/swaps/mine` (Bearer)
- GET `/swaps/incoming` (Bearer)
- PUT `/swaps/:id/status` (Bearer) {status}

## Messages
- GET `/swaps/:id/messages` (Bearer)
- POST `/swaps/:id/messages` (Bearer) {body}


## Admin (Bearer + role=admin)
- GET `/admin/users`
- PUT `/admin/users/:id/role` {role: "user"|"admin"}
- GET `/admin/items`
- PUT `/admin/items/:id/status` {status: "available"|"reserved"|"exchanged"|"hidden"}
- GET `/admin/swaps`
