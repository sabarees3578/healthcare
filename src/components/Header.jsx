import React from 'react'
export default function Header({ user, onOpenSettings, onLogout }){
  return (
    <div className="header">
      <div className="inner container">
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <div style={{fontWeight:700}}>🏥 Health Portal</div>
        </div>
        <div className="row" style={{minWidth:180,justifyContent:'flex-end'}}>
          {user && <div className="small" style={{marginRight:8}}>{user.email}</div>}
          <button className="ghost" onClick={onOpenSettings}>Settings</button>
          {user && <button onClick={onLogout}>Logout</button>}
        </div>
      </div>
    </div>
  )
}
