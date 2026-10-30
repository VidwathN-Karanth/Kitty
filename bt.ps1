$out = @()
Get-PnpDevice -Class Bluetooth -PresentOnly -ErrorAction SilentlyContinue | ForEach-Object {
  $p = Get-PnpDeviceProperty -InstanceId $_.InstanceId -KeyName '{104EA319-6EE2-4701-BD47-8DDBF425BBC5} 2' -ErrorAction SilentlyContinue
  if ($p -and $null -ne $p.Data -and $p.Type -ne 'Empty') { $out += [pscustomobject]@{ name = $_.FriendlyName; level = [int]$p.Data } }
}
if ($out.Count -eq 0) { '[]' } else { ConvertTo-Json -Compress -InputObject @($out) }
