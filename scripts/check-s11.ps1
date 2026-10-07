# S11 backend check (Windows PowerShell 5.1 compatible)
# Usage, from the repo root, with `pnpm dev` running:
#   powershell -ExecutionPolicy Bypass -File scripts/check-s11.ps1 -VacancyId <cashier job_vacancy_id> -Email <applicant email>
# -VacancyId and -Email are required (no default account); the password is prompted and never stored.
# Prescreen-failure run with a second applicant who misses a Cashier condition:
#   powershell -ExecutionPolicy Bypass -File scripts/check-s11.ps1 -VacancyId <id> -Email <applicant email> -ApplicantType first_time -Expect prescreen_failed

param(
  [Parameter(Mandatory = $true)] [string]$VacancyId,
  [Parameter(Mandatory = $true)] [string]$Email,
  [ValidateSet("experienced", "first_time")] [string]$ApplicantType = "experienced",
  [ValidateSet("qualified", "prescreen_failed", "below_threshold")] [string]$Expect = "qualified",
  [string]$Api = "http://127.0.0.1:5000",
  [string]$EnvFile = "apps/web/.env"
)

$ErrorActionPreference = "Stop"
$script:Pass = 0
$script:Fail = 0
$script:Auth = @{}

function Check([string]$Name, [bool]$Ok, [string]$Detail = "") {
  if ($Ok) { $script:Pass++; Write-Host "PASS  $Name" -ForegroundColor Green }
  else     { $script:Fail++; Write-Host "FAIL  $Name  $Detail" -ForegroundColor Red }
}

function Info([string]$Text) { Write-Host "INFO  $Text" -ForegroundColor Cyan }

function Get-EnvValue([string[]]$Lines, [string]$Pattern) {
  $line = $Lines | Where-Object { $_ -match $Pattern } | Select-Object -First 1
  if (-not $line) { return "" }
  return ($line -replace '^[^=]+=', '' -replace '["'' ]', '')
}

function Req([string]$Method, [string]$Path, $Body = $null, $Headers = $null) {
  if ($null -eq $Headers) { $Headers = $script:Auth }
  $p = @{ Method = $Method; Uri = "$Api$Path"; Headers = $Headers; ContentType = "application/json"; UseBasicParsing = $true }
  if ($null -ne $Body) { $p.Body = ($Body | ConvertTo-Json -Depth 6) }
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

# Collects every property name in a parsed JSON tree (for leak checks).
function Get-Keys($o) {
  if ($null -eq $o) { return }
  if ($o -is [string]) { return }
  if ($o -is [System.Collections.IEnumerable]) { foreach ($i in $o) { Get-Keys $i }; return }
  if ($o -is [pscustomobject]) {
    foreach ($prop in $o.PSObject.Properties) { $prop.Name; Get-Keys $prop.Value }
  }
}

$LeakPattern = '(?i)score|similarity|weights|company|status_?reason|age|gender|birth'

function Leaks($o) {
  $bad = @(Get-Keys $o | Where-Object { $_ -match $LeakPattern -and $_ -notmatch '(?i)^message$' } | Sort-Object -Unique)
  return $bad
}

# ---------------------------------------------------------------- setup
Write-Host "`n== S11 backend check: $Email ($ApplicantType, expect $Expect) ==`n"

if (-not (Test-Path $EnvFile)) { Write-Host "Run this from the repo root ($EnvFile not found)." -ForegroundColor Red; exit 1 }
$envLines     = Get-Content $EnvFile
$supabaseUrl  = Get-EnvValue $envLines '^VITE_SUPABASE_URL='
$publishable  = Get-EnvValue $envLines '^VITE_SUPABASE_(PUBLISHABLE|ANON)_KEY='
if (-not $supabaseUrl -or $publishable.Length -lt 30) {
  Write-Host "Could not read VITE_SUPABASE_URL / publishable key from $EnvFile." -ForegroundColor Red; exit 1
}

# 1. Health
$r = Req Get "/api/health" $null @{}
$healthy = $r.Status -eq 200 -and $r.Json.data.db -eq "up" -and $r.Json.data.svc -eq "up"
Check "API health (db + svc up)" $healthy "status $($r.Status): $($r.Raw)"
if (-not $healthy) { Write-Host "Start pnpm dev first." -ForegroundColor Red; exit 1 }

# Login (password prompted, never stored)
$sec  = Read-Host "Password for $Email" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
$pw   = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
try {
  $login = @{ email = $Email; password = $pw } | ConvertTo-Json
  $tok = (Invoke-RestMethod -Method Post -Uri "$supabaseUrl/auth/v1/token?grant_type=password" `
    -Headers @{ apikey = $publishable } -ContentType "application/json" -Body $login).access_token
} catch {
  Write-Host "Login failed: $($_.ErrorDetails.Message)" -ForegroundColor Red; exit 1
} finally { $pw = $null }
$script:Auth = @{ Authorization = "Bearer $tok" }
Check "Supabase login" ([bool]$tok)

# 2. Auth required
$r = Req Get "/api/applicant/applications" $null @{}
Check "No token -> 401" ($r.Status -eq 401) "got $($r.Status)"

# 3. Validation
$r = Req Post "/api/applicant/applications" @{ vacancyId = $VacancyId; applicantType = "bogus" }
Check "Invalid applicantType -> 400/422" ($r.Status -eq 400 -or $r.Status -eq 422) "got $($r.Status): $($r.Raw)"

$r = Req Post "/api/applicant/applications" @{ vacancyId = "not-a-uuid"; applicantType = $ApplicantType }
Check "Invalid vacancyId -> 400/422" ($r.Status -eq 400 -or $r.Status -eq 422) "got $($r.Status): $($r.Raw)"

# 4. Unknown vacancy
$r = Req Post "/api/applicant/applications" @{ vacancyId = [guid]::NewGuid().ToString(); applicantType = $ApplicantType }
Check "Unknown vacancy -> 404" ($r.Status -eq 404) "got $($r.Status): $($r.Raw)"

# 5. Apply
$expectedStatuses = @{
  qualified        = @("waiting_pool", "shortlisted")
  prescreen_failed = @("prescreen_failed")
  below_threshold  = @("below_threshold")
}[$Expect]

$r = Req Post "/api/applicant/applications" @{ vacancyId = $VacancyId; applicantType = $ApplicantType }
$alreadyApplied = $false
if ($r.Status -eq 409 -and $r.Raw -notmatch 'just closed') {
  $alreadyApplied = $true
  Info "Already applied to this vacancy (rerun). Skipping the create checks; duplicate check below still runs."
} else {
  Check "Apply -> 201" ($r.Status -eq 201) "got $($r.Status): $($r.Raw)"
  if ($r.Status -eq 201) {
    $d = $r.Json.data
    Info "Response: status=$($d.status)  message=$($d.message)"
    Check "Apply status is $($expectedStatuses -join '/')" ($expectedStatuses -contains $d.status) "got $($d.status)"
    Check "Apply response has applicationId" ([bool]$d.applicationId)
    $bad = Leaks $d
    Check "Apply response leaks nothing (score/company/age/gender/reason)" ($bad.Count -eq 0) "keys: $($bad -join ', ')"
    if ($Expect -eq "prescreen_failed") {
      $fc = @($d.failedConditions)
      Check "Prescreen failure names the condition" ($fc.Count -gt 0 -and [bool]$fc[0].message) "failedConditions: $($d.failedConditions | ConvertTo-Json -Compress)"
    }
  }
}

# 6. Duplicate
$r = Req Post "/api/applicant/applications" @{ vacancyId = $VacancyId; applicantType = $ApplicantType }
Check "Duplicate apply -> 409" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"

# 7. My applications list
$r = Req Get "/api/applicant/applications"
Check "GET my applications -> 200" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"
if ($r.Status -eq 200) {
  $rows = @($r.Json.data)
  $row = $rows | Where-Object { $_.vacancyId -eq $VacancyId } | Select-Object -First 1
  Check "List contains this vacancy" ($null -ne $row) "vacancyIds: $(($rows | ForEach-Object { $_.vacancyId }) -join ', ')"
  if ($row) {
    Info "Row: $($row.jobTitle) | $($row.applicantType) | $($row.status) | applied $($row.appliedAt)"
    Check "List row status is $($expectedStatuses -join '/')" ($expectedStatuses -contains $row.status) "got $($row.status)"
  }
  $bad = Leaks $rows
  Check "List leaks nothing (score/company/age/gender/reason)" ($bad.Count -eq 0) "keys: $($bad -join ', ')"
}

# 8. Notifications
$r = Req Get "/api/notifications?limit=20"
Check "GET notifications -> 200" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"
if ($r.Status -eq 200) {
  $notes = @($r.Json.data)
  Check "At least one notification" ($notes.Count -gt 0)
  Check "meta.unreadCount is a number" ($r.Json.meta.unreadCount -is [int] -or $r.Json.meta.unreadCount -is [long])
  Info "unreadCount=$($r.Json.meta.unreadCount); latest: $($notes[0].title) - $($notes[0].message)"
}

# 9. Mark all read
$r = Req Post "/api/notifications/read-all"
Check "POST read-all -> 2xx" ($r.Status -ge 200 -and $r.Status -lt 300) "got $($r.Status): $($r.Raw)"
$r = Req Get "/api/notifications?limit=1"
Check "unreadCount is 0 after read-all" ($r.Status -eq 200 -and $r.Json.meta.unreadCount -eq 0) "got $($r.Json.meta.unreadCount)"

# ---------------------------------------------------------------- summary
$color = "Green"; if ($script:Fail -gt 0) { $color = "Red" }
Write-Host "`n== $($script:Pass) passed, $($script:Fail) failed ==" -ForegroundColor $color
Write-Host @"

Now run these in the Supabase SQL editor:

  select a.status, a.status_reason, m.matching_score, m.weights
  from application a left join matching_result m using (application_id)
  where a.job_vacancy_id = '$VacancyId' order by a.applied_at desc;

  select h.application_id, h.from_status, h.to_status, h.reason, h.changed_by
  from application_status_history h join application a using (application_id)
  where a.job_vacancy_id = '$VacancyId' order by h.changed_at desc;

  select notification_type, title, message, created_at
  from notification order by created_at desc limit 10;

  select status, closed_at from job_vacancy where job_vacancy_id = '$VacancyId';

Expect: weights 0.5/0.5 (experienced) or 1/0 (first_time); the applicant's insert row has
their user id in changed_by; shortlist moves have changed_by null and reason 'shortlist refresh';
prescreen_failed rows have no matching_result.
"@

if ($script:Fail -gt 0) { exit 1 }
