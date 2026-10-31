# Long-running helper: reports the current Windows media session (Spotify, browser, ...) as JSON lines on stdout
# and accepts commands on stdin: toggle | next | prev.
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStreamReference, Windows.Storage.Streams, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.IInputStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
# Window drags: while the left button is held and the active window moves, someone is dragging a window (maybe to
# the top of the screen for Snap layouts). Reported as {"type":"windrag","on":true/false} so the island steps aside.
# The same watcher reports a screenshot tool's selection overlay in front as {"type":"snip","on":...}.
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices; using System.Threading;
public static class WinDrag {
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int k);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [StructLayout(LayoutKind.Sequential)] struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern int GetSystemMetrics(int i);
  static readonly string[] Snippers = { "screenclippinghost", "snippingtool", "screensketch", "sharex", "greenshot", "lightshot", "snagit32", "snagitcapture", "snagiteditor", "picpick" };
  // a known screenshot tool, with a window covering the whole screen (its selection overlay, not its normal window)
  static bool IsSnipOverlay(IntPtr h) {
    try {
      uint pid; GetWindowThreadProcessId(h, out pid);
      string name = System.Diagnostics.Process.GetProcessById((int)pid).ProcessName.ToLowerInvariant();
      if (Array.IndexOf(Snippers, name) < 0) return false;
      RECT r; GetWindowRect(h, out r);
      return r.R - r.L >= GetSystemMetrics(0) && r.B - r.T >= GetSystemMetrics(1);
    } catch { return false; }
  }
  public static void Start() {
    var t = new Thread(() => {
      bool down = false, drag = false, snip = false; IntPtr w = IntPtr.Zero, lastFg = IntPtr.Zero; RECT r0 = new RECT(); int tick = 0;
      while (true) {
        bool now = (GetAsyncKeyState(1) & 0x8000) != 0;
        IntPtr fg = GetForegroundWindow();
        // a screenshot tool's full-screen selection overlay is in front: the island steps aside so it is not in the way
        if (fg != lastFg || ++tick % 12 == 0) {
          lastFg = fg;
          bool s = IsSnipOverlay(fg);
          if (s != snip) { snip = s; Console.Out.WriteLine(s ? "{\"type\":\"snip\",\"on\":true}" : "{\"type\":\"snip\",\"on\":false}"); Console.Out.Flush(); }
        }
        // a click on an inactive window activates it a moment later: follow whichever window is active
        if (now && (!down || fg != w)) { w = fg; GetWindowRect(w, out r0); }
        else if (now && !drag) {
          RECT r; IntPtr f = fg;
          // moved as a whole: both left and right edges (or top and bottom) shifted. A resize moves only one edge; a
          // maximized or full-screen window shrinks back as it is dragged, so its size is not compared
          if (f == w && GetWindowRect(f, out r) && ((Math.Abs(r.L - r0.L) > 6 && Math.Abs(r.R - r0.R) > 6) || (Math.Abs(r.T - r0.T) > 6 && Math.Abs(r.B - r0.B) > 6))) {
            drag = true; Console.Out.WriteLine("{\"type\":\"windrag\",\"on\":true}"); Console.Out.Flush();
          }
        } else if (!now && drag) { drag = false; Console.Out.WriteLine("{\"type\":\"windrag\",\"on\":false}"); Console.Out.Flush(); }
        down = now;
        Thread.Sleep(40);
      }
    });
    t.IsBackground = true; t.Start();
  }
}
'@
[WinDrag]::Start()

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

# GPU usage (%), only while the app asks for it ("gpu on" / "gpu off"). Windows only exposes it through the
# "GPU Engine" performance counters (one per process and engine): the 3D engines are summed per graphics card and
# the busiest card is reported, like Task Manager does.
$gpuOn = $false; $gpuTick = 0; $gpuRefresh = 0; $counters = @{}
function GpuUsage {
  if ($script:gpuRefresh -le 0) {
    # processes come and go, so pick up the current instances every 10 seconds
    $script:gpuRefresh = 5
    $names = (New-Object System.Diagnostics.PerformanceCounterCategory('GPU Engine')).GetInstanceNames() | Where-Object { $_ -like '*engtype_3D*' }
    foreach ($n in $names) { if (-not $counters.ContainsKey($n)) { $c = New-Object System.Diagnostics.PerformanceCounter('GPU Engine', 'Utilization Percentage', $n); $null = $c.NextValue(); $counters[$n] = $c } }
    foreach ($k in @($counters.Keys)) { if ($names -notcontains $k) { $counters[$k].Dispose(); $counters.Remove($k) } }
  }
  $script:gpuRefresh--
  $perCard = @{}
  foreach ($k in @($counters.Keys)) {
    try { $v = $counters[$k].NextValue() } catch { continue }
    $card = ($k -replace '.*(luid_0x[0-9a-fA-F]+_0x[0-9a-fA-F]+).*', '$1')
    $perCard[$card] = ($perCard[$card] + $v)
  }
  $gpu = 0; foreach ($v in $perCard.Values) { if ($v -gt $gpu) { $gpu = $v } }
  [math]::Round([math]::Min(100, $gpu))
}

while ($true) {
  # prefer a session that is actually playing (the "current" one can be a paused tab or app). Browsers can have
  # several playing at once (a song and a muted video): stay with the one already shown, so the title does not flip.
  $s = $null; $count = 0
  try {
    $all = @($mgr.GetSessions()); $count = $all.Count
    $playing = @($all | Where-Object { $_.GetPlaybackInfo().PlaybackStatus -eq 'Playing' })
    if ($playing.Count -gt 1) {
      foreach ($x in $playing) {
        try { $p = Await ($x.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]); if ("$($p.Title)|$($p.Artist)" -eq $key) { $s = $x; break } } catch {}
      }
      if (-not $s) { $c = $mgr.GetCurrentSession(); if ($c -and $c.GetPlaybackInfo().PlaybackStatus -eq 'Playing') { $s = $c } }
    }
    if (-not $s -and $playing.Count) { $s = $playing[0] }
    if (-not $s) { $s = $mgr.GetCurrentSession() }
    if (-not $s -and $count -gt 0) { $s = $all[0] }
  } catch { $s = $mgr.GetCurrentSession() }

  # every command that came in since the last round (dragging the volume slider sends many: only the last one counts)
  $quit = $false; $newVol = $null
  while ($cmd.IsCompleted) {
    $line = $cmd.Result
    if ($null -eq $line) { $quit = $true; break }   # parent closed stdin: exit
    $cmd = $stdin.ReadLineAsync()
    $line = $line.Trim()
    if ($line -like 'vol *') { $newVol = $line.Substring(4) }
    elseif ($line -eq 'mute') { try { [Audio]::Mute = -not [Audio]::Mute } catch {} }
    elseif ($line -eq 'gpu on') { $gpuOn = $true; $gpuTick = 0 }
    elseif ($line -eq 'gpu off') { $gpuOn = $false; foreach ($c in $counters.Values) { $c.Dispose() }; $counters.Clear(); $gpuRefresh = 0 }
    elseif ($s) {
      switch ($line) {
        'toggle' { $null = Await ($s.TryTogglePlayPauseAsync()) ([bool]) }
        'next'   { $null = Await ($s.TrySkipNextAsync()) ([bool]) }
        'prev'   { $null = Await ($s.TrySkipPreviousAsync()) ([bool]) }
      }
      $tick = 0
    }
  }
  if ($quit) { break }
  if ($null -ne $newVol) { try { [Audio]::Volume = [float]::Parse($newVol, [Globalization.CultureInfo]::InvariantCulture) } catch {} }

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
  # GPU usage every 2 seconds, while it is shown
  if ($gpuOn) {
    if ($gpuTick -le 0) { $gpuTick = 8; try { Emit @{ type = 'gpu'; gpu = (GpuUsage) } } catch { Emit @{ type = 'gpu'; gpu = $null } } }
    $gpuTick--
  }

  $tick--
  Start-Sleep -Milliseconds 250
}
