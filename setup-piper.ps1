$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$assets = '.runtime/piper-assets'
New-Item -ItemType Directory -Force $assets | Out-Null
if (!(Test-Path -LiteralPath '.runtime/piper/piper.exe')) {
  curl.exe -fLsS --retry 2 --connect-timeout 15 https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip -o "$assets/piper.zip"
  if ($LASTEXITCODE) {exit $LASTEXITCODE}
  Expand-Archive -LiteralPath "$assets/piper.zip" -DestinationPath .runtime -Force
  Remove-Item -LiteralPath "$assets/piper.zip"
}
$base = 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium'
foreach ($name in @('en_US-lessac-medium.onnx','en_US-lessac-medium.onnx.json')) {
  if (!(Test-Path -LiteralPath "$assets/$name")) {
    curl.exe -fLsS --retry 2 --connect-timeout 15 "$base/$name" -o "$assets/$name.download"
    if ($LASTEXITCODE) {exit $LASTEXITCODE}
    Move-Item -LiteralPath "$assets/$name.download" -Destination "$assets/$name"
  }
}
Write-Host 'Piper is ready.'
