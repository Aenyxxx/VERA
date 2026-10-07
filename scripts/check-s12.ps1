# S12 Resume Screening backend check (Windows PowerShell 5.1 compatible)
# Usage, from the repo root, with `pnpm dev` running:
#   powershell -ExecutionPolicy Bypass -File scripts/check-s12.ps1 -VacancyId <cashier job_vacancy_id> `
#     -HrEmail <hr email> -KeepEmail <applicant to keep clean> -DropEmail <throwaway applicant>
# All four parameters are required (no default accounts); passwords are prompted and never stored.
#
# Before running: KeepEmail and DropEmail have both applied to -VacancyId and are SHORTLISTED (Resume Screening).
# What it changes:
#   - KeepEmail: only verifies their resume (never rejects, requests, or drops).
#   - DropEmail: a document request (then withdrawn), a resume rejection, and a DROP. dropped is a failed outcome:
#     DropEmail can never apply to that vacancy's company again (BR-19). You are asked to type DROP first.

param(
  [Parameter(Mandatory = $true)] [string]$VacancyId,
  [Parameter(Mandatory = $true)] [string]$HrEmail,
  [Parameter(Mandatory = $true)] [string]$KeepEmail,
  [Parameter(Mandatory = $true)] [string]$DropEmail,
  [string]$OtherJobTitle = "Store Crew",          # a job at ANOTHER company that must stay visible to DropEmail
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

function Get-EnvValue([string[]]$Lines, [string]$Pattern) {
  $line = $Lines | Where-Object { $_ -match $Pattern } | Select-Object -First 1
  if (-not $line) { return "" }
  return ($line -replace '^[^=]+=', '' -replace '["'' ]', '')
}

function Req([string]$Method, [string]$Path, $Token, $Body = $null) {
  $headers = @{}
  if ($Token) { $headers.Authorization = "Bearer $Token" }
  $p = @{ Method = $Method; Uri = "$Api$Path"; Headers = $headers; ContentType = "application/json"; UseBasicParsing = $true }
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

# Applicant responses must never carry company fields, scores, or the internal status reason (rule 4).
# "^age$" (not "age") so pagination keys like "page" / "pageSize" do not count.
$LeakPattern = '(?i)score|similarity|weights|company|status_?reason|^age$|gender|birth'

function Check-NoLeaks([string]$Name, $Json) {
  $bad = @(Get-Keys $Json | Where-Object { $_ -match $LeakPattern } | Sort-Object -Unique)
  Check "No company/score/status_reason keys: $Name" ($bad.Count -eq 0) "keys: $($bad -join ', ')"
}

function Login([string]$Email) {
  $sec  = Read-Host "Password for $Email" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  $pw   = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  try {
    $body = @{ email = $Email; password = $pw } | ConvertTo-Json
    return (Invoke-RestMethod -Method Post -Uri "$supabaseUrl/auth/v1/token?grant_type=password" `
      -Headers @{ apikey = $publishable } -ContentType "application/json" -Body $body).access_token
  } catch {
    Write-Host "Login failed for $($Email): $($_.ErrorDetails.Message)" -ForegroundColor Red; exit 1
  } finally { $pw = $null }
}

# The applicant's own application for -VacancyId (from their status panel API).
function My-Application([string]$Token) {
  $r = Req Get "/api/applicant/applications" $Token
  return [pscustomobject]@{ Response = $r; Row = (@($r.Json.data) | Where-Object { $_.vacancyId -eq $VacancyId } | Select-Object -First 1) }
}

# ---------------------------------------------------------------- setup
Write-Host "`n== S12 Resume Screening check: vacancy $VacancyId ==`n"

if (-not (Test-Path $EnvFile)) { Write-Host "Run this from the repo root ($EnvFile not found)." -ForegroundColor Red; exit 1 }
$envLines    = Get-Content $EnvFile
$supabaseUrl = Get-EnvValue $envLines '^VITE_SUPABASE_URL='
$publishable = Get-EnvValue $envLines '^VITE_SUPABASE_(PUBLISHABLE|ANON)_KEY='
if (-not $supabaseUrl -or $publishable.Length -lt 30) {
  Write-Host "Could not read VITE_SUPABASE_URL / publishable key from $EnvFile." -ForegroundColor Red; exit 1
}

$r = Req Get "/api/health" $null
$healthy = $r.Status -eq 200 -and $r.Json.data.db -eq "up"
Check "API health (db up)" $healthy "status $($r.Status): $($r.Raw)"
if (-not $healthy) { Write-Host "Start pnpm dev first." -ForegroundColor Red; exit 1 }

$hrTok   = Login $HrEmail
$keepTok = Login $KeepEmail
$dropTok = Login $DropEmail
Check "Supabase logins (HR, keep, drop)" ([bool]$hrTok -and [bool]$keepTok -and [bool]$dropTok)

$keep = My-Application $keepTok
$drop = My-Application $dropTok
Check-NoLeaks "keep GET /api/applicant/applications" $keep.Response.Json
Check-NoLeaks "drop GET /api/applicant/applications" $drop.Response.Json
if (-not $keep.Row -or -not $drop.Row) {
  Write-Host "Both applicants must have applied to $VacancyId first (keep: $([bool]$keep.Row), drop: $([bool]$drop.Row))." -ForegroundColor Red; exit 1
}
$keepApp = $keep.Row.applicationId
$dropApp = $drop.Row.applicationId
Info "keep application $keepApp ($($keep.Row.status)); drop application $dropApp ($($drop.Row.status))"

# ---------------------------------------------------------------- 1. role guard
$r = Req Get "/api/admin/screening" $keepTok
Check "Applicant -> 403 on GET /api/admin/screening" ($r.Status -eq 403) "got $($r.Status)"
$r = Req Get "/api/admin/applications/$keepApp" $keepTok
Check "Applicant -> 403 on GET /api/admin/applications/:id" ($r.Status -eq 403) "got $($r.Status)"

# ---------------------------------------------------------------- 2. HR shortlist view
$r = Req Get "/api/admin/screening" $hrTok
Check "HR GET /api/admin/screening -> 200" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"
Check "Screening list contains the vacancy" ([bool](@($r.Json.data) | Where-Object { $_.vacancyId -eq $VacancyId })) ""

$r = Req Get "/api/admin/screening/$VacancyId" $hrTok
Check "HR GET /api/admin/screening/:vacancyId -> 200" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"
$view = $r.Json.data
$companyName = $view.vacancy.companyName
Check "HR sees the company name" ([bool]$companyName) ""
$expGroup = $view.groups.experienced
$ftGroup  = $view.groups.first_time
Check "Both groups present" ($null -ne $expGroup -and $null -ne $ftGroup) ""
$expectedQuota = 2 * [int]$view.vacancy.slotsNeeded
Check "Quota = 2 x slots ($expectedQuota) in both groups" ($expGroup.quota -eq $expectedQuota -and $ftGroup.quota -eq $expectedQuota) "experienced $($expGroup.quota), first_time $($ftGroup.quota)"
$shortlisted = @($expGroup.shortlisted) + @($ftGroup.shortlisted)
$keepRow = $shortlisted | Where-Object { $_.applicationId -eq $keepApp } | Select-Object -First 1
$dropRow = $shortlisted | Where-Object { $_.applicationId -eq $dropApp } | Select-Object -First 1
Check "KeepEmail's application is shortlisted" ($null -ne $keepRow) "move them into the shortlist first"
Check "DropEmail's application is shortlisted" ($null -ne $dropRow) "move them into the shortlist first"
if (-not $keepRow -or -not $dropRow) { Write-Host "Stopping: both applications must be shortlisted." -ForegroundColor Red; exit 1 }
Check "Shortlist rows carry HR scores" ($null -ne $keepRow.matchingScore) ""

$pf = @($view.notShortlisted.prescreenFailed)
$bt = @($view.notShortlisted.belowThreshold)
Check "prescreenFailed / belowThreshold lists returned" ($null -ne $view.notShortlisted) ""
if ($pf.Count -gt 0) { Check "Every prescreen failure has a reason" (@($pf | Where-Object { -not $_.reason }).Count -eq 0) "" } else { Info "No prescreen failures on this vacancy" }
if ($bt.Count -gt 0) {
  Check "Every below-threshold row has a reason and a score" (@($bt | Where-Object { -not $_.reason -or $null -eq $_.matchingScore }).Count -eq 0) ""
} else { Info "No below-threshold applications on this vacancy" }

# ---------------------------------------------------------------- 3. KeepEmail review sheet (verify only)
$r = Req Get "/api/admin/applications/$keepApp" $hrTok
Check "HR review sheet (keep) -> 200" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"
$sheet = $r.Json.data
Check "Review sheet shows the company to HR" ($sheet.vacancy.companyName -eq $companyName) ""
$r = Req Get "/api/admin/applications/$keepApp/resume/url" $hrTok
Check "Resume signed URL returned" ($r.Status -eq 200 -and "$($r.Json.data.url)" -match '^https?://') "got $($r.Status): $($r.Raw)"

$r = Req Patch "/api/admin/resumes/$($sheet.resume.resumeId)/verification" $hrTok @{ status = "verified"; applicationId = $keepApp }
Check "Verify KeepEmail's resume -> 200" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"

$r = Req Get "/api/admin/applications/$keepApp" $hrTok
$sheet = $r.Json.data
Check "Slot locked after the first verification (verification_started_at set)" ($sheet.application.locked -eq $true) ""
$unverified = @($sheet.documents | Where-Object { $_.verificationStatus -ne "verified" })
$pendingReq = @($sheet.requests | Where-Object { $_.status -eq "pending" })
if ($unverified.Count -eq 0 -and $pendingReq.Count -eq 0) {
  Check "fullyVerified = true (resume verified, no other open items)" ($sheet.fullyVerified -eq $true) ""
  $expectedStep = "schedule_interview"; if ($sheet.reusableEvaluation) { $expectedStep = "reuse_ratings" }
  Check "nextStep = $expectedStep" ($sheet.nextStep -eq $expectedStep) "got $($sheet.nextStep)"
} else {
  Info "KeepEmail still has $($unverified.Count) unverified document(s) / $($pendingReq.Count) pending request(s): verify them in the UI"
  Check "fullyVerified = false while documents are open" ($sheet.fullyVerified -eq $false -and $null -eq $sheet.nextStep) ""
}

# ---------------------------------------------------------------- 4. DropEmail: request, withdraw, reject, drop
Write-Host "`nNext steps change $DropEmail permanently: their application is DROPPED and they can never apply to this company again." -ForegroundColor Yellow
$answer = Read-Host "Type DROP to continue"
if ($answer -ne "DROP") { Write-Host "Stopped before changing $DropEmail." -ForegroundColor Yellow; exit 1 }

$r = Req Get "/api/admin/applications/$dropApp" $hrTok
$dropSheet = $r.Json.data
Check "HR review sheet (drop) -> 200" ($r.Status -eq 200) "got $($r.Status)"

$r = Req Post "/api/admin/document-requests" $hrTok @{ applicationId = $dropApp; documentType = "nbi_clearance"; reason = "check-s12: please upload a clear NBI clearance." }
Check "Request nbi_clearance -> 201" ($r.Status -eq 201) "got $($r.Status): $($r.Raw)"
$requestId = $r.Json.data.requestId

$r = Req Get "/api/applicant/document-requests" $dropTok
Check "Applicant GET /api/applicant/document-requests -> 200" ($r.Status -eq 200) "got $($r.Status)"
$myReq = @($r.Json.data) | Where-Object { $_.requestId -eq $requestId } | Select-Object -First 1
Check "Applicant sees the request with a due date" ($null -ne $myReq -and [bool]$myReq.dueAt -and $myReq.status -eq "pending") ""
Check-NoLeaks "drop GET /api/applicant/document-requests" $r.Json

$d = My-Application $dropTok
Check "Status panel shows nextDueAt while the request is pending" ([bool]$d.Row.nextDueAt) "got '$($d.Row.nextDueAt)'"
Check-NoLeaks "drop GET /api/applicant/applications (request pending)" $d.Response.Json

$r = Req Delete "/api/admin/document-requests/$requestId" $hrTok
Check "Withdraw the request -> 200" ($r.Status -eq 200 -and $r.Json.data.status -eq "cancelled") "got $($r.Status): $($r.Raw)"
$d = My-Application $dropTok
Check "nextDueAt is null after the withdrawal" ($null -eq $d.Row.nextDueAt -or "$($d.Row.nextDueAt)" -eq "") "got '$($d.Row.nextDueAt)'"

$resumeId = $dropSheet.resume.resumeId
$r = Req Patch "/api/admin/resumes/$resumeId/verification" $hrTok @{ status = "rejected"; applicationId = $dropApp }
Check "Reject resume without remarks -> 400" ($r.Status -eq 400) "got $($r.Status): $($r.Raw)"
$r = Req Patch "/api/admin/resumes/$resumeId/verification" $hrTok @{ status = "rejected"; remarks = "check-s12: unreadable copy"; applicationId = $dropApp }
Check "Reject resume with remarks -> 200" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"
$d = My-Application $dropTok
Check "Reject alone does not drop (still shortlisted)" ($d.Row.status -eq "shortlisted") "got $($d.Row.status)"

$r = Req Post "/api/admin/applications/$dropApp/drop" $hrTok @{ reason = "failed_verification"; remarks = "check-s12" }
Check "Drop (failed_verification) -> 200" ($r.Status -eq 200 -and $r.Json.data.status -eq "dropped") "got $($r.Status): $($r.Raw)"
$promoted = @($r.Json.data.promoted)
Info "Promoted from the waiting pool: $($promoted.Count)"

# ---------------------------------------------------------------- 5. after the drop
$d = My-Application $dropTok
Check "DropEmail's application is dropped" ($d.Row.status -eq "dropped") "got $($d.Row.status)"
Check-NoLeaks "drop GET /api/applicant/applications (dropped)" $d.Response.Json

$r = Req Get "/api/notifications?limit=10" $dropTok
$notice = @($r.Json.data) | Where-Object { $_.type -eq "application_dropped" } | Select-Object -First 1
Check "Drop notification received" ($null -ne $notice) ""
if ($notice) {
  Check "Notification says the application was closed" ("$($notice.message)" -match "has been closed") "got: $($notice.message)"
  Check "Notification says 'You can apply to other jobs'" ("$($notice.message)" -match "You can apply to other jobs") ""
  Check "Notification never names the company" ("$($notice.title) $($notice.message)" -notmatch [regex]::Escape($companyName)) ""
  Check "Notification never shows the internal reason" ("$($notice.message)" -notmatch "(?i)verification|check-s12") ""
}
Check-NoLeaks "drop GET /api/notifications" $r.Json

$r = Req Get "/api/applicant/vacancies/$VacancyId" $dropTok
Check "Dropped applicant gets 404 on the vacancy detail (company block)" ($r.Status -eq 404) "got $($r.Status)"
Check-NoLeaks "drop GET /api/applicant/vacancies/:id" $r.Json

$r = Req Get "/api/applicant/vacancies?pageSize=100" $dropTok
$jobs = @($r.Json.data)
Check "Vacancy missing from the dropped applicant's job list" (@($jobs | Where-Object { $_.vacancyId -eq $VacancyId }).Count -eq 0) ""
Check "'$OtherJobTitle' (another company) is still visible" (@($jobs | Where-Object { $_.jobTitle -eq $OtherJobTitle }).Count -gt 0) "publish it or pass -OtherJobTitle"
Check-NoLeaks "drop GET /api/applicant/vacancies" $r.Json

$r = Req Post "/api/admin/applications/$dropApp/drop" $hrTok @{ reason = "failed_verification" }
Check "Dropping again -> 409" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"

# ---------------------------------------------------------------- summary
$color = "Green"; if ($script:Fail -gt 0) { $color = "Red" }
Write-Host "`n== $($script:Pass) passed, $($script:Fail) failed ==" -ForegroundColor $color
Write-Host @"

Now run these in the Supabase SQL editor:

  select application_id, status, verification_started_at
  from application where job_vacancy_id = '$VacancyId' order by applied_at;

  select history_id, application_id, from_status, to_status, reason, changed_by
  from application_status_history
  where application_id in (select application_id from application where job_vacancy_id = '$VacancyId')
  order by changed_at desc limit 10;

  select document_type, status, due_at, fulfilled_at
  from document_request where application_id = '$dropApp' order by created_at desc;

  select document_type, verification_status, is_current, replaced_at
  from supporting_document
  where applicant_id = (select applicant_id from application where application_id = '$dropApp');

  select verification_status, verification_remarks, verified_by
  from resume where is_current and applicant_id in
    (select applicant_id from application where application_id in ('$keepApp', '$dropApp'));

Expect: keep ($keepApp) shortlisted with verification_started_at set; drop ($dropApp) dropped;
the drop row in the history has the HR user in changed_by and a reason starting 'Dropped by HR: Failed document verification';
any promotion after it has changed_by null and reason 'shortlist refresh'; the nbi_clearance request is cancelled;
keep's resume verified, drop's resume rejected with remarks 'check-s12: unreadable copy'.
"@

if ($script:Fail -gt 0) { exit 1 }
