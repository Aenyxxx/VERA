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
#       VY @Company 1  Store Crew copy, open                            -> company block checks (not_hired, training_failed)
#       VX @Company 2  Store Crew copy, open                            -> "free to apply" checks
#   - VE: A, B, C, G Experienced and D, E First-time interviewed and passed; F (5th Experienced) waits.
#     Notify A, B, C, G, E -> A, B, C, G confirm, E does not answer; D is never notified.
#   - Create endorsement: A, B, C, G endorsed, D standby (system), E still awaiting.
#   - Reopen + close + archive -> refused while endorsed. A not hired, B hired, C hired -> VE FILLED and closed out:
#     G (endorsed, pending) and E (awaiting) standby, F not_selected. Then B's training fails.
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
               ('application_status', 'not_hired'), ('application_status', 'training_failed'),
               ('application_status', 'standby'), ('application_status', 'not_selected'),
               ('vacancy_status', 'endorsing'), ('vacancy_status', 'filled'),
               ('endorsement_status', 'sent'), ('endorsement_outcome', 'pending'),
               ('endorsement_outcome', 'hired'), ('endorsement_outcome', 'not_hired'),
               ('pool_reason', 'standby'), ('pool_reason', 'not_hired'), ('pool_reason', 'training_failed'),
               ('pool_reason', 'not_selected')) as v (typname, value)
  join pg_type t on t.typname = v.typname and t.typnamespace = 'public'::regnamespace
  order by t.typname, v.value;

Expect 16 rows, every one with present = true. If any is false, stop and report it before running anything.
"@ -ForegroundColor Yellow
$answer = Read-Host "Type VALUES if all 16 rows are present = true"
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
Write-Host "  A not hired (company block), B hired then training failed, C hired (fills VE), D/E/G standby, F not selected." -ForegroundColor Yellow
$answer = Read-Host "Type S16 to continue"
if ($answer -ne "S16") { Write-Host "Stopped before changing anything." -ForegroundColor Yellow; exit 1 }

# ---------------------------------------------------------------- 1. companies and vacancies (admin API)
$CashierText = @{
  jobDescription = "CHECK ONLY. Handles payments at the counter and serves customers in a busy supermarket."
  keyResponsibilities = "Process cash and cashless payments`nIssue receipts and give correct change`nCount and balance the cash drawer at the end of each shift`nAssist customers at the counter"
  requiredSkills = "Handling cash and giving correct change`nOperating a cash register or POS`nServing and assisting customers`nCounting and balancing the cash drawer"
  experienceRequirement = "Experience as a cashier or sales staff in a retail store, grocery or supermarket, handling payments and serving customers"
  minYearsExperience = 1
}
$StoreCrewText = @{
  jobDescription = "CHECK ONLY. Keeps the store stocked, clean and organized, and helps customers during busy hours."
  keyResponsibilities = "Stock and arrange items on shelves`nKeep the store and dining area clean`nAssist customers in finding items`nHelp with food preparation when needed"
  requiredSkills = "Stocking and arranging items on shelves`nKeeping the store clean and organized`nAssisting customers in finding items`nWorking under pressure during busy hours"
  experienceRequirement = "Experience as store crew, stock clerk or helper in a retail store, grocery or fast-food restaurant"
  minYearsExperience = 0
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
    minYearsExperience = $Text.minYearsExperience; minAge = 18; maxAge = 35; genderRequirement = "any"
    minEducationLevel = "senior_high"; minHeightCm = 150; deploymentLocation = "Check only"; employmentType = "Full-time"
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
  $r = Req Post "/api/applicant/interviews/$($interview[$k])/confirm" $tok[$k]
  Step "$k confirms the interview -> 200" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"
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
$r = Req Post "/api/admin/vacancies/$($ve.vacancyId)/notify" $hrTok @{ applicationIds = @($app.A, $app.B, $app.C, $app.G, $app.E) }
Step "Notify A, B, C, G, E -> 200" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"
foreach ($k in @("A", "B", "C", "G")) {
  $r = Req Post "/api/applicant/applications/$($app[$k])/endorsement/confirm" $tok[$k]
  Step "$k confirms the endorsement -> for_endorsement" ($r.Status -eq 200 -and $r.Json.data.status -eq "for_endorsement") "got $($r.Status): $($r.Raw)"
}

# ---------------------------------------------------------------- 4. Create endorsement (FR-END-05/06)
$r = Req Post "/api/admin/endorsements" $tok.A @{ vacancyId = $ve.vacancyId }
Check "Applicant token on Create endorsement -> 403" ($r.Status -eq 403) "got $($r.Status)"
$r = Req Post "/api/admin/endorsements" $hrTok @{ vacancyId = $ve.vacancyId }
Step "Create endorsement -> 201, vacancy endorsing" ($r.Status -eq 201 -and $r.Json.data.vacancyStatus -eq "endorsing") "got $($r.Status): $($r.Raw)"
$endorsementId = $r.Json.data.endorsementId
$endorsedGot = (@($r.Json.data.endorsed) | Sort-Object) -join ","
$endorsedWant = (@($app.A, $app.B, $app.C, $app.G) | Sort-Object) -join ","
Check "Endorsed = A, B, C, G" ($endorsedGot -eq $endorsedWant) "got $endorsedGot, want $endorsedWant"
Check "Standby = D (passed, never notified)" ((@($r.Json.data.standby) -join ",") -eq $app.D) ($r.Raw)
$expect = @{ A = "endorsed"; B = "endorsed"; C = "endorsed"; G = "endorsed"; D = "standby"; E = "passed_awaiting_confirmation"; F = "waiting_pool" }
foreach ($k in $keys) {
  $d = My-Application $tok[$k] $ve.vacancyId
  Step "$k is $($expect[$k]) after Create endorsement" ($d.Row.status -eq $expect[$k]) "got $($d.Row.status)"
  Check-NoLeaks "$k GET /api/applicant/applications" $d.Response.Json
}
$n = My-Notifications $tok.A "endorsed"
Check "A got 'endorsed' without the company" ($n.Rows.Count -ge 1 -and "$($n.Rows[0].title) $($n.Rows[0].message)" -notmatch [regex]::Escape($c1.companyName)) ""
$n = My-Notifications $tok.D "moved_to_standby"
Check "D got moved_to_standby" ($n.Rows.Count -ge 1 -and "$($n.Rows[0].message)" -match "will not go forward to the employer") ""
$r = Req Post "/api/admin/endorsements" $hrTok @{ vacancyId = $ve.vacancyId }
Check "Create endorsement again (nobody for_endorsement) -> 422" ($r.Status -eq 422) "got $($r.Status): $($r.Raw)"

$view = (Req Get "/api/admin/endorsements/$($ve.vacancyId)" $hrTok).Json.data
$items = @($view.endorsements[0].items)
$itemOf = @{}
foreach ($k in @("A", "B", "C", "G")) { $itemOf[$k] = ($items | Where-Object { $_.applicationId -eq $app[$k] } | Select-Object -First 1).itemId }
Check "The endorsement has 4 items, all with outcome pending" ($items.Count -eq 4 -and @($items | Where-Object { $_.outcome -ne "pending" }).Count -eq 0) ($view | ConvertTo-Json -Depth 6 -Compress)
Check "Unanswered count = 1 (E)" ($view.awaitingConfirmation -eq 1) "got $($view.awaitingConfirmation)"
$r = Req Get "/api/admin/endorsements/print/$endorsementId" $hrTok
Check "Printable endorsement: company, 4 candidates in rank order" ($r.Status -eq 200 -and $r.Json.data.company.companyName -eq $c1.companyName -and @($r.Json.data.candidates).Count -eq 4 -and ((@($r.Json.data.candidates | ForEach-Object { $_.rank }) -join ",") -eq ((@($r.Json.data.candidates | ForEach-Object { $_.rank }) | Sort-Object) -join ","))) "got $($r.Status)"

# ---------------------------------------------------------------- 5. archive refused while endorsed
$r = Req Post "/api/admin/vacancies/$($ve.vacancyId)/reopen" $hrTok @{}
Step "Reopen VE (endorsing -> open) -> 200" ($r.Status -eq 200 -and $r.Json.data.status -eq "open") "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/admin/vacancies/$($ve.vacancyId)/close" $hrTok @{}
Step "Close VE -> 200" ($r.Status -eq 200 -and $r.Json.data.status -eq "closed") "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/admin/vacancies/$($ve.vacancyId)/archive" $hrTok @{}
Check "Archive VE while endorsed -> 409 (record the client's decision first)" ($r.Status -eq 409 -and "$($r.Json.error.message)" -match "Record the client's decision") "got $($r.Status): $($r.Raw)"

# ---------------------------------------------------------------- 6. outcomes (FR-END-07/09)
$r = Req Patch "/api/admin/endorsement-items/$($itemOf.A)/outcome" $hrTok @{ outcome = "not_hired"; remarks = "Client chose another candidate" }
Step "A not hired -> 200 not_hired, vacancy not filled" ($r.Status -eq 200 -and $r.Json.data.status -eq "not_hired" -and $null -eq $r.Json.data.closeOut) "got $($r.Status): $($r.Raw)"
$n = My-Notifications $tok.A "not_hired"
Check "A got not_hired (neutral, no company)" ($n.Rows.Count -ge 1 -and "$($n.Rows[0].message)" -match "You can apply to other jobs" -and "$($n.Rows[0].title) $($n.Rows[0].message)" -notmatch [regex]::Escape($c1.companyName)) ""
$r = Req Get "/api/applicant/vacancies/$($vy.vacancyId)" $tok.A
Check "A gets 404 on VY at the same company (not_hired = failed, BR-19)" ($r.Status -eq 404) "got $($r.Status)"
$app.A2 = Apply "A" $vx "experienced" "shortlisted"   # free (BR-17) at another company

$r = Req Patch "/api/admin/endorsement-items/$($itemOf.B)/outcome" $hrTok @{ outcome = "hired"; clientInterviewAt = (Manila-Iso ([datetime]::UtcNow.AddDays(-1))) }
Step "B hired -> 200 hired, vacancy not filled (1 of 2)" ($r.Status -eq 200 -and $r.Json.data.status -eq "hired" -and $r.Json.data.vacancyStatus -ne "filled") "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/applicant/applications" $tok.B @{ vacancyId = $vx.vacancyId; applicantType = "experienced" }
Check "B (hired) cannot apply elsewhere -> 409 (BR-17)" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"
$n = My-Notifications $tok.B "hired"
Check "B got 'hired' without the company" ($n.Rows.Count -ge 1 -and "$($n.Rows[0].title) $($n.Rows[0].message)" -notmatch [regex]::Escape($c1.companyName)) ""

$r = Req Patch "/api/admin/endorsement-items/$($itemOf.C)/outcome" $hrTok @{ outcome = "hired" }
Step "C hired -> vacancy FILLED with closeOut { notSelected 1, standby 2 }" `
  ($r.Status -eq 200 -and $r.Json.data.vacancyStatus -eq "filled" -and $r.Json.data.closeOut.notSelected -eq 1 -and $r.Json.data.closeOut.standby -eq 2) "got $($r.Status): $($r.Raw)"
$expect = @{ A = "not_hired"; B = "hired"; C = "hired"; G = "standby"; D = "standby"; E = "standby"; F = "not_selected" }
foreach ($k in $keys) {
  $s = (My-Application $tok[$k] $ve.vacancyId).Row.status
  Step "$k is $($expect[$k]) after the fill" ($s -eq $expect[$k]) "got $s"
}
foreach ($k in @("G", "E")) {
  $n = My-Notifications $tok[$k] "moved_to_standby"
  Check "$k got moved_to_standby at the fill" ($n.Rows.Count -ge 1) ""
}
$n = My-Notifications $tok.F "not_selected"
Check "F got not_selected at the fill" ($n.Rows.Count -ge 1) ""
$view = (Req Get "/api/admin/endorsements/$($ve.vacancyId)" $hrTok).Json.data
$gItem = @($view.endorsements[0].items) | Where-Object { $_.applicationId -eq $app.G } | Select-Object -First 1
Check "G's item: outcome pending, remarks 'vacancy filled'" ($gItem.outcome -eq "pending" -and $gItem.outcomeRemarks -eq "vacancy filled") ($gItem | ConvertTo-Json -Compress)
Check "VE shows filled with 2 hired" ($view.vacancy.status -eq "filled" -and $view.vacancy.hiredCount -eq 2) ($view.vacancy | ConvertTo-Json -Compress)

$r = Req Patch "/api/admin/endorsement-items/$($itemOf.A)/outcome" $hrTok @{ outcome = "hired" }
Check "A's decision again -> 409" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"
$r = Req Patch "/api/admin/endorsement-items/$($itemOf.G)/outcome" $hrTok @{ outcome = "hired" }
Check "G (standby after the fill) -> 409" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/admin/vacancies/$($ve.vacancyId)/archive" $hrTok @{}
Check "Archive the filled VE -> 409" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"
foreach ($k in @("D", "E", "G")) {
  $r = Req Get "/api/applicant/vacancies/$($vy.vacancyId)" $tok[$k]
  Check "$k (standby, neutral) still sees VY at the same company" ($r.Status -eq 200) "got $($r.Status)"
}

# ---------------------------------------------------------------- 7. training failed (FR-END-08, TC-82)
$r = Req Post "/api/admin/applications/$($app.A)/training-failed" $hrTok @{}
Check "Training failed on a not_hired application -> 409" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/admin/applications/$($app.B)/training-failed" $hrTok @{}
Step "B training failed -> training_failed" ($r.Status -eq 200 -and $r.Json.data.status -eq "training_failed") "got $($r.Status): $($r.Raw)"
$n = My-Notifications $tok.B "training_failed"
Check "B got training_failed (neutral, no company)" ($n.Rows.Count -ge 1 -and "$($n.Rows[0].message)" -match "You can apply to other jobs" -and "$($n.Rows[0].title) $($n.Rows[0].message)" -notmatch [regex]::Escape($c1.companyName)) ""
$r = Req Get "/api/applicant/vacancies/$($vy.vacancyId)" $tok.B
Check "B gets 404 on VY at the same company (training_failed = failed)" ($r.Status -eq 404) "got $($r.Status)"
$app.B2 = Apply "B" $vx "experienced" "shortlisted"   # free again (BR-17)

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
    and h.to_status in ('endorsed', 'standby', 'hired', 'not_hired', 'training_failed', 'not_selected')
  order by h.changed_at;

  -- 2. the endorsement and its items
  select e.endorsement_id, e.status, e.company_id, e.sent_by, e.sent_at, i.application_id, i.rank_at_endorsement,
         i.final_score, i.outcome, i.outcome_recorded_by, i.client_interview_at, i.outcome_remarks
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
    and notification_type in ('endorsed', 'moved_to_standby', 'hired', 'not_hired', 'training_failed', 'not_selected')
  order by application_id, created_at;

Expect (A = $($app.A), B = $($app.B), C = $($app.C), D = $($app.D), E = $($app.E), F = $($app.F), G = $($app.G), HR = $hrUserId):
  1. A, B, C, G -> endorsed: HR, 'Endorsed to the client'. D -> standby: NULL, 'endorsement created: not included'.
     A -> not_hired, B -> hired, C -> hired: HR, 'Client decision: ...'. G (endorsed), E (awaiting) -> standby and
     F -> not_selected: NULL, 'close-out: vacancy filled'. B -> training_failed: HR, 'Training failed'.
  2. status sent, sent_by HR; 4 items; outcomes A not_hired (remarks 'Client chose another candidate'),
     B hired (client_interview_at set), C hired, G pending with remarks 'vacancy filled'.
  3. filled.
  4. D standby, A not_hired, E standby, G standby, F not_selected, B training_failed (each active unless replaced).
  5. A, B, C, G endorsed; D, E, G moved_to_standby; A not_hired; B, C hired; B training_failed; F not_selected.

Clean up afterwards (deletes only vacancies titled 'ZZ Check%' and their rows, then the empty 'ZZ Check' companies):
  run supabase/scripts/delete-check-vacancies.sql in the Supabase SQL editor.
Juan (juan@vera.test), Cashier, and Store Crew were not touched.
"@

if ($script:Fail -gt 0) { exit 1 }
