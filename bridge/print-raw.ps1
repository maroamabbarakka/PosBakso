param([Parameter(Mandatory=$true)][string]$PrinterName,[Parameter(Mandatory=$true)][string]$FilePath)
$source=@'
using System;
using System.Runtime.InteropServices;
public class RawPrinter {
 [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public class DOCINFO { [MarshalAs(UnmanagedType.LPWStr)] public string pDocName="POS Bakso"; [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile=null; [MarshalAs(UnmanagedType.LPWStr)] public string pDataType="RAW"; }
 [DllImport("winspool.drv", SetLastError=true, CharSet=CharSet.Unicode)] static extern bool OpenPrinter(string p, out IntPtr h, IntPtr d);
 [DllImport("winspool.drv", SetLastError=true)] static extern bool ClosePrinter(IntPtr h);
 [DllImport("winspool.drv", SetLastError=true, CharSet=CharSet.Unicode)] static extern int StartDocPrinter(IntPtr h,int l,DOCINFO d);
 [DllImport("winspool.drv", SetLastError=true)] static extern bool EndDocPrinter(IntPtr h);
 [DllImport("winspool.drv", SetLastError=true)] static extern bool StartPagePrinter(IntPtr h);
 [DllImport("winspool.drv", SetLastError=true)] static extern bool EndPagePrinter(IntPtr h);
 [DllImport("winspool.drv", SetLastError=true)] static extern bool WritePrinter(IntPtr h,byte[] b,int c,out int w);
 public static void Send(string printer,byte[] bytes){IntPtr h;if(!OpenPrinter(printer,out h,IntPtr.Zero))throw new System.ComponentModel.Win32Exception();try{if(StartDocPrinter(h,1,new DOCINFO())==0)throw new System.ComponentModel.Win32Exception();try{StartPagePrinter(h);int written;if(!WritePrinter(h,bytes,bytes.Length,out written)||written!=bytes.Length)throw new System.ComponentModel.Win32Exception();EndPagePrinter(h);}finally{EndDocPrinter(h);}}finally{ClosePrinter(h);}}
}
'@
Add-Type -TypeDefinition $source
[RawPrinter]::Send($PrinterName,[IO.File]::ReadAllBytes($FilePath))
