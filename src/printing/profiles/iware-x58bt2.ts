import type { PrinterConfig } from '../../types'

export const IWARE_X58BT2_PROFILE = {
  id:'iware-x58bt2' as const,
  label:'IWARE X58BT II',
  paperWidth:58 as const,
  headWidthDots:384,
  safeRasterWidthDots:360,
  columns:32,
  codePage:'CP437' as const,
  hasCutter:false,
  hasDrawerPort:true,
}

export function applyIwareProfile(printer:PrinterConfig):PrinterConfig{
  return {...printer,profileId:IWARE_X58BT2_PROFILE.id,paperWidth:58,printWidthDots:IWARE_X58BT2_PROFILE.headWidthDots,characterSet:IWARE_X58BT2_PROFILE.codePage,cutPaper:false}
}
