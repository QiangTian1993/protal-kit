import { invoke } from './request'

export async function setLayoutSize(args: {
  sidebarWidth: number
  topbarHeight: number
  rightInset?: number
}) {
  return invoke<{ applied: boolean }>('app.layout.set', args)
}
