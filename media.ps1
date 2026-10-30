# Long-running helper: reports the current Windows media session (Spotify, browser, ...) as JSON lines on stdout
# and accepts commands on stdin: toggle | next | prev.
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStreamReference, Windows.Storage.Streams, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.IInputStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
$asStream = [System.IO.WindowsRuntimeStreamExtensions].GetMethod('AsStreamForRead', [type[]]@([Windows.Storage.Streams.IInputStream]))

$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, $type) {
  $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
  $t.Wait(-1) | Out-Null
  $t.Result
}
function Emit($o) { [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress -Depth 4)); [Console]::Out.Flush() }

$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
# Console.In reads synchronously (it would block the whole loop), so read stdin through a StreamReader instead
$stdin = New-Object System.IO.StreamReader([Console]::OpenStandardInput())
$cmd = $stdin.ReadLineAsync()
$key = ''; $needArt = $false; $tick = 0; $lastV = -1; $lastM = $null; $lastA = $null

$lastPm = $null; $lastPc = $null
function InUse($cap) {
  $base = "HKCU:\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\$cap"
  foreach ($k in @($base, "$base\NonPackaged")) {
    if (-not (Test-Path $k)) { continue }
    foreach ($c in (Get-ChildItem $k -ErrorAction SilentlyContinue)) {
      $p = Get-ItemProperty $c.PSPath -ErrorAction SilentlyContinue
      if ($p -and $p.LastUsedTimeStart -gt 0 -and $p.LastUsedTimeStop -eq 0) { return $true }
    }
  }
  return $false
}

$null = [Windows.Devices.Radios.Radio, Windows.System.Devices, ContentType = WindowsRuntime]
$radioList = [System.Collections.Generic.IReadOnlyList[Windows.Devices.Radios.Radio]]
function AirplaneOn {
  try { $r = Await ([Windows.Devices.Radios.Radio]::GetRadiosAsync()) $radioList; return (($r.Count -gt 0) -and -not ($r | Where-Object { $_.State -eq 'On' })) }
  catch { return $false }
}

# Windows Core Audio (master volume + mute)
try {
  Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  int f(); int g(); int h(); int i();
  int SetMasterVolumeLevelScalar(float level, Guid ctx); int j();
  int GetMasterVolumeLevelScalar(out float level);
  int k(); int l(); int m(); int n();
  int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, Guid ctx);
  int GetMute(out bool mute);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice { int Activate(ref Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev); }
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator { int f(); int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint); }
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }
public class Audio {
  static IAudioEndpointVolume Vol() {
    var e = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
    IMMDevice d = null; Marshal.ThrowExceptionForHR(e.GetDefaultAudioEndpoint(0, 1, out d));
    IAudioEndpointVolume v = null; var id = typeof(IAudioEndpointVolume).GUID;
    Marshal.ThrowExceptionForHR(d.Activate(ref id, 23, 0, out v));
    return v;
  }
  public static float Volume {
    get { float v = -1; Marshal.ThrowExceptionForHR(Vol().GetMasterVolumeLevelScalar(out v)); return v; }
    set { Marshal.ThrowExceptionForHR(Vol().SetMasterVolumeLevelScalar(Math.Max(0f, Math.Min(1f, value)), Guid.Empty)); }
  }
  public static bool Mute {
    get { bool m = false; Marshal.ThrowExceptionForHR(Vol().GetMute(out m)); return m; }
    set { Marshal.ThrowExceptionForHR(Vol().SetMute(value, Guid.Empty)); }
  }
}
'@
} catch {}

while ($true) {
  # prefer a session that is actually playing (the "current" one can be a paused tab or app)
  $s = $null; $count = 0
  try {
    $all = @($mgr.GetSessions()); $count = $all.Count
    foreach ($x in $all) { if ($x.GetPlaybackInfo().PlaybackStatus -eq 'Playing') { $s = $x; break } }
    if (-not $s) { $s = $mgr.GetCurrentSession() }
    if (-not $s -and $count -gt 0) { $s = $all[0] }
  } catch { $s = $mgr.GetCurrentSession() }

  if ($cmd.IsCompleted) {
    $line = $cmd.Result
    if ($null -eq $line) { break }   # parent closed stdin: exit
    $cmd = $stdin.ReadLineAsync()
    $line = $line.Trim()
    if ($line -like 'vol *') { try { [Audio]::Volume = [float]::Parse($line.Substring(4), [Globalization.CultureInfo]::InvariantCulture) } catch {} }
    elseif ($line -eq 'mute') { try { [Audio]::Mute = -not [Audio]::Mute } catch {} }
    elseif ($s) {
      switch ($line) {
        'toggle' { $null = Await ($s.TryTogglePlayPauseAsync()) ([bool]) }
        'next'   { $null = Await ($s.TrySkipNextAsync()) ([bool]) }
        'prev'   { $null = Await ($s.TrySkipPreviousAsync()) ([bool]) }
      }
      $tick = 0
    }
  }

  # system volume: report whenever it changes (hardware keys, other apps, or our own slider)
  try {
    $v = [math]::Round([Audio]::Volume, 3); $m = [Audio]::Mute
    if ($v -ne $lastV -or $m -ne $lastM) { $lastV = $v; $lastM = $m; Emit @{ type = 'vol'; v = $v; mute = $m } }
  } catch {}

  # microphone / camera in use (like the iPhone's orange and green dots): an app has started using it and not stopped
  if ($tick -eq 2) {
    $pm = InUse 'microphone'; $pc = InUse 'webcam'
    if ($pm -ne $lastPm -or $pc -ne $lastPc) { $lastPm = $pm; $lastPc = $pc; Emit @{ type = 'priv'; mic = $pm; cam = $pc } }
  }

  if ($tick -le 0) {
    $tick = 4
    # airplane mode = radios exist and none of them (Wi-Fi, Bluetooth, mobile) is on
    $a = AirplaneOn
    if ($a -ne $lastA) { $lastA = $a; Emit @{ type = 'air'; on = $a } }
    if (-not $s) { Emit @{ type = 'state'; active = $false; sessions = $count } }
    else {
      try {
        $p = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
        $pb = $s.GetPlaybackInfo(); $tl = $s.GetTimelineProperties()
        $k = "$($p.Title)|$($p.Artist)"
        if ($k -ne $key) { $key = $k; $needArt = $true }
        Emit @{
          type = 'state'; active = $true; title = $p.Title; artist = $p.Artist
          playing = ($pb.PlaybackStatus -eq 'Playing')
          pos = [math]::Round($tl.Position.TotalSeconds, 1); end = [math]::Round($tl.EndTime.TotalSeconds, 1)
          app = $s.SourceAppUserModelId
        }
        if ($needArt -and $p.Thumbnail) {
          try {
            $rs = Await ($p.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
            # PowerShell 5 sees the stream as a bare COM object, so the .NET wrapper is called through reflection
            $st = $asStream.Invoke($null, @($rs))
            $ms = New-Object System.IO.MemoryStream; $st.CopyTo($ms)
            $bytes = $ms.ToArray()
            $mime = if ($bytes.Length -gt 3 -and $bytes[0] -eq 0x89 -and $bytes[1] -eq 0x50) { 'image/png' } elseif ($bytes.Length -gt 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xD8) { 'image/jpeg' } else { 'image/png' }
            if ($bytes.Length -gt 0) { Emit @{ type = 'art'; mime = $mime; data = [Convert]::ToBase64String($bytes) } }
            $needArt = $false
          } catch {}
        }
      } catch {}
    }
  }
  $tick--
  Start-Sleep -Milliseconds 250
}
