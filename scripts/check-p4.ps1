# Phase 4 check: decision 19 (User Management: admin creates HR accounts, activate / deactivate) and decision 20
# (applicant reschedule request, HR approve / decline, max 2 requests). Part C (decision 16) is not built yet.
# Windows PowerShell 5.1 compatible, ASCII only.
# Usage, from the repo root, with `pnpm dev` running (api + svc) and the Phase 4 migration applied:
#   powershell -ExecutionPolicy Bypass -File scripts/check-p4.ps1 -AdminEmail <admin> -HrEmail <hr> `
#     -ApplicantAEmail <a> -ApplicantBEmail <b> -ResumePath <Juan's demo resume PDF>
# All parameters are required (no default accounts); passwords are prompted and never stored.
#
# Before running:
#   - Apply 20261021000000_reschedule_requests.sql and run its verification queries (docs/DATABASE_SCHEMA.md section 7).
#   - Run supabase/scripts/delete-check-vacancies.sql: no 'ZZ Check' vacancy may exist.
#   - Create TWO fresh throwaway applicants (no profile yet): pnpm --filter api seed:applicant -- --email <email>
#
# SAFETY: the ZZ vacancy uses minHeightCm = 249 and the throwaways confirm 250 cm, so pool matching on publish never
# invites a real applicant. No SQL is run by this script.
#
# What it leaves behind:
#   - One Supabase HR user zz-check-p4-hr-<timestamp>@example.com, DEACTIVATED (the email is printed at the end).
#     Remove it later: docs/GETTING_STARTED.md "Remove test HR accounts".
#   - A ZZ company and the vacancy VR (clean up with supabase/scripts/delete-check-vacancies.sql).

param(
  [Parameter(Mandatory = $true)] [string]$AdminEmail,
  [Parameter(Mandatory = $true)] [string]$HrEmail,
  [Parameter(Mandatory = $true)] [string]$ApplicantAEmail,
  [Parameter(Mandatory = $true)] [string]$ApplicantBEmail,
  [Parameter(Mandatory = $true)] [string]$ResumePath,
  [string]$Api = "http://127.0.0.1:5000",
  [string]$EnvFile = "apps/web/.env"
)

$ErrorActionPreference = "Stop"
$script:Pass = 0
$script:Fail = 0
$script:TestHrEmail = $null
Add-Type -AssemblyName System.Net.Http

function Check([string]$Name, [bool]$Ok, [string]$Detail = "") {
  if ($Ok) { $script:Pass++; Write-Host "PASS  $Name" -ForegroundColor Green }
  else     { $script:Fail++; Write-Host "FAIL  $Name  $Detail" -ForegroundColor Red }
}

function Info([string]$Text) { Write-Host "INFO  $Text" -ForegroundColor Cyan }

function Show-TestHr {
  if ($script:TestHrEmail) {
    Write-Host "`nTest HR account created by this run (left INACTIVE): $($script:TestHrEmail)" -ForegroundColor Yellow
    Write-Host "Remove it later: docs/GETTING_STARTED.md 'Remove test HR accounts'." -ForegroundColor Yellow
  }
}

function Stop-Check([string]$Text) {
  Write-Host "STOP  $Text" -ForegroundColor Red
  Show-TestHr
  exit 1
}

# A state-changing step: on failure print the counts and STOP (nothing after it runs).
function Step([string]$Name, [bool]$Ok, [string]$Detail = "") {
  Check $Name $Ok $Detail
  if (-not $Ok) {
    Write-Host "`n== $($script:Pass) passed, $($script:Fail) failed ==" -ForegroundColor Red
    Stop-Check "A state change failed: '$Name'. Nothing after it was run. Check the API log, fix, and rerun with new accounts."
  }
}

function Get-EnvValue([string[]]$Lines, [string]$Pattern) {
  $line = $Lines | Where-Object { $_ -match $Pattern } | Select-Object -First 1
  if (-not $line) { return "" }
  return ($line -replace '^[^=]+=', '' -replace '["'' ]', '')
}

function Req([string]$Method, [string]$Path, $Token, $Body = $null) {
  $headers = @{}
  if ($Token) { $headers.Authorization = "Bearer $Token" }
  $p = @{ Method = $Method; Uri = "$Api$Path"; Headers = $headers; ContentType = "application/json"; UseBasicParsing = $true; TimeoutSec = 300 }
  if ($null -ne $Body) { $p.Body = ($Body | ConvertTo-Json -Depth 8) }
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

# Supabase password sign-in. Returns @{ Token; Status; Message } (Token $null when refused, e.g. a banned user).
function Sign-In([string]$Email, [string]$Password) {
  try {
    $body = @{ email = $Email; password = $Password } | ConvertTo-Json
    $t = (Invoke-RestMethod -Method Post -Uri "$supabaseUrl/auth/v1/token?grant_type=password" `
      -Headers @{ apikey = $publishable } -ContentType "application/json" -Body $body).access_token
    return @{ Token = $t; Status = 200; Message = "" }
  } catch {
    $status = 0
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
    return @{ Token = $null; Status = $status; Message = "$($_.ErrorDetails.Message)" }
  }
}

function Login([string]$Email) {
  $sec  = Read-Host "Password for $Email" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  $pw   = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  $r = Sign-In $Email $pw
  $pw = $null
  if (-not $r.Token) { Write-Host "Login failed for $($Email): $($r.Message)" -ForegroundColor Red; exit 1 }
  return $r.Token
}

function Manila-Iso([datetime]$Utc) {
  return $Utc.AddHours(8).ToString("yyyy-MM-ddTHH:mm:ss", [Globalization.CultureInfo]::InvariantCulture) + "+08:00"
}

function My-Application([string]$Token, [string]$VacancyId) {
  $r = Req Get "/api/applicant/applications" $Token
  return (@($r.Json.data) | Where-Object { $_.vacancyId -eq $VacancyId } | Select-Object -First 1)
}

# The leading comma keeps the array (PowerShell 5.1 unrolls a returned one-element array into a bare object).
function My-Notifications([string]$Token, [string]$Type) {
  $r = Req Get "/api/notifications?limit=50" $Token
  return ,@(@($r.Json.data) | Where-Object { $_.type -eq $Type })
}

function My-Interview([string]$Token) {
  $r = Req Get "/api/applicant/interviews" $Token
  return (@($r.Json.data) | Where-Object { $_ } | Select-Object -First 1)
}

# ---------------------------------------------------------------- setup
Write-Host "`n== Phase 4 check (User Management, interview reschedule requests) ==`n"

$keys = @("A", "B")
$emailOf = @{ A = $ApplicantAEmail; B = $ApplicantBEmail }
$emails = @($AdminEmail, $HrEmail, $ApplicantAEmail, $ApplicantBEmail) | ForEach-Object { $_.Trim().ToLowerInvariant() }
if ($emails -contains "juan@vera.test") { Stop-Check "juan@vera.test is never used by this check. Pass two throwaway applicants." }
if (@($emails | Sort-Object -Unique).Count -ne 4) { Stop-Check "Admin, HR and the two applicants must be four different accounts." }

if (-not (Test-Path $EnvFile)) { Stop-Check "Run this from the repo root ($EnvFile not found)." }
if (-not (Test-Path $ResumePath)) { Stop-Check "ResumePath not found: $ResumePath" }
$resumeFile = (Resolve-Path $ResumePath).Path
$envLines    = Get-Content $EnvFile
$supabaseUrl = Get-EnvValue $envLines '^VITE_SUPABASE_URL='
$publishable = Get-EnvValue $envLines '^VITE_SUPABASE_(PUBLISHABLE|ANON)_KEY='
if (-not $supabaseUrl -or $publishable.Length -lt 30) { Stop-Check "Could not read VITE_SUPABASE_URL / publishable key from $EnvFile." }

Write-Host @"

Pre-check: run the Phase 4 migration verification queries (docs/DATABASE_SCHEMA.md section 7) in the Supabase SQL
Editor (read-only). Expect: application.reschedule_requests smallint default 0 not null with CHECK 0..2; no row
above 0; max_reschedules = 2; the one-open interview index lists reschedule_requested. Then run delete-check-vacancies.sql.
"@ -ForegroundColor Yellow
$answer = Read-Host "Type MIGRATED if every verification query matches and the cleanup ran"
if ($answer -ne "MIGRATED") { Write-Host "Stopped: apply and verify the Phase 4 migration first." -ForegroundColor Yellow; exit 1 }

$r = Req Get "/api/health" $null
$healthy = $r.Status -eq 200 -and $r.Json.data.db -eq "up"
Check "API health (db up)" $healthy "status $($r.Status): $($r.Raw)"
if (-not $healthy) { Stop-Check "Start pnpm dev first." }

$adminTok = Login $AdminEmail
$hrTok = Login $HrEmail
$tok = @{}
foreach ($k in $keys) { $tok[$k] = Login $emailOf[$k] }
$adminMe = (Req Get "/api/me" $adminTok).Json.data
if ($adminMe.role -ne "admin") { Stop-Check "$AdminEmail is not an admin account." }
$hrMe = (Req Get "/api/me" $hrTok).Json.data
if ($hrMe.role -ne "hr") { Stop-Check "$HrEmail is not an HR account (pass the HR account here, the admin above)." }
foreach ($k in $keys) {
  $m = (Req Get "/api/me" $tok[$k]).Json.data
  if ($m.role -ne "applicant") { Stop-Check "$($emailOf[$k]) is not an applicant account." }
  if ($m.hasProfile) { Stop-Check "$($emailOf[$k]) already has a profile. Use a fresh throwaway (seed:applicant)." }
}

$r = Req Get "/api/admin/vacancies?search=ZZ%20Check&pageSize=100" $hrTok
$leftovers = @($r.Json.data | Where-Object { $_ })
if ($r.Status -ne 200 -or $leftovers.Count -gt 0) {
  Stop-Check "Leftover 'ZZ Check' vacancies ($($leftovers.Count)): run supabase/scripts/delete-check-vacancies.sql first."
}
Check "No 'ZZ Check' vacancy exists before the run" $true

$ts = (Get-Date).ToString("yyyyMMdd-HHmmss")
Write-Host "`nNext steps create one Supabase HR user (left inactive), a ZZ company and vacancy, and change A and B permanently." -ForegroundColor Yellow
$answer = Read-Host "Type P4 to continue"
if ($answer -ne "P4") { Write-Host "Stopped before changing anything." -ForegroundColor Yellow; exit 1 }

# ---------------------------------------------------------------- 1. User Management (decision 19)
$r = Req Get "/api/admin/users" $hrTok
Check "HR token on GET /api/admin/users -> 403" ($r.Status -eq 403) "got $($r.Status)"
$r = Req Post "/api/admin/users" $hrTok @{ email = "x@example.com"; fullName = "X"; temporaryPassword = "Temp1234x" }
Check "HR token on POST /api/admin/users -> 403" ($r.Status -eq 403) "got $($r.Status)"
$r = Req Get "/api/admin/users" $tok.A
Check "Applicant token on GET /api/admin/users -> 403" ($r.Status -eq 403) "got $($r.Status)"

$r = Req Get "/api/admin/users" $adminTok
$staff = @($r.Json.data | Where-Object { $_ })
$self = $staff | Where-Object { $_.userId -eq $adminMe.userId } | Select-Object -First 1
Check "Admin list: staff only, own row marked isSelf" ($r.Status -eq 200 -and $self.isSelf -eq $true -and @($staff | Where-Object { $_.role -eq "applicant" }).Count -eq 0) "got $($r.Status)"

# Random in-memory password (letters + digits, always one of each); never printed.
$chars = [char[]]"abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
$tempPassword = (-join (1..14 | ForEach-Object { $chars | Get-Random })) + "a7"
$testEmail = "zz-check-p4-hr-$ts@example.com"
$r = Req Post "/api/admin/users" $adminTok @{ email = $testEmail; fullName = "ZZ Check P4 HR"; temporaryPassword = $tempPassword }
Step "Admin creates the test HR account -> 201 role hr, active" ($r.Status -eq 201 -and $r.Json.data.role -eq "hr" -and $r.Json.data.accountStatus -eq "active") "got $($r.Status): $($r.Raw)"
$script:TestHrEmail = $testEmail
$testHrId = $r.Json.data.userId
Check "The create response never echoes the password" ("$($r.Raw)" -notmatch [regex]::Escape($tempPassword)) ""
$r = Req Post "/api/admin/users" $adminTok @{ email = $testEmail.ToUpperInvariant(); fullName = "Dup"; temporaryPassword = "Temp1234x" }
Check "Same email again (any case) -> 409" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/admin/users" $adminTok @{ email = "zz-check-p4-weak-$ts@example.com"; fullName = "Weak"; temporaryPassword = "abcdefgh" }
Check "Weak password (no number) -> 400" ($r.Status -eq 400) "got $($r.Status): $($r.Raw)"

$s = Sign-In $testEmail $tempPassword
Step "The new HR signs in with the temporary password" ([bool]$s.Token) "status $($s.Status): $($s.Message)"
$testHrTok = $s.Token
$m = (Req Get "/api/me" $testHrTok).Json.data
Check "The new HR is role hr in VERA" ($m.role -eq "hr") "got $($m.role)"
Check "The new HR cannot open User Management -> 403" ((Req Get "/api/admin/users" $testHrTok).Status -eq 403) ""

$r = Req Patch "/api/admin/users/$($adminMe.userId)/status" $adminTok @{ accountStatus = "inactive" }
Check "Admin deactivates self -> 409" ($r.Status -eq 409 -and "$($r.Json.error.message)" -eq "You cannot deactivate your own account.") "got $($r.Status): $($r.Raw)"

$r = Req Patch "/api/admin/users/$testHrId/status" $adminTok @{ accountStatus = "inactive" }
Step "Admin deactivates the test HR -> inactive, sign-in blocked" ($r.Status -eq 200 -and $r.Json.data.accountStatus -eq "inactive" -and $r.Json.data.signInBlocked -eq $true) "got $($r.Status): $($r.Raw)"
$r = Req Get "/api/admin/dashboard" $testHrTok
Check "The deactivated HR's existing token is refused (401/403)" ($r.Status -eq 401 -or $r.Status -eq 403) "got $($r.Status)"
$s = Sign-In $testEmail $tempPassword
Check "The deactivated HR cannot sign in (Supabase ban)" (-not $s.Token) "status $($s.Status)"
$r = Req Get "/api/admin/users" $adminTok
$row = @($r.Json.data) | Where-Object { $_.userId -eq $testHrId } | Select-Object -First 1
Check "Admin list shows the test HR as inactive" ($row.accountStatus -eq "inactive") ($row | ConvertTo-Json -Compress)

$r = Req Patch "/api/admin/users/$testHrId/status" $adminTok @{ accountStatus = "active" }
Step "Admin activates the test HR again -> active" ($r.Status -eq 200 -and $r.Json.data.accountStatus -eq "active") "got $($r.Status): $($r.Raw)"
$s = Sign-In $testEmail $tempPassword
Check "The re-activated HR can sign in again" ([bool]$s.Token) "status $($s.Status): $($s.Message)"
$r = Req Patch "/api/admin/users/$testHrId/status" $adminTok @{ accountStatus = "inactive" }
Step "Admin deactivates the test HR at the end (left inactive)" ($r.Status -eq 200 -and $r.Json.data.accountStatus -eq "inactive") "got $($r.Status): $($r.Raw)"
$tempPassword = $null

# ---------------------------------------------------------------- 2. Reschedule requests (decision 20)
$Cashier = @{
  skills = "Handling cash and giving correct change`nOperating a cash register or POS`nServing and assisting customers`nCounting and balancing the cash drawer"
  experience = "Experience as a cashier or sales staff in a retail store, grocery or supermarket, handling payments and serving customers"
}
$r = Req Post "/api/admin/companies" $hrTok @{
  companyName = "ZZ Check P4 $ts Agency"; industry = "Check script (delete me)"; description = $null; website = $null
  contactPersonName = "ZZ Check"; contactPersonPosition = $null; contactEmail = "zz-check-p4@example.com"; contactNumber = $null
}
if ($r.Status -ne 201) { Stop-Check "Create company -> $($r.Status): $($r.Raw)" }
$company = $r.Json.data
$r = Req Post "/api/admin/vacancies" $hrTok @{
  companyId = $company.companyId; jobTitle = "ZZ Check P4 $ts VR"
  jobDescription = "CHECK ONLY."; keyResponsibilities = "Check only"; requiredSkills = $Cashier.skills; experienceRequirement = $Cashier.experience
  minAge = 18; maxAge = 35; genderRequirement = "any"
  minEducationLevel = "senior_high"; minHeightCm = 249; deploymentLocation = "Check only"; employmentType = "Full-time"  # check-only height
  slotsNeeded = 2; applicationCap = 16; endorsementCount = 2; matchingThreshold = 40; passingScore = 50
  sectionWeights = @(@{ sectionCode = "A"; weight = 30 }, @{ sectionCode = "B"; weight = 30 }, @{ sectionCode = "C"; weight = 40 })
}
if ($r.Status -ne 201) { Stop-Check "Create vacancy -> $($r.Status): $($r.Raw)" }
$vr = $r.Json.data
$r = Req Post "/api/admin/vacancies/$($vr.vacancyId)/publish" $hrTok @{}
Step "Publish $($vr.jobTitle) -> open" ($r.Status -eq 200 -and $r.Json.data.status -eq "open") "got $($r.Status): $($r.Raw)"

$app = @{}
foreach ($k in $keys) {
  $r = Upload-Resume $tok[$k] $resumeFile
  if ($r.Status -ne 200) { Stop-Check "Resume upload for $k -> $($r.Status): $($r.Raw)" }
  $p = $r.Json.data.profile
  foreach ($field in @("birthdate", "gender", "educationLevel")) {
    if (-not "$($p.$field)".Trim()) { Stop-Check "$field is missing in $k's parsed profile. Use Juan's demo resume." }
  }
  $r = Req Post "/api/applicant/profile/confirm" $tok[$k] @{
    firstName = "P4 Test"; middleName = $null; lastName = "Applicant $k"; suffix = $null
    contactNumber = "09170000000"; birthdate = $p.birthdate; gender = $p.gender; heightCm = 250   # check-only height
    addressLine = "P4 Test Street"; city = "Quezon City"; province = "Metro Manila"; educationLevel = $p.educationLevel
  }
  Step "Profile confirmed for $k (250 cm) -> 201" ($r.Status -eq 201) "got $($r.Status): $($r.Raw)"
  $r = Req Post "/api/applicant/applications" $tok[$k] @{ vacancyId = $vr.vacancyId; applicantType = "experienced" }
  Step "$k applies to VR -> 201" ($r.Status -eq 201) "got $($r.Status): $($r.Raw)"
  $app[$k] = $r.Json.data.applicationId
  Step "$k is shortlisted at VR" ((My-Application $tok[$k] $vr.vacancyId).status -eq "shortlisted") ""

  $sheet = (Req Get "/api/admin/applications/$($app[$k])" $hrTok).Json.data
  $r = Req Patch "/api/admin/resumes/$($sheet.resume.resumeId)/verification" $hrTok @{ status = "verified"; applicationId = $app[$k] }
  Step "HR verifies $k's resume -> 200" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"
  $r = Req Post "/api/admin/interviews" $hrTok @{
    applicationId = $app[$k]; scheduledAt = (Manila-Iso ([datetime]::UtcNow.AddDays(2))); durationMinutes = 30
    meetingLink = "https://meet.google.com/p4-check-link"; interviewerId = $hrMe.userId
  }
  Step "HR schedules $k's interview (in 2 days) -> 201" ($r.Status -eq 201) "got $($r.Status): $($r.Raw)"
}

function Request-Reschedule([string]$Key, [string]$InterviewId, [string]$Reason = "P4 check: I have a medical check-up at that time.") {
  return Req Post "/api/applicant/interviews/$InterviewId/reschedule-request" $tok[$Key] @{ reason = $Reason }
}
function Approve([string]$InterviewId, [int]$Days) {
  return Req Post "/api/admin/interviews/$InterviewId/reschedule/approve" $hrTok @{
    scheduledAt = (Manila-Iso ([datetime]::UtcNow.AddDays($Days))); durationMinutes = 30
    meetingLink = "https://meet.google.com/p4-check-link"; interviewerId = $hrMe.userId
  }
}

# --- A: request (pending) -> approve -> confirm -> request (confirmed) -> approve (back to interview_scheduled) -> 3rd refused
$ia = My-Interview $tok.A
Check "A's interview list shows requestsLeft = 2" ($ia.requestsLeft -eq 2) ($ia | ConvertTo-Json -Compress)
$r = Request-Reschedule "A" $ia.interviewId
Step "A requests a reschedule (#1, awaiting confirmation) -> reschedule_requested, 1 left" ($r.Status -eq 200 -and $r.Json.data.status -eq "reschedule_requested" -and $r.Json.data.requestsLeft -eq 1) "got $($r.Status): $($r.Raw)"
$n = My-Notifications $hrTok "hr_reschedule_requested"
Check "HR got 'Reschedule requested: P4 Test Applicant A' with the reason, no link" `
  ($n.Count -ge 1 -and "$($n[0].title)" -eq "Reschedule requested: P4 Test Applicant A" -and "$($n[0].message)" -match "medical check-up" -and "$($n[0].message)" -notmatch "https?:") ($n | ConvertTo-Json -Compress)
Check "A's application status did not move (interview_scheduled)" ((My-Application $tok.A $vr.vacancyId).status -eq "interview_scheduled") ""
$r = Req Patch "/api/admin/interviews/$($ia.interviewId)" $hrTok @{ scheduledAt = (Manila-Iso ([datetime]::UtcNow.AddDays(3))); durationMinutes = 30; meetingLink = "https://meet.google.com/p4-check-link"; interviewerId = $hrMe.userId }
Check "HR Edit time while the request waits -> 409" ($r.Status -eq 409 -and "$($r.Json.error.message)" -eq "Answer the reschedule request first.") "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/applicant/interviews/$($ia.interviewId)/confirm" $tok.A
Check "A confirm while the request waits -> 409" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"
$r = Request-Reschedule "A" $ia.interviewId
Check "A requests again while waiting -> 409" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/admin/interviews/$($ia.interviewId)/reschedule/approve" $tok.A @{ scheduledAt = (Manila-Iso ([datetime]::UtcNow.AddDays(3))); durationMinutes = 30; meetingLink = "https://meet.google.com/x"; interviewerId = $hrMe.userId }
Check "Applicant token on approve -> 403" ($r.Status -eq 403) "got $($r.Status)"
$r = Request-Reschedule "B" $ia.interviewId
Check "B asking on A's interview -> 404" ($r.Status -eq 404) "got $($r.Status)"
$r = Req Post "/api/applicant/interviews/$($ia.interviewId)/reschedule-request" $hrTok @{ reason = "HR cannot do this" }
Check "HR token on the applicant request -> 403" ($r.Status -eq 403) "got $($r.Status)"

$r = Approve $ia.interviewId 3
Step "HR approves A's request with a new time -> attempt 2 awaiting confirmation" ($r.Status -eq 200 -and $r.Json.data.attemptNumber -eq 2 -and $r.Json.data.status -eq "pending_confirmation") "got $($r.Status): $($r.Raw)"
$n = My-Notifications $tok.A "interview_rescheduled"
Check "A got 'Interview time changed' asking to confirm (no link, no company)" `
  ($n.Count -ge 1 -and "$($n[0].message)" -match "Please confirm it on your dashboard" -and "$($n[0].title) $($n[0].message)" -notmatch "(?i)https?:|Agency") ($n | ConvertTo-Json -Compress)
$ia2 = My-Interview $tok.A
Check "A's list shows the new attempt (awaiting confirmation, 1 left)" ($ia2.interviewId -ne $ia.interviewId -and $ia2.status -eq "pending_confirmation" -and $ia2.requestsLeft -eq 1) ($ia2 | ConvertTo-Json -Compress)
$r = Req Post "/api/applicant/interviews/$($ia2.interviewId)/confirm" $tok.A
Step "A confirms the new time -> interview_confirmed" ($r.Status -eq 200 -and $r.Json.data.applicationStatus -eq "interview_confirmed") "got $($r.Status): $($r.Raw)"

$r = Request-Reschedule "A" $ia2.interviewId
Step "A requests again (#2, from confirmed) -> 0 left" ($r.Status -eq 200 -and $r.Json.data.requestsLeft -eq 0) "got $($r.Status): $($r.Raw)"
$r = Approve $ia2.interviewId 4
Step "HR approves -> attempt 3; the application goes back to interview_scheduled (answer 12)" ($r.Status -eq 200 -and $r.Json.data.attemptNumber -eq 3 -and $r.Json.data.applicationStatus -eq "interview_scheduled") "got $($r.Status): $($r.Raw)"
Check "A's status panel shows interview_scheduled again" ((My-Application $tok.A $vr.vacancyId).status -eq "interview_scheduled") ""
$ia3 = My-Interview $tok.A
Check "A has no requests left (requestsLeft = 0)" ($ia3.requestsLeft -eq 0) ($ia3 | ConvertTo-Json -Compress)
$r = Request-Reschedule "A" $ia3.interviewId
Check "A's 3rd request -> 422 'used both'" ($r.Status -eq 422 -and "$($r.Json.error.message)" -match "used both reschedule requests") "got $($r.Status): $($r.Raw)"

# --- B: request -> decline (twice) -> 3rd refused (declines count)
$ib = My-Interview $tok.B
$r = Request-Reschedule "B" $ib.interviewId
Step "B requests a reschedule (#1)" ($r.Status -eq 200 -and $r.Json.data.requestsLeft -eq 1) "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/admin/interviews/$($ib.interviewId)/reschedule/decline" $hrTok
Step "HR declines B's request -> back to awaiting confirmation" ($r.Status -eq 200 -and $r.Json.data.status -eq "pending_confirmation" -and $r.Json.data.applicationStatus -eq "interview_scheduled") "got $($r.Status): $($r.Raw)"
$n = My-Notifications $tok.B "reschedule_declined"
Check "B got 'Reschedule request declined: $($vr.jobTitle)' (stays on, confirm line, no company)" `
  ($n.Count -ge 1 -and "$($n[0].title)" -eq "Reschedule request declined: $($vr.jobTitle)" -and "$($n[0].message)" -match "stays on" -and "$($n[0].message)" -match "Please confirm it" -and "$($n[0].message)" -notmatch "Agency") ($n | ConvertTo-Json -Compress)
$ibAfter = My-Interview $tok.B
Check "B keeps the same interview and time" ($ibAfter.interviewId -eq $ib.interviewId -and $ibAfter.scheduledAt -eq $ib.scheduledAt -and $ibAfter.requestsLeft -eq 1) ($ibAfter | ConvertTo-Json -Compress)
$r = Req Post "/api/admin/interviews/$($ib.interviewId)/reschedule/decline" $hrTok
Check "Decline again with no request waiting -> 409" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"
$r = Request-Reschedule "B" $ib.interviewId
Step "B requests again (#2)" ($r.Status -eq 200 -and $r.Json.data.requestsLeft -eq 0) "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/admin/interviews/$($ib.interviewId)/reschedule/decline" $hrTok
Step "HR declines B's 2nd request" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"
$r = Request-Reschedule "B" $ib.interviewId
Check "B's 3rd request -> 422 (declined requests count)" ($r.Status -eq 422) "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/applicant/interviews/$($ib.interviewId)/confirm" $tok.B
Check "B can still confirm the kept time" ($r.Status -eq 200 -and $r.Json.data.applicationStatus -eq "interview_confirmed") "got $($r.Status): $($r.Raw)"

# ---------------------------------------------------------------- summary
$color = "Green"; if ($script:Fail -gt 0) { $color = "Red" }
Write-Host "`n== $($script:Pass) passed, $($script:Fail) failed ==" -ForegroundColor $color

Write-Host @"

Optional read-only queries for the Supabase SQL Editor:
  select a.application_id, a.status, a.reschedule_requests from application a where a.application_id in ('$($app.A)', '$($app.B)');
  -- expect A interview_scheduled 2, B interview_confirmed 2
  select application_id, attempt_number, status, reschedule_reason is not null as has_reason
    from interview_schedule where application_id in ('$($app.A)', '$($app.B)') order by application_id, attempt_number;
  -- expect A: 1 rescheduled, 2 rescheduled, 3 pending_confirmation; B: 1 confirmed

Clean up afterwards: run supabase/scripts/delete-check-vacancies.sql in the Supabase SQL editor.
"@ -ForegroundColor Yellow
Show-TestHr

if ($script:Fail -gt 0) { exit 1 }
