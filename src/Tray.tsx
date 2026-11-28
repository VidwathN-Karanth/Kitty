import { useEffect, useRef, useState } from 'react'
import { Files, Inbox, X, Smartphone, Check, LoaderCircle, CircleAlert } from 'lucide-react'
import { usePhone, phoneLabel } from './usePhone'

// Drop files on it and they go to the phone (KDE Connect); a click sends what's in the tray. Not there without KDE Connect.
function PhoneDrop({ files, big }: { files: string[]; big?: boolean }) {
  const { device, status, send } = usePhone()
  const [over, setOver] = useState(false)
  const depth = useRef(0)
  if (device === null) return null
  const busy = status?.state === 'sending', ok = status?.state === 'done' && status.ok, bad = status?.state === 'done' && !status.ok
  const sub = status ? phoneLabel(status, device ? device.name : undefined) : device ? device.name : device === false ? 'Phone not reachable' : 'Looking for your phone…'
  return (
    <div className={'phone-drop' + (big ? ' big' : '') + (over ? ' over' : '') + (busy ? ' busy' : '') + (ok ? ' ok' : '') + (bad ? ' bad' : '') + (device ? '' : ' away')}
      data-drop="phone" title={device ? `Drop files here to send them to ${device.name}${files.length ? ', or click to send everything in the tray' : ''}` : 'Open KDE Connect on your phone'}
      onDragEnter={() => { depth.current++; setOver(true) }} onDragLeave={() => { if (--depth.current <= 0) { depth.current = 0; setOver(false) } }} onDrop={() => { depth.current = 0; setOver(false) }}
      onClick={() => { if (device && files.length && !busy) send(files) }}>
      <span className="pd-ico">{busy ? <LoaderCircle size={big ? 24 : 20} className="spin" /> : ok ? <Check size={big ? 24 : 20} /> : bad ? <CircleAlert size={big ? 24 : 20} /> : <Smartphone size={big ? 24 : 20} />}</span>
      <b>Send to phone</b>
      <span className="pd-sub">{sub}</span>
    </div>
  )
}

// Drop zone + list of remembered files. Drag a file (or all of them at once) out of here into any app; click to open.
export default function Tray() {
  const [files, setFiles] = useState<TrayFile[]>([])
  useEffect(() => {
    window.kitty.tray().then(setFiles)
    return window.kitty.onTray(setFiles)
  }, [])

  if (files.length === 0)
    return (
      <div className="tray-empty">
        <div className="drop">
          <Inbox size={26} />
          <b>Drop files here</b>
          <span>Drag them out any time · click to open</span>
        </div>
        <PhoneDrop files={[]} big />
      </div>
    )

  return (
    <div className="files">
      {files.length > 1 && (
        <div className="file all" draggable title="Drag every file out at once" onDragStart={(e) => { e.preventDefault(); window.kitty.dragFile(files.map((f) => f.path)) }}>
          <Files size={26} />
          <span>Drag all {files.length}</span>
        </div>
      )}
      {files.map((f) => (
        <div
          key={f.path}
          className="file"
          draggable
          title={f.path}
          onDragStart={(e) => { e.preventDefault(); window.kitty.dragFile(f.path) }}
          onClick={() => window.kitty.openFile(f.path)}
        >
          <img src={f.icon} width={32} height={32} />
          <span>{f.name}</span>
          <button className="x" onClick={(e) => { e.stopPropagation(); window.kitty.removeFile(f.path) }}><X size={12} /></button>
        </div>
      ))}
      <div className="drop mini"><span>Drop more files here</span></div>
      <PhoneDrop files={files.map((f) => f.path)} />
    </div>
  )
}
