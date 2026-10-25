param(
    [string]$ExecutablePath,
    [string]$InstallerPath
)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$taskRoot=Split-Path -Parent $PSScriptRoot
$taskVersion=(Get-Content -LiteralPath (Join-Path $taskRoot 'package.json') -Raw | ConvertFrom-Json).version
if(-not $ExecutablePath){$ExecutablePath=Join-Path $taskRoot 'dist\win-unpacked\Recorte Studio.exe'}
if(-not $InstallerPath){$InstallerPath=Join-Path $taskRoot "dist\Recorte-Studio-Setup-$taskVersion-x64.exe"}
$taskReferenceIcon=[System.Drawing.Icon]::new((Join-Path $taskRoot 'assets\icon.ico'),32,32)
$taskReference=$taskReferenceIcon.ToBitmap()
try {
    foreach($taskPath in @($ExecutablePath,$InstallerPath)){
        if(-not (Test-Path -LiteralPath $taskPath)){throw "Arquivo não encontrado: $taskPath"}
        $taskIcon=[System.Drawing.Icon]::ExtractAssociatedIcon((Resolve-Path -LiteralPath $taskPath).Path)
        if(-not $taskIcon){throw "Executável sem ícone: $taskPath"}
        $taskBitmap=$taskIcon.ToBitmap()
        try {
            if($taskBitmap.Width -ne 32 -or $taskBitmap.Height -ne 32){throw "Tamanho do ícone inesperado: $taskPath"}
            for($taskY=0;$taskY -lt 32;$taskY++){
                for($taskX=0;$taskX -lt 32;$taskX++){
                    if($taskBitmap.GetPixel($taskX,$taskY).ToArgb() -ne $taskReference.GetPixel($taskX,$taskY).ToArgb()){
                        throw "O ícone do executável não corresponde ao Recorte Studio: $taskPath"
                    }
                }
            }
            Write-Output "OK: ícone do Recorte Studio confirmado em $(Split-Path -Leaf $taskPath)"
        } finally {$taskBitmap.Dispose();$taskIcon.Dispose()}
    }
} finally {$taskReference.Dispose();$taskReferenceIcon.Dispose()}
