import { invokeResult } from './request'

export async function setLayoutSize(args: {
  sidebarWidth: number
  topbarHeight: number
  rightInset?: number
}) {
  return invokeResult<{ applied: boolean }>('app.layout.set', args)
}
