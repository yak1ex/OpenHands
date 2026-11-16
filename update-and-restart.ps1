
param(
    [switch]$Server
)

$GIT = 'c:\cygwin64\bin\git.exe'
$ORIG_PATH = $env:PATH
if (Test-Path $GIT) {
    $env:PATH = "c:\cygwin64\bin;$env:PATH"
} else {
    $GIT = 'git'
}

$local_script = if ($Server) { 'start-server.local.ps1' } else { 'start-backend.local.ps1' }
. (Join-Path $PSScriptRoot $local_script)
$folders = @(
    $PSScriptRoot
    $env:OH_AGENT_SERVER_LOCAL_PATH
    $env:OH_AUTOMATION_LOCAL_PATH
)

foreach ($folder in $folders) {
    Push-Location $folder
    try {
        Write-Host "Fetching $folder"
        & $GIT fetch origin
        if ($LASTEXITCODE -ne 0) { throw "git fetch failed" }

        $branch = & $GIT branch -r --format='%(refname:short)' |
            Where-Object { $_ -match '^origin/local/(.+-)?v?\d+\.\d+\.\d+$' } |
            Sort-Object {
                [version]([regex]::Match($_, '\d+\.\d+\.\d+$').Value)
            } -Descending |
            Select-Object -First 1

        if (-not $branch) {
            throw "No matching branch found in $folder"
        }

        $localBranch = $branch -replace '^origin/', ''

        Write-Host "Updating $folder ($localBranch)"
        & $GIT switch $localBranch 2>$null
        if ($LASTEXITCODE -ne 0) {
            & $GIT switch --track $branch
            if ($LASTEXITCODE -ne 0) { throw "git switch failed" }
        }

        & $GIT pull --ff-only
        if ($LASTEXITCODE -ne 0) { throw "git pull failed" }
    }
    finally {
        Pop-Location
    }
}

$script = if ($Server) { 'start-server.ps1' } else { 'start-backend.ps1' }

Push-Location $PSScriptRoot
$env:PATH = $ORIG_PATH
try {
    npm ci
    & (Join-Path $PSScriptRoot $script)
}
finally {
    Pop-Location
}
