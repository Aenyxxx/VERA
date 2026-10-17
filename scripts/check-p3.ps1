# Phase 3 check: decisions 17 and 18 (screening failures and drops kept in the applicant pool, automatic pool matching
# when a job is published, job invitations accept / decline / expire, Applicant Pool tabs). Windows PowerShell 5.1
# compatible, ASCII only.
# Usage, from the repo root, with `pnpm dev` running (api + svc) and both Phase 3 migrations applied:
#   powershell -ExecutionPolicy Bypass -File scripts/check-p3.ps1 -HrEmail <hr email> `
#     -ApplicantAEmail <a> -ApplicantBEmail <b> -ApplicantCEmail <c> -ResumePath <Juan's demo resume PDF>
# All parameters are required (no default accounts); passwords are prompted and never stored.
#
# Before running:
#   - Apply 20261020000000_pool_reason_values.sql and 20261020010000_job_invitation.sql and run their verification
#     queries (docs/DATABASE_SCHEMA.md section 7).
#   - Run supabase/scripts/delete-check-vacancies.sql: no 'ZZ Check' vacancy may exist (in any status), so no throwaway
#     from an earlier run is left in the pool to be invited.
#   - Create THREE fresh throwaway applicants (no profile yet): pnpm --filter api seed:applicant -- --email <email>
#   - ResumePath = Juan's demo resume (text PDF).
#
# SAFETY: every ZZ vacancy uses minHeightCm = 249 and the throwaways confirm a height of 250 cm, so prescreen rejects
# every real applicant before svc is called; the script STOPS if anyone other than this run's throwaways is invited.
# No SQL is run by this script.
#
# What it creates (clean up with supabase/scripts/delete-check-vacancies.sql):
#   Company 1: VA (Cashier text, postgraduate required) -> A prescreen_failed; VB (welding / forklift skills, no experience
#     text) -> B below_threshold; VC (Cashier text) -> C shortlisted, then dropped by HR.
#   Company 2: VN (Cashier text) published -> pool matching invites exactly A, B, C. Run again -> nobody new.
#   A accepts (a normal application at VN), B declines (stays in the pool), HR closes VN -> C's invitation expires.

param(
  [Parameter(Mandatory = $true)] [string]$HrEmail,
  [Parameter(Mandatory = $true)] [string]$ApplicantAEmail,
  [Parameter(Mandatory = $true)] [string]$ApplicantBEmail,
  [Parameter(Mandatory = $true)] [string]$ApplicantCEmail,
  [Parameter(Mandatory = $true)] [string]$ResumePath,
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

# The leading comma keeps the array (PowerShell 5.1 unrolls a returned one-element array into a bare object).
function My-Notifications([string]$Token, [string]$Type) {
  $r = Req Get "/api/notifications?limit=50" $Token
  return ,@(@($r.Json.data) | Where-Object { $_.type -eq $Type })
}

function Pool-Tab([string]$Tab) {
  $r = Req Get "/api/admin/pool?tab=$Tab" $hrTok
  if ($r.Status -ne 200) { Stop-Check "GET pool tab $Tab -> $($r.Status): $($r.Raw)" }
  return ,@($r.Json.data | Where-Object { $_ })
}

# Waits until the vacancy's background pool matching is no longer running (2 s polls, up to 3 minutes).
function Wait-PoolMatching($Vacancy) {
  for ($i = 0; $i -lt 90; $i++) {
    $r = Req Get "/api/admin/vacancies/$($Vacancy.vacancyId)/invitations" $hrTok
    if ($r.Status -ne 200) { Stop-Check "GET invitations -> $($r.Status): $($r.Raw)" }
    if (-not $r.Json.data.running -and $null -ne $r.Json.data.summary) { return $r.Json.data }
    Start-Sleep -Seconds 2
  }
  Stop-Check "Pool matching for $($Vacancy.jobTitle) did not finish within 3 minutes (is svc running?)."
}

# ---------------------------------------------------------------- setup
Write-Host "`n== Phase 3 check (applicant pool, pool matching, job invitations, pool tabs) ==`n"

$keys = @("A", "B", "C")
$emailOf = @{ A = $ApplicantAEmail; B = $ApplicantBEmail; C = $ApplicantCEmail }
$emails = @($HrEmail) + @($keys | ForEach-Object { $emailOf[$_] }) | ForEach-Object { $_.Trim().ToLowerInvariant() }
if ($emails -contains "juan@vera.test") { Stop-Check "juan@vera.test is never used by this check. Pass three throwaway applicants." }
if (@($emails | Sort-Object -Unique).Count -ne 4) { Stop-Check "HR and the three applicants must be four different accounts." }

if (-not (Test-Path $EnvFile)) { Stop-Check "Run this from the repo root ($EnvFile not found)." }
if (-not (Test-Path $ResumePath)) { Stop-Check "ResumePath not found: $ResumePath" }
$resumeFile = (Resolve-Path $ResumePath).Path
$envLines    = Get-Content $EnvFile
$supabaseUrl = Get-EnvValue $envLines '^VITE_SUPABASE_URL='
$publishable = Get-EnvValue $envLines '^VITE_SUPABASE_(PUBLISHABLE|ANON)_KEY='
if (-not $supabaseUrl -or $publishable.Length -lt 30) { Stop-Check "Could not read VITE_SUPABASE_URL / publishable key from $EnvFile." }

Write-Host @"

Pre-check: run the Phase 3 migration verification queries (docs/DATABASE_SCHEMA.md section 7) in the Supabase SQL
Editor (read-only). Expect: pool_reason ends with prescreen_failed, below_threshold, dropped; invitation_kind =
rematch_offer, job_invitation; every existing pool_invitation row is a rematch_offer; the one-pending index is
unchanged; job_vacancy has pool_matched_at and pool_match_summary. Then run delete-check-vacancies.sql.
"@ -ForegroundColor Yellow
$answer = Read-Host "Type MIGRATED if every verification query matches and the cleanup ran"
if ($answer -ne "MIGRATED") { Write-Host "Stopped: apply and verify the Phase 3 migrations first." -ForegroundColor Yellow; exit 1 }

$r = Req Get "/api/health" $null
$healthy = $r.Status -eq 200 -and $r.Json.data.db -eq "up"
Check "API health (db up)" $healthy "status $($r.Status): $($r.Raw)"
if (-not $healthy) { Stop-Check "Start pnpm dev first." }

$hrTok = Login $HrEmail
$tok = @{}
foreach ($k in $keys) { $tok[$k] = Login $emailOf[$k] }
$me = (Req Get "/api/me" $hrTok).Json.data
if ($me.role -ne "hr" -and $me.role -ne "admin") { Stop-Check "$HrEmail is not an HR/admin account." }
foreach ($k in $keys) {
  $m = (Req Get "/api/me" $tok[$k]).Json.data
  if ($m.role -ne "applicant") { Stop-Check "$($emailOf[$k]) is not an applicant account." }
  if ($m.hasProfile) { Stop-Check "$($emailOf[$k]) already has a profile. Use a fresh throwaway (seed:applicant)." }
}

$r = Req Get "/api/admin/vacancies?search=ZZ%20Check&pageSize=100" $hrTok
$leftovers = @($r.Json.data | Where-Object { $_ })
if ($r.Status -ne 200 -or $leftovers.Count -gt 0) {
  Stop-Check "Leftover 'ZZ Check' vacancies ($($leftovers.Count)): run supabase/scripts/delete-check-vacancies.sql first (old throwaways would be invited)."
}
Check "No 'ZZ Check' vacancy exists before the run" $true

$ts = (Get-Date).ToString("yyyyMMdd-HHmmss")
Write-Host "`nNext steps create 2 companies and 4 published vacancies named 'ZZ Check P3 $ts ...' and change A, B, C permanently." -ForegroundColor Yellow
$answer = Read-Host "Type P3 to continue"
if ($answer -ne "P3") { Write-Host "Stopped before changing anything." -ForegroundColor Yellow; exit 1 }

# ---------------------------------------------------------------- 1. companies and vacancies
$Cashier = @{
  skills = "Handling cash and giving correct change`nOperating a cash register or POS`nServing and assisting customers`nCounting and balancing the cash drawer"
  experience = "Experience as a cashier or sales staff in a retail store, grocery or supermarket, handling payments and serving customers"
}

function New-Company([int]$No) {
  $body = @{
    companyName = "ZZ Check P3 $ts Agency $No"; industry = "Check script (delete me)"; description = $null; website = $null
    contactPersonName = "ZZ Check"; contactPersonPosition = $null; contactEmail = "zz-check-p3@example.com"; contactNumber = $null
  }
  $r = Req Post "/api/admin/companies" $hrTok $body
  if ($r.Status -ne 201) { Stop-Check "Create company $No -> $($r.Status): $($r.Raw)" }
  return $r.Json.data
}

function New-Vacancy([string]$Name, $Company, [string]$Skills, $Experience, [string]$Education) {
  $body = @{
    companyId = $Company.companyId; jobTitle = "ZZ Check P3 $ts $Name"
    jobDescription = "CHECK ONLY."; keyResponsibilities = "Check only"; requiredSkills = $Skills; experienceRequirement = $Experience
    minAge = 18; maxAge = 35; genderRequirement = "any"
    minEducationLevel = $Education; minHeightCm = 249; deploymentLocation = "Check only"; employmentType = "Full-time"  # check-only height
    slotsNeeded = 1; applicationCap = 8; endorsementCount = 1; matchingThreshold = 40; passingScore = 50
    sectionWeights = @(@{ sectionCode = "A"; weight = 30 }, @{ sectionCode = "B"; weight = 30 }, @{ sectionCode = "C"; weight = 40 })
  }
  $r = Req Post "/api/admin/vacancies" $hrTok $body
  if ($r.Status -ne 201) { Stop-Check "Create vacancy $Name -> $($r.Status): $($r.Raw)" }
  return $r.Json.data
}

function Publish($Vacancy) {
  $r = Req Post "/api/admin/vacancies/$($Vacancy.vacancyId)/publish" $hrTok @{}
  Step "Publish $($Vacancy.jobTitle) -> 200 open, poolMatching started (no svc wait)" ($r.Status -eq 200 -and $r.Json.data.status -eq "open" -and $r.Json.data.poolMatching -eq "started") "got $($r.Status): $($r.Raw)"
  return $r.Json.data
}

$c1 = New-Company 1; $c2 = New-Company 2
$va = Publish (New-Vacancy "VA" $c1 $Cashier.skills $Cashier.experience "postgraduate")
$vb = Publish (New-Vacancy "VB" $c1 "Welding steel structures`nOperating a forklift" $null "senior_high")
$vc = Publish (New-Vacancy "VC" $c1 $Cashier.skills $Cashier.experience "senior_high")
foreach ($v in @($va, $vb, $vc)) { [void](Wait-PoolMatching $v) }   # nobody is in the pool yet: these runs invite nobody

# ---------------------------------------------------------------- 2. profiles (250 cm)
foreach ($k in $keys) {
  $r = Upload-Resume $tok[$k] $resumeFile
  if ($r.Status -ne 200) { Stop-Check "Resume upload for $k -> $($r.Status): $($r.Raw)" }
  $p = $r.Json.data.profile
  foreach ($field in @("birthdate", "gender", "educationLevel")) {
    if (-not "$($p.$field)".Trim()) { Stop-Check "$field is missing in $k's parsed profile. Use Juan's demo resume." }
  }
  if ("$($p.educationLevel)" -eq "postgraduate") { Stop-Check "$k's parsed education is postgraduate: VA would not fail the prescreen. Use Juan's demo resume." }
  $body = @{
    firstName = "P3 Test"; middleName = $null; lastName = "Applicant $k"; suffix = $null
    contactNumber = "09170000000"; birthdate = $p.birthdate; gender = $p.gender; heightCm = 250   # check-only height
    addressLine = "P3 Test Street"; city = "Quezon City"; province = "Metro Manila"; educationLevel = $p.educationLevel
  }
  $r = Req Post "/api/applicant/profile/confirm" $tok[$k] $body
  Step "Profile confirmed for $k (250 cm) -> 201" ($r.Status -eq 201) "got $($r.Status): $($r.Raw)"
}

# ---------------------------------------------------------------- 3. screening failures and a drop enter the pool
function Apply([string]$Key, $Vacancy, [string]$Expect) {
  $r = Req Post "/api/applicant/applications" $tok[$Key] @{ vacancyId = $Vacancy.vacancyId; applicantType = "experienced" }
  Step "$Key applies to $($Vacancy.jobTitle) -> 201" ($r.Status -eq 201) "got $($r.Status): $($r.Raw)"
  Step "$Key is $Expect at $($Vacancy.jobTitle)" ((My-Application $tok[$Key] $Vacancy.vacancyId).status -eq $Expect) ""
  return $r.Json.data.applicationId
}
$app = @{}
$app.A = Apply "A" $va "prescreen_failed"
$app.B = Apply "B" $vb "below_threshold"
$app.C = Apply "C" $vc "shortlisted"
$r = Req Post "/api/admin/applications/$($app.C)/drop" $hrTok @{ reason = "failed_verification" }
Step "HR drops C at VC -> dropped" ($r.Status -eq 200 -and $r.Json.data.status -eq "dropped") "got $($r.Status): $($r.Raw)"

foreach ($pair in @(@("A", $va, "prescreen_failed"), @("B", $vb, "below_threshold"))) {
  $n = My-Notifications $tok[$pair[0]] $pair[2]
  Check "$($pair[0]) got 'Not shortlisted for $($pair[1].jobTitle)' with the pool sentence, no company, no score" `
    ($n.Count -ge 1 -and "$($n[0].title)" -eq "Not shortlisted for $($pair[1].jobTitle)" -and "$($n[0].message)" -match "We keep your profile in our applicant pool and will invite you when a job fits" -and "$($n[0].title) $($n[0].message)" -notmatch "(?i)Agency 1|score") ($n | ConvertTo-Json -Compress)
}
$waiting = Pool-Tab "waiting"
$client = Pool-Tab "client"
$reasonOf = @{ A = "prescreen_failed"; B = "below_threshold"; C = "dropped" }
foreach ($k in $keys) {
  $row = $waiting | Where-Object { $_.sourceApplicationId -eq $app[$k] } | Select-Object -First 1
  Check "Pool tab Waiting lists $k ($($reasonOf[$k]), available)" ($row.poolReason -eq $reasonOf[$k] -and $row.availability -eq "available") ($row | ConvertTo-Json -Compress)
  Check "Pool tab Returned by Client does not list $k" (@($client | Where-Object { $_.sourceApplicationId -eq $app[$k] }).Count -eq 0) ""
}

# ---------------------------------------------------------------- 4. publish VN -> pool matching invites exactly A, B, C
$vn = Publish (New-Vacancy "VN" $c2 $Cashier.skills $Cashier.experience "senior_high")
$run = Wait-PoolMatching $vn
$names = @($run.invitations | ForEach-Object { $_.applicantName } | Sort-Object)
$expected = @("P3 Test Applicant A", "P3 Test Applicant B", "P3 Test Applicant C")
if (($names -join "|") -ne ($expected -join "|")) {
  Stop-Check "VN invited [$($names -join ', ')] but exactly [$($expected -join ', ')] were expected. Report this before doing anything else."
}
Check "VN's pool matching invited exactly A, B, C (summary invited 3, failed 0)" ($run.summary.invited -eq 3 -and $run.summary.failed -eq 0) ($run.summary | ConvertTo-Json -Compress)
foreach ($k in $keys) {
  $n = My-Notifications $tok[$k] "job_invitation"
  Check "$k got 'Job invitation: $($vn.jobTitle)' (deadline, no company, no score)" `
    ($n.Count -ge 1 -and "$($n[0].title)" -eq "Job invitation: $($vn.jobTitle)" -and "$($n[0].message)" -match "Philippine time" -and "$($n[0].title) $($n[0].message)" -notmatch "(?i)Agency 2|score") ($n | ConvertTo-Json -Compress)
  $o = @((Req Get "/api/applicant/offers" $tok[$k]).Json.data | Where-Object { $_ })
  Check "$k sees one pending job invitation (kind, job title, no company)" ($o.Count -eq 1 -and $o[0].kind -eq "job_invitation" -and $o[0].jobTitle -eq $vn.jobTitle -and -not ($o[0].PSObject.Properties.Name -contains "companyName")) ($o | ConvertTo-Json -Compress)
}
$invitedRows = @((Pool-Tab "waiting") | Where-Object { @($app.A, $app.B, $app.C) -contains $_.sourceApplicationId })
Check "A, B, C are 'invited' in the pool with a pending job invitation" (@($invitedRows | Where-Object { $_.availability -eq "invited" -and $_.offerKind -eq "job_invitation" -and $_.offerStatus -eq "pending" }).Count -eq 3) ($invitedRows | ConvertTo-Json -Compress)

$r = Req Post "/api/admin/vacancies/$($vn.vacancyId)/pool-matching" $hrTok @{}
Step "Run pool matching again -> 202 started" ($r.Status -eq 202 -and $r.Json.data.status -eq "started") "got $($r.Status): $($r.Raw)"
$again = Wait-PoolMatching $vn
Check "The second run invites nobody new (A, B, C already have a pending invitation)" ($again.summary.invited -eq 0 -and @($again.invitations).Count -eq 3) ($again.summary | ConvertTo-Json -Compress)

# ---------------------------------------------------------------- 5. accept, decline, expire on close
$offerOf = @{}
foreach ($k in $keys) { $offerOf[$k] = (@((Req Get "/api/applicant/offers" $tok[$k]).Json.data) | Select-Object -First 1).offerId }

$r = Req Post "/api/applicant/offers/$($offerOf.A)/accept" $tok.A @{}
Step "A accepts -> a normal application at VN (waiting_pool or shortlisted)" ($r.Status -eq 200 -and $r.Json.data.status -eq "accepted" -and @("waiting_pool", "shortlisted") -contains $r.Json.data.applicationStatus) "got $($r.Status): $($r.Raw)"
Check "A's accept answer has no company and no score" ("$($r.Raw)" -notmatch "(?i)Agency 2|companyName|matchingScore") "$($r.Raw)"
$appAN = $r.Json.data.applicationId
$d = (Req Get "/api/admin/applications/$appAN" $hrTok).Json.data
Check "HR review sheet of A's VN application: matching stored from the invitation, warnings listed" ($null -ne $d.matching -and [double]$d.matching.matchingScore -ge 40 -and $d.matching.PSObject.Properties.Name -contains "warnings") ($d.matching | ConvertTo-Json -Compress -Depth 4)
Check "A left the pool view (back in the process)" (@((Pool-Tab "waiting") | Where-Object { $_.sourceApplicationId -eq $app.A }).Count -eq 0) ""

$r = Req Post "/api/applicant/offers/$($offerOf.B)/decline" $tok.B @{}
Step "B declines -> declined" ($r.Status -eq 200 -and $r.Json.data.status -eq "declined") "got $($r.Status): $($r.Raw)"
$bRow = (Pool-Tab "waiting") | Where-Object { $_.sourceApplicationId -eq $app.B } | Select-Object -First 1
Check "B stays in the Waiting tab, available again" ($bRow.availability -eq "available" -and $bRow.offerStatus -eq "declined") ($bRow | ConvertTo-Json -Compress)

$r = Req Post "/api/admin/vacancies/$($vn.vacancyId)/close" $hrTok @{}
Step "HR closes VN -> closed" ($r.Status -eq 200 -and $r.Json.data.status -eq "closed") "got $($r.Status): $($r.Raw)"
$list = (Req Get "/api/admin/vacancies/$($vn.vacancyId)/invitations" $hrTok).Json.data
$cInv = @($list.invitations) | Where-Object { $_.applicantName -eq "P3 Test Applicant C" } | Select-Object -First 1
Check "Closing VN expired C's pending invitation in the same step (no answer needed)" ($cInv.status -eq "expired" -and $null -ne $cInv.respondedAt) ($cInv | ConvertTo-Json -Compress)
$n = My-Notifications $tok.C "job_invitation_expired"
Check "C got 'Job no longer available: $($vn.jobTitle)'" ($n.Count -ge 1 -and "$($n[0].title)" -eq "Job no longer available: $($vn.jobTitle)") ($n | ConvertTo-Json -Compress)
$cRow = (Pool-Tab "waiting") | Where-Object { $_.sourceApplicationId -eq $app.C } | Select-Object -First 1
Check "C is available again in the pool (the one-pending slot is free)" ($cRow.availability -eq "available" -and $cRow.offerStatus -eq "expired") ($cRow | ConvertTo-Json -Compress)
$r = Req Post "/api/applicant/offers/$($offerOf.C)/accept" $tok.C @{}
Check "C accepting the expired invitation -> 409 'no longer available'" ($r.Status -eq 409 -and "$($r.Json.error.message)" -match "no longer available") "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/admin/vacancies/$($vn.vacancyId)/pool-matching" $hrTok @{}
Check "Run pool matching again on a closed job -> 409" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"

# ---------------------------------------------------------------- 6. roles
$r = Req Get "/api/admin/vacancies/$($vn.vacancyId)/invitations" $tok.B
Check "Applicant token on /invitations -> 403" ($r.Status -eq 403) "got $($r.Status)"
$r = Req Post "/api/admin/vacancies/$($vn.vacancyId)/pool-matching" $tok.B @{}
Check "Applicant token on /pool-matching -> 403" ($r.Status -eq 403) "got $($r.Status)"
$r = Req Get "/api/admin/pool?tab=waiting" $tok.B
Check "Applicant token on the pool -> 403" ($r.Status -eq 403) "got $($r.Status)"

# ---------------------------------------------------------------- summary
$color = "Green"; if ($script:Fail -gt 0) { $color = "Red" }
Write-Host "`n== $($script:Pass) passed, $($script:Fail) failed ==" -ForegroundColor $color

Write-Host @"

Optional read-only queries for the Supabase SQL Editor:
  select pi.kind, pi.status, pi.matching_score, pi.application_id is not null as has_application
    from pool_invitation pi where pi.job_vacancy_id = '$($vn.vacancyId)' order by pi.invited_at;
  -- expect 3 job_invitation rows: accepted (A, with an application), declined (B), expired (C)
  select tp.pool_reason, tp.availability, tp.removed_at is not null as closed from talent_pool tp
   where tp.source_application_id in ('$($app.A)', '$($app.B)', '$($app.C)') order by tp.added_at;
  -- expect prescreen_failed (closed: A reapplied), below_threshold (available), dropped (available)
  select application_source, status from application where application_id = '$appAN';
  -- expect talent_pool, waiting_pool or shortlisted

Clean up afterwards: run supabase/scripts/delete-check-vacancies.sql in the Supabase SQL editor.
"@ -ForegroundColor Yellow

if ($script:Fail -gt 0) { exit 1 }
