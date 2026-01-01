import React from 'react'

interface LoadingSkeletonProps {
  message?: string
}

export function LoadingSkeleton({ message = '加载中...' }: LoadingSkeletonProps) {
  return (
    <div className="loadingSkeleton">
      <div className="loadingSkeletonContent">
        <div className="loadingSpinner" />
        <div className="loadingMessage">{message}</div>
        <div className="loadingProgress">
          <div className="loadingProgressBar" />
        </div>
      </div>
    </div>
  )
}

interface LoadingTimeoutProps {
  onRetry?: () => void
  onCancel?: () => void
}

export function LoadingTimeout({ onRetry, onCancel }: LoadingTimeoutProps) {
  return (
    <div className="loadingTimeout">
      <div className="loadingTimeoutContent">
        <div className="loadingTimeoutIcon">⏱️</div>
        <div className="loadingTimeoutTitle">加载超时</div>
        <div className="loadingTimeoutMessage">
          页面加载时间过长，可能是网络问题或服务器响应缓慢
        </div>
        <div className="loadingTimeoutActions">
          {onRetry && (
            <button className="btn btnPrimary" onClick={onRetry}>
              重试
            </button>
          )}
          {onCancel && (
            <button className="btn" onClick={onCancel}>
              取消
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
