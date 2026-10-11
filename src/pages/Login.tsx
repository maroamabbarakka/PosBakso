import { useMemo, useState } from 'react'
import { usePosStore } from '../context/PosStore'
import { Icon } from '../components/Icon'

const demoPins: Record<string,string> = { owner:'1234', manager:'2468', cashier:'3579', kitchen:'1111' }

export function LoginPage() {
  const { data, loginWithPin, loginWithEmail, demoMode, cloudSyncEnabled } = usePosStore()
  const users = useMemo(() => data.users.filter(u => u.active), [data.users])
  const [userId, setUserId] = useState(users[0]?.id ?? '')
  const [pin, setPin] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const selected = users.find(u => u.id === userId)

  const submitPin = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('')
    const ok = await loginWithPin(userId, pin)
    if (!ok) setError('PIN tidak sesuai. Periksa kembali PIN pengguna.')
    setBusy(false)
  }
  const submitCloud = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('')
    const result = await loginWithEmail(email,password)
    if (!result.ok) setError(result.message ?? 'Login gagal.')
    setBusy(false)
  }

  return <main className="login-screen">
    <section className="login-brand-panel">
      <div className="login-brand"><img src={data.settings.logoUrl||'/icon.svg'} alt=""/><div><strong>{data.settings.brandName}</strong><span>{data.settings.outletName}</span></div></div>
      <div className="login-copy"><span className="eyebrow light">POINT OF SALE V2</span><h1>Kasir cepat.<br/>Kontrol bisnis lengkap.</h1><p>POS F&B offline-first dengan laporan, inventory resep, shift kasir, role bertingkat dan printer thermal.</p></div>
      <div className="login-feature-row"><span><Icon name="wifi"/> Offline-ready</span><span><Icon name="printer"/> ESC/POS</span><span><Icon name="report"/> Laporan profesional</span></div>
    </section>
    <section className="login-form-panel">
      {demoMode ? <form className="login-card" onSubmit={submitPin}>
        <div className="login-mobile-brand"><img src={data.settings.logoUrl||'/icon.svg'} alt=""/><strong>{data.settings.brandName}</strong></div>
        <span className="eyebrow">AKSES POS • DEMO LOKAL</span><h2>Masuk ke aplikasi</h2><p>Pilih profil lalu masukkan PIN operasional.</p>
        <label className="field-label">Pengguna</label>
        <div className="user-selector">{users.map(user => <button type="button" key={user.id} className={user.id===userId?'active':''} onClick={()=>{setUserId(user.id);setPin('');setError('')}}><span className="avatar">{user.avatarInitials}</span><span><b>{user.name}</b><small>{user.roleLabel}</small></span>{user.id===userId && <Icon name="check"/>}</button>)}</div>
        <label className="field-label" htmlFor="pin">PIN</label><div className="pin-input"><Icon name="lock"/><input id="pin" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" autoComplete="one-time-code" placeholder="••••" type="password"/></div>
        {error&&<div className="form-error"><Icon name="alert" size={16}/>{error}</div>}
        <button className="primary login-submit" disabled={!userId||pin.length<4||busy}>{busy?'Memverifikasi...':'MASUK KE POS'}</button>
        {selected&&<div className="demo-hint"><Icon name="info"/><span>PIN demo <b>{demoPins[selected.role]??'—'}</b>. Ubah <code>VITE_DEMO_MODE=false</code> untuk Firebase Authentication produksi.</span></div>}
      </form> : <form className="login-card" onSubmit={submitCloud}>
        <div className="login-mobile-brand"><img src={data.settings.logoUrl||'/icon.svg'} alt=""/><strong>{data.settings.brandName}</strong></div>
        <span className="eyebrow">FIREBASE AUTHENTICATION</span><h2>Masuk ke POS</h2><p>Gunakan akun operasional yang sudah dibuat pada Firebase Authentication.</p>
        <label className="field-label">Email</label><div className="pin-input"><Icon name="user"/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nama@usaha.id" autoComplete="username"/></div>
        <label className="field-label">Password</label><div className="pin-input"><Icon name="lock"/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" autoComplete="current-password"/></div>
        {error&&<div className="form-error"><Icon name="alert" size={16}/>{error}</div>}
        <button className="primary login-submit" disabled={!cloudSyncEnabled||!email||!password||busy}>{busy?'Menghubungkan...':'MASUK KE POS'}</button>
        {!cloudSyncEnabled&&<div className="form-error"><Icon name="alert" size={16}/>Konfigurasi Firebase belum lengkap. Isi file <code>.env.local</code>.</div>}
        <div className="demo-hint"><Icon name="check"/><span>Session cloud memakai Firebase Authentication. Transaksi tetap disimpan lokal terlebih dahulu lalu disinkronkan melalui antrean offline.</span></div>
      </form>}
    </section>
  </main>
}
