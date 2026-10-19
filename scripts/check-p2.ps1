# Phase 2 check: decisions 14 (final interview + notice), 15 (For hiring before the hiring decision) and 21 (one
# endorsement packet PDF per applicant), with decision 32 (the final interview is in the Notify message and set at
# Create endorsement). Juan's defense path is rehearsed on throwaways at ZZ vacancies.
# Windows PowerShell 5.1 compatible, ASCII only.
# Usage, from the repo root, with `pnpm dev` running (api + svc) and both Phase 2 migrations applied:
#   powershell -ExecutionPolicy Bypass -File scripts/check-p2.ps1 -HrEmail <hr email> `
#     -ApplicantPEmail <p> -ApplicantQEmail <q> -ResumePath <Juan's demo resume PDF>
# All parameters are required (no default accounts); passwords are prompted and never stored.
#
# Before running:
#   - Apply 20261019000000_final_interview_values.sql and 20261019010000_final_interview.sql and run their
#     verification queries (docs/DATABASE_SCHEMA.md section 7).
#   - Create TWO fresh throwaway applicants (no profile yet): pnpm --filter api seed:applicant -- --email <email>
#   - ResumePath = Juan's demo resume (text PDF; passes the Cashier prescreen).
#
# SAFETY: Store Crew (64428f4d-...) must stay CLOSED while this check runs: Q's not-hired starts the automatic rematch,
# which scans every open vacancy. The script STOPS before changing anything, and before the rematch, if Store Crew is
# open or any vacancy other than this run's ZZ ones is open; it STOPS without answering if the offer is not this run's
# VR. Never touches Cashier, Store Crew, or juan@vera.test. No SQL is run by this script.
#
# What it creates (clean up with supabase/scripts/delete-check-vacancies.sql):
#   Companies "ZZ Check P2 <ts> Company 1 / 2" and published vacancies (Cashier text):
#     VP @1  slots 2, endorsement 2, passing 50, weights 30/30/40 -> P and Q interviewed, endorsed
#     VR @2  slots 1, endorsement 1, passing 50, weights 20/80/0  -> Q's automatic rematch target
#   Notify P, Q with the final interview (now); Create endorsement with now + 1 h -> 409 FINAL_INTERVIEW_CHANGED, then
#     acknowledged -> both final_interview_scheduled with 'Final interview time changed' (no 'scheduled' notice).
#   P: For hiring -> hired (VP 1 of 2).
#   Q (Juan's path): For hiring -> not hired -> rematch offers VR -> accept -> for_endorsement -> endorsement at VR
#     (no Notify for a rematch: 'Final interview scheduled' is the first notice) -> For hiring -> hired -> VR filled.
#     Packet of Q's VR item downloaded.

param(
  [Parameter(Mandatory = $true)] [string]$HrEmail,
  [Parameter(Mandatory = $true)] [string]$ApplicantPEmail,
  [Parameter(Mandatory = $true)] [string]$ApplicantQEmail,
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

# GET a file: status, bytes, Content-Type and Content-Disposition (the endorsement packet).
function Get-File([string]$Path, [string]$Token) {
  $client = New-Object System.Net.Http.HttpClient
  $client.Timeout = [TimeSpan]::FromMinutes(3)
  try {
    $client.DefaultRequestHeaders.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", $Token)
    $resp = $client.GetAsync("$Api$Path").GetAwaiter().GetResult()
    $bytes = $resp.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
    $type = if ($resp.Content.Headers.ContentType) { $resp.Content.Headers.ContentType.MediaType } else { "" }
    $disposition = if ($resp.Content.Headers.ContentDisposition) { $resp.Content.Headers.ContentDisposition.ToString() } else { "" }
    return [pscustomobject]@{ Status = [int]$resp.StatusCode; Bytes = $bytes; Type = $type; Disposition = $disposition }
  } finally { $client.Dispose() }
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

function My-Application([string]$Token, [string]$VacancyId) {
  $r = Req Get "/api/applicant/applications" $Token
  return (@($r.Json.data) | Where-Object { $_.vacancyId -eq $VacancyId } | Select-Object -First 1)
}

function My-Notifications([string]$Token, [string]$Type) {
  $r = Req Get "/api/notifications?limit=50" $Token
  # The leading comma keeps the array: PowerShell 5.1 unrolls a returned one-element array into a bare object, which
  # has no .Count, so "$n.Count -ge 1" would be false even when the notice is there.
  return ,@(@($r.Json.data) | Where-Object { $_.type -eq $Type })
}

function Manila-Iso([datetime]$Utc) {
  return $Utc.AddHours(8).ToString("yyyy-MM-ddTHH:mm:ss", [Globalization.CultureInfo]::InvariantCulture) + "+08:00"
}

function Whole-Seconds([datetime]$Utc) {
  return [datetime]::new($Utc.Ticks - ($Utc.Ticks % [TimeSpan]::TicksPerSecond), [DateTimeKind]::Utc)
}

# Store Crew must be CLOSED; only this run's ZZ vacancies may be open (see SAFETY).
function Assert-OpenVacancies([string[]]$AllowedIds, [string]$When) {
  $r = Req Get "/api/admin/vacancies?status=open&pageSize=100" $hrTok
  if ($r.Status -ne 200) { Stop-Check "List open vacancies -> $($r.Status): $($r.Raw)" }
  $open = @($r.Json.data | Where-Object { $_ })
  if (@($open | Where-Object { $_.vacancyId -eq $StoreCrewId }).Count -gt 0) {
    Stop-Check "$($When): Store Crew must stay CLOSED while this check runs (a not-hired throwaway could be offered it). Close it in Job Vacancies and rerun."
  }
  $others = @($open | Where-Object { $AllowedIds -notcontains $_.vacancyId })
  if ($others.Count -gt 0) {
    $list = ($others | ForEach-Object { "'$($_.jobTitle)' ($($_.vacancyId), $($_.companyName))" }) -join "; "
    Stop-Check "$($When): other open vacancies could be offered to a throwaway: $list. Close them (or run delete-check-vacancies.sql for leftover ZZ Check ones) and rerun with new accounts."
  }
  Check "$($When): Store Crew is closed; open vacancies are only this run's ZZ vacancies ($($open.Count) open)" $true
}

# ---------------------------------------------------------------- setup
Write-Host "`n== Phase 2 check (final interview, For hiring, endorsement packet) ==`n"

$keys = @("P", "Q")
$emailOf = @{ P = $ApplicantPEmail; Q = $ApplicantQEmail }
$emails = @($HrEmail, $ApplicantPEmail, $ApplicantQEmail) | ForEach-Object { $_.Trim().ToLowerInvariant() }
if ($emails -contains "juan@vera.test") { Stop-Check "juan@vera.test is never used by this check. Pass two throwaway applicants." }
if (@($emails | Sort-Object -Unique).Count -ne 3) { Stop-Check "HR and the two applicants must be three different accounts." }

if (-not (Test-Path $EnvFile)) { Stop-Check "Run this from the repo root ($EnvFile not found)." }
if (-not (Test-Path $ResumePath)) { Stop-Check "ResumePath not found: $ResumePath" }
$resumeFile = (Resolve-Path $ResumePath).Path
$envLines    = Get-Content $EnvFile
$supabaseUrl = Get-EnvValue $envLines '^VITE_SUPABASE_URL='
$publishable = Get-EnvValue $envLines '^VITE_SUPABASE_(PUBLISHABLE|ANON)_KEY='
if (-not $supabaseUrl -or $publishable.Length -lt 30) { Stop-Check "Could not read VITE_SUPABASE_URL / publishable key from $EnvFile." }

Write-Host @"

Pre-check: run the Phase 2 migration verification queries (docs/DATABASE_SCHEMA.md section 7) in the Supabase SQL
Editor (read-only). Expect: the enum ends with final_interview_scheduled, for_hiring; is_active_application_status()
gives t, t, f for final_interview_scheduled, for_hiring, hired; both index definitions list the two new values;
endorsement_item has client_interview_at and final_interview_details; Juan is endorsed / pending at Cashier.
Store Crew must be CLOSED (Job Vacancies) before you continue.
"@ -ForegroundColor Yellow
$answer = Read-Host "Type MIGRATED if every verification query matches"
if ($answer -ne "MIGRATED") { Write-Host "Stopped: apply and verify the Phase 2 migrations first." -ForegroundColor Yellow; exit 1 }

$r = Req Get "/api/health" $null
$healthy = $r.Status -eq 200 -and $r.Json.data.db -eq "up"
Check "API health (db up)" $healthy "status $($r.Status): $($r.Raw)"
if (-not $healthy) { Stop-Check "Start pnpm dev first." }

$hrTok = Login $HrEmail
$tok = @{}
foreach ($k in $keys) { $tok[$k] = Login $emailOf[$k] }
$me = (Req Get "/api/me" $hrTok).Json.data
if ($me.role -ne "hr" -and $me.role -ne "admin") { Stop-Check "$HrEmail is not an HR/admin account." }
$hrUserId = $me.userId
foreach ($k in $keys) {
  $m = (Req Get "/api/me" $tok[$k]).Json.data
  if ($m.role -ne "applicant") { Stop-Check "$($emailOf[$k]) is not an applicant account." }
  if ($m.hasProfile) { Stop-Check "$($emailOf[$k]) already has a profile. Use a fresh throwaway (seed:applicant)." }
}

Assert-OpenVacancies @() "Before the check"

$rubric = @((Req Get "/api/admin/competencies" $hrTok).Json.data)
$counts = ($rubric | ForEach-Object { "$($_.sectionCode) $(@($_.items).Count)" }) -join " / "
if ($counts -ne "A 3 / B 9 / C 3") { Stop-Check "Unexpected Competency Profile rubric: $counts" }
# Juan's demo ratings (ALGORITHM.md section 6): 80.00 with 30/30/40, 83.33 with 20/80/0.
$pattern = @{ A = @(5, 4, 4); B = @(5, 5, 5, 4, 4, 4, 4, 4, 4); C = @(4, 4, 4) }
$ratings = @()
foreach ($section in $rubric) {
  $i = 0
  foreach ($item in @($section.items)) { $ratings += @{ competencyId = $item.competencyId; rating = $pattern[$section.sectionCode][$i] }; $i++ }
}

$ts = (Get-Date).ToString("yyyyMMdd-HHmmss")
Write-Host "`nNext steps create 2 companies and 2 published vacancies named 'ZZ Check P2 $ts ...' and change P and Q permanently:" -ForegroundColor Yellow
Write-Host "  P hired at VP after the final interview; Q not hired at VP, rematched to VR, endorsed and hired there (VR filled)." -ForegroundColor Yellow
$answer = Read-Host "Type P2 to continue"
if ($answer -ne "P2") { Write-Host "Stopped before changing anything." -ForegroundColor Yellow; exit 1 }

# ---------------------------------------------------------------- 1. companies, vacancies, profiles
$Text = @{
  jobDescription = "CHECK ONLY. Handles payments at the counter and serves customers in a busy supermarket."
  keyResponsibilities = "Process cash and cashless payments`nIssue receipts and give correct change`nCount and balance the cash drawer at the end of each shift"
  requiredSkills = "Handling cash and giving correct change`nOperating a cash register or POS`nServing and assisting customers`nCounting and balancing the cash drawer"
  experienceRequirement = "Experience as a cashier or sales staff in a retail store, grocery or supermarket, handling payments and serving customers"
}

function New-Company([int]$No) {
  $body = @{
    companyName = "ZZ Check P2 $ts Company $No"; industry = "Check script (delete me)"; description = $null; website = $null
    contactPersonName = "ZZ Check"; contactPersonPosition = $null; contactEmail = "zz-check-p2@example.com"; contactNumber = $null
  }
  $r = Req Post "/api/admin/companies" $hrTok $body
  if ($r.Status -ne 201) { Stop-Check "Create company $No -> $($r.Status): $($r.Raw)" }
  return $r.Json.data
}

function New-Vacancy([string]$Name, $Company, [int]$Slots, [int]$Endorsement, [int[]]$Weights) {
  $body = @{
    companyId = $Company.companyId; jobTitle = "ZZ Check P2 $ts $Name"
    jobDescription = $Text.jobDescription; keyResponsibilities = $Text.keyResponsibilities
    requiredSkills = $Text.requiredSkills; experienceRequirement = $Text.experienceRequirement
    minAge = 18; maxAge = 35; genderRequirement = "any"
    minEducationLevel = "senior_high"; minHeightCm = 249; deploymentLocation = "Check only"; employmentType = "Full-time"  # check-only height: publishing starts pool matching; no real applicant is 249 cm or taller
    slotsNeeded = $Slots; applicationCap = 16; endorsementCount = $Endorsement; matchingThreshold = 40; passingScore = 50
    sectionWeights = @(@{ sectionCode = "A"; weight = $Weights[0] }, @{ sectionCode = "B"; weight = $Weights[1] }, @{ sectionCode = "C"; weight = $Weights[2] })
  }
  $r = Req Post "/api/admin/vacancies" $hrTok $body
  if ($r.Status -ne 201) { Stop-Check "Create vacancy $Name -> $($r.Status): $($r.Raw)" }
  $v = $r.Json.data
  $r = Req Post "/api/admin/vacancies/$($v.vacancyId)/publish" $hrTok @{}
  if ($r.Status -ne 200) { Stop-Check "Publish vacancy $Name -> $($r.Status): $($r.Raw)" }
  Check "Vacancy $Name created and open" $true
  return (Req Get "/api/admin/vacancies/$($v.vacancyId)" $hrTok).Json.data
}

$c1 = New-Company 1; $c2 = New-Company 2
$vp = New-Vacancy "VP" $c1 2 2 @(30, 30, 40)
$vr = New-Vacancy "VR" $c2 1 1 @(20, 80, 0)
Info "VP $($vp.vacancyId) | VR $($vr.vacancyId)"
$zzIds = @($vp.vacancyId, $vr.vacancyId)

foreach ($k in $keys) {
  $r = Upload-Resume $tok[$k] $resumeFile
  if ($r.Status -ne 200) { Stop-Check "Resume upload for $k -> $($r.Status): $($r.Raw)" }
  $p = $r.Json.data.profile
  $p | Add-Member -NotePropertyName heightCm -NotePropertyValue 250 -Force   # throwaway is 250 cm: passes the ZZ 249 cm minimum
  foreach ($field in @("birthdate", "gender", "educationLevel", "heightCm")) {
    if (-not "$($p.$field)".Trim()) { Stop-Check "$field is missing in $k's parsed profile. Use Juan's demo resume." }
  }
  $body = @{
    firstName = "P2 Test"; middleName = $null; lastName = "Applicant $k"; suffix = $null
    contactNumber = "09170000000"; birthdate = $p.birthdate; gender = $p.gender; heightCm = $p.heightCm
    addressLine = "P2 Test Street"; city = "Quezon City"; province = "Metro Manila"; educationLevel = $p.educationLevel
  }
  $r = Req Post "/api/applicant/profile/confirm" $tok[$k] $body
  Step "Profile confirmed for $k -> 201" ($r.Status -eq 201) "got $($r.Status): $($r.Raw)"
}

# ---------------------------------------------------------------- 2. P and Q: apply, verify, interview, evaluate, endorse
$app = @{}
foreach ($k in $keys) {
  $r = Req Post "/api/applicant/applications" $tok[$k] @{ vacancyId = $vp.vacancyId; applicantType = "experienced" }
  Step "$k applies to VP -> 201" ($r.Status -eq 201) "got $($r.Status): $($r.Raw)"
  $app[$k] = $r.Json.data.applicationId
  Step "$k is shortlisted at VP" ((My-Application $tok[$k] $vp.vacancyId).status -eq "shortlisted")
  $s = (Req Get "/api/admin/applications/$($app[$k])" $hrTok).Json.data
  $r = Req Patch "/api/admin/resumes/$($s.resume.resumeId)/verification" $hrTok @{ status = "verified"; applicationId = $app[$k] }
  Step "Verify $k's resume -> 200" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"
  Start-Sleep -Milliseconds 1100
}
$scheduledUtc = Whole-Seconds ([datetime]::UtcNow.AddSeconds(90))
foreach ($k in $keys) {
  $r = Req Post "/api/admin/interviews" $hrTok @{ applicationId = $app[$k]; scheduledAt = (Manila-Iso $scheduledUtc); durationMinutes = 30; meetingLink = "https://meet.google.com/p2-check-link"; interviewerId = $hrUserId }
  Step "Schedule $k's agency interview at now + 90 s -> 201" ($r.Status -eq 201) "got $($r.Status): $($r.Raw)"
  $r = Req Post "/api/applicant/interviews/$($r.Json.data.interviewId)/confirm" $tok[$k]
  Step "$k confirms the interview -> 200" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"
}
# The S14 rule (evaluate only after the agency interview started) applies to these throwaways only; Juan is past it.
$target = $scheduledUtc.AddSeconds(5)
while ([datetime]::UtcNow -lt $target) {
  $left = [int][Math]::Ceiling(($target - [datetime]::UtcNow).TotalSeconds)
  Write-Host -NoNewline ("`rWaiting for the agency interview time to pass: {0,4} s " -f $left)
  Start-Sleep -Seconds 1
}
Write-Host ""
foreach ($k in $keys) {
  $r = Req Post "/api/admin/applications/$($app[$k])/evaluation" $hrTok @{ ratings = $ratings }
  Step "Evaluate $k -> passed (interview 80.00 with 30/30/40)" ($r.Status -eq 201 -and $r.Json.data.status -eq "passed" -and [double]$r.Json.data.interviewScore -eq 80) "got $($r.Status): $($r.Raw)"
}
# Decision 32: the Notify message carries the client's final interview (now: no clock check anywhere).
$now = Manila-Iso (Whole-Seconds ([datetime]::UtcNow))
$later = Manila-Iso (Whole-Seconds ([datetime]::UtcNow.AddHours(1)))
$finalDetails = "Bring two valid IDs."
$r = Req Post "/api/admin/vacancies/$($vp.vacancyId)/notify" $hrTok @{ applicationIds = @($app.P, $app.Q); finalInterviewAt = $now; finalInterviewDetails = $finalDetails }
Step "Notify P, Q at VP with the final interview -> 200" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"
foreach ($k in $keys) {
  $r = Req Post "/api/applicant/applications/$($app[$k])/endorsement/confirm" $tok[$k]
  Step "$k confirms the endorsement -> for_endorsement" ($r.Status -eq 200 -and $r.Json.data.status -eq "for_endorsement") "got $($r.Status): $($r.Raw)"
}
# Decision 32: the client moved the final interview by an hour after the Notify -> HR is warned first (nothing
# written), then acknowledges: both are told "Final interview time changed" in the same transaction.
$both = (@($app.P, $app.Q) | Sort-Object) -join ","
$r = Req Post "/api/admin/endorsements" $hrTok @{ vacancyId = $vp.vacancyId; finalInterviewAt = $later; finalInterviewDetails = $finalDetails }
Check "Create endorsement at VP with another time -> 409 FINAL_INTERVIEW_CHANGED naming P and Q" ($r.Status -eq 409 -and $r.Json.error.code -eq "FINAL_INTERVIEW_CHANGED" -and ((@($r.Json.error.details | ForEach-Object { $_.applicationId }) | Sort-Object) -join ",") -eq $both) "got $($r.Status): $($r.Raw)"
Check "Nothing written: P still for_endorsement" ((My-Application $tok.P $vp.vacancyId).status -eq "for_endorsement") ""
$r = Req Post "/api/admin/endorsements" $hrTok @{ vacancyId = $vp.vacancyId; finalInterviewAt = $later; finalInterviewDetails = $finalDetails; acknowledgeChange = $true }
Step "Create endorsement at VP (acknowledged) -> P, Q endorsed, timeChanged P and Q" ($r.Status -eq 201 -and @($r.Json.data.endorsed).Count -eq 2 -and ((@($r.Json.data.timeChanged) | Sort-Object) -join ",") -eq $both -and @($r.Json.data.firstNotice).Count -eq 0) "got $($r.Status): $($r.Raw)"
foreach ($k in $keys) {
  Check "$k's status panel: final_interview_scheduled right after Create endorsement" ((My-Application $tok[$k] $vp.vacancyId).status -eq "final_interview_scheduled") ""
  # one list per applicant: the positive check (time changed) and the zero check (no 'scheduled') read the same rows
  $all = @(@((Req Get "/api/notifications?limit=50" $tok[$k]).Json.data) | Where-Object { $_ })
  $n = @($all | Where-Object { $_.type -eq "final_interview_rescheduled" })
  Check "$k got 'Final interview time changed: $($vp.jobTitle)' (Philippine time, details, no company, no score)" `
    ($n.Count -eq 1 -and "$($n[0].title)" -eq "Final interview time changed: $($vp.jobTitle)" -and "$($n[0].message)" -match "Philippine time" -and "$($n[0].message)" -match "Bring two valid IDs" -and "$($n[0].title) $($n[0].message)" -notmatch "(?i)ZZ Check P2 $ts Company|score") ($n | ConvertTo-Json -Compress)
  Check "$k got no 'Final interview scheduled' at VP (the time-changed notice replaces it)" ($n.Count -eq 1 -and @($all | Where-Object { $_.type -eq "final_interview_scheduled" }).Count -eq 0) (@($all | ForEach-Object { $_.type }) -join ",")
}

function Item-Of($Vacancy, [string]$ApplicationId) {
  $items = @((Req Get "/api/admin/endorsements/$($Vacancy.vacancyId)" $hrTok).Json.data.endorsements | ForEach-Object { $_.items })
  return ($items | Where-Object { $_.applicationId -eq $ApplicationId } | Select-Object -First 1)
}
$itemP = (Item-Of $vp $app.P).itemId
$itemQ = (Item-Of $vp $app.Q).itemId
Step "VP endorsement items found for P and Q" ($itemP -and $itemQ)

# Decision 32: a rematch application never got a Notify message, so Create endorsement sends the first notice.
function Assert-FirstNotice([string]$Key, $Vacancy) {
  $n = My-Notifications $tok[$Key] "final_interview_scheduled"
  Check "$Key got 'Final interview scheduled: $($Vacancy.jobTitle)' (Philippine time, details, no company, no score)" `
    ($n.Count -ge 1 -and "$($n[0].title)" -eq "Final interview scheduled: $($Vacancy.jobTitle)" -and "$($n[0].message)" -match "Philippine time" -and "$($n[0].message)" -match "Bring two valid IDs" -and "$($n[0].title) $($n[0].message)" -notmatch "(?i)ZZ Check P2 $ts Company|score") ($n | ConvertTo-Json -Compress)
  Check "$Key's status panel: final_interview_scheduled" ((My-Application $tok[$Key] $Vacancy.vacancyId).status -eq "final_interview_scheduled") ""
}
function Mark-ForHiring([string]$Key, [string]$ItemId, $Vacancy) {
  $r = Req Post "/api/admin/endorsement-items/$ItemId/for-hiring" $hrTok @{}
  Step "$Key proceeds right after scheduling (no clock wait) -> for_hiring" ($r.Status -eq 200 -and $r.Json.data.status -eq "for_hiring") "got $($r.Status): $($r.Raw)"
  $n = My-Notifications $tok[$Key] "for_hiring"
  Check "$Key got 'For hiring: $($Vacancy.jobTitle)' without the company" ($n.Count -ge 1 -and "$($n[0].title)" -eq "For hiring: $($Vacancy.jobTitle)" -and "$($n[0].message)" -notmatch "ZZ Check P2 $ts Company") ""
}

# ---------------------------------------------------------------- 3. P: final interview (set at Create) -> For hiring -> hired
$r = Req Patch "/api/admin/endorsement-items/$itemP/outcome" $hrTok @{ outcome = "hired" }
Check "P hired straight from the final interview -> 409 (Proceeds first)" ($r.Status -eq 409 -and "$($r.Json.error.message)" -match "mark it as proceeding first") "got $($r.Status): $($r.Raw)"
Check "P's item carries the acknowledged time" ([math]::Abs((([datetime](Item-Of $vp $app.P).clientInterviewAt) - ([datetime]$later)).TotalSeconds) -lt 1) ""
Mark-ForHiring "P" $itemP $vp
$r = Req Patch "/api/admin/endorsement-items/$itemP/outcome" $hrTok @{ outcome = "hired" }
Step "P hired -> hired, VP not filled (1 of 2)" ($r.Status -eq 200 -and $r.Json.data.status -eq "hired" -and $r.Json.data.vacancyStatus -ne "filled") "got $($r.Status): $($r.Raw)"

# ---------------------------------------------------------------- 4. Q: Juan's path
Mark-ForHiring "Q" $itemQ $vp
$r = Req Post "/api/admin/vacancies/$($vp.vacancyId)/archive" $hrTok @{}
Check "Archive VP while Q is For hiring -> 409" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"

Assert-OpenVacancies $zzIds "Before Q's not hired (automatic rematch)"
$r = Req Patch "/api/admin/endorsement-items/$itemQ/outcome" $hrTok @{ outcome = "not_hired"; remarks = "P2 check" }
Step "Q not hired (from For hiring) -> not_hired" ($r.Status -eq 200 -and $r.Json.data.status -eq "not_hired") "got $($r.Status): $($r.Raw)"
$rematch = $r.Json.data.rematch
if ($null -eq $rematch -or $rematch.status -ne "offered") { Step "Q's rematch offered" $false "got $($rematch | ConvertTo-Json -Compress)" }
if ("$($rematch.jobTitle)" -ne $vr.jobTitle) {
  Stop-Check "Q's rematch offered '$($rematch.jobTitle)' at '$($rematch.companyName)' (offer $($rematch.offerId)), which is NOT this run's VR. Nothing was answered. Report this before doing anything else."
}
Check "Q's rematch offers VR (HR sees the company)" ($rematch.companyName -eq $c2.companyName) ($rematch | ConvertTo-Json -Compress)

$offers = @((Req Get "/api/applicant/offers" $tok.Q).Json.data | Where-Object { $_ })
if ($offers.Count -ne 1 -or $offers[0].jobTitle -ne $vr.jobTitle) {
  Stop-Check "Q should have exactly one pending offer for VR before answering; got $($offers | ConvertTo-Json -Compress). Nothing was answered."
}
$r = Req Post "/api/applicant/offers/$($offers[0].offerId)/accept" $tok.Q @{}
Step "Q accepts VR -> for_endorsement" ($r.Status -eq 200 -and $r.Json.data.applicationStatus -eq "for_endorsement") "got $($r.Status): $($r.Raw)"
$app.QR = $r.Json.data.applicationId
$r = Req Post "/api/admin/endorsements" $hrTok @{ vacancyId = $vr.vacancyId; finalInterviewAt = $now; finalInterviewDetails = $finalDetails }
Step "Create endorsement at VR -> Q endorsed, first notice for Q (accepted rematch: no Notify message)" ($r.Status -eq 201 -and @($r.Json.data.endorsed) -contains $app.QR -and @($r.Json.data.firstNotice) -contains $app.QR -and @($r.Json.data.timeChanged).Count -eq 0) "got $($r.Status): $($r.Raw)"
$itemQR = (Item-Of $vr $app.QR).itemId
Step "VR endorsement item found for Q" ([bool]$itemQR)
Assert-FirstNotice "Q" $vr
Mark-ForHiring "Q" $itemQR $vr
$r = Req Patch "/api/admin/endorsement-items/$itemQR/outcome" $hrTok @{ outcome = "hired" }
Step "Q hired at VR -> VR filled (1 of 1)" ($r.Status -eq 200 -and $r.Json.data.status -eq "hired" -and $r.Json.data.vacancyStatus -eq "filled") "got $($r.Status): $($r.Raw)"

# ---------------------------------------------------------------- 5. packets (decision 21; decision 33: by application)
$f = Get-File "/api/admin/applications/$($app.QR)/packet" $hrTok
$head = if ($f.Bytes.Length -ge 5) { [Text.Encoding]::ASCII.GetString($f.Bytes, 0, 5) } else { "" }
$pdfText = [Text.Encoding]::ASCII.GetString($f.Bytes)
$pages = ([regex]::Matches($pdfText, "/Type\s*/Page[^s]")).Count
Check "HR downloads Q's VR packet: 200, application/pdf, starts with %PDF-" ($f.Status -eq 200 -and $f.Type -eq "application/pdf" -and $head -eq "%PDF-") "got $($f.Status) $($f.Type) '$head'"
Check "Packet file name: <LastName>_<FirstName>_<JobTitle>_Endorsement.pdf" ($f.Disposition -match 'filename="?Applicant-Q_P2-Test_ZZ-Check-P2-[0-9-]+-VR_Endorsement\.pdf') "got '$($f.Disposition)'"
Check "Packet = cover + resume pages (at least 2 pages)" ($pages -ge 2) "got $pages page objects"
$f = Get-File "/api/admin/applications/$($app.P)/packet" $hrTok
Check "HR downloads P's VP packet (hired) -> 200 PDF" ($f.Status -eq 200 -and $f.Type -eq "application/pdf") "got $($f.Status)"
$f = Get-File "/api/admin/applications/$($app.Q)/packet" $hrTok
Check "HR downloads Q's VP packet (not_hired) -> 200 PDF" ($f.Status -eq 200 -and $f.Type -eq "application/pdf") "got $($f.Status)"
$f = Get-File "/api/admin/applications/$($app.QR)/packet" $tok.Q
Check "An applicant token on the packet -> 403" ($f.Status -eq 403) "got $($f.Status)"
$f = Get-File "/api/admin/applications/$([guid]::NewGuid())/packet" $hrTok
Check "An unknown application -> 404" ($f.Status -eq 404) "got $($f.Status)"

# ---------------------------------------------------------------- 6. dashboard tile
$d = (Req Get "/api/admin/dashboard" $hrTok).Json.data
$tile = @($d.tiles) | Where-Object { $_.key -eq "forEndorsement" } | Select-Object -First 1
Check "Dashboard 'For endorsement' counts final_interview_scheduled and for_hiring" (@($tile.statuses) -contains "final_interview_scheduled" -and @($tile.statuses) -contains "for_hiring") ($tile | ConvertTo-Json -Compress)

Assert-OpenVacancies @($vp.vacancyId) "After the check"

# ---------------------------------------------------------------- summary
$color = "Green"; if ($script:Fail -gt 0) { $color = "Red" }
Write-Host "`n== $($script:Pass) passed, $($script:Fail) failed ==" -ForegroundColor $color

Write-Host @"

Optional read-only queries for the Supabase SQL Editor:
  select h.application_id, h.from_status, h.to_status, h.reason, u.role as changed_by_role
    from application_status_history h left join user_account u on u.user_account_id = h.changed_by
   where h.application_id in ('$($app.P)', '$($app.Q)', '$($app.QR)')
     and h.to_status in ('endorsed', 'final_interview_scheduled', 'for_hiring', 'hired', 'not_hired', 'for_endorsement')
   order by h.changed_at, h.history_id;
Expect: P and Q endorsed -> final_interview_scheduled ('Final interview scheduled'; both rows written by Create
endorsement with the same changed_at, endorsed first by history_id) -> for_hiring ('Proceeds after the
final interview'); P -> hired; Q -> not_hired ('Client decision: not hired'); Q's VR application for_endorsement ->
endorsed -> final_interview_scheduled -> for_hiring -> hired; every move by HR.

Clean up afterwards: run supabase/scripts/delete-check-vacancies.sql in the Supabase SQL editor.
Juan (juan@vera.test), Cashier, and Store Crew were not touched.
"@ -ForegroundColor Yellow

if ($script:Fail -gt 0) { exit 1 }
