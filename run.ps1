$env:OH_AGENT_SERVER_LOCAL_PATH = "$PSScriptRoot\..\software-agent-sdk"

npm run dev:static -- --host 0.0.0.0
