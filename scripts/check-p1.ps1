# Phase 1 check: decisions 11 (no minimum years), 12 (whole-resume fallback, via the stored warnings), 5 (1-year
# company block). Windows PowerShell 5.1 compatible, ASCII only.
# Usage, from the repo root, with `pnpm dev` running (api + svc):
#   powershell -ExecutionPolicy Bypass -File scripts/check-p1.ps1 -HrEmail <hr email> -ApplicantEmail <throwaway> `
#     -ResumePath <Juan's demo resume PDF>
# Passwords are prompted and never stored. No migration is needed for Phase 1.
#
# Before running:
#   - Create ONE fresh throwaway applicant (no profile yet): pnpm --filter api seed:applicant -- --email <email>
#   - ResumePath = Juan's demo resume (text PDF; passes the Cashier prescreen).
#
# SAFETY: only Store Crew (64428f4d-...) and this run's ZZ vacancies may be open; anything else stops the script before
# it changes anything. Never touches Cashier, Store Crew, or juan@vera.test. No SQL is run by this script.
#
# What it creates (permanent; clean up with supabase/scripts/delete-check-vacancies.sql):
#   Companies "ZZ Check P1 <ts> Company 1 / 2" and published vacancies (Cashier skills):
#     VA @1  NO experience text   -> Experienced applicant matched on skills only (weights 1 / 0, decision 11)
#     VB @1  with experience text -> hidden and 404 after the throwaway is dropped at VA (company block, decision 5)
#     VC @2  with experience text -> Experienced applicant matched 0.5 / 0.5 with experience matches
# The 1-year expiry itself is covered by apps/api/tests/eligibility.test.js (the shared SQL rule); a read-only audit
# query is printed at the end.

param(
  [Parameter(Mandatory = $true)] [string]$HrEmail,
  [Parameter(Mandatory = $true)] [string]$ApplicantEmail,
  [Parameter(Mandatory = $true)] [string]$ResumePath,
  [string]$Api = "http://127.0.0.1:5000",
  [string]$EnvFile = "apps/web/.env"
)

$ErrorActionPreference = "Stop"
$script:Pass = 0
$script:Fail = 0
Add-Type -AssemblyName System.Net.Http

$StoreCrewId = "64428f4d-fcf7-4c10-93fd-adc8a3ba1dd4"

function Check([string]$Name, [bool]$Ok, [string]$Detail = "") {
  if ($Ok) { $script:Pass++; Write-Host "PASS  $Name" -ForegroundColor Green }
  else     { $script:Fail++; Write-Host "FAIL  $Name  $Detail" -ForegroundColor Red }
}

function Info([string]$Text) { Write-Host "INFO  $Text" -ForegroundColor Cyan }
function Stop-Check([string]$Text) { Write-Host "STOP  $Text" -ForegroundColor Red; exit 1 }

# A state-changing step: on failure print the counts and STOP (nothing after it runs).
function Step([string]$Name, [bool]$Ok, [string]$Detail = "") {
  Check $Name $Ok $Detail
  if (-not $Ok) {
    Write-Host "`n== $($script:Pass) passed, $($script:Fail) failed ==" -ForegroundColor Red
    Stop-Check "A state change failed: '$Name'. Nothing after it was run. Check the API log, fix, and rerun with a new account."
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

function My-Application([string]$VacancyId) {
  $r = Req Get "/api/applicant/applications" $appTok
  return (@($r.Json.data) | Where-Object { $_.vacancyId -eq $VacancyId } | Select-Object -First 1)
}

# Open vacancies right now: only Store Crew and this run's ZZ vacancies may be open.
function Assert-OpenVacancies([string[]]$AllowedIds, [string]$When) {
  $r = Req Get "/api/admin/vacancies?status=open&pageSize=100" $hrTok
  if ($r.Status -ne 200) { Stop-Check "List open vacancies -> $($r.Status): $($r.Raw)" }
  $open = @($r.Json.data | Where-Object { $_ })
  $others = @($open | Where-Object { $AllowedIds -notcontains $_.vacancyId })
  if ($others.Count -gt 0) {
    $list = ($others | ForEach-Object { "'$($_.jobTitle)' ($($_.vacancyId), $($_.companyName))" }) -join "; "
    Stop-Check "$($When): other open vacancies: $list. Close them (or run delete-check-vacancies.sql for leftover ZZ Check ones) and rerun."
  }
  Check "$($When): open vacancies are only Store Crew and this run's ZZ vacancies ($($open.Count) open)" $true
}

# ---------------------------------------------------------------- setup
Write-Host "`n== Phase 1 check (decisions 11, 12, 5) ==`n"

$emails = @($HrEmail, $ApplicantEmail) | ForEach-Object { $_.Trim().ToLowerInvariant() }
if ($emails -contains "juan@vera.test") { Stop-Check "juan@vera.test is never used by this check. Pass a throwaway applicant." }
if ($emails[0] -eq $emails[1]) { Stop-Check "HR and the applicant must be different accounts." }

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
$appTok = Login $ApplicantEmail
$me = (Req Get "/api/me" $hrTok).Json.data
if ($me.role -ne "hr" -and $me.role -ne "admin") { Stop-Check "$HrEmail is not an HR/admin account." }
$m = (Req Get "/api/me" $appTok).Json.data
if ($m.role -ne "applicant") { Stop-Check "$ApplicantEmail is not an applicant account." }
if ($m.hasProfile) { Stop-Check "$ApplicantEmail already has a profile. Use a fresh throwaway (seed:applicant)." }

Assert-OpenVacancies @($StoreCrewId) "Before the check"

$ts = (Get-Date).ToString("yyyyMMdd-HHmmss")
Write-Host "`nNext steps create 2 companies and 3 published vacancies named 'ZZ Check P1 $ts ...' and change $ApplicantEmail permanently (applied at VA, dropped, applied at VC)." -ForegroundColor Yellow
$answer = Read-Host "Type P1 to continue"
if ($answer -ne "P1") { Write-Host "Stopped before changing anything." -ForegroundColor Yellow; exit 1 }

# ---------------------------------------------------------------- 1. companies and vacancies
$Text = @{
  jobDescription = "CHECK ONLY. Handles payments at the counter and serves customers in a busy supermarket."
  keyResponsibilities = "Process cash and cashless payments`nIssue receipts and give correct change`nCount and balance the cash drawer at the end of each shift"
  requiredSkills = "Handling cash and giving correct change`nOperating a cash register or POS`nServing and assisting customers`nCounting and balancing the cash drawer"
  experienceRequirement = "Experience as a cashier or sales staff in a retail store, grocery or supermarket, handling payments and serving customers"
}

function New-Company([int]$No) {
  $body = @{
    companyName = "ZZ Check P1 $ts Company $No"; industry = "Check script (delete me)"; description = $null; website = $null
    contactPersonName = "ZZ Check"; contactPersonPosition = $null; contactEmail = "zz-check-p1@example.com"; contactNumber = $null
  }
  $r = Req Post "/api/admin/companies" $hrTok $body
  if ($r.Status -ne 201) { Stop-Check "Create company $No -> $($r.Status): $($r.Raw)" }
  return $r.Json.data
}

function New-Vacancy([string]$Name, $Company, $Experience) {
  $body = @{
    companyId = $Company.companyId; jobTitle = "ZZ Check P1 $ts $Name"
    jobDescription = $Text.jobDescription; keyResponsibilities = $Text.keyResponsibilities
    requiredSkills = $Text.requiredSkills; experienceRequirement = $Experience
    minYearsExperience = 3   # an old client's field: must be ignored (decision 11)
    minAge = 18; maxAge = 35; genderRequirement = "any"
    minEducationLevel = "senior_high"; minHeightCm = 150; deploymentLocation = "Check only"; employmentType = "Full-time"
    slotsNeeded = 1; applicationCap = 8; endorsementCount = 1; matchingThreshold = 40; passingScore = 50
    sectionWeights = @(@{ sectionCode = "A"; weight = 30 }, @{ sectionCode = "B"; weight = 30 }, @{ sectionCode = "C"; weight = 40 })
  }
  $r = Req Post "/api/admin/vacancies" $hrTok $body
  if ($r.Status -ne 201) { Stop-Check "Create vacancy $Name -> $($r.Status): $($r.Raw)" }
  $v = $r.Json.data
  $r = Req Post "/api/admin/vacancies/$($v.vacancyId)/publish" $hrTok @{}
  if ($r.Status -ne 200) { Stop-Check "Publish vacancy $Name -> $($r.Status): $($r.Raw)" }
  $detail = (Req Get "/api/admin/vacancies/$($v.vacancyId)" $hrTok).Json.data
  Check "Vacancy $Name created and open; HR detail has no minYearsExperience (decision 11)" ($detail.status -eq "open" -and -not ($detail.PSObject.Properties.Name -contains "minYearsExperience")) "keys: $($detail.PSObject.Properties.Name -join ',')"
  return $detail
}

$c1 = New-Company 1; $c2 = New-Company 2
$va = New-Vacancy "VA" $c1 $null
$vb = New-Vacancy "VB" $c1 $Text.experienceRequirement
$vc = New-Vacancy "VC" $c2 $Text.experienceRequirement
Info "VA $($va.vacancyId) | VB $($vb.vacancyId) | VC $($vc.vacancyId)"
Assert-OpenVacancies @($StoreCrewId, $va.vacancyId, $vb.vacancyId, $vc.vacancyId) "After creating the ZZ vacancies"

# ---------------------------------------------------------------- 2. profile
$r = Upload-Resume $appTok $resumeFile
if ($r.Status -ne 200) { Stop-Check "Resume upload -> $($r.Status): $($r.Raw)" }
$p = $r.Json.data.profile
foreach ($field in @("birthdate", "gender", "educationLevel", "heightCm")) {
  if (-not "$($p.$field)".Trim()) { Stop-Check "$field is missing in the parsed profile. Use Juan's demo resume." }
}
$body = @{
  firstName = "P1 Test"; middleName = $null; lastName = "Applicant"; suffix = $null
  contactNumber = "09170000000"; birthdate = $p.birthdate; gender = $p.gender; heightCm = $p.heightCm
  addressLine = "P1 Test Street"; city = "Quezon City"; province = "Metro Manila"; educationLevel = $p.educationLevel
}
$r = Req Post "/api/applicant/profile/confirm" $appTok $body
Step "Profile confirmed -> 201" ($r.Status -eq 201) "got $($r.Status): $($r.Raw)"

# ---------------------------------------------------------------- 3. decision 11: weights follow the experience text only
$r = Req Get "/api/applicant/vacancies/$($vc.vacancyId)" $appTok
Check "Applicant job detail has no minYearsExperience (decision 11)" ($r.Status -eq 200 -and -not ($r.Json.data.PSObject.Properties.Name -contains "minYearsExperience")) "got $($r.Status): $($r.Raw)"

function Apply($Vacancy) {
  $r = Req Post "/api/applicant/applications" $appTok @{ vacancyId = $Vacancy.vacancyId; applicantType = "experienced" }
  Step "Applicant applies to $($Vacancy.jobTitle) as Experienced -> 201" ($r.Status -eq 201) "got $($r.Status): $($r.Raw)"
  $row = My-Application $Vacancy.vacancyId
  Step "Application at $($Vacancy.jobTitle) is shortlisted" ($row.status -eq "shortlisted") "got $($row.status)"
  return $r.Json.data.applicationId
}

$appA = Apply $va
$sA = (Req Get "/api/admin/applications/$appA" $hrTok).Json.data
Check "VA (no experience text): weights skills 1 / experience 0, even with minYearsExperience 3 sent (decision 11)" ([double]$sA.matching.weights.skills -eq 1 -and [double]$sA.matching.weights.experience -eq 0) "weights $($sA.matching.weights | ConvertTo-Json -Compress)"
# Decision 12 (whole-resume fallback) is not visible through the API (warnings are stored, not returned); it is
# covered by apps/svc/tests/test_matcher_math.py and the read-only warnings query printed at the end.

# ---------------------------------------------------------------- 4. decision 5: dropped at company 1 blocks company 1 (inside the year)
$r = Req Post "/api/admin/applications/$appA/drop" $hrTok @{ reason = "failed_verification" }
Step "HR drops the application at VA -> 200" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"
Step "Application at VA is dropped (failed outcome)" ((My-Application $va.vacancyId).status -eq "dropped")

$r = Req Get "/api/applicant/vacancies?search=$([uri]::EscapeDataString("ZZ Check P1 $ts"))&pageSize=100" $appTok
$listed = @($r.Json.data | ForEach-Object { $_.vacancyId })
Check "Job list shows VC (other company)" ($r.Status -eq 200 -and $listed -contains $vc.vacancyId) "listed: $($listed -join ',')"
Check "Job list hides VA and VB (company 1, failed within 1 year)" (-not ($listed -contains $va.vacancyId) -and -not ($listed -contains $vb.vacancyId)) "listed: $($listed -join ',')"
$r = Req Get "/api/applicant/vacancies/$($vb.vacancyId)" $appTok
Check "VB detail answers like a closed job (404)" ($r.Status -eq 404) "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/applicant/applications" $appTok @{ vacancyId = $vb.vacancyId; applicantType = "experienced" }
Check "Apply to VB -> 404 'not available for your application'" ($r.Status -eq 404 -and "$($r.Json.error.message)" -match "not available for your application") "got $($r.Status): $($r.Raw)"

# ---------------------------------------------------------------- 5. decision 11: experience text -> 0.5 / 0.5
$appC = Apply $vc
$sC = (Req Get "/api/admin/applications/$appC" $hrTok).Json.data
Check "VC (experience text): weights 0.5 / 0.5" ([double]$sC.matching.weights.skills -eq 0.5 -and [double]$sC.matching.weights.experience -eq 0.5) "weights $($sC.matching.weights | ConvertTo-Json -Compress)"
$expMatches = @($sC.matching.experienceMatches | Where-Object { $_ })
Check "VC: experience matches are stored, and no years fields in them" ($expMatches.Count -gt 0 -and -not (($sC.matching | ConvertTo-Json -Depth 8) -match "years_needed|years_score")) "count $($expMatches.Count)"
Info "VC matching $($sC.matching.matchingScore) (skills $($sC.matching.skillsScore), experience $($sC.matching.experienceScore))"

Assert-OpenVacancies @($StoreCrewId, $va.vacancyId, $vb.vacancyId, $vc.vacancyId) "After the check"

Write-Host @"

Read-only queries for the Supabase SQL Editor (optional):
  -- failed applications that no longer block their company (older than 1 year; expected 0 in dev)
  select count(*) from public.application
   where status in ('did_not_pass', 'not_hired', 'training_failed', 'dropped')
     and status_changed_at <= now() - interval '1 year';
  -- Juan's current resume warnings (no 'section found' warning -> decision 12 does not touch his Store Crew 71.15)
  select x.warnings from public.resume r join public.resume_extraction x using (resume_id)
    join public.applicant p using (applicant_id) join public.user_account u using (user_account_id)
   where u.email = 'juan@vera.test' and r.is_current;

Clean up with supabase/scripts/delete-check-vacancies.sql.
"@ -ForegroundColor Yellow

$color = if ($script:Fail -eq 0) { "Green" } else { "Red" }
Write-Host "`n== $($script:Pass) passed, $($script:Fail) failed ==" -ForegroundColor $color
if ($script:Fail -gt 0) { exit 1 }
