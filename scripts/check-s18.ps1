# S18 HR dashboard + Applicant Management check (Windows PowerShell 5.1 compatible, ASCII only)
# Usage, from the repo root, with `pnpm dev` running:
#   powershell -ExecutionPolicy Bypass -File scripts/check-s18.ps1 -HrEmail <hr email> `
#     -ApplicantEmail <an existing, spent throwaway applicant> -KnownApplicantEmail <a seeded applicant you know>
# All parameters are required (no default accounts); passwords are prompted and never stored.
#
# READ-ONLY: every call to the VERA API is a GET (Req below only sends GET). The only POST is the Supabase password
# sign-in (Supabase Auth, not the VERA API). No account, vacancy, or application is created or changed.
#
# What it checks:
#   1. GET /api/admin/dashboard as HR: prints every tile value and the upcoming interviews.
#   2. GET /api/admin/applicants as HR: total = Total applicants; for every tile that selects applicants,
#      ?status=<tile> total = that tile (proves the current-application selection on real data);
#      ?search=<KnownApplicantEmail> finds that applicant.
#   3. The applicant token gets 403 on both endpoints.
#   4. Prints ONE SQL query (built from the tile definitions the API returned) that gives every tile count in a
#      single row with the same column names, for you to run in the Supabase SQL Editor and compare.

param(
  [Parameter(Mandatory = $true)] [string]$HrEmail,
  [Parameter(Mandatory = $true)] [string]$ApplicantEmail,
  [Parameter(Mandatory = $true)] [string]$KnownApplicantEmail,
  [string]$Api = "http://127.0.0.1:5000",
  [string]$EnvFile = "apps/web/.env"
)

$ErrorActionPreference = "Stop"
$script:Pass = 0
$script:Fail = 0

function Check([string]$Name, [bool]$Ok, [string]$Detail = "") {
  if ($Ok) { $script:Pass++; Write-Host "PASS  $Name" -ForegroundColor Green }
  else     { $script:Fail++; Write-Host "FAIL  $Name  $Detail" -ForegroundColor Red }
}

function Info([string]$Text) { Write-Host "INFO  $Text" -ForegroundColor Cyan }
function Stop-Check([string]$Text) { Write-Host "STOP  $Text" -ForegroundColor Red; exit 1 }

function Get-EnvValue([string[]]$Lines, [string]$Pattern) {
  $line = $Lines | Where-Object { $_ -match $Pattern } | Select-Object -First 1
  if (-not $line) { return "" }
  return ($line -replace '^[^=]+=', '' -replace '["'' ]', '')
}

# GET only: this check never changes VERA data.
function Req([string]$Path, $Token, [string]$Method = "Get", $Body = $null) {
  $headers = @{}
  if ($Token) { $headers.Authorization = "Bearer $Token" }
  $p = @{ Method = $Method; Uri = "$Api$Path"; Headers = $headers; UseBasicParsing = $true; TimeoutSec = 120 }
  if ($null -ne $Body) { $p.Body = ($Body | ConvertTo-Json -Depth 5 -Compress); $p.ContentType = "application/json" }
  try {
    $r = Invoke-WebRequest @p
    $json = $null
    if ($r.Content) { try { $json = $r.Content | ConvertFrom-Json } catch {} }
    return [pscustomobject]@{ Status = [int]$r.StatusCode; Json = $json; Raw = $r.Content }
  } catch {
    $resp = $_.Exception.Response
    if ($null -eq $resp) { return [pscustomobject]@{ Status = 0; Json = $null; Raw = $_.Exception.Message } }
    $raw = $_.ErrorDetails.Message
    $json = $null
    if ($raw) { try { $json = $raw | ConvertFrom-Json } catch {} }
    return [pscustomobject]@{ Status = [int]$resp.StatusCode; Json = $json; Raw = $raw }
  }
}

function Login([string]$Email) {
  $sec  = Read-Host "Password for $Email" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  $pw   = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  try {
    $body = @{ email = $Email; password = $pw } | ConvertTo-Json
    # Supabase Auth sign-in (the only POST in this script; it is not a VERA API call).
    return (Invoke-RestMethod -Method Post -Uri "$supabaseUrl/auth/v1/token?grant_type=password" `
      -Headers @{ apikey = $publishable } -ContentType "application/json" -Body $body).access_token
  } catch {
    Write-Host "Login failed for $($Email): $($_.ErrorDetails.Message)" -ForegroundColor Red; exit 1
  } finally { $pw = $null }
}

function Manila([string]$Iso) {
  $utc = [datetime]::Parse($Iso, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::AdjustToUniversal)
  return $utc.AddHours(8).ToString("MMM d, yyyy h:mm tt", [Globalization.CultureInfo]::InvariantCulture) + " (Philippine time)"
}

# Status names are inlined into the printed SQL only after this check (lowercase letters and underscores).
function SqlList($Values) {
  $items = @($Values)
  if ($items.Count -eq 0) { Stop-Check "A tile came back with an empty status set." }
  foreach ($v in $items) { if ("$v" -notmatch '^[a-z_]+$') { Stop-Check "Unexpected status value in a tile definition: $v" } }
  return (($items | ForEach-Object { "'$_'" }) -join ", ")
}

# ---------------------------------------------------------------- setup
Write-Host "`n== S18 dashboard and Applicant Management check (read-only) ==`n"

if ($HrEmail.Trim().ToLowerInvariant() -eq $ApplicantEmail.Trim().ToLowerInvariant()) { Stop-Check "HR and the applicant must be different accounts." }
if (-not (Test-Path $EnvFile)) { Stop-Check "Run this from the repo root ($EnvFile not found)." }
$envLines    = Get-Content $EnvFile
$supabaseUrl = Get-EnvValue $envLines '^VITE_SUPABASE_URL='
$publishable = Get-EnvValue $envLines '^VITE_SUPABASE_(PUBLISHABLE|ANON)_KEY='
if (-not $supabaseUrl -or $publishable.Length -lt 30) { Stop-Check "Could not read VITE_SUPABASE_URL / publishable key from $EnvFile." }

$r = Req "/api/health" $null
$healthy = $r.Status -eq 200 -and $r.Json.data.db -eq "up"
Check "API health (db up)" $healthy "status $($r.Status): $($r.Raw)"
if (-not $healthy) { Stop-Check "Start pnpm dev first." }

$hrTok = Login $HrEmail
$apTok = Login $ApplicantEmail
$me = (Req "/api/me" $hrTok).Json.data
if ($me.role -ne "hr" -and $me.role -ne "admin") { Stop-Check "$HrEmail is not an HR/admin account." }
$ap = (Req "/api/me" $apTok).Json.data
if ($ap.role -ne "applicant") { Stop-Check "$ApplicantEmail is not an applicant account." }
Check "Signed in: HR/admin and an applicant" $true

# ---------------------------------------------------------------- 1. dashboard
$r = Req "/api/admin/dashboard" $hrTok
Check "GET /api/admin/dashboard as HR -> 200" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"
if ($r.Status -ne 200) { Stop-Check "The dashboard did not load." }
$tiles = @($r.Json.data.tiles)
$keys = ($tiles | ForEach-Object { $_.key }) -join ","
Check "8 tiles in order" ($keys -eq "applicants,waitingPool,forScreening,forInterview,forEndorsement,hired,applicantPool,activeVacancies") "got $keys"
$value = @{}
Write-Host ""
foreach ($t in $tiles) {
  $value[$t.key] = [int]$t.value
  Write-Host ("  {0,-16} {1,6}   ({2})" -f $t.key, $t.value, $t.label)
}
$upcoming = @($r.Json.data.upcomingInterviews | Where-Object { $_ })
Write-Host "`n  Upcoming interviews: $($upcoming.Count)"
foreach ($i in $upcoming) { Write-Host ("    {0}  {1} - {2}  [{3}]" -f (Manila $i.scheduledAt), $i.jobTitle, $i.companyName, $i.status) }
$sorted = ($upcoming | ForEach-Object { [datetime]::Parse($_.scheduledAt, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::AdjustToUniversal) })
$inOrder = $true
for ($k = 1; $k -lt @($sorted).Count; $k++) { if (@($sorted)[$k] -lt @($sorted)[$k - 1]) { $inOrder = $false } }
# Decision 40-2: the list starts at midnight today, Philippine time (UTC+8), so today's started interviews stay listed.
$todayPhUtc = [datetime]::UtcNow.AddHours(8).Date.AddHours(-8)
Check "Upcoming interviews: at most 10, earliest first, none before today 00:00 Philippine time" `
  ($upcoming.Count -le 10 -and $inOrder -and @($sorted | Where-Object { $_ -lt $todayPhUtc.AddMinutes(-5) }).Count -eq 0) ""
Write-Host ""

# ---------------------------------------------------------------- 2. Applicant Management list
$r = Req "/api/admin/applicants?pageSize=1" $hrTok
Check "GET /api/admin/applicants as HR -> 200" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"
Check "List total = Total applicants ($($value.applicants))" ([int]$r.Json.meta.total -eq $value.applicants) "list total $($r.Json.meta.total)"

foreach ($t in $tiles) {
  if (-not ($t.statuses -or $t.blockingStatuses)) { continue }   # the tiles that select applicants
  $r = Req "/api/admin/applicants?status=$($t.key)&pageSize=1" $hrTok
  Check "List ?status=$($t.key) total = tile ($($value[$t.key]))" ($r.Status -eq 200 -and [int]$r.Json.meta.total -eq $value[$t.key]) "got $($r.Status), total $($r.Json.meta.total)"
}

$r = Req "/api/admin/applicants?pageSize=500" $hrTok
Check "pageSize above 50 is capped at 50" ($r.Status -eq 200 -and [int]$r.Json.meta.pageSize -eq 50 -and @($r.Json.data).Count -le 50) "got $($r.Status), pageSize $($r.Json.meta.pageSize)"

$known = $KnownApplicantEmail.Trim().ToLowerInvariant()
$r = Req "/api/admin/applicants?search=$([uri]::EscapeDataString($known))&pageSize=50" $hrTok
$found = @($r.Json.data | Where-Object { "$($_.email)".ToLowerInvariant() -eq $known })
Check "Search by email finds $known" ($r.Status -eq 200 -and $found.Count -eq 1) "got $($r.Status), $(@($r.Json.data).Count) rows"
if ($found.Count -eq 1) {
  Info "Known applicant: current application $($found[0].jobTitle) at $($found[0].companyName), status $($found[0].status)"
}
# Decision 39-4: every row carries the account status (+ HR's reason, null while active) for the Account column.
Check "Applicant rows carry accountStatus and deactivationReason (reason null while active)" `
  ($found.Count -eq 1 -and @("active", "inactive") -contains "$($found[0].accountStatus)" -and @($found[0].PSObject.Properties.Name) -contains "deactivationReason" -and ($found[0].accountStatus -ne "active" -or $null -eq $found[0].deactivationReason)) ($found | ConvertTo-Json -Compress)

# ---------------------------------------------------------------- 3. roles
$r = Req "/api/admin/dashboard" $apTok
Check "Applicant token on the dashboard -> 403" ($r.Status -eq 403) "got $($r.Status)"
$r = Req "/api/admin/applicants" $apTok
Check "Applicant token on the applicant list -> 403" ($r.Status -eq 403) "got $($r.Status)"
if ($found.Count -eq 1) {
  # Decision 39-4: the account control is staff only (nothing changes: refused before any write)
  $r = Req "/api/admin/applicants/$($found[0].applicantId)/account" $apTok "PATCH" @{ accountStatus = "inactive"; reason = "S18 check: applicant token" }
  Check "Applicant token on the account control -> 403" ($r.Status -eq 403) "got $($r.Status)"
}

# ---------------------------------------------------------------- 4. comparison SQL (built from the API's tile definitions)
$columns = @()
foreach ($t in $tiles) {
  switch ($t.counts) {
    "profiles"            { $columns += "  (select count(*) from public.applicant) as `"$($t.key)`"" }
    "distinct applicants" { $columns += "  (select count(distinct applicant_id) from public.application where status in ($(SqlList $t.statuses))) as `"$($t.key)`"" }
    "free pool entries"   { $columns += "  (select count(*) from public.talent_pool tp where tp.removed_at is null and not exists (select 1 from public.application b where b.applicant_id = tp.applicant_id and b.status in ($(SqlList $t.blockingStatuses)))) as `"$($t.key)`"" }
    "vacancies"           { $columns += "  (select count(*) from public.job_vacancy where status in ($(SqlList $t.vacancyStatuses))) as `"$($t.key)`"" }
    default               { Stop-Check "Unknown tile kind '$($t.counts)' for $($t.key)." }
  }
}
$sql = "select`n" + ($columns -join ",`n") + ";"
$apiRow = ($tiles | ForEach-Object { "$($_.key)=$($_.value)" }) -join "  "

$color = "Green"; if ($script:Fail -gt 0) { $color = "Red" }
Write-Host "`n== $($script:Pass) passed, $($script:Fail) failed ==" -ForegroundColor $color

Write-Host @"

Now run this ONE query in the Supabase SQL editor (read-only) and compare the row with the API values:

$sql

API values: $apiRow
Every column must equal the API value with the same name (counts can move if someone uses the app in between).
Nothing was created or changed by this check.
"@

if ($script:Fail -gt 0) { exit 1 }
