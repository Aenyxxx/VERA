# S17 Automatic rematch backend check (Windows PowerShell 5.1 compatible, ASCII only)
# Usage, from the repo root, with `pnpm dev` running (api + svc) and migration 20261011000000 applied:
#   powershell -ExecutionPolicy Bypass -File scripts/check-s17.ps1 -HrEmail <hr email> `
#     -ApplicantR1Email <r1> -ApplicantR2Email <r2> -ApplicantXEmail <x> -ResumePath <Juan's demo resume PDF>
# All parameters are required (no default accounts); passwords are prompted and never stored.
#
# Before running:
#   - Apply supabase/migrations/20261011000000_rematch_offer.sql and run the DATABASE_SCHEMA.md section 7 checks.
#   - Run the printed pg_enum pre-check in the Supabase SQL Editor (the script never reads the database).
#   - Create THREE fresh throwaway applicants (no profile yet): pnpm --filter api seed:applicant -- --email <email>
#   - ResumePath = Juan's demo resume (text PDF; passes the Cashier prescreen; matching ~99.38 on the Cashier text,
#     ~71.15 on Store Crew).
#
# SAFETY: the rematch scans EVERY open vacancy, including the real Store Crew (64428f4d-...), which is a valid
# candidate for these throwaways (matching ~71.15). Store Crew must NEVER be offered to or accepted by a throwaway:
#   - Before anything changes, the only open vacancies allowed are Store Crew and this run's ZZ vacancies; any other
#     open vacancy (Cashier included, or a leftover 'ZZ Check' one) stops the script.
#   - Every ZZ vacancy the check expects to be offered (VBEST, VOK) uses the CASHIER requirements, so its matching
#     (~99.38) always outranks Store Crew. No rematch is run once no ZZ candidate is left.
#   - Each scan result must be a 'ZZ Check' vacancy, and before EVERY accept or decline the offered title must start
#     with 'ZZ Check'; otherwise the script STOPS immediately without answering and prints the offered vacancy.
#
# What it creates (never Cashier, Store Crew, or juan@vera.test):
#   Companies "ZZ Check S17 <ts> Company 1 / 2" and published vacancies (Cashier text unless noted):
#     VS    @1  slots 2, endorsement 2, passing 50, weights 30/30/40 -> R1, R2 interviewed, endorsed, not hired
#     VSAME @1  weights 50/50/0                                     -> excluded: failed company (BR-19)
#     VLOW  @2  passing 100                                         -> excluded: below passing
#     VFULL @2  endorsement 1, weights 50/50/0                      -> excluded: X notified there (endorsement full)
#     VBEST @2  endorsement 2, passing 50, weights 30/30/40         -> offered to R1 (accepts) and R2 (declines)
#     VOK   @2  endorsement 2, passing 50, weights 20/20/60         -> offered to R2 on Run rematch again; closed -> 409
#   VSAME and VFULL would outrank VBEST (higher interview score) if their exclusion failed.
# The script STOPS at the first failed state change. No SQL is run by this script.
# Clean up afterwards with supabase/scripts/delete-check-vacancies.sql.

param(
  [Parameter(Mandatory = $true)] [string]$HrEmail,
  [Parameter(Mandatory = $true)] [string]$ApplicantR1Email,
  [Parameter(Mandatory = $true)] [string]$ApplicantR2Email,
  [Parameter(Mandatory = $true)] [string]$ApplicantXEmail,
  [Parameter(Mandatory = $true)] [string]$ResumePath,
  [string]$Api = "http://127.0.0.1:5000",
  [string]$EnvFile = "apps/web/.env"
)

$ErrorActionPreference = "Stop"
$script:Pass = 0
$script:Fail = 0
Add-Type -AssemblyName System.Net.Http

$CashierId = "dc4c5084-7d53-4da9-933e-e6ec91f492db"
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
$LeakPattern = '(?i)score|similarity|weights|rating|company|status_?reason|^age$|gender|birth|matching'

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
  addressLine = "S17 Test Street"; city = "Quezon City"; province = "Metro Manila"; contactNumber = "09170000000"
}
function Fill-Profile($p) {
  $values = @{}
  foreach ($field in $TestValues.Keys) {
    if ("$($p.$field)".Trim()) { $values[$field] = $p.$field } else { $values[$field] = $TestValues[$field] }
  }
  return $values
}

# Open vacancies right now: only Store Crew and this run's ZZ vacancies may be open (see SAFETY above).
function Assert-OpenVacancies([string[]]$AllowedIds, [string]$When) {
  $r = Req Get "/api/admin/vacancies?status=open&pageSize=100" $hrTok
  if ($r.Status -ne 200) { Stop-Check "List open vacancies -> $($r.Status): $($r.Raw)" }
  $open = @($r.Json.data | Where-Object { $_ })
  $others = @($open | Where-Object { $AllowedIds -notcontains $_.vacancyId })
  if ($others.Count -gt 0) {
    $list = ($others | ForEach-Object { "'$($_.jobTitle)' ($($_.vacancyId), $($_.companyName))" }) -join "; "
    Stop-Check "$($When): other open vacancies could be offered to a throwaway: $list. Close them (or run delete-check-vacancies.sql for leftover ZZ Check ones) and rerun with new accounts."
  }
  Check "$($When): open vacancies are only Store Crew and this run's ZZ vacancies ($($open.Count) open)" $true
}

# A scan result (outcome response or Run rematch again) must be the expected ZZ vacancy; anything else STOPS.
function Assert-ZZScan([string]$Name, $Rematch, $Expected) {
  if ($null -eq $Rematch -or $Rematch.status -ne "offered") {
    Step "$($Name): rematch offered" $false "got $($Rematch | ConvertTo-Json -Compress)"
  }
  if (-not "$($Rematch.jobTitle)".StartsWith("ZZ Check")) {
    Stop-Check "$($Name): the rematch offered '$($Rematch.jobTitle)' at '$($Rematch.companyName)' (offer $($Rematch.offerId)), which is NOT a ZZ Check vacancy. Nothing was answered. Report this before doing anything else."
  }
  Step "$($Name): rematch offered $($Expected.jobTitle)" ($Rematch.jobTitle -eq $Expected.jobTitle) "got '$($Rematch.jobTitle)' (offer $($Rematch.offerId))"
}

# Before EVERY accept or decline: the applicant's one pending offer must be a ZZ Check vacancy (the expected one).
function Assert-ZZOffer([string]$Key, $Expected) {
  $r = Req Get "/api/applicant/offers" $tok[$Key]
  $offers = @($r.Json.data | Where-Object { $_ })
  if ($r.Status -ne 200 -or $offers.Count -ne 1) {
    Stop-Check "$Key should have exactly one pending offer before answering; got $($r.Status): $($r.Raw). Nothing was answered."
  }
  $o = $offers[0]
  if (-not "$($o.jobTitle)".StartsWith("ZZ Check")) {
    Stop-Check "$Key was offered '$($o.jobTitle)' (offer $($o.offerId)), which is NOT a ZZ Check vacancy. Nothing was answered. Report this before doing anything else."
  }
  Step "$Key's pending offer is $($Expected.jobTitle) (checked before answering)" ($o.jobTitle -eq $Expected.jobTitle) "got '$($o.jobTitle)' (offer $($o.offerId))"
  Check-NoLeaks "$Key GET /api/applicant/offers" $r.Json
  $keys = (@($o.PSObject.Properties | ForEach-Object { $_.Name }) | Sort-Object) -join ","
  Check "$Key's offer shows only job title, location, type, deadline" ($keys -eq "deploymentLocation,dueAt,employmentType,jobTitle,offeredAt,offerId") "keys: $keys"
  return $o
}

# ---------------------------------------------------------------- setup
Write-Host "`n== S17 Automatic rematch check ==`n"

$keys = @("R1", "R2", "X")
$emailOf = @{ R1 = $ApplicantR1Email; R2 = $ApplicantR2Email; X = $ApplicantXEmail }
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

# Enum pre-check (manual: this script never reads the database).
Write-Host @"

Pre-check: run this in the Supabase SQL Editor (read-only):

  select t.typname, v.value, exists (
           select 1 from pg_enum e where e.enumtypid = t.oid and e.enumlabel = v.value) as present
  from (values ('invitation_status', 'pending'), ('invitation_status', 'accepted'),
               ('invitation_status', 'declined'), ('invitation_status', 'expired'),
               ('pool_availability', 'available'), ('pool_availability', 'invited'),
               ('pool_availability', 'reapplied'), ('application_source', 'rematch'),
               ('application_status', 'for_endorsement'), ('application_status', 'endorsed'),
               ('application_status', 'not_hired'), ('pool_reason', 'not_hired')) as v (typname, value)
  join pg_type t on t.typname = v.typname and t.typnamespace = 'public'::regnamespace
  order by t.typname, v.value;

Expect 12 rows, every one with present = true. If any is false, stop and report it before running anything.
"@ -ForegroundColor Yellow
$answer = Read-Host "Type VALUES if all 12 rows are present = true"
if ($answer -ne "VALUES") { Write-Host "Stopped: the enum values are not all on the database." -ForegroundColor Yellow; exit 1 }

$r = Req Get "/api/health" $null
$healthy = $r.Status -eq 200 -and $r.Json.data.db -eq "up"
Check "API health (db up)" $healthy "status $($r.Status): $($r.Raw)"
if (-not $healthy) { Stop-Check "Start pnpm dev first." }

$hrTok = Login $HrEmail
$tok = @{}
foreach ($k in $keys) { $tok[$k] = Login $emailOf[$k] }
$missingTokens = @($keys | Where-Object { [string]::IsNullOrEmpty($tok[$_]) }).Count
Check "Supabase logins (HR + R1, R2, X)" (-not [string]::IsNullOrEmpty($hrTok) -and $missingTokens -eq 0) "missing tokens: $missingTokens"

$me = (Req Get "/api/me" $hrTok).Json.data
if ($me.role -ne "hr" -and $me.role -ne "admin") { Stop-Check "$HrEmail is not an HR/admin account." }
$hrUserId = $me.userId

$userOf = @{}
foreach ($k in $keys) {
  $m = (Req Get "/api/me" $tok[$k]).Json.data
  if ($m.role -ne "applicant") { Stop-Check "$($emailOf[$k]) is not an applicant account." }
  if ($m.hasProfile) { Stop-Check "$($emailOf[$k]) already has a profile. Use a fresh throwaway (seed:applicant)." }
  if (@((Req Get "/api/applicant/applications" $tok[$k]).Json.data | Where-Object { $_ }).Count -ne 0) { Stop-Check "$($emailOf[$k]) already has applications." }
  $userOf[$k] = $m.userId
}

# Fail early, before creating anything: Store Crew may be open; nothing else (Cashier must not be open).
Assert-OpenVacancies @($StoreCrewId) "Before the check"

$rubric = @((Req Get "/api/admin/competencies" $hrTok).Json.data)
$counts = ($rubric | ForEach-Object { "$($_.sectionCode) $(@($_.items).Count)" }) -join " / "
if ($counts -ne "A 3 / B 9 / C 3") { Stop-Check "Unexpected Competency Profile rubric: $counts" }
# Juan's demo ratings (ALGORITHM.md section 6): sections 83.33 / 83.33 / 75.00, so the section weights change the score.
$pattern = @{ A = @(5, 4, 4); B = @(5, 5, 5, 4, 4, 4, 4, 4, 4); C = @(4, 4, 4) }
$ratings = @()
foreach ($section in $rubric) {
  $i = 0
  foreach ($item in @($section.items)) { $ratings += @{ competencyId = $item.competencyId; rating = $pattern[$section.sectionCode][$i] }; $i++ }
}

$ts = (Get-Date).ToString("yyyyMMdd-HHmmss")
Write-Host "`nNext steps create 2 companies and 6 published vacancies named 'ZZ Check S17 $ts ...' and change R1, R2, X permanently:" -ForegroundColor Yellow
Write-Host "  R1, R2 endorsed at VS then not hired (automatic rematch), R1 accepts VBEST, R2 declines VBEST and gets VOK (closed -> 409); X notified at VFULL." -ForegroundColor Yellow
$answer = Read-Host "Type S17 to continue"
if ($answer -ne "S17") { Write-Host "Stopped before changing anything." -ForegroundColor Yellow; exit 1 }

# ---------------------------------------------------------------- 1. companies and vacancies (admin API)
$CashierText = @{
  jobDescription = "CHECK ONLY. Handles payments at the counter and serves customers in a busy supermarket."
  keyResponsibilities = "Process cash and cashless payments`nIssue receipts and give correct change`nCount and balance the cash drawer at the end of each shift`nAssist customers at the counter"
  requiredSkills = "Handling cash and giving correct change`nOperating a cash register or POS`nServing and assisting customers`nCounting and balancing the cash drawer"
  experienceRequirement = "Experience as a cashier or sales staff in a retail store, grocery or supermarket, handling payments and serving customers"
  minYearsExperience = 1
}

function New-Company([int]$No) {
  $body = @{
    companyName = "ZZ Check S17 $ts Company $No"; industry = "Check script (delete me)"; description = $null; website = $null
    contactPersonName = "ZZ Check"; contactPersonPosition = $null; contactEmail = "zz-check-s17@example.com"; contactNumber = $null
  }
  $r = Req Post "/api/admin/companies" $hrTok $body
  if ($r.Status -ne 201) { Stop-Check "Create company $No -> $($r.Status): $($r.Raw)" }
  return $r.Json.data
}

function New-Vacancy([string]$Name, $Company, [int]$Slots, [int]$Endorsement, [int]$Passing, [int[]]$Weights) {
  $body = @{
    companyId = $Company.companyId; jobTitle = "ZZ Check S17 $ts $Name"
    jobDescription = $CashierText.jobDescription; keyResponsibilities = $CashierText.keyResponsibilities
    requiredSkills = $CashierText.requiredSkills; experienceRequirement = $CashierText.experienceRequirement
    minYearsExperience = $CashierText.minYearsExperience; minAge = 18; maxAge = 35; genderRequirement = "any"
    minEducationLevel = "senior_high"; minHeightCm = 150; deploymentLocation = "Check only"; employmentType = "Full-time"
    slotsNeeded = $Slots; applicationCap = 16; endorsementCount = $Endorsement; matchingThreshold = 40; passingScore = $Passing
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
$vs    = New-Vacancy "VS"    $c1 2 2 50  @(30, 30, 40)
$vsame = New-Vacancy "VSAME" $c1 1 2 50  @(50, 50, 0)
$vlow  = New-Vacancy "VLOW"  $c2 1 2 100 @(30, 30, 40)
$vfull = New-Vacancy "VFULL" $c2 1 1 50  @(50, 50, 0)
$vbest = New-Vacancy "VBEST" $c2 1 2 50  @(30, 30, 40)
$vok   = New-Vacancy "VOK"   $c2 1 2 50  @(20, 20, 60)
Info "VS $($vs.vacancyId) | VSAME $($vsame.vacancyId) | VLOW $($vlow.vacancyId) | VFULL $($vfull.vacancyId) | VBEST $($vbest.vacancyId) | VOK $($vok.vacancyId)"
$zzIds = @($vs.vacancyId, $vsame.vacancyId, $vlow.vacancyId, $vfull.vacancyId, $vbest.vacancyId, $vok.vacancyId)

# ---------------------------------------------------------------- 2. profiles, applications, interviews, evaluations
foreach ($k in $keys) {
  $r = Upload-Resume $tok[$k] $resumeFile
  if ($r.Status -ne 200) { Stop-Check "Resume upload for $k -> $($r.Status): $($r.Raw)" }
  $p = $r.Json.data.profile
  $problem = Profile-Problem $p $vs
  if ($problem) { Stop-Check "Parsed profile for $($k): $problem. Use Juan's demo resume." }
  $fill = Fill-Profile $p
  $body = @{
    firstName = "S17 Test"; middleName = $null; lastName = $k; suffix = $null
    contactNumber = $fill.contactNumber; birthdate = $p.birthdate; gender = $p.gender; heightCm = $p.heightCm
    addressLine = $fill.addressLine; city = $fill.city; province = $fill.province; educationLevel = $p.educationLevel
  }
  $r = Req Post "/api/applicant/profile/confirm" $tok[$k] $body
  if ($r.Status -ne 201) { Stop-Check "Profile confirm for $k -> $($r.Status): $($r.Json.error.message)" }
}
Check "Profiles confirmed: S17 Test R1, R2, X" $true

function Apply([string]$Key, $Vacancy, [string]$Expect) {
  $r = Req Post "/api/applicant/applications" $tok[$Key] @{ vacancyId = $Vacancy.vacancyId; applicantType = "experienced" }
  Step "$Key applies to $($Vacancy.jobTitle) -> 201" ($r.Status -eq 201) "got $($r.Status): $($r.Raw)"
  $status = (My-Application $tok[$Key] $Vacancy.vacancyId).Row.status
  Step "$Key is $Expect at $($Vacancy.jobTitle)" ($status -eq $Expect) "got $status"
  Start-Sleep -Milliseconds 1100
  return $r.Json.data.applicationId
}

$app = @{}
$app.R1 = Apply "R1" $vs "shortlisted"
$app.R2 = Apply "R2" $vs "shortlisted"
$app.X  = Apply "X" $vfull "shortlisted"

foreach ($k in $keys) {
  $s = (Req Get "/api/admin/applications/$($app[$k])" $hrTok).Json.data
  $r = Req Patch "/api/admin/resumes/$($s.resume.resumeId)/verification" $hrTok @{ status = "verified"; applicationId = $app[$k] }
  Step "Verify $k's resume -> 200" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"
}
$scheduledUtc = Whole-Seconds ([datetime]::UtcNow.AddSeconds(90))
foreach ($k in $keys) {
  $r = Req Post "/api/admin/interviews" $hrTok @{ applicationId = $app[$k]; scheduledAt = (Manila-Iso $scheduledUtc); durationMinutes = 30; meetingLink = "https://meet.google.com/s17-check-link"; interviewerId = $hrUserId }
  Step "Schedule $k at now + 90 s -> 201" ($r.Status -eq 201) "got $($r.Status): $($r.Raw)"
  $r = Req Post "/api/applicant/interviews/$($r.Json.data.interviewId)/confirm" $tok[$k]
  Step "$k confirms the interview -> 200" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"
}
$target = $scheduledUtc.AddSeconds(5)
while ([datetime]::UtcNow -lt $target) {
  $left = [int][Math]::Ceiling(($target - [datetime]::UtcNow).TotalSeconds)
  Write-Host -NoNewline ("`rWaiting for the interview time to pass: {0,4} s " -f $left)
  Start-Sleep -Seconds 1
}
Write-Host ""
$evalOf = @{}
foreach ($k in $keys) {
  $r = Req Post "/api/admin/applications/$($app[$k])/evaluation" $hrTok @{ ratings = $ratings }
  Step "Evaluate $k -> passed, interview 80.00 (weights 30/30/40 or 50/50/0 -> 80.00 / 83.33)" ($r.Status -eq 201 -and $r.Json.data.status -eq "passed") "got $($r.Status): $($r.Raw)"
  $evalOf[$k] = $r.Json.data
}
Check "R1's VS interview score = 80.00 (Juan's ratings x 30/30/40)" ([double]$evalOf.R1.interviewScore -eq 80) "got $($evalOf.R1.interviewScore)"

# ---------------------------------------------------------------- 3. X fills VFULL's endorsement; R1, R2 endorsed at VS
$r = Req Post "/api/admin/vacancies/$($vfull.vacancyId)/notify" $hrTok @{ applicationIds = @($app.X) }
Step "Notify X at VFULL -> VFULL endorsement full (1 of 1)" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/admin/vacancies/$($vs.vacancyId)/notify" $hrTok @{ applicationIds = @($app.R1, $app.R2) }
Step "Notify R1, R2 at VS -> 200" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"
foreach ($k in @("R1", "R2")) {
  $r = Req Post "/api/applicant/applications/$($app[$k])/endorsement/confirm" $tok[$k]
  Step "$k confirms the endorsement -> for_endorsement" ($r.Status -eq 200 -and $r.Json.data.status -eq "for_endorsement") "got $($r.Status): $($r.Raw)"
}
$r = Req Post "/api/admin/endorsements" $hrTok @{ vacancyId = $vs.vacancyId }
Step "Create endorsement at VS -> R1, R2 endorsed" ($r.Status -eq 201 -and @($r.Json.data.endorsed).Count -eq 2) "got $($r.Status): $($r.Raw)"
$items = @((Req Get "/api/admin/endorsements/$($vs.vacancyId)" $hrTok).Json.data.endorsements[0].items)
$itemOf = @{}
foreach ($k in @("R1", "R2")) { $itemOf[$k] = ($items | Where-Object { $_.applicationId -eq $app[$k] } | Select-Object -First 1).itemId }
Step "VS endorsement items found for R1 and R2" ($itemOf.R1 -and $itemOf.R2) ($items | ConvertTo-Json -Compress -Depth 4)

# Last gate before any scan: VS is endorsing now; only Store Crew and VSAME, VLOW, VFULL, VBEST, VOK may be open.
Assert-OpenVacancies (@($StoreCrewId) + $zzIds) "Before the first rematch"

# ---------------------------------------------------------------- 4. R1 not hired -> automatic rematch -> accept
$r = Req Patch "/api/admin/endorsement-items/$($itemOf.R1)/outcome" $hrTok @{ outcome = "not_hired"; remarks = "S17 check" }
Step "R1 not hired -> 200 not_hired" ($r.Status -eq 200 -and $r.Json.data.status -eq "not_hired") "got $($r.Status): $($r.Raw)"
Assert-ZZScan "R1 not hired" $r.Json.data.rematch $vbest
Check "R1's rematch (HR response) names VBEST's company" ($r.Json.data.rematch.companyName -eq $c2.companyName) "got $($r.Json.data.rematch.companyName)"
$offerR1 = $r.Json.data.rematch.offerId

$n = My-Notifications $tok.R1 "rematch_offer"
Check "R1 got rematch_offer with the job title, without the company" ($n.Rows.Count -ge 1 -and "$($n.Rows[0].title)" -eq "Another job for you: $($vbest.jobTitle)" -and "$($n.Rows[0].title) $($n.Rows[0].message)" -notmatch [regex]::Escape($c2.companyName)) ($n.Rows | ConvertTo-Json -Compress)
$r = Req Post "/api/admin/applications/$($app.R1)/rematch" $hrTok @{}
Check "Run rematch again while R1's offer is pending -> 409 (no scan)" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/admin/applications/$($app.R1)/rematch" $tok.R1 @{}
Check "Applicant token on Run rematch again -> 403" ($r.Status -eq 403) "got $($r.Status)"

$o = Assert-ZZOffer "R1" $vbest
Check "R1's offer id matches the HR response" ($o.offerId -eq $offerR1) "got $($o.offerId), want $offerR1"
$r = Req Post "/api/applicant/offers/$offerR1/accept" $tok.R2 @{}
Check "R2 accepting R1's offer -> 404 (nothing changes)" ($r.Status -eq 404) "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/applicant/offers/$offerR1/accept" $hrTok @{}
Check "HR token on accept -> 403" ($r.Status -eq 403) "got $($r.Status)"

$r = Req Post "/api/applicant/offers/$offerR1/accept" $tok.R1 @{}
Step "R1 accepts VBEST -> application for_endorsement" ($r.Status -eq 200 -and $r.Json.data.status -eq "accepted" -and $r.Json.data.applicationStatus -eq "for_endorsement") "got $($r.Status): $($r.Raw)"
Check-NoLeaks "R1 accept response" $r.Json
$app.R1B = $r.Json.data.applicationId

$d = My-Application $tok.R1 $vbest.vacancyId
Step "R1 is for_endorsement at VBEST" ($d.Row.status -eq "for_endorsement") "got $($d.Row.status)"
Check-NoLeaks "R1 GET /api/applicant/applications" $d.Response.Json
$r = Req Get "/api/applicant/offers" $tok.R1
Check "R1 has no pending offer after accepting" ($r.Status -eq 200 -and @($r.Json.data | Where-Object { $_ }).Count -eq 0) "got $($r.Raw)"
$r = Req Post "/api/applicant/offers/$offerR1/accept" $tok.R1 @{}
Check "R1 accepts again -> 409" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/admin/applications/$($app.R1)/rematch" $hrTok @{}
Check "Run rematch again for R1 after the accept -> 409 (no scan)" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"

$ev = (Req Get "/api/admin/applications/$($app.R1B)/evaluation" $hrTok).Json.data
Check "R1's VBEST evaluation reuses the VS interview (WSM-03)" ($ev.evaluation.reused -eq $true -and $ev.evaluation.source.applicationId -eq $app.R1) ($ev.evaluation | ConvertTo-Json -Compress -Depth 4)
Check "R1's VBEST scores = VS scores (same text, same weights): matching $($evalOf.R1.matchingScore), interview 80, final $($evalOf.R1.finalScore)" `
  ([double]$ev.evaluation.matchingScore -eq [double]$evalOf.R1.matchingScore -and [double]$ev.evaluation.interviewScore -eq 80 -and [double]$ev.evaluation.finalScore -eq [double]$evalOf.R1.finalScore) ($ev.evaluation | ConvertTo-Json -Compress -Depth 4)
Check "R1's matching on the Cashier text outranks Store Crew (> 71.15)" ([double]$ev.evaluation.matchingScore -gt 71.15) "got $($ev.evaluation.matchingScore)"
$view = (Req Get "/api/admin/endorsements/$($vbest.vacancyId)" $hrTok).Json.data
Check "VBEST Endorsement Management lists R1 as a for_endorsement candidate" (@($view.candidates | Where-Object { $_.applicationId -eq $app.R1B }).Count -eq 1) ($view.candidates | ConvertTo-Json -Compress -Depth 4)

# ---------------------------------------------------------------- 5. R2 not hired -> VBEST -> decline -> Run again -> VOK -> closed -> 409
$r = Req Patch "/api/admin/endorsement-items/$($itemOf.R2)/outcome" $hrTok @{ outcome = "not_hired" }
Step "R2 not hired -> 200 not_hired" ($r.Status -eq 200 -and $r.Json.data.status -eq "not_hired") "got $($r.Status): $($r.Raw)"
Assert-ZZScan "R2 not hired (VBEST 1 of 2 taken, still open)" $r.Json.data.rematch $vbest

$o = Assert-ZZOffer "R2" $vbest
$r = Req Post "/api/applicant/offers/$($o.offerId)/decline" $tok.R2 @{}
Step "R2 declines VBEST -> declined" ($r.Status -eq 200 -and $r.Json.data.status -eq "declined") "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/applicant/offers/$($o.offerId)/accept" $tok.R2 @{}
Check "R2 accepts the declined offer -> 409" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"

# VBEST is skipped (declined); VOK (Cashier text, 99.38) still outranks Store Crew.
Assert-OpenVacancies (@($StoreCrewId) + $zzIds) "Before Run rematch again for R2"
$r = Req Post "/api/admin/applications/$($app.R2)/rematch" $hrTok @{}
Step "Run rematch again for R2 -> 200" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"
Assert-ZZScan "R2 Run rematch again" $r.Json.data $vok
Check "R2's VOK offer: matching > 71.15, interview below VBEST's 80 (20/20/60)" ([double]$r.Json.data.matchingScore -gt 71.15 -and [double]$r.Json.data.interviewScore -lt 80) ($r.Raw)

$o = Assert-ZZOffer "R2" $vok
$r = Req Post "/api/admin/vacancies/$($vok.vacancyId)/close" $hrTok @{}
Step "HR closes VOK before R2 answers -> 200" ($r.Status -eq 200 -and $r.Json.data.status -eq "closed") "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/applicant/offers/$($o.offerId)/accept" $tok.R2 @{}
Step "R2 accepts the closed VOK -> 409 'no longer available'" ($r.Status -eq 409 -and "$($r.Json.error.message)" -match "no longer available") "got $($r.Status): $($r.Raw)"
$r = Req Get "/api/applicant/offers" $tok.R2
Check "R2 has no pending offer (expired)" ($r.Status -eq 200 -and @($r.Json.data | Where-Object { $_ }).Count -eq 0) "got $($r.Raw)"
$n = My-Notifications $tok.R2 "rematch_offer_expired"
Check "R2 got rematch_offer_expired (neutral, no company)" ($n.Rows.Count -ge 1 -and "$($n.Rows[0].message)" -match "You can apply to other jobs" -and "$($n.Rows[0].title) $($n.Rows[0].message)" -notmatch [regex]::Escape($c2.companyName)) ($n.Rows | ConvertTo-Json -Compress)
$d = My-Application $tok.R2 $vok.vacancyId
Check "R2 has no application at VOK" ($null -eq $d.Row) ($d.Row | ConvertTo-Json -Compress)
Info "No further rematch is run for R2: no ZZ candidate is left, so a scan could offer Store Crew."

# ---------------------------------------------------------------- 6. applicant pool view
$r = Req Get "/api/admin/pool" $hrTok
$poolRows = @($r.Json.data | Where-Object { $_ })
$r2Row = $poolRows | Where-Object { $_.sourceApplicationId -eq $app.R2 } | Select-Object -First 1
Check "Pool view lists R2 (not_hired, available, latest offer expired at VOK)" ($r.Status -eq 200 -and $r2Row.poolReason -eq "not_hired" -and $r2Row.availability -eq "available" -and $r2Row.offerStatus -eq "expired" -and $r2Row.offerJobTitle -eq $vok.jobTitle) ($r2Row | ConvertTo-Json -Compress)
Check "Pool view does not list R1 (accepted: back in the process)" (@($poolRows | Where-Object { $_.sourceApplicationId -eq $app.R1 }).Count -eq 0) ""
Check "Pool view does not list X (ongoing application)" (@($poolRows | Where-Object { $_.applicantName -eq "S17 Test X" }).Count -eq 0) ""
$r = Req Get "/api/admin/pool" $tok.R1
Check "Applicant token on the pool view -> 403" ($r.Status -eq 403) "got $($r.Status)"
$view = (Req Get "/api/admin/endorsements/$($vs.vacancyId)" $hrTok).Json.data
$r1Item = @($view.endorsements[0].items) | Where-Object { $_.applicationId -eq $app.R1 } | Select-Object -First 1
$r2Item = @($view.endorsements[0].items) | Where-Object { $_.applicationId -eq $app.R2 } | Select-Object -First 1
Check "VS Outcomes: R1's latest offer accepted at VBEST" ($r1Item.rematchStatus -eq "accepted" -and $r1Item.rematchJobTitle -eq $vbest.jobTitle) ($r1Item | ConvertTo-Json -Compress)
Check "VS Outcomes: R2's latest offer expired at VOK" ($r2Item.rematchStatus -eq "expired" -and $r2Item.rematchJobTitle -eq $vok.jobTitle) ($r2Item | ConvertTo-Json -Compress)

# ---------------------------------------------------------------- summary
$color = "Green"; if ($script:Fail -gt 0) { $color = "Red" }
Write-Host "`n== $($script:Pass) passed, $($script:Fail) failed ==" -ForegroundColor $color

$sources = "'$($app.R1)', '$($app.R2)'"
Write-Host @"

Now run these in the Supabase SQL editor (read-only):

  -- 1. SAFETY: no offer and no rematch application ever references Cashier or Store Crew
  select 'pool_invitation' as source, pi.pool_invitation_id as id, pi.job_vacancy_id, pi.status::text
  from pool_invitation pi
  where pi.job_vacancy_id in ('$CashierId', '$StoreCrewId')
  union all
  select 'application', a.application_id, a.job_vacancy_id, a.status::text
  from application a
  where a.application_source = 'rematch' and a.job_vacancy_id in ('$CashierId', '$StoreCrewId');

  -- 2. the offers made from R1's and R2's pool entries
  select tp.source_application_id, v.job_title, pi.status, pi.invited_by, pi.applicant_type, pi.matching_score,
         pi.interview_score, pi.final_score, pi.section_scores, pi.ratings_source_application_id, pi.application_id,
         pi.due_at > pi.invited_at as due_later, pi.responded_at is not null as answered
  from pool_invitation pi join talent_pool tp using (talent_pool_id) join job_vacancy v using (job_vacancy_id)
  where tp.source_application_id in ($sources) order by pi.invited_at;

  -- 3. R1's accepted rematch application, its matching and final evaluation
  select a.application_source, a.status, a.applicant_type, m.matching_score, fe.matching_score as fe_matching,
         fe.interview_score, fe.final_score, fe.passed, fe.ratings_source_application_id, fe.computed_by
  from application a join matching_result m using (application_id) join final_evaluation fe using (application_id)
  where a.application_id = '$($app.R1B)';

  -- 4. its status history (created at for_endorsement by R1)
  select from_status, to_status, reason, changed_by from application_status_history
  where application_id = '$($app.R1B)' order by changed_at;

  -- 5. pool entries
  select source_application_id, pool_reason, availability, removed_at is not null as closed from talent_pool
  where source_application_id in ($sources) order by added_at;

  -- 6. rematch notifications of R1 and R2
  select user_account_id, notification_type, title, requires_action from notification
  where user_account_id in ('$($userOf.R1)', '$($userOf.R2)') and notification_type like 'rematch%'
  order by created_at;

Expect (R1 VS = $($app.R1), R2 VS = $($app.R2), R1 VBEST = $($app.R1B), R1 user = $($userOf.R1)):
  1. NO rows.
  2. Three rows: R1 VBEST accepted (application_id = R1 VBEST), R2 VBEST declined, R2 VOK expired; invited_by NULL,
     applicant_type experienced, ratings_source_application_id = the R1 / R2 VS application, due_later and answered true;
     VBEST interview 80.00, VOK interview below 80.00, matching the same on all three.
  3. rematch, for_endorsement, experienced, matching = fe_matching, interview 80.00, passed true,
     ratings_source_application_id = R1 VS, computed_by NULL.
  4. One row: NULL -> for_endorsement, 'Accepted rematch offer', changed_by = R1 user.
  5. R1 VS: not_hired, reapplied, closed true. R2 VS: not_hired, available, closed false.
  6. R1 rematch_offer (requires_action true); R2 rematch_offer twice (VBEST, VOK), rematch_offer_expired once.

Clean up afterwards (deletes only vacancies titled 'ZZ Check%' and their rows, then the empty 'ZZ Check' companies):
  run supabase/scripts/delete-check-vacancies.sql in the Supabase SQL editor.
Juan (juan@vera.test), Cashier, and Store Crew were not touched.
"@

if ($script:Fail -gt 0) { exit 1 }
