[CmdletBinding()]
param(
	[string]$PanelEnvFile = $env:FEATHERPANEL_ENV_FILE,
	[string]$AppEnvFile = "$PSScriptRoot\rss-discord.env",
	[int]$NodeId = 0,
	[string]$AllocationIp = "",
	[int]$AllocationPort = 0,
	[int]$OwnerId = 0,
	[switch]$NoStart
)

$ErrorActionPreference = "Stop"

function Read-DotEnv([string]$Path) {
	if (-not (Test-Path -LiteralPath $Path)) {
		throw "Environment file was not found: $Path"
	}

	$values = @{}
	foreach ($line in Get-Content -LiteralPath $Path) {
		if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
			$values[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
		}
	}
	return $values
}

function Assert-RequiredValues($Values, [string[]]$Names) {
	foreach ($name in $Names) {
		if ([string]::IsNullOrWhiteSpace($Values[$name])) {
			throw "$name is missing"
		}
	}
}

if ([string]::IsNullOrWhiteSpace($PanelEnvFile)) {
	throw "Pass -PanelEnvFile or set FEATHERPANEL_ENV_FILE"
}

$panel = Read-DotEnv $PanelEnvFile
$app = Read-DotEnv $AppEnvFile
$feedVariables = @(
	"RSS_DISCORD_FEEDS_1_NAME",
	"RSS_DISCORD_FEEDS_1_URL",
	"RSS_DISCORD_FEEDS_1_WEBHOOK_URL",
	"RSS_DISCORD_FEEDS_1_COLOR",
	"RSS_DISCORD_FEEDS_1_INTERVAL_MINUTES",
	"RSS_DISCORD_FEEDS_2_NAME",
	"RSS_DISCORD_FEEDS_2_URL",
	"RSS_DISCORD_FEEDS_2_WEBHOOK_URL",
	"RSS_DISCORD_FEEDS_2_COLOR",
	"RSS_DISCORD_FEEDS_2_INTERVAL_MINUTES"
)

Assert-RequiredValues $panel @("FEATHERPANEL_URL", "FEATHERPANEL_API_PUBLIC_KEY")
Assert-RequiredValues $app $feedVariables

foreach ($name in @(
	"RSS_DISCORD_FEEDS_1_URL",
	"RSS_DISCORD_FEEDS_2_URL"
)) {
	if ($app[$name] -notmatch '^https?://') {
		throw "$name must be an HTTP(S) URL"
	}
}
foreach ($name in @(
	"RSS_DISCORD_FEEDS_1_WEBHOOK_URL",
	"RSS_DISCORD_FEEDS_2_WEBHOOK_URL"
)) {
	if ($app[$name] -notmatch '^https://discord\.com/api/webhooks/') {
		throw "$name must be a Discord webhook URL"
	}
}

$baseUrl = $panel.FEATHERPANEL_URL.TrimEnd("/")
$headers = @{
	Authorization = "Bearer $($panel.FEATHERPANEL_API_PUBLIC_KEY)"
	Accept        = "application/json"
}

function Invoke-PanelApi([string]$Method, [string]$Path, $Body = $null) {
	$params = @{
		Uri     = "$baseUrl$Path"
		Headers = $headers
		Method  = $Method
	}
	if ($null -ne $Body) {
		$params.Body = $Body | ConvertTo-Json -Depth 20 -Compress
		$params.ContentType = "application/json"
	}
	return Invoke-RestMethod @params
}

$session = Invoke-PanelApi GET "/api/user/session"
Write-Output "FeatherPanel session: OK"

$nodes = @((Invoke-PanelApi GET "/api/admin/nodes").data.nodes)
$resolvedNodeId = if ($NodeId -gt 0) {
	$NodeId
} elseif ($panel.FEATHERPANEL_NODE_ID) {
	[int]$panel.FEATHERPANEL_NODE_ID
} elseif ($nodes.Count -eq 1) {
	[int]$nodes[0].id
} else {
	throw "Specify -NodeId because the Panel has $($nodes.Count) nodes"
}
$node = $nodes | Where-Object id -eq $resolvedNodeId | Select-Object -First 1
if (-not $node) {
	throw "Node $resolvedNodeId was not found"
}

$resolvedOwnerId = if ($OwnerId -gt 0) {
	$OwnerId
} elseif ($panel.FEATHERPANEL_OWNER_ID) {
	[int]$panel.FEATHERPANEL_OWNER_ID
} elseif ($session.data.user_info.id) {
	[int]$session.data.user_info.id
} else {
	throw "Specify -OwnerId because it could not be derived from the API session"
}

$resolvedAllocationIp = if ($AllocationIp) {
	$AllocationIp
} elseif ($panel.FEATHERPANEL_ALLOCATION_IP) {
	$panel.FEATHERPANEL_ALLOCATION_IP
} elseif ($node.public_ip_v4) {
	$node.public_ip_v4
} else {
	throw "Specify -AllocationIp because node $resolvedNodeId has no public IPv4"
}

$servers = @((Invoke-PanelApi GET "/api/admin/servers").data.servers)
$server = $servers | Where-Object name -eq "rss-discord" | Select-Object -First 1
if ($server) {
	Write-Output "Server already exists: id=$($server.id), uuidShort=$($server.uuidShort)"
	exit 0
}

$realms = @((Invoke-PanelApi GET "/api/admin/realms").data.realms)
$realm = $realms | Where-Object name -eq "Discord Bots" | Select-Object -First 1
if (-not $realm) {
	$realm = (Invoke-PanelApi PUT "/api/admin/realms" @{
		name        = "Discord Bots"
		description = "Discord bot workloads"
	}).data.realm
	Write-Output "Realm created: id=$($realm.id)"
} else {
	Write-Output "Realm reused: id=$($realm.id)"
}

$spells = @((Invoke-PanelApi GET "/api/admin/spells?realm_id=$($realm.id)").data.spells)
$spell = $spells | Where-Object name -eq "RSS Discord" | Select-Object -First 1
if (-not $spell) {
	$spellPath = Join-Path $PSScriptRoot "rss-discord-spell.json"
	$import = Invoke-RestMethod `
		-Uri "$baseUrl/api/admin/spells/import" `
		-Headers $headers `
		-Method POST `
		-Form @{ realm_id = "$($realm.id)"; file = Get-Item -LiteralPath $spellPath }
	$spell = $import.data.spell
	Write-Output "Spell imported: id=$($spell.id)"
} else {
	Write-Output "Spell reused: id=$($spell.id)"
}

$actualVariables = @((Invoke-PanelApi GET "/api/admin/spells/$($spell.id)/variables").data.variables)
$missingVariables = @($feedVariables | Where-Object { $_ -notin $actualVariables.env_variable })
$unexpectedVariables = @($actualVariables.env_variable | Where-Object { $_ -notin $feedVariables })
if ($missingVariables.Count -gt 0 -or $unexpectedVariables.Count -gt 0) {
	throw "Spell variables differ from the expected set"
}

$allocations = @(
	(Invoke-PanelApi GET "/api/admin/allocations?node_id=$resolvedNodeId&limit=100").data.allocations
)
$resolvedAllocationPort = if ($AllocationPort -gt 0) {
	$AllocationPort
} elseif ($panel.FEATHERPANEL_ALLOCATION_PORT) {
	[int]$panel.FEATHERPANEL_ALLOCATION_PORT
} elseif ($allocations.Count -gt 0) {
	([int]($allocations.port | Measure-Object -Maximum).Maximum) + 1
} else {
	throw "Specify -AllocationPort because this node has no existing allocation to derive from"
}
if ($resolvedAllocationPort -gt 65535) {
	throw "No valid allocation port can be derived"
}

$allocation = $allocations | Where-Object port -eq $resolvedAllocationPort | Select-Object -First 1
if ($allocation -and $allocation.server_id) {
	throw "Allocation port $resolvedAllocationPort is already assigned"
}
if (-not $allocation) {
	$allocationBody = @{
		node_id = $resolvedNodeId
		ip       = $resolvedAllocationIp
		port     = $resolvedAllocationPort
		notes    = "rss-discord bot allocation; no listener"
	}
	if ($panel.FEATHERPANEL_ALLOCATION_ALIAS) {
		$allocationBody.ip_alias = $panel.FEATHERPANEL_ALLOCATION_ALIAS
	}
	$allocation = (Invoke-PanelApi PUT "/api/admin/allocations" $allocationBody).data.allocations[0]
	Write-Output "Allocation created: id=$($allocation.id), port=$($allocation.port)"
} else {
	Write-Output "Allocation reused: id=$($allocation.id), port=$($allocation.port)"
}

$variables = @{}
foreach ($name in $feedVariables) {
	$variables[$name] = $app[$name]
}

$serverResponse = Invoke-PanelApi PUT "/api/admin/servers" @{
	node_id          = $resolvedNodeId
	name             = "rss-discord"
	description      = "RSS and Atom feed notifier for Discord"
	owner_id         = $resolvedOwnerId
	memory           = 256
	swap             = 0
	disk             = 1024
	io               = 500
	cpu              = 50
	allocation_id    = $allocation.id
	realms_id        = $realm.id
	spell_id         = $spell.id
	startup          = "bun /opt/rss-discord/cli.js"
	image            = "ghcr.io/getsetmind/rss-discord:latest"
	database_limit   = 0
	allocation_limit = 1
	backup_limit     = 1
	skip_scripts     = $true
	variables        = $variables
	oom_killer       = $true
	threads          = $null
}

$server = $serverResponse.data.server
if (-not $server) {
	$server = @((Invoke-PanelApi GET "/api/admin/servers").data.servers) |
		Where-Object name -eq "rss-discord" |
		Select-Object -First 1
}
if (-not $server) {
	throw "Server creation returned no server"
}
Write-Output "Server created: id=$($server.id), uuidShort=$($server.uuidShort)"

if (-not $NoStart) {
	$deadline = (Get-Date).AddMinutes(2)
	do {
		Start-Sleep -Seconds 3
		$current = @((Invoke-PanelApi GET "/api/admin/servers").data.servers) |
			Where-Object id -eq $server.id |
			Select-Object -First 1
	} while (-not $current.installed_at -and (Get-Date) -lt $deadline)

	if (-not $current.installed_at) {
		throw "Server installation did not finish within two minutes"
	}
	[void](Invoke-PanelApi POST "/api/user/servers/$($server.uuidShort)/power/start")
	Write-Output "Server start requested"
}
