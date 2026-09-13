# 큰길이벤트기획 · 3D 무대 시안(JSON) → 고화질 영상(MP4)
# 쓰는 법 (PowerShell):
#   .\무대영상.ps1 시안.json                  → 시안.mp4 (1080p · 24fps · 12초)
#   .\무대영상.ps1 시안.json -Seconds 20 -Size 3840x2160 -Samples 32
#   .\무대영상.ps1 시안.json -Shots audience,led,side,stage,bird
#   .\무대영상.ps1 시안.json -NoFog          → 안개 없이 (빠름)
param(
  [Parameter(Mandatory=$true)][string]$Json,
  [string]$Out = '',
  [double]$Seconds = 12,
  [int]$Fps = 24,
  [string]$Size = '1920x1080',
  [int]$Samples = 24,
  [string]$Shots = 'audience,crane,side,bird',
  [switch]$NoFog,
  [switch]$Keep
)
$ErrorActionPreference = 'Stop'
$env:PYTHONIOENCODING = 'utf-8'
$blender = Get-ChildItem 'C:\Program Files\Blender Foundation' -Directory -ErrorAction SilentlyContinue |
  Sort-Object Name -Descending | ForEach-Object { Join-Path $_.FullName 'blender.exe' } | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $blender) { Write-Host '블렌더가 없습니다. 먼저:  winget install BlenderFoundation.Blender'; exit 1 }
$Json = (Resolve-Path $Json).Path
if (-not $Out) { $Out = [IO.Path]::ChangeExtension($Json, '.mp4') }
$script = Join-Path $PSScriptRoot 'stage_video.py'
$args = @('-b', '-P', $script, '--', $Json, $Out, '--seconds', $Seconds, '--fps', $Fps, '--size', $Size, '--samples', $Samples, '--shots', $Shots,
          '--blend', [IO.Path]::ChangeExtension($Out, '.blend'))
if ($NoFog) { $args += '--no-fog' }
if ($Keep)  { $args += '--keep' }
$frames = [int]($Seconds * $Fps)
Write-Host ("렌더 시작: {0} 프레임 · {1} · {2} 샘플 — 1080p 기준 프레임당 5초쯤, 전체 약 {3}분" -f $frames, $Size, $Samples, [math]::Ceiling($frames * 5 / 60))
& $blender @args 2>&1 | Where-Object { $_ -match 'Saved|완료|Error|Traceback|line ' -and $_ -notmatch 'Shadow buffer' } |
  ForEach-Object { if ($_ -match 'f_(\d+)\.png') { Write-Host ("`r  {0}/{1} 프레임" -f [int]$Matches[1], $frames) -NoNewline } else { Write-Host $_ } }
Write-Host ''
if (Test-Path $Out) { Write-Host "완료: $Out"; Start-Process $Out } else { Write-Host '영상이 만들어지지 않았습니다. 위 오류를 확인하세요.' }
