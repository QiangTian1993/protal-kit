import React from 'react'

interface HibernatedViewProps {
  profileName: string
  snapshotPath?: string
  onRestore: () => void
}

export function HibernatedView({ profileName, snapshotPath, onRestore }: HibernatedViewProps) {
  // 自动激活
  React.useEffect(() => {
    onRestore()
  }, [onRestore])

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        backgroundImage: snapshotPath ? `url("file://${snapshotPath}")` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {/* 只显示快照，无遮罩 */}
    </div>
  )
}
