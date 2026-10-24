# S16 Endorsement and client outcomes backend check (Windows PowerShell 5.1 compatible, ASCII only)
# Usage, from the repo root, with `pnpm dev` running (api + svc):
#   powershell -ExecutionPolicy Bypass -File scripts/check-s16.ps1 -HrEmail <hr email> `
#     -ApplicantAEmail <a> -ApplicantBEmail <b> -ApplicantCEmail <c> -ApplicantDEmail <d> `
#     -ApplicantEEmail <e> -ApplicantFEmail <f> -ApplicantGEmail <g> -ResumePath <text PDF>
# All parameters are required (no default accounts); passwords are prompted and never stored.
#
# Before running:
#   - Run the printed pg_enum pre-check in the Supabase SQL Editor (the script never reads the database).
#   - Create SEVEN fresh throwaway applicants (no profile yet): pnpm --filter api seed:applicant -- --email <email>
#   - ResumePath is a text-based English PDF whose parsed profile passes the Cashier prescreen and clears a matching
#     threshold of 40 (the demo resume does).
#
# What it creates (never Cashier, Store Crew, or juan@vera.test):
#   - Companies "ZZ Check S16 <ts> Company 1 / 2" and published vacancies:
#       VE @Company 1  Cashier copy, slots 2, endorsement 5, passing 50 -> the endorsement and outcomes
#       VY @Company 1  Store Crew copy, open                            -> company block check (training_failed)
#       VX @Company 2  Store Crew copy, open                            -> "free to apply" checks
#   - VE: A, B, C, G Experienced and D, E First-time interviewed and passed; F (5th Experienced) waits.
#     Notify A, B, C, G, E -> all for_endorsement at once (decision 37B: no confirmation); HR removes E from the
#     endorsement (archived, neutral); D is never notified.
#   - Decision 32: the Notify message carries the client's final interview (a past time: no clock check). Create
#     endorsement takes the same schedule: a different one -> 409 FINAL_INTERVIEW_CHANGED, nothing written; the same
#     one -> A, B, C, G endorsed -> final_interview_scheduled with NO second schedule notice, D standby (system), E stays
#     archived.
#   - Reopen + close + archive -> refused while with the client.
#   - Decision 37C stages (final interview -> For training -> For requirements -> For orientation -> Deployed = hired):
#     B deployed straight from the final interview -> 409, a skipped stage -> 409, Training failed before For training
#     -> 409; B Change time -> 'Final interview time changed' -> every stage (one notice each) -> Deployed (1 of 2).
#     A For training -> Training failed (pool, company block, free elsewhere, no rematch). G For training and stays.
#     C every stage -> Deployed -> VE FILLED and closed out: G (For training, pending) standby, F not_selected,
#     E untouched (archived). Not hired is checked by check-s17 (from endorsed) and check-p2 (at a stage).
# SAFETY: Store Crew (64428f4d-...) must stay CLOSED while this check runs (a guard kept from S16: nothing here starts
# the automatic rematch any more). The script STOPS before changing anything if Store Crew is open.
# The script STOPS at the first failed state change. No SQL is run by this script.
# Clean up afterwards with supabase/scripts/delete-check-vacancies.sql.

param(
  [Parameter(Mandatory = $true)] [string]$HrEmail,
  [Parameter(Mandatory = $true)] [string]$ApplicantAEmail,
  [Parameter(Mandatory = $true)] [string]$ApplicantBEmail,
  [Parameter(Mandatory = $true)] [string]$ApplicantCEmail,
  [Parameter(Mandatory = $true)] [string]$ApplicantDEmail,
  [Parameter(Mandatory = $true)] [string]$ApplicantEEmail,
  [Parameter(Mandatory = $true)] [string]$ApplicantFEmail,
  [Parameter(Mandatory = $true)] [string]$ApplicantGEmail,
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
  $p = @{ Method = $Method; Uri = "$Api$Path"; Headers = $headers; ContentType = "application/json"; UseBasicParsing = $true }
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

function Get-Keys($o) {
  if ($null -eq $o) { return }
  if ($o -is [string]) { return }
  if ($o -is [System.Collections.IEnumerable]) { foreach ($i in $o) { Get-Keys $i }; return }
  if ($o -is [pscustomobject]) {
    foreach ($prop in $o.PSObject.Properties) { $prop.Name; Get-Keys $prop.Value }
  }
}

# Applicant responses must never carry company fields, scores, or the internal status reason (rule 4).
$LeakPattern = '(?i)score|similarity|weights|rating|company|status_?reason|^age$|gender|birth'

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

function My-Application([string]$Token, [string]$VacancyId) {
  $r = Req Get "/api/applicant/applications" $Token
  return [pscustomobject]@{ Response = $r; Row = (@($r.Json.data) | Where-Object { $_.vacancyId -eq $VacancyId } | Select-Object -First 1) }
}

function My-Notifications([string]$Token, [string]$Type) {
  $r = Req Get "/api/notifications?limit=50" $Token
  return [pscustomobject]@{ Response = $r; Rows = @(@($r.Json.data) | Where-Object { $_.type -eq $Type }) }
}

function Manila-Iso([datetime]$Utc) {
  return $Utc.AddHours(8).ToString("yyyy-MM-ddTHH:mm:ss", [Globalization.CultureInfo]::InvariantCulture) + "+08:00"
}

function Whole-Seconds([datetime]$Utc) {
  return [datetime]::new($Utc.Ticks - ($Utc.Ticks % [TimeSpan]::TicksPerSecond), [DateTimeKind]::Utc)
}

$EducationLevels = @("elementary", "junior_high", "senior_high", "vocational", "college_undergraduate", "college_graduate", "postgraduate")

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

$TestValues = [ordered]@{
  addressLine = "S16 Test Street"; city = "Quezon City"; province = "Metro Manila"; contactNumber = "09170000000"
}
function Fill-Profile($p) {
  $values = @{}
  foreach ($field in $TestValues.Keys) {
    if ("$($p.$field)".Trim()) { $values[$field] = $p.$field } else { $values[$field] = $TestValues[$field] }
  }
  return $values
}

# ---------------------------------------------------------------- setup
Write-Host "`n== S16 Endorsement and client outcomes check ==`n"

$keys = @("A", "B", "C", "D", "E", "F", "G")
$emailOf = @{ A = $ApplicantAEmail; B = $ApplicantBEmail; C = $ApplicantCEmail; D = $ApplicantDEmail; E = $ApplicantEEmail; F = $ApplicantFEmail; G = $ApplicantGEmail }
$emails = @($HrEmail) + @($keys | ForEach-Object { $emailOf[$_] }) | ForEach-Object { $_.Trim().ToLowerInvariant() }
if ($emails -contains "juan@vera.test") { Stop-Check "juan@vera.test is never used by this check. Pass seven throwaway applicants." }
if (@($emails | Sort-Object -Unique).Count -ne 8) { Stop-Check "HR and the seven applicants must be eight different accounts." }

if (-not (Test-Path $EnvFile)) { Stop-Check "Run this from the repo root ($EnvFile not found)." }
if (-not (Test-Path $ResumePath)) { Stop-Check "ResumePath not found: $ResumePath" }
$resumeFile = (Resolve-Path $ResumePath).Path
$envLines    = Get-Content $EnvFile
$supabaseUrl = Get-EnvValue $envLines '^VITE_SUPABASE_URL='
$publishable = Get-EnvValue $envLines '^VITE_SUPABASE_(PUBLISHABLE|ANON)_KEY='
if (-not $supabaseUrl -or $publishable.Length -lt 30) { Stop-Check "Could not read VITE_SUPABASE_URL / publishable key from $EnvFile." }

# Enum pre-check (manual: this script never reads the database).
Write-Host @"

Pre-check: run this in the Supabase SQL Editor (read-only):

  select t.typname, v.value, exists (
           select 1 from pg_enum e where e.enumtypid = t.oid and e.enumlabel = v.value) as present
  from (values ('application_status', 'endorsed'), ('application_status', 'hired'),
               ('application_status', 'final_interview_scheduled'), ('application_status', 'for_hiring'),
               ('application_status', 'for_training'), ('application_status', 'for_requirements'),
               ('application_status', 'for_orientation'),
               ('application_status', 'not_hired'), ('application_status', 'training_failed'),
               ('application_status', 'standby'), ('application_status', 'not_selected'),
               ('vacancy_status', 'endorsing'), ('vacancy_status', 'filled'),
               ('endorsement_status', 'sent'), ('endorsement_outcome', 'pending'),
               ('endorsement_outcome', 'hired'), ('endorsement_outcome', 'not_hired'),
               ('pool_reason', 'standby'), ('pool_reason', 'not_hired'), ('pool_reason', 'training_failed'),
               ('pool_reason', 'not_selected')) as v (typname, value)
  join pg_type t on t.typname = v.typname and t.typnamespace = 'public'::regnamespace
  order by t.typname, v.value;

Expect 21 rows, every one with present = true (Phase 2 migrations 20261019000000 and 20261019010000 and the
decision 37C migrations 20261024000000 and 20261024010000 applied).
If any is false, stop and report it before running anything.
"@ -ForegroundColor Yellow
$answer = Read-Host "Type VALUES if all 21 rows are present = true"
if ($answer -ne "VALUES") { Write-Host "Stopped: the enum values are not all on the database." -ForegroundColor Yellow; exit 1 }

$r = Req Get "/api/health" $null
$healthy = $r.Status -eq 200 -and $r.Json.data.db -eq "up"
Check "API health (db up)" $healthy "status $($r.Status): $($r.Raw)"
if (-not $healthy) { Stop-Check "Start pnpm dev first." }

$hrTok = Login $HrEmail
$tok = @{}
foreach ($k in $keys) { $tok[$k] = Login $emailOf[$k] }
$missingTokens = @($keys | Where-Object { [string]::IsNullOrEmpty($tok[$_]) }).Count
Check "Supabase logins (HR + A..G)" (-not [string]::IsNullOrEmpty($hrTok) -and $missingTokens -eq 0) "missing tokens: $missingTokens"

$me = (Req Get "/api/me" $hrTok).Json.data
if ($me.role -ne "hr" -and $me.role -ne "admin") { Stop-Check "$HrEmail is not an HR/admin account." }
$hrUserId = $me.userId

# Store Crew must stay CLOSED (see SAFETY): checked before anything changes.
$StoreCrewId = "64428f4d-fcf7-4c10-93fd-adc8a3ba1dd4"
function Assert-StoreCrewClosed([string]$When) {
  $r = Req Get "/api/admin/vacancies/$StoreCrewId" $hrTok
  if ($r.Status -eq 200 -and $r.Json.data.status -eq "open") {
    Stop-Check "$($When): Store Crew must stay CLOSED while this check runs (a not-hired throwaway could be offered it). Close it in Job Vacancies and rerun."
  }
  $state = if ($r.Status -eq 200) { $r.Json.data.status } else { "status $($r.Status)" }
  Check "$($When): Store Crew is not open ($state)" $true
}
Assert-StoreCrewClosed "Before the check"

foreach ($k in $keys) {
  $m = (Req Get "/api/me" $tok[$k]).Json.data
  if ($m.role -ne "applicant") { Stop-Check "$($emailOf[$k]) is not an applicant account." }
  if ($m.hasProfile) { Stop-Check "$($emailOf[$k]) already has a profile. Use a fresh throwaway (seed:applicant)." }
  if (@((Req Get "/api/applicant/applications" $tok[$k]).Json.data | Where-Object { $_ }).Count -ne 0) { Stop-Check "$($emailOf[$k]) already has applications." }
}

$rubric = @((Req Get "/api/admin/competencies" $hrTok).Json.data)
$counts = ($rubric | ForEach-Object { "$($_.sectionCode) $(@($_.items).Count)" }) -join " / "
if ($counts -ne "A 3 / B 9 / C 3") { Stop-Check "Unexpected Competency Profile rubric: $counts" }
$ratings = @()
foreach ($section in $rubric) { foreach ($item in @($section.items)) { $ratings += @{ competencyId = $item.competencyId; rating = 4 } } }

$ts = (Get-Date).ToString("yyyyMMdd-HHmmss")
Write-Host "`nNext steps create 2 companies and 3 published vacancies named 'ZZ Check S16 $ts ...' and change A..G permanently:" -ForegroundColor Yellow
Write-Host "  A training failed (company block), B deployed, C deployed (fills VE), D/G standby, E archived, F not selected." -ForegroundColor Yellow
$answer = Read-Host "Type S16 to continue"
if ($answer -ne "S16") { Write-Host "Stopped before changing anything." -ForegroundColor Yellow; exit 1 }

# ---------------------------------------------------------------- 1. companies and vacancies (admin API)
$CashierText = @{
  jobDescription = "CHECK ONLY. Handles payments at the counter and serves customers in a busy supermarket."
  keyResponsibilities = "Process cash and cashless payments`nIssue receipts and give correct change`nCount and balance the cash drawer at the end of each shift`nAssist customers at the counter"
  requiredSkills = "Handling cash and giving correct change`nOperating a cash register or POS`nServing and assisting customers`nCounting and balancing the cash drawer"
  experienceRequirement = "Experience as a cashier or sales staff in a retail store, grocery or supermarket, handling payments and serving customers"
}
$StoreCrewText = @{
  jobDescription = "CHECK ONLY. Keeps the store stocked, clean and organized, and helps customers during busy hours."
  keyResponsibilities = "Stock and arrange items on shelves`nKeep the store and dining area clean`nAssist customers in finding items`nHelp with food preparation when needed"
  requiredSkills = "Stocking and arranging items on shelves`nKeeping the store clean and organized`nAssisting customers in finding items`nWorking under pressure during busy hours"
  experienceRequirement = "Experience as store crew, stock clerk or helper in a retail store, grocery or fast-food restaurant"
}

function New-Company([int]$No) {
  $body = @{
    companyName = "ZZ Check S16 $ts Company $No"; industry = "Check script (delete me)"; description = $null; website = $null
    contactPersonName = "ZZ Check"; contactPersonPosition = $null; contactEmail = "zz-check-s16@example.com"; contactNumber = $null
  }
  $r = Req Post "/api/admin/companies" $hrTok $body
  if ($r.Status -ne 201) { Stop-Check "Create company $No -> $($r.Status): $($r.Raw)" }
  return $r.Json.data
}

function New-Vacancy([string]$Name, $Company, $Text, [int]$Slots, [int]$Endorsement, [int]$Cap) {
  $body = @{
    companyId = $Company.companyId; jobTitle = "ZZ Check S16 $ts $Name"
    jobDescription = $Text.jobDescription; keyResponsibilities = $Text.keyResponsibilities
    requiredSkills = $Text.requiredSkills; experienceRequirement = $Text.experienceRequirement
    minAge = 18; maxAge = 35; genderRequirement = "any"
    minEducationLevel = "senior_high"; minHeightCm = 249; deploymentLocation = "Check only"; employmentType = "Full-time"  # check-only height: publishing starts pool matching; no real applicant is 249 cm or taller
    slotsNeeded = $Slots; applicationCap = $Cap; endorsementCount = $Endorsement; matchingThreshold = 40; passingScore = 50
    sectionWeights = @(@{ sectionCode = "A"; weight = 30 }, @{ sectionCode = "B"; weight = 30 }, @{ sectionCode = "C"; weight = 40 })
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
$ve = New-Vacancy "VE" $c1 $CashierText 2 5 16
$vy = New-Vacancy "VY" $c1 $StoreCrewText 1 1 8
$vx = New-Vacancy "VX" $c2 $StoreCrewText 1 1 8
Info "VE $($ve.vacancyId) | VY $($vy.vacancyId) | VX $($vx.vacancyId)"

# ---------------------------------------------------------------- 2. profiles, applications, interviews, evaluations
foreach ($k in $keys) {
  $r = Upload-Resume $tok[$k] $resumeFile
  if ($r.Status -ne 200) { Stop-Check "Resume upload for $k -> $($r.Status): $($r.Raw)" }
  $p = $r.Json.data.profile
  $p | Add-Member -NotePropertyName heightCm -NotePropertyValue 250 -Force   # throwaway is 250 cm: passes the ZZ 249 cm minimum
  $problem = Profile-Problem $p $ve
  if ($problem) { Stop-Check "Parsed profile for $($k): $problem. Use a resume that passes the Cashier prescreen." }
  $fill = Fill-Profile $p
  $body = @{
    firstName = "S16 Test"; middleName = $null; lastName = $k; suffix = $null
    contactNumber = $fill.contactNumber; birthdate = $p.birthdate; gender = $p.gender; heightCm = $p.heightCm
    addressLine = $fill.addressLine; city = $fill.city; province = $fill.province; educationLevel = $p.educationLevel
  }
  $r = Req Post "/api/applicant/profile/confirm" $tok[$k] $body
  if ($r.Status -ne 201) { Stop-Check "Profile confirm for $k -> $($r.Status): $($r.Json.error.message)" }
}
Check "Profiles confirmed: S16 Test A..G" $true

function Apply([string]$Key, $Vacancy, [string]$Type, [string]$Expect) {
  $r = Req Post "/api/applicant/applications" $tok[$Key] @{ vacancyId = $Vacancy.vacancyId; applicantType = $Type }
  Step "$Key applies to $($Vacancy.jobTitle) as $Type -> 201" ($r.Status -eq 201) "got $($r.Status): $($r.Raw)"
  $status = (My-Application $tok[$Key] $Vacancy.vacancyId).Row.status
  Step "$Key is $Expect at $($Vacancy.jobTitle)" ($status -eq $Expect) "got $status"
  Start-Sleep -Milliseconds 1100
  return $r.Json.data.applicationId
}

$app = @{}
foreach ($k in @("A", "B", "C", "G")) { $app[$k] = Apply $k $ve "experienced" "shortlisted" }
foreach ($k in @("D", "E")) { $app[$k] = Apply $k $ve "first_time" "shortlisted" }
$app.F = Apply "F" $ve "experienced" "waiting_pool"   # quota 4 per group: the 5th Experienced applicant waits

$interviewed = @("A", "B", "C", "G", "D", "E")
foreach ($k in $interviewed) {
  $s = (Req Get "/api/admin/applications/$($app[$k])" $hrTok).Json.data
  $r = Req Patch "/api/admin/resumes/$($s.resume.resumeId)/verification" $hrTok @{ status = "verified"; applicationId = $app[$k] }
  Step "Verify $k's resume -> 200" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"
}
$scheduledUtc = Whole-Seconds ([datetime]::UtcNow.AddSeconds(90))
$interview = @{}
foreach ($k in $interviewed) {
  $r = Req Post "/api/admin/interviews" $hrTok @{ applicationId = $app[$k]; scheduledAt = (Manila-Iso $scheduledUtc); durationMinutes = 30; meetingLink = "https://meet.google.com/s16-check-link"; interviewerId = $hrUserId }
  Step "Schedule $k at now + 90 s -> 201" ($r.Status -eq 201) "got $($r.Status): $($r.Raw)"
  $interview[$k] = $r.Json.data.interviewId
  Step "$k's interview is set at once (decision 37: interview_confirmed, nobody confirms)" ($r.Json.data.applicationStatus -eq "interview_confirmed") $r.Raw
}
$target = $scheduledUtc.AddSeconds(5)
while ([datetime]::UtcNow -lt $target) {
  $left = [int][Math]::Ceiling(($target - [datetime]::UtcNow).TotalSeconds)
  Write-Host -NoNewline ("`rWaiting for the interview time to pass: {0,4} s " -f $left)
  Start-Sleep -Seconds 1
}
Write-Host ""
foreach ($k in $interviewed) {
  $r = Req Post "/api/admin/applications/$($app[$k])/evaluation" $hrTok @{ ratings = $ratings }
  Step "Evaluate $k -> passed (passing 50)" ($r.Status -eq 201 -and $r.Json.data.status -eq "passed") "got $($r.Status): $($r.Raw)"
}

# ---------------------------------------------------------------- 3. Notify and answers
# Decision 32: the client's final interview is in the Notify message (yesterday: no clock check anywhere).
$finalAt = Manila-Iso (Whole-Seconds ([datetime]::UtcNow.AddDays(-1)))
$finalDetails = "Bring two valid IDs."
$r = Req Post "/api/admin/vacancies/$($ve.vacancyId)/notify" $hrTok @{ applicationIds = @($app.A, $app.B, $app.C, $app.G, $app.E); finalInterviewAt = $finalAt; finalInterviewDetails = $finalDetails }
Step "Notify A, B, C, G, E -> 200" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"
# Decision 37B: no applicant confirmation. Everyone notified is for_endorsement at once; HR removes E (told the agency
# they will not continue) before the endorsement: archived, neutral.
foreach ($k in @("A", "B", "C", "G")) {
  Step "$k is for_endorsement right after Notify (no confirmation)" ((My-Application $tok[$k] $ve.vacancyId).Row.status -eq "for_endorsement") ""
}
$r = Req Post "/api/admin/applications/$($app.E)/remove-from-endorsement" $hrTok @{ reason = "S16 check: E will not continue." }
Step "HR removes E from the endorsement -> archived" ($r.Status -eq 200 -and $r.Json.data.status -eq "archived") "got $($r.Status): $($r.Raw)"

# ---------------------------------------------------------------- 4. Create endorsement (FR-END-05/06)
$createBody = @{ vacancyId = $ve.vacancyId; finalInterviewAt = $finalAt; finalInterviewDetails = $finalDetails }
$r = Req Post "/api/admin/endorsements" $tok.A $createBody
Check "Applicant token on Create endorsement -> 403" ($r.Status -eq 403) "got $($r.Status)"
$r = Req Post "/api/admin/endorsements" $hrTok @{ vacancyId = $ve.vacancyId }
Check "Create endorsement without the final interview -> 400 (decision 32: required)" ($r.Status -eq 400) "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/admin/endorsements" $hrTok @{ vacancyId = $ve.vacancyId; finalInterviewAt = $finalAt; finalInterviewDetails = "Go to the $($c1.companyName) office." }
Check "Create endorsement with details naming the company -> 422, A still for_endorsement" ($r.Status -eq 422 -and (My-Application $tok.A $ve.vacancyId).Row.status -eq "for_endorsement") "got $($r.Status): $($r.Raw)"
$laterAt = Manila-Iso (Whole-Seconds ([datetime]::UtcNow.AddDays(-1).AddHours(1)))
$r = Req Post "/api/admin/endorsements" $hrTok @{ vacancyId = $ve.vacancyId; finalInterviewAt = $laterAt; finalInterviewDetails = $finalDetails }
$changedGot = (@($r.Json.error.details | ForEach-Object { $_.applicationId }) | Sort-Object) -join ","
$changedWant = (@($app.A, $app.B, $app.C, $app.G) | Sort-Object) -join ","
Check "Create endorsement with another time than the Notify message -> 409 FINAL_INTERVIEW_CHANGED naming A, B, C, G" ($r.Status -eq 409 -and $r.Json.error.code -eq "FINAL_INTERVIEW_CHANGED" -and $changedGot -eq $changedWant) "got $($r.Status): $($r.Raw)"
Check "Nothing written by the refused Create: A still for_endorsement, no endorsement yet" ((My-Application $tok.A $ve.vacancyId).Row.status -eq "for_endorsement" -and @((Req Get "/api/admin/endorsements/$($ve.vacancyId)" $hrTok).Json.data.endorsements).Count -eq 0) ""
$r = Req Post "/api/admin/endorsements" $hrTok $createBody
Step "Create endorsement (the notified schedule) -> 201, vacancy endorsing, no time changed, no first notice" ($r.Status -eq 201 -and $r.Json.data.vacancyStatus -eq "endorsing" -and @($r.Json.data.timeChanged).Count -eq 0 -and @($r.Json.data.firstNotice).Count -eq 0) "got $($r.Status): $($r.Raw)"
$endorsementId = $r.Json.data.endorsementId
$endorsedGot = (@($r.Json.data.endorsed) | Sort-Object) -join ","
$endorsedWant = (@($app.A, $app.B, $app.C, $app.G) | Sort-Object) -join ","
Check "Endorsed = A, B, C, G" ($endorsedGot -eq $endorsedWant) "got $endorsedGot, want $endorsedWant"
Check "Standby = D (passed, never notified)" ((@($r.Json.data.standby) -join ",") -eq $app.D) ($r.Raw)
$expect = @{ A = "final_interview_scheduled"; B = "final_interview_scheduled"; C = "final_interview_scheduled"; G = "final_interview_scheduled"; D = "standby"; E = "archived"; F = "waiting_pool" }
foreach ($k in $keys) {
  $d = My-Application $tok[$k] $ve.vacancyId
  Step "$k is $($expect[$k]) after Create endorsement" ($d.Row.status -eq $expect[$k]) "got $($d.Row.status)"
  Check-NoLeaks "$k GET /api/applicant/applications" $d.Response.Json
}
$n = My-Notifications $tok.A "endorsed"
Check "A got 'endorsed' without the company" ($n.Rows.Count -ge 1 -and "$($n.Rows[0].title) $($n.Rows[0].message)" -notmatch [regex]::Escape($c1.companyName)) ""
# Decision 32: the schedule was in the Notify message, so no second schedule notice (positive check first, on the same
# list: the 'endorsed' notice is there). Throwaway applicants: VE is their only application so far.
foreach ($k in @("A", "B", "C", "G")) {
  $all = @(@((Req Get "/api/notifications?limit=50" $tok[$k]).Json.data) | Where-Object { $_ })
  Check "$k's notices include 'endorsed' and 'endorsement_notice' (once each; decision 37B)" (@($all | Where-Object { $_.type -eq "endorsed" }).Count -eq 1 -and @($all | Where-Object { $_.type -eq "endorsement_notice" }).Count -eq 1) ""
  Check "$k got no 'final_interview_scheduled' / 'final_interview_rescheduled' at Create endorsement" (@($all | Where-Object { $_.type -like "final_interview_*" }).Count -eq 0) (@($all | ForEach-Object { $_.type }) -join ",")
}
$n = My-Notifications $tok.D "moved_to_standby"
Check "D got moved_to_standby" ($n.Rows.Count -ge 1 -and "$($n.Rows[0].message)" -match "will not go forward to the employer") ""
# A valid body (the same notified schedule), so the call reaches the business rule instead of the 400 validation.
$r = Req Post "/api/admin/endorsements" $hrTok $createBody
Check "Create endorsement again (nobody for_endorsement) -> 422" ($r.Status -eq 422 -and "$($r.Json.error.message)" -eq "Nobody to endorse yet: notify passed applicants first.") "got $($r.Status): $($r.Raw)"

$view = (Req Get "/api/admin/endorsements/$($ve.vacancyId)" $hrTok).Json.data
$items = @($view.endorsements[0].items)
$itemOf = @{}
foreach ($k in @("A", "B", "C", "G")) { $itemOf[$k] = ($items | Where-Object { $_.applicationId -eq $app[$k] } | Select-Object -First 1).itemId }
Check "The endorsement has 4 items, all with outcome pending" ($items.Count -eq 4 -and @($items | Where-Object { $_.outcome -ne "pending" }).Count -eq 0) ($view | ConvertTo-Json -Depth 6 -Compress)
Check "Every item carries the batch's final interview (time and details)" (@($items | Where-Object { [math]::Abs((([datetime]$_.clientInterviewAt) - ([datetime]$finalAt)).TotalSeconds) -lt 1 -and $_.finalInterviewDetails -eq $finalDetails }).Count -eq 4) ($items | ConvertTo-Json -Depth 4 -Compress)
Check "No unanswered count any more (decision 37B), no candidates left" ($null -eq $view.awaitingConfirmation -and @($view.candidates).Count -eq 0) ($view.candidates | ConvertTo-Json -Compress)
$r = Req Get "/api/admin/endorsements/print/$endorsementId" $hrTok
Check "Printable endorsement: company, 4 candidates in rank order" ($r.Status -eq 200 -and $r.Json.data.company.companyName -eq $c1.companyName -and @($r.Json.data.candidates).Count -eq 4 -and ((@($r.Json.data.candidates | ForEach-Object { $_.rank }) -join ",") -eq ((@($r.Json.data.candidates | ForEach-Object { $_.rank }) | Sort-Object) -join ","))) "got $($r.Status)"

# ---------------------------------------------------------------- 5. archive refused while with the client
$r = Req Post "/api/admin/vacancies/$($ve.vacancyId)/reopen" $hrTok @{}
Step "Reopen VE (endorsing -> open) -> 200" ($r.Status -eq 200 -and $r.Json.data.status -eq "open") "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/admin/vacancies/$($ve.vacancyId)/close" $hrTok @{}
Step "Close VE -> 200" ($r.Status -eq 200 -and $r.Json.data.status -eq "closed") "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/admin/vacancies/$($ve.vacancyId)/archive" $hrTok @{}
Check "Archive VE while with the client (final interview scheduled) -> 409 (record the client's decision first)" ($r.Status -eq 409 -and "$($r.Json.error.message)" -match "Record the client's decision") "got $($r.Status): $($r.Raw)"

# ---------------------------------------------------------------- 6. client stages (FR-END-07/08/09; decision 37C)
# Fixed order: final interview -> For training -> For requirements -> For orientation -> Deployed (hired); one stage at
# a time, each with a notice (job title only); a past final interview time is accepted (no clock check).
$StageTitle = @{ for_training = "For training"; for_requirements = "For requirements"; for_orientation = "For orientation" }
function Advance([string]$Key, [string]$To) {
  $r = Req Post "/api/admin/endorsement-items/$($itemOf[$Key])/advance" $hrTok @{ to = $To }
  Step "$Key -> $To" ($r.Status -eq 200 -and $r.Json.data.status -eq $To) "got $($r.Status): $($r.Raw)"
  $n = My-Notifications $tok[$Key] $To
  Check "$Key got '$($StageTitle[$To]): <job>' without the company" ($n.Rows.Count -ge 1 -and "$($n.Rows[0].title)" -eq "$($StageTitle[$To]): $($ve.jobTitle)" -and "$($n.Rows[0].title) $($n.Rows[0].message)" -notmatch [regex]::Escape($c1.companyName)) ""
}

$r = Req Patch "/api/admin/endorsement-items/$($itemOf.B)/outcome" $hrTok @{ outcome = "hired" }
Check "B deployed straight from the final interview -> 409 (stages first)" ($r.Status -eq 409 -and "$($r.Json.error.message)" -match "training, requirements and orientation first") "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/admin/endorsement-items/$($itemOf.B)/advance" $hrTok @{ to = "for_requirements" }
Check "B skips For training -> 409, still final_interview_scheduled" ($r.Status -eq 409 -and (My-Application $tok.B $ve.vacancyId).Row.status -eq "final_interview_scheduled") "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/admin/endorsement-items/$($itemOf.B)/advance" $hrTok @{ to = "hired" }
Check "Advance to hired (not a stage move) -> 400" ($r.Status -eq 400) "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/admin/endorsement-items/$($itemOf.B)/training-failed" $hrTok @{}
Check "Training failed before For training (B at the final interview) -> 409" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/admin/endorsement-items/$($itemOf.B)/for-hiring" $hrTok @{}
Check "The old For hiring route is gone -> 404" ($r.Status -eq 404) "got $($r.Status)"
$r = Req Post "/api/admin/endorsement-items/$($itemOf.B)/advance" $tok.B @{ to = "for_training" }
Check "Applicant token on advance -> 403" ($r.Status -eq 403) "got $($r.Status)"

# A: For training -> Training failed (FR-END-08, TC-82): pool training_failed, company block, free elsewhere, no rematch.
Advance "A" "for_training"
$r = Req Post "/api/admin/endorsement-items/$($itemOf.A)/training-failed" $hrTok @{}
Step "A training failed (at For training) -> training_failed, vacancy not filled" ($r.Status -eq 200 -and $r.Json.data.status -eq "training_failed") "got $($r.Status): $($r.Raw)"
$n = My-Notifications $tok.A "training_failed"
Check "A got training_failed (neutral, no company)" ($n.Rows.Count -ge 1 -and "$($n.Rows[0].message)" -match "You can apply to other jobs" -and "$($n.Rows[0].title) $($n.Rows[0].message)" -notmatch [regex]::Escape($c1.companyName)) ""
Check "A got no rematch offer (training failed never rematches)" (@((My-Notifications $tok.A "rematch_offer").Rows).Count -eq 0) ""
$r = Req Get "/api/applicant/vacancies/$($vy.vacancyId)" $tok.A
Check "A gets 404 on VY at the same company (training_failed = failed, BR-19)" ($r.Status -eq 404) "got $($r.Status)"
$r = Req Post "/api/admin/endorsement-items/$($itemOf.A)/training-failed" $hrTok @{}
Check "A's training failed again -> 409" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"
$app.A2 = Apply "A" $vx "experienced" "shortlisted"   # free (BR-17) at another company

# G: For training, and stays there (the fill moves it to standby).
Advance "G" "for_training"
# Change time after Create endorsement (unchanged): a new time and details -> 'Final interview time changed'.
$changedAt = Manila-Iso (Whole-Seconds ([datetime]::UtcNow.AddDays(-1).AddHours(2)))
function Change-Time([string]$Key) {
  $r = Req Post "/api/admin/endorsement-items/$($itemOf[$Key])/final-interview" $hrTok @{ scheduledAt = $changedAt; details = "Bring two valid IDs and a pen." }
  Step "$Key Change time (no clock check) -> still final_interview_scheduled, rescheduled" ($r.Status -eq 200 -and $r.Json.data.status -eq "final_interview_scheduled" -and $r.Json.data.rescheduled -eq $true) "got $($r.Status): $($r.Raw)"
}
function Through-Stages([string]$Key) {
  foreach ($to in @("for_training", "for_requirements", "for_orientation")) { Advance $Key $to }
}
$r = Req Post "/api/admin/endorsement-items/$($itemOf.B)/final-interview" $hrTok @{ scheduledAt = $changedAt; details = "Go to the $($c1.companyName) office." }
Check "Change time with details naming the company -> 422, nothing changed" ($r.Status -eq 422 -and (My-Application $tok.B $ve.vacancyId).Row.status -eq "final_interview_scheduled" -and @((My-Notifications $tok.B "final_interview_rescheduled").Rows).Count -eq 0 -and @((My-Notifications $tok.B "endorsed").Rows).Count -eq 1) "got $($r.Status): $($r.Raw)"
Change-Time "B"
$n = My-Notifications $tok.B "final_interview_rescheduled"
Check "B got 'Final interview time changed' (job title, Philippine time, new details) without the company" `
  ($n.Rows.Count -ge 1 -and "$($n.Rows[0].title)" -eq "Final interview time changed: $($ve.jobTitle)" -and "$($n.Rows[0].message)" -match "Philippine time" -and "$($n.Rows[0].message)" -match "Bring two valid IDs and a pen" -and "$($n.Rows[0].title) $($n.Rows[0].message)" -notmatch [regex]::Escape($c1.companyName)) ""
Check "B's status panel: final_interview_scheduled" ((My-Application $tok.B $ve.vacancyId).Row.status -eq "final_interview_scheduled") ""
Advance "B" "for_training"
$r = Req Patch "/api/admin/endorsement-items/$($itemOf.B)/outcome" $hrTok @{ outcome = "hired" }
Check "B deployed at For training -> 409 (stages first)" ($r.Status -eq 409 -and (My-Application $tok.B $ve.vacancyId).Row.status -eq "for_training") "got $($r.Status): $($r.Raw)"
Advance "B" "for_requirements"
$r = Req Post "/api/admin/endorsement-items/$($itemOf.B)/training-failed" $hrTok @{}
Check "Training failed after For training (B at For requirements) -> 409" ($r.Status -eq 409 -and (My-Application $tok.B $ve.vacancyId).Row.status -eq "for_requirements") "got $($r.Status): $($r.Raw)"
Advance "B" "for_orientation"
Check "B's status panel: for_orientation (applicant label, no company)" ((My-Application $tok.B $ve.vacancyId).Row.status -eq "for_orientation") ""
Check-NoLeaks "B GET /api/applicant/applications at For orientation" (My-Application $tok.B $ve.vacancyId).Response.Json
$r = Req Patch "/api/admin/endorsement-items/$($itemOf.B)/outcome" $hrTok @{ outcome = "hired" }
Step "B deployed (from for_orientation) -> 200 hired, vacancy not filled (1 of 2)" ($r.Status -eq 200 -and $r.Json.data.status -eq "hired" -and $r.Json.data.vacancyStatus -ne "filled") "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/applicant/applications" $tok.B @{ vacancyId = $vx.vacancyId; applicantType = "experienced" }
Check "B (deployed) cannot apply elsewhere -> 409 (BR-17)" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"
$n = My-Notifications $tok.B "hired"
Check "B got 'Deployed: <job>' without the company" ($n.Rows.Count -ge 1 -and "$($n.Rows[0].title)" -eq "Deployed: $($ve.jobTitle)" -and "$($n.Rows[0].title) $($n.Rows[0].message)" -notmatch [regex]::Escape($c1.companyName)) ""
$r = Req Post "/api/admin/endorsement-items/$($itemOf.B)/training-failed" $hrTok @{}
Check "Training failed after Deployed -> 409 (Deployed is final)" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"

# G stays at For training: the fill moves it to standby (decision 37C stages are with the client)
Through-Stages "C"
$r = Req Patch "/api/admin/endorsement-items/$($itemOf.C)/outcome" $hrTok @{ outcome = "hired" }
Step "C deployed -> vacancy FILLED with closeOut { notSelected 1, standby 1 (G For training) }" `
  ($r.Status -eq 200 -and $r.Json.data.vacancyStatus -eq "filled" -and $r.Json.data.closeOut.notSelected -eq 1 -and $r.Json.data.closeOut.standby -eq 1) "got $($r.Status): $($r.Raw)"
$expect = @{ A = "training_failed"; B = "hired"; C = "hired"; G = "standby"; D = "standby"; E = "archived"; F = "not_selected" }
foreach ($k in $keys) {
  $s = (My-Application $tok[$k] $ve.vacancyId).Row.status
  Step "$k is $($expect[$k]) after the fill" ($s -eq $expect[$k]) "got $s"
}
$n = My-Notifications $tok.G "moved_to_standby"
Check "G got moved_to_standby at the fill" ($n.Rows.Count -ge 1) ""
$n = My-Notifications $tok.E "endorsement_removed"
Check "E got 'Application closed' when removed (neutral, no company) and no moved_to_standby" `
  ($n.Rows.Count -ge 1 -and "$($n.Rows[0].title)" -eq "Application closed: $($ve.jobTitle)" -and "$($n.Rows[0].title) $($n.Rows[0].message)" -notmatch [regex]::Escape($c1.companyName) -and @((My-Notifications $tok.E "moved_to_standby").Rows).Count -eq 0) ""
$n = My-Notifications $tok.F "not_selected"
Check "F got not_selected at the fill" ($n.Rows.Count -ge 1) ""
$view = (Req Get "/api/admin/endorsements/$($ve.vacancyId)" $hrTok).Json.data
$gItem = @($view.endorsements[0].items) | Where-Object { $_.applicationId -eq $app.G } | Select-Object -First 1
Check "G's item: outcome pending, remarks 'vacancy filled'" ($gItem.outcome -eq "pending" -and $gItem.outcomeRemarks -eq "vacancy filled") ($gItem | ConvertTo-Json -Compress)
Check "VE shows filled with 2 hired" ($view.vacancy.status -eq "filled" -and $view.vacancy.hiredCount -eq 2) ($view.vacancy | ConvertTo-Json -Compress)
# Decision 37C: a training-failed (or not-hired) applicant leaves the Outcomes view; the history stays in the database.
$shownGot = (@($view.endorsements[0].items | ForEach-Object { $_.applicationId }) | Sort-Object) -join ","
$shownWant = (@($app.B, $app.C, $app.G) | Sort-Object) -join ","
Check "Outcomes view lists B, C, G only (A training failed is left out)" ($shownGot -eq $shownWant) "got $shownGot, want $shownWant"

$r = Req Patch "/api/admin/endorsement-items/$($itemOf.A)/outcome" $hrTok @{ outcome = "hired" }
Check "A's decision again -> 409" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"
$r = Req Patch "/api/admin/endorsement-items/$($itemOf.G)/outcome" $hrTok @{ outcome = "hired" }
Check "G (standby after the fill) -> 409" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/admin/vacancies/$($ve.vacancyId)/archive" $hrTok @{}
Check "Archive the filled VE -> 409" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"
foreach ($k in @("D", "E", "G")) {
  $r = Req Get "/api/applicant/vacancies/$($vy.vacancyId)" $tok[$k]
  Check "$k (standby or archived, neutral) still sees VY at the same company" ($r.Status -eq 200) "got $($r.Status)"
}

# ---------------------------------------------------------------- 7. old routes (decision 37C)
$r = Req Post "/api/admin/applications/$($app.B)/training-failed" $hrTok @{}
Check "The old training-failed route by application is gone -> 404" ($r.Status -eq 404) "got $($r.Status)"

# ---------------------------------------------------------------- 8. endorsement packet by application (decision 33)
# Download from the Ranking tab: passed (final >= passing) and passed .. Deployed / not_hired; staff only.
$r = Req Get "/api/admin/applications/$($app.C)/packet" $hrTok
Check "Packet for C (hired) -> 200" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"
$r = Req Get "/api/admin/applications/$($app.B)/packet" $hrTok
Check "Packet for B (hired after every stage) -> 200" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"
$r = Req Get "/api/admin/applications/$($app.C)/packet" $tok.C
Check "Applicant token on the packet -> 403" ($r.Status -eq 403) "got $($r.Status)"
$r = Req Get "/api/admin/applications/$($app.D)/packet" $hrTok
Check "Packet for D (passed, then standby) -> 409 not passed" ($r.Status -eq 409 -and "$($r.Json.error.message)" -match "passed the assessment") "got $($r.Status): $($r.Raw)"
$r = Req Get "/api/admin/applications/$($app.A)/packet" $hrTok
Check "Packet for A (training_failed) -> 409 not passed" ($r.Status -eq 409 -and "$($r.Json.error.message)" -match "passed the assessment") "got $($r.Status): $($r.Raw)"
$r = Req Get "/api/admin/applications/$($app.F)/packet" $hrTok
Check "Packet for F (never evaluated) -> 409 no evaluation" ($r.Status -eq 409 -and "$($r.Json.error.message)" -match "no evaluation") "got $($r.Status): $($r.Raw)"
$r = Req Get "/api/admin/endorsement-items/$($itemOf.C)/packet" $hrTok
Check "The old packet route by endorsement item is gone -> 404" ($r.Status -eq 404) "got $($r.Status)"

# ---------------------------------------------------------------- summary
$color = "Green"; if ($script:Fail -gt 0) { $color = "Red" }
Write-Host "`n== $($script:Pass) passed, $($script:Fail) failed ==" -ForegroundColor $color

$main = "'$($app.A)', '$($app.B)', '$($app.C)', '$($app.D)', '$($app.E)', '$($app.F)', '$($app.G)'"
Write-Host @"

Now run these in the Supabase SQL editor (read-only):

  -- 1. status history with actors (HR for endorsement and decisions; system / null for standby and close-out)
  select h.application_id, h.from_status, h.to_status, h.reason, h.changed_by, u.role as changed_by_role, h.changed_at
  from application_status_history h left join user_account u on u.user_account_id = h.changed_by
  where h.application_id in ($main)
    and h.to_status in ('for_endorsement', 'archived', 'endorsed', 'final_interview_scheduled', 'for_training',
                        'for_requirements', 'for_orientation', 'for_hiring', 'standby', 'hired', 'not_hired',
                        'training_failed', 'not_selected')
  order by h.changed_at, h.history_id;

  -- 2. the endorsement and its items
  select e.endorsement_id, e.status, e.company_id, e.sent_by, e.sent_at, i.application_id, i.rank_at_endorsement,
         i.final_score, i.outcome, i.outcome_recorded_by, i.client_interview_at, i.final_interview_details, i.outcome_remarks
  from endorsement e join endorsement_item i using (endorsement_id)
  where e.endorsement_id = '$endorsementId' order by i.rank_at_endorsement;

  -- 3. vacancy status
  select job_title, status from job_vacancy where job_vacancy_id = '$($ve.vacancyId)';

  -- 4. applicant pool rows from VE
  select source_application_id, pool_reason, availability, removed_at from talent_pool
  where source_application_id in ($main) order by added_at;

  -- 5. notification types per application
  select application_id, notification_type, title from notification
  where application_id in ($main)
    and notification_type in ('endorsement_notice', 'endorsement_removed', 'endorsed', 'final_interview_scheduled',
                              'final_interview_rescheduled', 'for_training', 'for_requirements', 'for_orientation',
                              'for_hiring', 'moved_to_standby', 'hired', 'not_hired', 'training_failed', 'not_selected')
  order by application_id, created_at;

Expect (A = $($app.A), B = $($app.B), C = $($app.C), D = $($app.D), E = $($app.E), F = $($app.F), G = $($app.G), HR = $hrUserId):
  1. A, B, C, G, E passed -> for_endorsement: HR, 'Notified for endorsement' (decision 37B: no applicant answer).
     E for_endorsement -> archived: HR, 'Removed from endorsement: S16 check: E will not continue.'.
     A, B, C, G -> endorsed: HR, 'Endorsed to the client', then (same changed_at, next history_id)
     -> final_interview_scheduled: HR, 'Final interview scheduled'. D -> standby: NULL, 'endorsement created: not
     included'. A, B, C, G -> for_training: HR, 'Proceeds after the final interview'. A -> training_failed: HR,
     'Training failed'. B, C -> for_requirements: HR, 'Training passed'; -> for_orientation: HR, 'Requirements
     completed'; -> hired: HR, 'Client decision: hired'. G (for_training) -> standby and F -> not_selected: NULL,
     'close-out: vacancy filled' (E stays archived). NO for_hiring row (decision 37C).
  2. status sent, sent_by HR; 4 items; outcomes A not_hired (remarks 'Training failed'), B and C hired, G pending
     with remarks 'vacancy filled'; A, C, G client_interview_at = yesterday (the notified time) and
     final_interview_details 'Bring two valid IDs.'; B 2 hours later with 'Bring two valid IDs and a pen.'.
  3. filled.
  4. D standby, A training_failed, G standby, F not_selected (each active unless replaced); NO row for B, C
     (deployed) or E (archived is neutral and never enters the pool).
  5. A, B, C, G, E endorsement_notice; E endorsement_removed; A, B, C, G endorsed and NO final_interview_scheduled
     (decision 32); B final_interview_rescheduled; A, B, C, G for_training; B, C for_requirements and
     for_orientation; B, C hired ('Deployed: ...'); A training_failed; D, G moved_to_standby; F not_selected; NO
     for_hiring and NO not_hired.

Clean up afterwards (deletes only vacancies titled 'ZZ Check%' and their rows, then the empty 'ZZ Check' companies):
  run supabase/scripts/delete-check-vacancies.sql in the Supabase SQL editor.
Juan (juan@vera.test), Cashier, and Store Crew were not touched.
"@

if ($script:Fail -gt 0) { exit 1 }
