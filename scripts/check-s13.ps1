# S13 Interview scheduling backend check (Windows PowerShell 5.1 compatible)
# Usage, from the repo root, with `pnpm dev` running:
#   powershell -ExecutionPolicy Bypass -File scripts/check-s13.ps1 -HrEmail <hr email> `
#     -ApplicantAEmail <throwaway A> -ApplicantCEmail <throwaway C> -ApplicantBEmail <throwaway B> -ResumePath <text PDF>
# All parameters are required (no default accounts); passwords are prompted and never stored.
#
# Before running:
#   - Create three FRESH throwaway applicants (no profile yet): pnpm --filter api seed:applicant -- --email <email>
#   - Store Crew is open and its Experienced group has nobody shortlisted or waiting
#     (otherwise run supabase/scripts/reset-applications.sql for Store Crew first).
#   - ResumePath is a text-based English PDF whose parsed profile passes Store Crew's prescreen.
# What it changes (the three throwaways only; juan@vera.test is refused):
#   - A, C, B each upload ResumePath, confirm the parsed profile (names "S13 Test A/C/B"), and apply to Store Crew
#     as Experienced, strictly in the order A -> C -> B (same resume, so the tie goes to the earlier application).
#   - A: resume verified, interview scheduled, confirmed, edited, then marked NO-SHOW -> dropped. dropped is a
#     failed outcome: A can never apply to Store Crew's company again (BR-19).
#   - C stays shortlisted; B moves from the waiting pool to shortlisted (refill).
#   - Each run uses 3 of Store Crew's application cap.

param(
  [Parameter(Mandatory = $true)] [string]$HrEmail,
  [Parameter(Mandatory = $true)] [string]$ApplicantAEmail,
  [Parameter(Mandatory = $true)] [string]$ApplicantCEmail,
  [Parameter(Mandatory = $true)] [string]$ApplicantBEmail,
  [Parameter(Mandatory = $true)] [string]$ResumePath,
  [string]$JobTitle = "Store Crew",
  [string]$Api = "http://127.0.0.1:5000",
  [string]$EnvFile = "apps/web/.env"
)

$ErrorActionPreference = "Stop"
$script:Pass = 0
$script:Fail = 0
Add-Type -AssemblyName System.Net.Http

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

# Multipart upload through the normal applicant endpoint (PS 5.1 has no Invoke-RestMethod -Form).
function Upload-Resume([string]$Token, [string]$Path) {
  $client = New-Object System.Net.Http.HttpClient
  $client.Timeout = [TimeSpan]::FromMinutes(3)
  try {
    $client.DefaultRequestHeaders.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", $Token)
    $content = New-Object System.Net.Http.MultipartFormDataContent
    $file = [System.Net.Http.ByteArrayContent]::new([System.IO.File]::ReadAllBytes($Path))
    $file.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("application/pdf")
    $content.Add($file, "resume", [System.IO.Path]::GetFileName($Path))
    $resp = $client.PostAsync("$Api/api/applicant/resume/parse", $content).GetAwaiter().GetResult()
    $raw = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    $json = $null
    if ($raw) { try { $json = $raw | ConvertFrom-Json } catch {} }
    return [pscustomobject]@{ Status = [int]$resp.StatusCode; Json = $json; Raw = $raw }
  } finally { $client.Dispose() }
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
$LeakPattern = '(?i)score|similarity|weights|company|status_?reason|^age$|gender|birth'

function Check-NoLeaks([string]$Name, $Json) {
  $bad = @(Get-Keys $Json | Where-Object { $_ -match $LeakPattern } | Sort-Object -Unique)
  Check "No company/score/status_reason keys: $Name" ($bad.Count -eq 0) "keys: $($bad -join ', ')"
}

function Check-NoCompanyText([string]$Name, [string]$Raw) {
  Check "Company name never in the text: $Name" ($Raw -notmatch [regex]::Escape($companyName)) ""
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

# The applicant's own Store Crew application (from their status panel API).
function My-Application([string]$Token) {
  $r = Req Get "/api/applicant/applications" $Token
  return [pscustomobject]@{ Response = $r; Row = (@($r.Json.data) | Where-Object { $_.vacancyId -eq $vacancyId } | Select-Object -First 1) }
}

function My-Notifications([string]$Token, [string]$Type) {
  $r = Req Get "/api/notifications?limit=50" $Token
  return [pscustomobject]@{ Response = $r; Rows = @(@($r.Json.data) | Where-Object { $_.type -eq $Type }) }
}

# An ISO time with an explicit Philippine offset (+08:00), like the web app sends; whole seconds.
function Manila-Iso([datetime]$Utc) {
  return $Utc.AddHours(8).ToString("yyyy-MM-ddTHH:mm:ss", [Globalization.CultureInfo]::InvariantCulture) + "+08:00"
}

function Whole-Seconds([datetime]$Utc) {
  return [datetime]::new($Utc.Ticks - ($Utc.Ticks % [TimeSpan]::TicksPerSecond), [DateTimeKind]::Utc)
}

$EducationLevels = @("elementary", "junior_high", "senior_high", "vocational", "college_undergraduate", "college_graduate", "postgraduate")

# Names the first PRESCREEN field that is missing or fails the vacancy's prescreen (never filled in).
# Non-prescreen fields are filled with visible test values instead (see Fill-Profile).
function Profile-Problem($p, $v) {
  foreach ($field in @("birthdate", "gender", "educationLevel")) {
    if (-not "$($p.$field)".Trim()) { return "$field is missing in the parsed profile" }
  }
  $bd = [datetime]::ParseExact("$($p.birthdate)", "yyyy-MM-dd", [Globalization.CultureInfo]::InvariantCulture)
  $today = [datetime]::UtcNow.AddHours(8).Date
  $age = $today.Year - $bd.Year
  if ($today -lt $bd.AddYears($age)) { $age-- }
  if ($null -ne $v.minAge -and $age -lt [int]$v.minAge) { return "birthdate: age $age is below $($v.minAge)" }
  if ($null -ne $v.maxAge -and $age -gt [int]$v.maxAge) { return "birthdate: age $age is above $($v.maxAge)" }
  if ($v.genderRequirement -and $v.genderRequirement -ne "any" -and $p.gender -ne $v.genderRequirement) {
    return "gender: $($p.gender) but the job needs $($v.genderRequirement)"
  }
  if ($v.minEducationLevel -and ($EducationLevels.IndexOf("$($p.educationLevel)") -lt $EducationLevels.IndexOf("$($v.minEducationLevel)"))) {
    return "educationLevel: $($p.educationLevel) is below $($v.minEducationLevel)"
  }
  if ($null -ne $v.minHeightCm) {
    if ($null -eq $p.heightCm) { return "heightCm is missing in the parsed profile (job needs $($v.minHeightCm) cm)" }
    if ([double]$p.heightCm -lt [double]$v.minHeightCm) { return "heightCm: $($p.heightCm) is below $($v.minHeightCm)" }
  }
  return $null
}

# Non-prescreen fields: the parsed value if present, else a visible test value (profile schema:
# contactNumber matches ^[0-9+()\-\s]{7,20}$). Returns the value and records which fields were filled.
$TestValues = [ordered]@{
  addressLine = "S13 Test Street"; city = "Quezon City"; province = "Metro Manila"; contactNumber = "09170000000"
}
function Fill-Profile($p) {
  $values = @{}
  $filled = @()
  foreach ($field in $TestValues.Keys) {
    if ("$($p.$field)".Trim()) { $values[$field] = $p.$field }
    else { $values[$field] = $TestValues[$field]; $filled += $field }
  }
  return [pscustomobject]@{ Values = $values; Filled = $filled }
}

# ---------------------------------------------------------------- setup
Write-Host "`n== S13 Interview scheduling check: $JobTitle ==`n"

$emails = @($HrEmail, $ApplicantAEmail, $ApplicantCEmail, $ApplicantBEmail) | ForEach-Object { $_.Trim().ToLowerInvariant() }
if ($emails -contains "juan@vera.test") { Stop-Check "juan@vera.test is never used by this check. Pass three throwaway applicants." }
if (@($emails | Sort-Object -Unique).Count -ne 4) { Stop-Check "HR, A, C, and B must be four different accounts." }

if (-not (Test-Path $EnvFile)) { Stop-Check "Run this from the repo root ($EnvFile not found)." }
if (-not (Test-Path $ResumePath)) { Stop-Check "ResumePath not found: $ResumePath" }
$resumeFile = (Resolve-Path $ResumePath).Path
$envLines    = Get-Content $EnvFile
$supabaseUrl = Get-EnvValue $envLines '^VITE_SUPABASE_URL='
$publishable = Get-EnvValue $envLines '^VITE_SUPABASE_(PUBLISHABLE|ANON)_KEY='
if (-not $supabaseUrl -or $publishable.Length -lt 30) { Stop-Check "Could not read VITE_SUPABASE_URL / publishable key from $EnvFile." }

$r = Req Get "/api/health" $null
$healthy = $r.Status -eq 200 -and $r.Json.data.db -eq "up"
Check "API health (db up)" $healthy "status $($r.Status): $($r.Raw)"
if (-not $healthy) { Stop-Check "Start pnpm dev first." }

$hrTok = Login $HrEmail
$aTok  = Login $ApplicantAEmail
$cTok  = Login $ApplicantCEmail
$bTok  = Login $ApplicantBEmail
Check "Supabase logins (HR, A, C, B)" ([bool]$hrTok -and [bool]$aTok -and [bool]$cTok -and [bool]$bTok)

$me = (Req Get "/api/me" $hrTok).Json.data
if ($me.role -ne "hr" -and $me.role -ne "admin") { Stop-Check "$HrEmail is not an HR/admin account." }
$hrUserId = $me.userId

# ---------------------------------------------------------------- 1. pre-checks (nothing changes yet)
$r = Req Get "/api/admin/screening" $hrTok
$found = @(@($r.Json.data) | Where-Object { $_.jobTitle -eq $JobTitle })
if ($found.Count -ne 1) { Stop-Check "Expected exactly one '$JobTitle' in Resume Screening, found $($found.Count)." }
$vacancyId = $found[0].vacancyId
if ($found[0].status -ne "open") { Stop-Check "$JobTitle is $($found[0].status); it must be open." }

$view = (Req Get "/api/admin/screening/$vacancyId" $hrTok).Json.data
$companyName = $view.vacancy.companyName
$exp = $view.groups.experienced
# Shortlisted must be 0 (A and C need both slots). Waiting must be 0 too, so the refill can only promote B.
if (@($exp.shortlisted).Count -ne 0 -or @($exp.waitingPool).Count -ne 0) {
  Stop-Check "Run reset-applications.sql for $JobTitle first. (Experienced: $(@($exp.shortlisted).Count) shortlisted, $(@($exp.waitingPool).Count) waiting.)"
}
Check "Experienced quota = 2 x slots = 2" ($exp.quota -eq 2) "got $($exp.quota)"
$vacancy = (Req Get "/api/admin/vacancies/$vacancyId" $hrTok).Json.data
Info "$JobTitle ($companyName) $vacancyId; threshold $($vacancy.matchingThreshold); cap $($vacancy.applicationCap)"

$applicants = @(
  [pscustomobject]@{ Key = "A"; Email = $ApplicantAEmail; Token = $aTok; AppId = $null },
  [pscustomobject]@{ Key = "C"; Email = $ApplicantCEmail; Token = $cTok; AppId = $null },
  [pscustomobject]@{ Key = "B"; Email = $ApplicantBEmail; Token = $bTok; AppId = $null }
)
foreach ($x in $applicants) {
  $m = (Req Get "/api/me" $x.Token).Json.data
  if ($m.role -ne "applicant") { Stop-Check "$($x.Email) is not an applicant account." }
  if ($m.hasProfile) { Stop-Check "$($x.Email) already has a profile. Use a fresh throwaway (seed:applicant)." }
  if (@((Req Get "/api/applicant/applications" $x.Token).Json.data).Count -ne 0) { Stop-Check "$($x.Email) already has applications." }
}

Write-Host "`nNext steps change A, C, and B permanently: A is DROPPED (no-show) and can never apply to $companyName again." -ForegroundColor Yellow
$answer = Read-Host "Type S13 to continue"
if ($answer -ne "S13") { Write-Host "Stopped before changing anything." -ForegroundColor Yellow; exit 1 }

# ---------------------------------------------------------------- 2. setup: upload, confirm profile, apply A -> C -> B
foreach ($x in $applicants) {
  $r = Upload-Resume $x.Token $resumeFile
  if ($r.Status -ne 200) { Stop-Check "Resume upload for $($x.Key) -> $($r.Status): $($r.Raw)" }
  $p = $r.Json.data.profile
  $problem = Profile-Problem $p $vacancy
  if ($problem) { Stop-Check "Parsed profile for $($x.Key): $problem. Use a resume that passes $JobTitle's prescreen." }
  $fill = Fill-Profile $p
  if ($fill.Filled.Count -gt 0) { Info "$($x.Key): filled test values for $($fill.Filled -join ', ') (not prescreen fields)" }
  $body = @{
    firstName = "S13 Test"; middleName = $null; lastName = $x.Key; suffix = $null
    contactNumber = $fill.Values.contactNumber; birthdate = $p.birthdate; gender = $p.gender; heightCm = $p.heightCm
    addressLine = $fill.Values.addressLine; city = $fill.Values.city; province = $fill.Values.province
    educationLevel = $p.educationLevel
  }
  $r = Req Post "/api/applicant/profile/confirm" $x.Token $body
  if ($r.Status -ne 201) {
    $fields = @($r.Json.error.details | ForEach-Object { "$($_.path)" }) -join ", "
    Stop-Check "Profile confirm for $($x.Key) -> $($r.Status) (fields: $fields): $($r.Json.error.message)"
  }
  Check "Profile confirmed: S13 Test $($x.Key)" $true
}

foreach ($x in $applicants) {
  $r = Req Post "/api/applicant/applications" $x.Token @{ vacancyId = $vacancyId; applicantType = "experienced" }
  Check "Apply $($x.Key) (Experienced) -> 201" ($r.Status -eq 201) "got $($r.Status): $($r.Raw)"
  if ($r.Status -ne 201) { Stop-Check "Apply failed for $($x.Key)." }
  Check-NoLeaks "apply response ($($x.Key))" $r.Json
  $x.AppId = $r.Json.data.applicationId
  Start-Sleep -Milliseconds 1100 # distinct applied_at, so the tie goes A, C, B
}
$a = $applicants[0]; $c = $applicants[1]; $b = $applicants[2]

$view = (Req Get "/api/admin/screening/$vacancyId" $hrTok).Json.data
$rows = @($view.groups.experienced.shortlisted) + @($view.groups.experienced.waitingPool)
foreach ($x in $applicants) {
  $row = $rows | Where-Object { $_.applicationId -eq $x.AppId } | Select-Object -First 1
  Info "$($x.Key): application $($x.AppId), matching score $($row.matchingScore)"
}
$aStatus = (My-Application $aTok).Row.status
$cStatus = (My-Application $cTok).Row.status
$bStatus = (My-Application $bTok).Row.status
Check "A shortlisted" ($aStatus -eq "shortlisted") "got $aStatus"
Check "C shortlisted" ($cStatus -eq "shortlisted") "got $cStatus"
Check "B in the waiting pool" ($bStatus -eq "waiting_pool") "got $bStatus"
if ($aStatus -ne "shortlisted" -or $bStatus -ne "waiting_pool") { Stop-Check "Unexpected shortlist; the rest of the check needs A shortlisted and B waiting." }

# ---------------------------------------------------------------- 3. HR verifies A's resume
$sheet = (Req Get "/api/admin/applications/$($a.AppId)" $hrTok).Json.data
$r = Req Patch "/api/admin/resumes/$($sheet.resume.resumeId)/verification" $hrTok @{ status = "verified"; applicationId = $a.AppId }
Check "Verify A's resume -> 200" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"
$sheet = (Req Get "/api/admin/applications/$($a.AppId)" $hrTok).Json.data
Check "A fully verified" ($sheet.fullyVerified -eq $true) "documents: $(@($sheet.documents).Count), requests: $(@($sheet.requests).Count)"
Check "A nextStep = schedule_interview" ($sheet.nextStep -eq "schedule_interview") "got $($sheet.nextStep)"
if ($sheet.nextStep -ne "schedule_interview") { Stop-Check "A cannot be scheduled yet." }

$r = Req Get "/api/admin/interviewers" $hrTok
Check "Interviewer list includes the HR user" ([bool](@($r.Json.data) | Where-Object { $_.userId -eq $hrUserId })) "got $($r.Status)"

# ---------------------------------------------------------------- 4. negative cases (none of these schedule anything)
$link = "https://meet.google.com/s13-check-link"
function Schedule-Body([string]$ApplicationId, [string]$ScheduledAt, [string]$MeetingLink = $link) {
  return @{ applicationId = $ApplicationId; scheduledAt = $ScheduledAt; durationMinutes = 30; meetingLink = $MeetingLink; interviewerId = $hrUserId }
}
$inOneHour = Manila-Iso ([datetime]::UtcNow.AddHours(1))

$r = Req Post "/api/admin/interviews" $hrTok (Schedule-Body $b.AppId $inOneHour)
Check "Schedule B (waiting pool, not shortlisted) -> 409" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/admin/interviews" $hrTok (Schedule-Body $a.AppId (Manila-Iso ([datetime]::UtcNow.AddHours(-1))))
Check "Schedule A in the past -> 400" ($r.Status -eq 400) "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/admin/interviews" $hrTok (Schedule-Body $a.AppId $inOneHour "http://meet.google.com/s13-check-link")
Check "Schedule A with an http (not https) link -> 400" ($r.Status -eq 400) "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/admin/interviews" $aTok (Schedule-Body $a.AppId $inOneHour)
Check "Applicant token on POST /api/admin/interviews -> 403" ($r.Status -eq 403) "got $($r.Status)"
Check "A is still shortlisted after the negative cases" ((My-Application $aTok).Row.status -eq "shortlisted") ""

# ---------------------------------------------------------------- 5. schedule A at now + 2 minutes
$scheduledUtc = Whole-Seconds ([datetime]::UtcNow.AddMinutes(2))
$r = Req Post "/api/admin/interviews" $hrTok (Schedule-Body $a.AppId (Manila-Iso $scheduledUtc))
Check "Schedule A at now + 2 min -> 201" ($r.Status -eq 201) "got $($r.Status): $($r.Raw)"
if ($r.Status -ne 201) { Stop-Check "Scheduling failed." }
$interviewId = $r.Json.data.interviewId
Check "Response: attempt 1, pending_confirmation, application interview_scheduled" `
  ($r.Json.data.attemptNumber -eq 1 -and $r.Json.data.status -eq "pending_confirmation" -and $r.Json.data.applicationStatus -eq "interview_scheduled") $r.Raw
Info "Interview $interviewId at $(Manila-Iso $scheduledUtc)"

$r = Req Post "/api/admin/interviews" $hrTok (Schedule-Body $a.AppId (Manila-Iso ([datetime]::UtcNow.AddHours(2))))
Check "Double schedule A -> 409" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"

$d = My-Application $aTok
Check "A's status panel: interview_scheduled with a confirm deadline" ($d.Row.status -eq "interview_scheduled" -and [bool]$d.Row.nextDueAt) "got $($d.Row.status), nextDueAt '$($d.Row.nextDueAt)'"
Check-NoLeaks "A GET /api/applicant/applications" $d.Response.Json

$r = Req Get "/api/applicant/interviews" $aTok
$mine = @($r.Json.data) | Where-Object { $_.interviewId -eq $interviewId } | Select-Object -First 1
Check "A's interview list shows the interview" ($r.Status -eq 200 -and $null -ne $mine) "got $($r.Status): $($r.Raw)"
Check "Meeting link hidden before confirming" ($null -eq $mine.meetingLink -and $r.Raw -notmatch [regex]::Escape($link)) ""
Check-NoLeaks "A GET /api/applicant/interviews" $r.Json
Check-NoCompanyText "A GET /api/applicant/interviews" $r.Raw

$n = My-Notifications $aTok "interview_scheduled"
Check "A got interview_scheduled" ($n.Rows.Count -ge 1) ""
if ($n.Rows.Count -ge 1) {
  Check "interview_scheduled has no link and no company" ("$($n.Rows[0].title) $($n.Rows[0].message)" -notmatch "(?i)https?:|$([regex]::Escape($companyName))") $n.Rows[0].message
}

# ---------------------------------------------------------------- 6. confirm
$r = Req Post "/api/applicant/interviews/$interviewId/confirm" $bTok
Check "B confirming A's interview -> 404" ($r.Status -eq 404) "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/applicant/interviews/$interviewId/confirm" $aTok
Check "A confirms -> 200 (confirmed / interview_confirmed)" ($r.Status -eq 200 -and $r.Json.data.status -eq "confirmed" -and $r.Json.data.applicationStatus -eq "interview_confirmed") "got $($r.Status): $($r.Raw)"
$r = Req Get "/api/applicant/interviews" $aTok
$mine = @($r.Json.data) | Where-Object { $_.interviewId -eq $interviewId } | Select-Object -First 1
Check "Meeting link visible after confirming" ($mine.meetingLink -eq $link) "got '$($mine.meetingLink)'"
Check-NoLeaks "A GET /api/applicant/interviews (confirmed)" $r.Json
$r = Req Post "/api/applicant/interviews/$interviewId/confirm" $aTok
Check "Second confirm -> 409" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"
$n = My-Notifications $hrTok "hr_interview_confirmed"
Check "Staff got hr_interview_confirmed for S13 Test A" ([bool]($n.Rows | Where-Object { "$($_.message)" -match "S13 Test A" })) ""

# ---------------------------------------------------------------- 7. HR edits the time (+1 minute)
$scheduledUtc = $scheduledUtc.AddMinutes(1)
$edit = Schedule-Body $a.AppId (Manila-Iso $scheduledUtc)
$edit.Remove("applicationId")
$r = Req Patch "/api/admin/interviews/$interviewId" $hrTok $edit
Check "HR edits A's time (+1 min) -> 200, still confirmed" ($r.Status -eq 200 -and $r.Json.data.status -eq "confirmed") "got $($r.Status): $($r.Raw)"
Check "A's application still interview_confirmed" ((My-Application $aTok).Row.status -eq "interview_confirmed") ""
$n = My-Notifications $aTok "interview_rescheduled"
Check "A got interview_rescheduled" ($n.Rows.Count -ge 1) ""
if ($n.Rows.Count -ge 1) {
  Check "interview_rescheduled ends with the contact line" ("$($n.Rows[0].message)".EndsWith("If you can't attend at the new time, please contact Confiable Manpower.")) $n.Rows[0].message
  Check-NoCompanyText "interview_rescheduled" "$($n.Rows[0].title) $($n.Rows[0].message)"
}
$r = Req Get "/api/admin/interviews?vacancyId=$vacancyId" $hrTok
$hrRow = @($r.Json.data) | Where-Object { $_.interviewId -eq $interviewId } | Select-Object -First 1
Check "HR list shows A confirmed at the new time" ($hrRow.status -eq "confirmed" -and ([datetime]$hrRow.scheduledAt).ToUniversalTime() -eq $scheduledUtc) "got $($hrRow.status) $($hrRow.scheduledAt)"

# ---------------------------------------------------------------- 8. no-show
$r = Req Post "/api/admin/interviews/$interviewId/no-show" $hrTok
Check "No-show before the interview time -> 409" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"

$target = $scheduledUtc.AddSeconds(5)
while ([datetime]::UtcNow -lt $target) {
  $left = [int][Math]::Ceiling(($target - [datetime]::UtcNow).TotalSeconds)
  Write-Host -NoNewline ("`rWaiting for the interview time to pass: {0,4} s " -f $left)
  Start-Sleep -Seconds 1
}
Write-Host ""

$r = Req Post "/api/admin/interviews/$interviewId/no-show" $hrTok
Check "No-show after the interview time -> 200 (no_show / dropped)" ($r.Status -eq 200 -and $r.Json.data.interviewStatus -eq "no_show" -and $r.Json.data.status -eq "dropped") "got $($r.Status): $($r.Raw)"
Check "Refill promoted B" (@($r.Json.data.promoted) -contains $b.AppId) "promoted: $(@($r.Json.data.promoted) -join ', ')"

$d = My-Application $aTok
Check "A's application dropped" ($d.Row.status -eq "dropped") "got $($d.Row.status)"
Check-NoLeaks "A GET /api/applicant/applications (dropped)" $d.Response.Json
Check "B shortlisted" ((My-Application $bTok).Row.status -eq "shortlisted") ""
Check "C still shortlisted" ((My-Application $cTok).Row.status -eq "shortlisted") ""
$r = Req Get "/api/applicant/interviews" $aTok
Check "A's interview list is empty" (@($r.Json.data | Where-Object { $_ }).Count -eq 0) $r.Raw

$n = My-Notifications $aTok "application_dropped"
Check "A got application_dropped" ($n.Rows.Count -ge 1) ""
if ($n.Rows.Count -ge 1) {
  $text = "$($n.Rows[0].title) $($n.Rows[0].message)"
  Check "Drop notice is neutral (closed, apply to other jobs)" ($text -match "has been closed" -and $text -match "You can apply to other jobs") $text
  # Not "other": the notice itself says "You can apply to other jobs".
  Check "Drop notice has no reason (no-show, dropped by HR, interview)" ($text -notmatch "(?i)no-show|no show|reason|dropped by|interview") $text
  Check-NoCompanyText "application_dropped" $text
}

# ---------------------------------------------------------------- 9. company block
$r = Req Get "/api/applicant/vacancies/$vacancyId" $aTok
Check "A gets 404 on $JobTitle (company block, BR-19)" ($r.Status -eq 404) "got $($r.Status)"
$r = Req Get "/api/applicant/vacancies?pageSize=100" $aTok
Check "$JobTitle missing from A's job list" (@(@($r.Json.data) | Where-Object { $_.vacancyId -eq $vacancyId }).Count -eq 0) ""
Check-NoLeaks "A GET /api/applicant/vacancies" $r.Json
$r = Req Get "/api/applicant/vacancies/$vacancyId" $bTok
Check "B still sees $JobTitle" ($r.Status -eq 200) "got $($r.Status)"

# ---------------------------------------------------------------- summary
$color = "Green"; if ($script:Fail -gt 0) { $color = "Red" }
Write-Host "`n== $($script:Pass) passed, $($script:Fail) failed ==" -ForegroundColor $color
Write-Host @"

Now run these in the Supabase SQL editor:

  select h.application_id, h.from_status, h.to_status, h.reason, h.changed_by, u.role as changed_by_role, h.changed_at
  from application_status_history h
  left join user_account u on u.user_account_id = h.changed_by
  where h.application_id in ('$($a.AppId)', '$($c.AppId)', '$($b.AppId)')
  order by h.changed_at;

  select interview_schedule_id, status, attempt_number, scheduled_at, confirm_due_at, confirmed_at, interviewer_id, created_by
  from interview_schedule where application_id = '$($a.AppId)';

Expect (A = $($a.AppId), B = $($b.AppId)):
  - A shortlisted -> interview_scheduled: changed_by = the HR user ($hrUserId).
  - A interview_scheduled -> interview_confirmed: changed_by = A's own user (role applicant).
  - A interview_confirmed -> dropped: changed_by = the HR user, reason 'Dropped by HR: Other <em dash> No-show'.
  - B waiting_pool -> shortlisted: changed_by null, reason 'shortlist refresh'.
  - The attempt: status no_show, attempt_number 1, confirmed_at set, created_by = the HR user.

Reminder: each run uses 3 of $JobTitle's application cap ($($vacancy.applicationCap)). Reset with
supabase/scripts/reset-applications.sql before the cap closes the vacancy.
"@

if ($script:Fail -gt 0) { exit 1 }
