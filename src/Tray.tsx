import { useEffect, useState } from 'react'
import { Inbox, X } from 'lucide-react'

// Drop zone + list of remembered files. Drag a file out of here into any app; click to open.
export default function Tray() {
  const [files, setFiles] = useState<TrayFile[]>([])
  useEffect(() => {
    window.kitty.tray().then(setFiles)
    return window.kitty.onTray(setFiles)
  }, [])

  if (files.length === 0)
    return (
      <div className="drop">
        <Inbox size={26} />
        <b>Drop files here</b>
        <span>Drag them out any time · click to open</span>
      </div>
    )

  return (
    <div className="files">
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
    </div>
  )
}
