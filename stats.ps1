# Long-running helper: prints GPU usage (%) as JSON lines every 2 seconds.
# Windows only exposes it through the "GPU Engine" performance counters (one per process and engine), so this sums
# the 3D engines per graphics card and reports the busiest card, like Task Manager does. Exits when stdin closes.
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$stdin = New-Object System.IO.StreamReader([Console]::OpenStandardInput())
$eof = $stdin.ReadLineAsync()
$counters = @{}
$refresh = 0

while (-not $eof.IsCompleted) {
  try {
    if ($refresh -le 0) {
      # processes come and go, so pick up the current instances every 10 seconds
      $refresh = 5
      $names = (New-Object System.Diagnostics.PerformanceCounterCategory('GPU Engine')).GetInstanceNames() | Where-Object { $_ -like '*engtype_3D*' }
      foreach ($n in $names) { if (-not $counters.ContainsKey($n)) { $c = New-Object System.Diagnostics.PerformanceCounter('GPU Engine', 'Utilization Percentage', $n); $null = $c.NextValue(); $counters[$n] = $c } }
      foreach ($k in @($counters.Keys)) { if ($names -notcontains $k) { $counters[$k].Dispose(); $counters.Remove($k) } }
    }
    $refresh--
    $perCard = @{}
    foreach ($k in @($counters.Keys)) {
      try { $v = $counters[$k].NextValue() } catch { continue }
      $card = ($k -replace '.*(luid_0x[0-9a-fA-F]+_0x[0-9a-fA-F]+).*', '$1')
      $perCard[$card] = ($perCard[$card] + $v)
    }
    $gpu = 0; foreach ($v in $perCard.Values) { if ($v -gt $gpu) { $gpu = $v } }
    [Console]::Out.WriteLine((@{ gpu = [math]::Round([math]::Min(100, $gpu)) } | ConvertTo-Json -Compress)); [Console]::Out.Flush()
  } catch {
    [Console]::Out.WriteLine('{"gpu":null}'); [Console]::Out.Flush()
  }
  Start-Sleep -Seconds 2
}
