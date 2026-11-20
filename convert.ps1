# Helper for the converter (convert.js):
#   hasword                 prints yes / no: is Microsoft Word installed?
#   wic <in> <out.png>      decodes any image Windows can read (BMP, ICO, HEIC, ...) and writes it as a PNG
#   word <jobs.json>        converts documents with Word: [{ id, in, out, fmt }] (fmt 17 = PDF, 16 = DOCX),
#                           printing one JSON line per document: { id, ok, error }
param([string]$mode, [string]$a, [string]$b)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

if ($mode -eq 'hasword') {
  if (Test-Path 'Registry::HKEY_CLASSES_ROOT\Word.Application\CLSID') { 'yes' } else { 'no' }
  exit 0
}

if ($mode -eq 'wic') {
  Add-Type -AssemblyName PresentationCore
  $in = [IO.File]::OpenRead($a)
  try {
    $dec = [Windows.Media.Imaging.BitmapDecoder]::Create($in, [Windows.Media.Imaging.BitmapCreateOptions]::PreservePixelFormat, [Windows.Media.Imaging.BitmapCacheOption]::OnLoad)
    # an icon holds several sizes: take the biggest
    $frame = $dec.Frames | Sort-Object { $_.PixelWidth * $_.PixelHeight } -Descending | Select-Object -First 1
    $enc = New-Object Windows.Media.Imaging.PngBitmapEncoder
    $enc.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($frame))
    $out = [IO.File]::Create($b)
    try { $enc.Save($out) } finally { $out.Close() }
  } finally { $in.Close() }
  exit 0
}

if ($mode -eq 'word') {
  $jobs = @(Get-Content -LiteralPath $a -Raw -Encoding UTF8 | ConvertFrom-Json | ForEach-Object { $_ }) # one job per item, also for a single one
  # Opening a PDF makes Office's PDF converter (PDFREFLOW.exe, a separate process) ask "Word will now convert your
  # PDF..." even with alerts off, and nobody can answer a hidden Word. A watcher presses its OK button: only on that
  # dialog, only from a converter started during this run.
  Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, WindowsBase
  $refs = @([Windows.Automation.AutomationElement].Assembly.Location, [Windows.Automation.ControlType].Assembly.Location, [System.Windows.Threading.Dispatcher].Assembly.Location)
  Add-Type -ReferencedAssemblies $refs -TypeDefinition @'
using System; using System.Diagnostics; using System.Threading; using System.Windows.Automation;
public static class PdfOk {
  public static void Start(DateTime since) {
    var t = new Thread(() => {
      while (true) {
        try {
          foreach (var p in Process.GetProcessesByName("PDFREFLOW")) {
            if (p.StartTime < since) continue;
            var dlg = AutomationElement.RootElement.FindFirst(TreeScope.Children, new AndCondition(
              new PropertyCondition(AutomationElement.ProcessIdProperty, p.Id), new PropertyCondition(AutomationElement.ClassNameProperty, "NUIDialog")));
            if (dlg == null) continue;
            var btns = dlg.FindAll(TreeScope.Descendants, new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Button));
            AutomationElement ok = null;
            foreach (AutomationElement b in btns) if (b.Current.Name == "OK") ok = b;
            if (ok == null && btns.Count > 0) ok = btns[0]; // OK comes first, whatever the language
            object pat;
            if (ok != null && ok.TryGetCurrentPattern(InvokePattern.Pattern, out pat)) ((InvokePattern)pat).Invoke();
          }
        } catch {}
        Thread.Sleep(300);
      }
    });
    t.IsBackground = true; t.Start();
  }
}
'@
  $runStart = Get-Date
  [PdfOk]::Start($runStart.AddSeconds(-1))
  # the Word process started for this run (a Word the user already has open is never it)
  $before = @(Get-Process WINWORD -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
  $w = New-Object -ComObject Word.Application
  $mine = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Where-Object { $before -notcontains $_.Id } | ForEach-Object { $_.Id }) | Select-Object -First 1
  [Console]::Out.WriteLine((@{ pid = $mine } | ConvertTo-Json -Compress)); [Console]::Out.Flush()
  $empty = $false
  try {
    $w.Visible = $false
    $w.DisplayAlerts = 0             # no dialogs
    $w.AutomationSecurity = 3        # macros off, whatever the document wants
    foreach ($j in $jobs) {
      $d = $null
      try {
        # Open(FileName, ConfirmConversions, ReadOnly, AddToRecentFiles, PasswordDocument): a made-up password makes
        # a protected document fail right away instead of waiting on a password box nobody can see
        $d = $w.Documents.Open([string]$j.in, $false, $true, $false, 'kitty-has-no-password')
        if ([int]$j.fmt -eq 17) { $d.ExportAsFixedFormat([string]$j.out, 17) } else { $d.SaveAs2([string]$j.out, 16) }
        [Console]::Out.WriteLine((@{ id = $j.id; ok = $true } | ConvertTo-Json -Compress))
      } catch {
        [Console]::Out.WriteLine((@{ id = $j.id; ok = $false; error = $_.Exception.Message.Split("`n")[0].Trim() } | ConvertTo-Json -Compress))
      } finally {
        if ($d) { try { $d.Close(0) } catch {} }
        [Console]::Out.Flush()
      }
    }
  } finally {
    # only quit a Word that has nothing else open (never close the user's own documents)
    try { if ($w.Documents.Count -eq 0) { $empty = $true; $w.Quit(0) } } catch {}
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($w); $w = $null
    [GC]::Collect(); [GC]::WaitForPendingFinalizers()
    # a hidden Word sometimes stays behind after Quit: end the one started here, if it had nothing else open
    if ($mine -and $empty) { Start-Sleep -Milliseconds 1500; Stop-Process -Id $mine -Force -ErrorAction SilentlyContinue }
    # the PDF converter it started, if it stayed behind
    Get-Process PDFREFLOW -ErrorAction SilentlyContinue | Where-Object { $_.StartTime -ge $runStart } | Stop-Process -Force -ErrorAction SilentlyContinue
  }
  exit 0
}

Write-Error "unknown mode $mode"
exit 1
