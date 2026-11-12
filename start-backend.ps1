$ErrorActionPreference = 'Stop'

$localConfig = Join-Path $PSScriptRoot 'start-backend.local.ps1'

if (-not (Test-Path $localConfig)) {
	    throw "Missing local configuration: $localConfig"
}

. $localConfig

Push-Location $PSScriptRoot
try {
	    npm run dev -- --backend-only --host 0.0.0.0
	        if ($LASTEXITCODE -ne 0) {
			        throw "Agent Canvas exited with code $LASTEXITCODE"
				    }
}
finally {
	    Pop-Location
}
