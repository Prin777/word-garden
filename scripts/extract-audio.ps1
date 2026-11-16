Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = Split-Path -Parent $PSScriptRoot
$mapping = Get-Content -Raw -LiteralPath (Join-Path $root 'data/media-map.json') | ConvertFrom-Json
$archive = [IO.Compression.ZipFile]::OpenRead((Join-Path $root 'research/ielts-sample.apkg'))
try {
 foreach ($property in $mapping.PSObject.Properties) {
  if ($property.Value -match '\.(mp3|ogg|wav|m4a)$') {
   $name = [IO.Path]::GetFileName($property.Value)
   $entry = $archive.GetEntry($property.Name)
   if ($entry) { [IO.Compression.ZipFileExtensions]::ExtractToFile($entry,(Join-Path $root "data/media/$name"),$true) }
  }
 }
} finally { $archive.Dispose() }
