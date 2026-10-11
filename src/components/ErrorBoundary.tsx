import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props={children:ReactNode}
type State={error:Error|null}

export class ErrorBoundary extends Component<Props,State>{
  state:State={error:null}
  static getDerivedStateFromError(error:Error):State{return {error}}
  componentDidCatch(error:Error,info:ErrorInfo){console.error('[PosBakso] Unhandled UI error',error,info.componentStack)}
  private reload=()=>window.location.reload()
  render(){
    if(this.state.error)return <main className="fatal-error" role="alert"><div><img src="/icon.svg" alt=""/><span>POS RECOVERY</span><h1>Aplikasi mengalami kendala tampilan</h1><p>Data transaksi lokal tidak otomatis dihapus. Muat ulang aplikasi. Jika masalah berulang, ekspor backup dari perangkat lain atau hubungi administrator sebelum membersihkan data browser.</p><code>{this.state.error.message}</code><button className="primary" onClick={this.reload}>Muat Ulang Aplikasi</button></div></main>
    return this.props.children
  }
}
