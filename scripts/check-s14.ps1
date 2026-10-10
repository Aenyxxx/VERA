# S14 Evaluation and scores backend check (Windows PowerShell 5.1 compatible, ASCII only)
# Usage, from the repo root, with `pnpm dev` running (api + svc):
#   powershell -ExecutionPolicy Bypass -File scripts/check-s14.ps1 -HrEmail <hr email> `
#     -ApplicantPEmail <throwaway P> -ApplicantREmail <throwaway R> -ResumePath <text PDF>
# All parameters are required (no default accounts); passwords are prompted and never stored.
#
# Before running:
#   - Create two FRESH throwaway applicants (no profile yet): pnpm --filter api seed:applicant -- --email <email>
#   - ResumePath is a text-based English PDF whose parsed profile passes the Cashier prescreen (ages 18-35,
#     senior high, 150 cm) and clears a matching threshold of 40 on the Cashier and Store Crew requirements
#     (the demo resume does).
#   - node is on PATH (the expected scores come from packages/shared/src/scoring.js via scripts/check-s14-score.mjs).
#
# What it creates (never Cashier, Store Crew, or juan@vera.test):
#   - 4 companies "ZZ Check S14 <ts> Company 1..4" and 4 published vacancies, one per company:
#       V1  Cashier copy,    A30/B30/C40, passing  75  -> P is interviewed and PASSES (worked example)
#       V1b Cashier copy,    A30/B30/C40, passing 100  -> R is interviewed and does NOT pass (same ratings)
#       V2  Store Crew copy, A20/B80/C0,  passing 100  -> R reuses the V1b ratings: 76.67, does not pass
#       V3  Cashier copy,    A40/B40/C20, passing  75  -> R reuses again: source is still the V1b interview (TC-84)
#     Why V1b: a passed application is ongoing (BR-17), so P cannot apply to V2. The reuse chain runs on R,
#     whose own interview (V1b) fails; R is freed and can apply again.
#   - P and R upload ResumePath, confirm the parsed profile ("S14 Test P/R"), apply as Experienced.
#   - R ends with failed outcomes at Company 2 and Company 3 (company block, BR-19): throwaways only.
# No SQL is run by this script. Clean up afterwards with supabase/scripts/delete-check-vacancies.sql.

param(
  [Parameter(Mandatory = $true)] [string]$HrEmail,
  [Parameter(Mandatory = $true)] [string]$ApplicantPEmail,
  [Parameter(Mandatory = $true)] [string]$ApplicantREmail,
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

# The applicant's own application for one vacancy (from their status panel API).
function My-Application([string]$Token, [string]$VacancyId) {
  $r = Req Get "/api/applicant/applications" $Token
  return [pscustomobject]@{ Response = $r; Row = (@($r.Json.data) | Where-Object { $_.vacancyId -eq $VacancyId } | Select-Object -First 1) }
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

# Non-prescreen fields: the parsed value if present, else a visible test value.
$TestValues = [ordered]@{
  addressLine = "S14 Test Street"; city = "Quezon City"; province = "Metro Manila"; contactNumber = "09170000000"
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

# ---------------------------------------------------------------- scores
function Same($a, $b) { return ($null -ne $a -and $null -ne $b -and [math]::Abs([double]$a - [double]$b) -lt 0.001) }

# The JS values from packages/shared/src/scoring.js (scoreEvaluation), through scripts/check-s14-score.mjs.
function Js-Score($RatingsBySection, $Weights, $Matching, $Passing) {
  $env:S14_SCORE_INPUT = (@{
    ratingsBySection = $RatingsBySection; sectionWeights = $Weights
    matchingScore = [double]$Matching; passingScore = [double]$Passing
  } | ConvertTo-Json -Compress -Depth 5)
  try { $out = & node scripts/check-s14-score.mjs } finally { Remove-Item Env:S14_SCORE_INPUT -ErrorAction SilentlyContinue }
  if ($LASTEXITCODE -ne 0 -or -not $out) { Stop-Check "node scripts/check-s14-score.mjs failed." }
  return ($out | ConvertFrom-Json)
}

# Stored values (API response = database RETURNING / re-read) against the JS values, one check per column.
function Check-Scores([string]$Label, $Got, $Js) {
  $okSections = (Same $Got.sectionScores.A $Js.sectionScores.A) -and (Same $Got.sectionScores.B $Js.sectionScores.B) -and (Same $Got.sectionScores.C $Js.sectionScores.C)
  Check "$Label section scores = JS (A $($Js.sectionScores.A), B $($Js.sectionScores.B), C $($Js.sectionScores.C))" $okSections `
    "got A $($Got.sectionScores.A), B $($Got.sectionScores.B), C $($Got.sectionScores.C)"
  Check "$Label interview score = JS ($($Js.interviewScore))" (Same $Got.interviewScore $Js.interviewScore) "got $($Got.interviewScore)"
  Check "$Label overall rating (generated column) = JS ($($Js.overallRating))" ([int]$Got.overallRating -eq [int]$Js.overallRating) "got $($Got.overallRating)"
  Check "$Label final score (generated column) = JS ($($Js.finalScore))" (Same $Got.finalScore $Js.finalScore) "got $($Got.finalScore)"
  Check "$Label passed (generated column) = JS ($($Js.passed))" ([bool]$Got.passed -eq [bool]$Js.passed) "got $($Got.passed)"
}

# ---------------------------------------------------------------- setup
Write-Host "`n== S14 Evaluation and scores check ==`n"

$emails = @($HrEmail, $ApplicantPEmail, $ApplicantREmail) | ForEach-Object { $_.Trim().ToLowerInvariant() }
if ($emails -contains "juan@vera.test") { Stop-Check "juan@vera.test is never used by this check. Pass two throwaway applicants." }
if (@($emails | Sort-Object -Unique).Count -ne 3) { Stop-Check "HR, P, and R must be three different accounts." }

if (-not (Test-Path $EnvFile)) { Stop-Check "Run this from the repo root ($EnvFile not found)." }
if (-not (Test-Path "scripts/check-s14-score.mjs")) { Stop-Check "scripts/check-s14-score.mjs not found (run from the repo root)." }
if (-not (Test-Path $ResumePath)) { Stop-Check "ResumePath not found: $ResumePath" }
$resumeFile = (Resolve-Path $ResumePath).Path
$envLines    = Get-Content $EnvFile
$supabaseUrl = Get-EnvValue $envLines '^VITE_SUPABASE_URL='
$publishable = Get-EnvValue $envLines '^VITE_SUPABASE_(PUBLISHABLE|ANON)_KEY='
if (-not $supabaseUrl -or $publishable.Length -lt 30) { Stop-Check "Could not read VITE_SUPABASE_URL / publishable key from $EnvFile." }

# The scoring helper must reproduce the worked example before anything is compared with it.
$Worked = @{ A = @(5, 4, 4); B = @(4, 4, 4, 4, 5, 4, 3, 4, 4); C = @(4, 4, 4) }
$W1 = @{ A = 30; B = 30; C = 40 }
$W2 = @{ A = 20; B = 80; C = 0 }
$W3 = @{ A = 40; B = 40; C = 20 }
$probe = Js-Score $Worked $W1 79.31 75
Check "JS helper reproduces the worked example (77.50 / 4 / 78.41)" ((Same $probe.interviewScore 77.5) -and [int]$probe.overallRating -eq 4 -and (Same $probe.finalScore 78.41)) ($probe | ConvertTo-Json -Compress)
if (-not (Same $probe.finalScore 78.41)) { Stop-Check "The JS helper does not give the worked example." }

$r = Req Get "/api/health" $null
$healthy = $r.Status -eq 200 -and $r.Json.data.db -eq "up"
Check "API health (db up)" $healthy "status $($r.Status): $($r.Raw)"
if (-not $healthy) { Stop-Check "Start pnpm dev first." }

$hrTok = Login $HrEmail
$pTok  = Login $ApplicantPEmail
$rTok  = Login $ApplicantREmail
Check "Supabase logins (HR, P, R)" ([bool]$hrTok -and [bool]$pTok -and [bool]$rTok)

$me = (Req Get "/api/me" $hrTok).Json.data
if ($me.role -ne "hr" -and $me.role -ne "admin") { Stop-Check "$HrEmail is not an HR/admin account." }
$hrUserId = $me.userId

# ---------------------------------------------------------------- 1. pre-checks (nothing changes yet)
foreach ($x in @(@{ Key = "P"; Email = $ApplicantPEmail; Token = $pTok }, @{ Key = "R"; Email = $ApplicantREmail; Token = $rTok })) {
  $m = (Req Get "/api/me" $x.Token).Json.data
  if ($m.role -ne "applicant") { Stop-Check "$($x.Email) is not an applicant account." }
  if ($m.hasProfile) { Stop-Check "$($x.Email) already has a profile. Use a fresh throwaway (seed:applicant)." }
  if (@((Req Get "/api/applicant/applications" $x.Token).Json.data | Where-Object { $_ }).Count -ne 0) { Stop-Check "$($x.Email) already has applications." }
}

# The active rubric: 3 sections, A 3 / B 9 / C 3 items (ids for the ratings).
$rubric = @((Req Get "/api/admin/competencies" $hrTok).Json.data)
$counts = ($rubric | ForEach-Object { "$($_.sectionCode) $(@($_.items).Count)" }) -join " / "
Check "Rubric is A 3 / B 9 / C 3" ($counts -eq "A 3 / B 9 / C 3") "got $counts"
if ($counts -ne "A 3 / B 9 / C 3") { Stop-Check "Unexpected Competency Profile rubric." }

function Ratings-Body($BySection) {
  $list = @()
  foreach ($section in $rubric) {
    $values = $BySection[$section.sectionCode]
    $i = 0
    foreach ($item in @($section.items)) { $list += @{ competencyId = $item.competencyId; rating = [int]$values[$i] }; $i++ }
  }
  return $list
}
$workedBody = Ratings-Body $Worked

$ts = (Get-Date).ToString("yyyyMMdd-HHmmss")
Write-Host "`nNext steps create 4 companies and 4 published vacancies named 'ZZ Check S14 $ts ...', and change P and R permanently:" -ForegroundColor Yellow
Write-Host "  P passes V1 (ongoing until S15/S16); R does NOT pass V1b and V2 (company block at Company 2 and 3), then reuses at V3." -ForegroundColor Yellow
$answer = Read-Host "Type S14 to continue"
if ($answer -ne "S14") { Write-Host "Stopped before changing anything." -ForegroundColor Yellow; exit 1 }

# ---------------------------------------------------------------- 2. test companies and vacancies (admin API)
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
    companyName = "ZZ Check S14 $ts Company $No"; industry = "Check script (delete me)"; description = $null; website = $null
    contactPersonName = "ZZ Check"; contactPersonPosition = $null; contactEmail = "zz-check-s14@example.com"; contactNumber = $null
  }
  $r = Req Post "/api/admin/companies" $hrTok $body
  if ($r.Status -ne 201) { Stop-Check "Create company $No -> $($r.Status): $($r.Raw)" }
  return $r.Json.data
}

function New-Vacancy([string]$Name, $Company, $Text, $Weights, [double]$Passing) {
  $body = @{
    companyId = $Company.companyId; jobTitle = "ZZ Check S14 $ts $Name"
    jobDescription = $Text.jobDescription; keyResponsibilities = $Text.keyResponsibilities
    requiredSkills = $Text.requiredSkills; experienceRequirement = $Text.experienceRequirement
    minYearsExperience = $Text.minYearsExperience; minAge = 18; maxAge = 35; genderRequirement = "any"
    minEducationLevel = "senior_high"; minHeightCm = 150; deploymentLocation = "Check only"; employmentType = "Full-time"
    slotsNeeded = 1; applicationCap = 8; endorsementCount = 1; matchingThreshold = 40; passingScore = $Passing
    sectionWeights = @(
      @{ sectionCode = "A"; weight = $Weights.A }, @{ sectionCode = "B"; weight = $Weights.B }, @{ sectionCode = "C"; weight = $Weights.C }
    )
  }
  $r = Req Post "/api/admin/vacancies" $hrTok $body
  if ($r.Status -ne 201) { Stop-Check "Create vacancy $Name -> $($r.Status): $($r.Raw)" }
  $v = $r.Json.data
  $r = Req Post "/api/admin/vacancies/$($v.vacancyId)/publish" $hrTok @{}
  if ($r.Status -ne 200) { Stop-Check "Publish vacancy $Name -> $($r.Status): $($r.Raw)" }
  $v = (Req Get "/api/admin/vacancies/$($v.vacancyId)" $hrTok).Json.data
  Check "Vacancy $Name created and open (A$($Weights.A)/B$($Weights.B)/C$($Weights.C), passing $Passing)" ($v.status -eq "open") "got $($v.status)"
  return $v
}

$c1 = New-Company 1; $c2 = New-Company 2; $c3 = New-Company 3; $c4 = New-Company 4
$v1  = New-Vacancy "V1"  $c1 $CashierText   $W1 75
$v1b = New-Vacancy "V1b" $c2 $CashierText   $W1 100
$v2  = New-Vacancy "V2"  $c3 $StoreCrewText $W2 100
$v3  = New-Vacancy "V3"  $c4 $CashierText   $W3 75
Info "V1 $($v1.vacancyId) | V1b $($v1b.vacancyId) | V2 $($v2.vacancyId) | V3 $($v3.vacancyId)"

# ---------------------------------------------------------------- 3. P and R: upload, confirm profile
foreach ($x in @(@{ Key = "P"; Token = $pTok }, @{ Key = "R"; Token = $rTok })) {
  $r = Upload-Resume $x.Token $resumeFile
  if ($r.Status -ne 200) { Stop-Check "Resume upload for $($x.Key) -> $($r.Status): $($r.Raw)" }
  $p = $r.Json.data.profile
  $problem = Profile-Problem $p $v1
  if ($problem) { Stop-Check "Parsed profile for $($x.Key): $problem. Use a resume that passes the Cashier prescreen." }
  $fill = Fill-Profile $p
  if ($fill.Filled.Count -gt 0) { Info "$($x.Key): filled test values for $($fill.Filled -join ', ') (not prescreen fields)" }
  $body = @{
    firstName = "S14 Test"; middleName = $null; lastName = $x.Key; suffix = $null
    contactNumber = $fill.Values.contactNumber; birthdate = $p.birthdate; gender = $p.gender; heightCm = $p.heightCm
    addressLine = $fill.Values.addressLine; city = $fill.Values.city; province = $fill.Values.province
    educationLevel = $p.educationLevel
  }
  $r = Req Post "/api/applicant/profile/confirm" $x.Token $body
  if ($r.Status -ne 201) { Stop-Check "Profile confirm for $($x.Key) -> $($r.Status): $($r.Json.error.message)" }
  Check "Profile confirmed: S14 Test $($x.Key)" $true
}

# Applies, expects shortlisted (fresh vacancy, quota 2 per group), verifies the resume once (it carries over).
function Apply-Shortlisted([string]$Key, [string]$Token, $Vacancy) {
  $r = Req Post "/api/applicant/applications" $Token @{ vacancyId = $Vacancy.vacancyId; applicantType = "experienced" }
  Check "$Key applies to $($Vacancy.jobTitle) -> 201" ($r.Status -eq 201) "got $($r.Status): $($r.Raw)"
  if ($r.Status -ne 201) { Stop-Check "Apply failed for $Key." }
  Check-NoLeaks "apply response ($Key, $($Vacancy.jobTitle))" $r.Json
  $appId = $r.Json.data.applicationId
  $status = (My-Application $Token $Vacancy.vacancyId).Row.status
  Check "$Key shortlisted at $($Vacancy.jobTitle)" ($status -eq "shortlisted") "got $status"
  if ($status -ne "shortlisted") { Stop-Check "$Key is not shortlisted (below the threshold?)." }
  return $appId
}

function Sheet([string]$AppId) { return (Req Get "/api/admin/applications/$AppId" $hrTok).Json.data }

function Verify-Resume([string]$Key, [string]$AppId) {
  $s = Sheet $AppId
  if ($s.resume.verificationStatus -ne "verified") {
    $r = Req Patch "/api/admin/resumes/$($s.resume.resumeId)/verification" $hrTok @{ status = "verified"; applicationId = $AppId }
    Check "Verify $Key's resume -> 200" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"
  }
  $s = Sheet $AppId
  Check "$Key fully verified" ($s.fullyVerified -eq $true) "documents: $(@($s.documents).Count), requests: $(@($s.requests).Count)"
  return $s
}

# ---------------------------------------------------------------- 4. apply, verify, reuse without a source
$pApp  = Apply-Shortlisted "P" $pTok $v1
$rApp1 = Apply-Shortlisted "R" $rTok $v1b
$pSheet = Verify-Resume "P" $pApp
$rSheet = Verify-Resume "R" $rApp1
Check "P nextStep = schedule_interview (no earlier evaluation)" ($pSheet.nextStep -eq "schedule_interview") "got $($pSheet.nextStep)"
$pMatching = [double]$pSheet.matching.matchingScore
$rMatching1 = [double]$rSheet.matching.matchingScore
Info "Stored matching: P at V1 $pMatching, R at V1b $rMatching1"

$r = Req Post "/api/admin/applications/$pApp/evaluation/reuse" $hrTok @{}
Check "Reuse for P with no earlier evaluation -> 422" ($r.Status -eq 422) "got $($r.Status): $($r.Raw)"
Check "422 message names the missing evaluation" ("$($r.Json.error.message)" -eq "This applicant has no earlier evaluation. Schedule an interview instead.") "$($r.Json.error.message)"
$r = Req Post "/api/admin/applications/$pApp/evaluation" $hrTok @{ ratings = $workedBody }
Check "Evaluate P while still shortlisted -> 409" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"

# ---------------------------------------------------------------- 5. schedule both at now + 90 s, confirm
$scheduledUtc = Whole-Seconds ([datetime]::UtcNow.AddSeconds(90))
$link = "https://meet.google.com/s14-check-link"
$interviews = @{}
foreach ($x in @(@{ Key = "P"; App = $pApp; Token = $pTok }, @{ Key = "R"; App = $rApp1; Token = $rTok })) {
  $r = Req Post "/api/admin/interviews" $hrTok @{ applicationId = $x.App; scheduledAt = (Manila-Iso $scheduledUtc); durationMinutes = 30; meetingLink = $link; interviewerId = $hrUserId }
  Check "Schedule $($x.Key) at now + 90 s -> 201" ($r.Status -eq 201) "got $($r.Status): $($r.Raw)"
  if ($r.Status -ne 201) { Stop-Check "Scheduling failed for $($x.Key)." }
  $interviews[$x.Key] = $r.Json.data.interviewId
  $r = Req Post "/api/applicant/interviews/$($r.Json.data.interviewId)/confirm" $x.Token
  Check "$($x.Key) confirms -> 200" ($r.Status -eq 200 -and $r.Json.data.applicationStatus -eq "interview_confirmed") "got $($r.Status): $($r.Raw)"
}
Info "Interviews at $(Manila-Iso $scheduledUtc): P $($interviews.P), R $($interviews.R)"

$r = Req Post "/api/admin/applications/$pApp/evaluation" $hrTok @{ ratings = $workedBody }
Check "Evaluate P before the interview time -> 409" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"
Check "409 message: The interview has not started yet." ("$($r.Json.error.message)" -eq "The interview has not started yet.") "$($r.Json.error.message)"
$page = (Req Get "/api/admin/applications/$pApp/evaluation" $hrTok).Json.data
Check "Evaluation page before the time: canEvaluate false with the reason" ($page.canEvaluate -eq $false -and $page.blockedReason -eq "The interview has not started yet.") "$($page.canEvaluate) / $($page.blockedReason)"
$r = Req Post "/api/admin/applications/$pApp/evaluation" $pTok @{ ratings = $workedBody }
Check "Applicant token on the evaluation route -> 403" ($r.Status -eq 403) "got $($r.Status)"

$target = $scheduledUtc.AddSeconds(5)
while ([datetime]::UtcNow -lt $target) {
  $left = [int][Math]::Ceiling(($target - [datetime]::UtcNow).TotalSeconds)
  Write-Host -NoNewline ("`rWaiting for the interview time to pass: {0,4} s " -f $left)
  Start-Sleep -Seconds 1
}
Write-Host ""

# ---------------------------------------------------------------- 6. P: missing rating, pass, double evaluate
$missing = @($workedBody | Select-Object -Skip 1)
$r = Req Post "/api/admin/applications/$pApp/evaluation" $hrTok @{ ratings = $missing }
Check "Evaluate P with 14 ratings -> 400 (TC-49)" ($r.Status -eq 400) "got $($r.Status): $($r.Raw)"
$page = (Req Get "/api/admin/applications/$pApp/evaluation" $hrTok).Json.data
Check "Nothing written: no evaluation, still interview_confirmed, can evaluate" ($null -eq $page.evaluation -and $page.application.status -eq "interview_confirmed" -and $page.canEvaluate -eq $true) "evaluation $($page.evaluation), status $($page.application.status), canEvaluate $($page.canEvaluate)"
$sectionList = (@($page.sections) | ForEach-Object { "$($_.sectionCode)$($_.weight)" }) -join ","
Check "Evaluation page: sections A/B/C with weights 30/30/40" ($sectionList -eq "A30,B30,C40") "got $sectionList"

$jsP = Js-Score $Worked $W1 $pMatching 75
$r = Req Post "/api/admin/applications/$pApp/evaluation" $hrTok @{ ratings = $workedBody }
Check "Evaluate P (worked example) after the start time -> 201" ($r.Status -eq 201) "got $($r.Status): $($r.Raw)"
$e = $r.Json.data
Check "Worked example values: 83.33 / 75 / 75, interview 77.50, overall 4 (TC-48)" `
  ((Same $e.sectionScores.A 83.33) -and (Same $e.sectionScores.B 75) -and (Same $e.sectionScores.C 75) -and (Same $e.interviewScore 77.5) -and [int]$e.overallRating -eq 4) ($r.Raw)
Check "Stored matching = the application's matching score ($pMatching)" (Same $e.matchingScore $pMatching) "got $($e.matchingScore)"
Check-Scores "P POST response" $e $jsP
Check "P passed (status passed), source = itself, attempt completed" ($e.status -eq "passed" -and $e.ratingsSourceApplicationId -eq $pApp -and $e.reused -eq $false -and $e.interviewStatus -eq "completed") ($r.Raw)
$page = (Req Get "/api/admin/applications/$pApp/evaluation" $hrTok).Json.data
Check-Scores "P re-read" $page.evaluation $jsP
Check "P re-read: 15 ratings stored" (@($page.evaluation.ratings).Count -eq 15) "got $(@($page.evaluation.ratings).Count)"
$r = Req Get "/api/admin/interviews?vacancyId=$($v1.vacancyId)" $hrTok
Check "P's completed interview left the open-interviews list" (@(@($r.Json.data) | Where-Object { $_.interviewId -eq $interviews.P }).Count -eq 0) ""
$r = Req Post "/api/admin/applications/$pApp/evaluation" $hrTok @{ ratings = $workedBody }
Check "Evaluate P again -> 409" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"
$d = My-Application $pTok $v1.vacancyId
Check "P's status panel: passed" ($d.Row.status -eq "passed") "got $($d.Row.status)"
Check-NoLeaks "P GET /api/applicant/applications" $d.Response.Json
Check "P got no evaluation_did_not_pass notice" ((My-Notifications $pTok "evaluation_did_not_pass").Rows.Count -eq 0) ""

# ---------------------------------------------------------------- 7. R: does not pass V1b (pool, notice, company block)
$jsR1 = Js-Score $Worked $W1 $rMatching1 100
$r = Req Post "/api/admin/applications/$rApp1/evaluation" $hrTok @{ ratings = $workedBody }
Check "Evaluate R at V1b (passing 100) -> 201" ($r.Status -eq 201) "got $($r.Status): $($r.Raw)"
$e = $r.Json.data
Check-Scores "R V1b POST response" $e $jsR1
Check "R did_not_pass (TC-51)" ($e.status -eq "did_not_pass" -and $e.passed -eq $false) ($r.Raw)
$d = My-Application $rTok $v1b.vacancyId
Check "R's status panel: did_not_pass" ($d.Row.status -eq "did_not_pass") "got $($d.Row.status)"
Check-NoLeaks "R GET /api/applicant/applications" $d.Response.Json
$n = My-Notifications $rTok "evaluation_did_not_pass"
Check "R got evaluation_did_not_pass" ($n.Rows.Count -ge 1) ""
if ($n.Rows.Count -ge 1) {
  $text = "$($n.Rows[0].title) $($n.Rows[0].message)"
  Check "Notice title: Application update: $($v1b.jobTitle)" ("$($n.Rows[0].title)" -eq "Application update: $($v1b.jobTitle)") "$($n.Rows[0].title)"
  Check "Notice is neutral and says 'You can apply to other jobs.'" ($text -match "was not successful this time" -and $text -match "You can apply to other jobs\.") $text
  Check "Notice has no company, score, rating, or reason" ($text -notmatch "(?i)company|score|rating|passing|selected|interview|\d+\.\d\d" -and $text -notmatch [regex]::Escape($c2.companyName)) $text
}
$r = Req Get "/api/applicant/vacancies/$($v1b.vacancyId)" $rTok
Check "R gets 404 on V1b (company block, BR-19)" ($r.Status -eq 404) "got $($r.Status)"
$r = Req Get "/api/applicant/vacancies?pageSize=100" $rTok
Check "V1b missing from R's job list" (@(@($r.Json.data) | Where-Object { $_.vacancyId -eq $v1b.vacancyId }).Count -eq 0) ""
$r = Req Get "/api/applicant/vacancies/$($v1b.vacancyId)" $pTok
Check "P still sees V1b (no block for P)" ($r.Status -eq 200) "got $($r.Status)"

# ---------------------------------------------------------------- 8. R: reuse at V2 (TC-78), twice -> 409
$rApp2 = Apply-Shortlisted "R" $rTok $v2
$s = Sheet $rApp2
Check "R at V2: fully verified (resume verification carries over)" ($s.fullyVerified -eq $true) ""
Check "R at V2: nextStep reuse_ratings, ratings on file from the V1b interview" ($s.nextStep -eq "reuse_ratings" -and $s.reusableEvaluation.sourceApplicationId -eq $rApp1) "nextStep $($s.nextStep), source $($s.reusableEvaluation.sourceApplicationId)"
$rMatching2 = [double]$s.matching.matchingScore
$r = Req Post "/api/admin/applications/$($rApp2)/evaluation" $hrTok @{ ratings = $workedBody }
Check "Evaluate (rate) R at V2 instead of reuse -> 409 (no interview)" ($r.Status -eq 409) "got $($r.Status)"
$jsR2 = Js-Score $Worked $W2 $rMatching2 100
$r = Req Post "/api/admin/applications/$rApp2/evaluation/reuse" $hrTok @{}
Check "Reuse R at V2 -> 201" ($r.Status -eq 201) "got $($r.Status): $($r.Raw)"
$e = $r.Json.data
Check "Reuse interview score 76.67 (A20/B80/C0, TC-78)" (Same $e.interviewScore 76.67) "got $($e.interviewScore)"
Check-Scores "R V2 reuse response" $e $jsR2
Check "R V2: source = R's V1b application, reused, did_not_pass (passing 100)" ($e.ratingsSourceApplicationId -eq $rApp1 -and $e.reused -eq $true -and $e.status -eq "did_not_pass") ($r.Raw)
$page = (Req Get "/api/admin/applications/$rApp2/evaluation" $hrTok).Json.data
Check-Scores "R V2 re-read" $page.evaluation $jsR2
Check "R V2 page: reused, source V1b, the 15 original ratings read-only, cannot evaluate" `
  ($page.evaluation.reused -eq $true -and $page.evaluation.source.applicationId -eq $rApp1 -and @($page.evaluation.ratings).Count -eq 15 -and $page.canEvaluate -eq $false) ""
$r = Req Post "/api/admin/applications/$rApp2/evaluation/reuse" $hrTok @{}
Check "Reuse R at V2 again -> 409" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"
$r = Req Get "/api/applicant/vacancies/$($v2.vacancyId)" $rTok
Check "R gets 404 on V2 now (company block)" ($r.Status -eq 404) "got $($r.Status)"

# ---------------------------------------------------------------- 9. R: reuse at V3 -> still the V1b interview (TC-84)
$rApp3 = Apply-Shortlisted "R" $rTok $v3
$s = Sheet $rApp3
Check "R at V3: ratings on file still from the V1b interview (not the V2 reuse)" ($s.reusableEvaluation.sourceApplicationId -eq $rApp1) "got $($s.reusableEvaluation.sourceApplicationId)"
$rMatching3 = [double]$s.matching.matchingScore
$jsR3 = Js-Score $Worked $W3 $rMatching3 75
$r = Req Post "/api/admin/applications/$rApp3/evaluation/reuse" $hrTok @{}
Check "Reuse R at V3 -> 201" ($r.Status -eq 201) "got $($r.Status): $($r.Raw)"
$e = $r.Json.data
Check-Scores "R V3 reuse response" $e $jsR3
Check "R V3: source = R's V1b application (TC-84)" ($e.ratingsSourceApplicationId -eq $rApp1) "got $($e.ratingsSourceApplicationId)"
$expected3 = "did_not_pass"; if ($jsR3.passed) { $expected3 = "passed" }
Check "R V3 status = $expected3 (from the JS pass rule)" ($e.status -eq $expected3) "got $($e.status)"
$d = My-Application $rTok $v3.vacancyId
Check-NoLeaks "R GET /api/applicant/applications (after reuse)" $d.Response.Json

# ---------------------------------------------------------------- summary
$color = "Green"; if ($script:Fail -gt 0) { $color = "Red" }
Write-Host "`n== $($script:Pass) passed, $($script:Fail) failed ==" -ForegroundColor $color

$allApps = "'$pApp', '$rApp1', '$rApp2', '$rApp3'"
$poolExpect = "R: V1b entry closed (removed_at set) and V2 entry ACTIVE (V3 passed, so no new entry)."
if (-not $jsR3.passed) { $poolExpect = "R: V1b and V2 entries closed, V3 entry ACTIVE (reason did_not_pass)." }
Write-Host @"

Now run these in the Supabase SQL editor (read-only):

  -- 1. ratings: 15 per interviewed application, rated_by = the HR user, linked to the attempt; none for reuses
  select application_id, count(*) as ratings, min(rating) as min_r, max(rating) as max_r,
         count(distinct rated_by) as raters, min(rated_by::text) as rated_by, count(interview_schedule_id) as with_attempt
  from competency_rating where application_id in ($allApps) group by application_id;

  -- 2. final evaluations (generated columns final_score, passed, overall_rating)
  select application_id, matching_score, interview_score, final_score, passing_score, passed, overall_rating,
         section_scores, ratings_source_application_id, computed_by
  from final_evaluation where application_id in ($allApps) order by computed_at;

  -- 3. status history with actors
  select h.application_id, h.from_status, h.to_status, h.reason, h.changed_by, u.role as changed_by_role, h.changed_at
  from application_status_history h left join user_account u on u.user_account_id = h.changed_by
  where h.application_id in ($allApps) order by h.changed_at;

  -- 4. interview attempts
  select application_id, status, attempt_number, scheduled_at, confirmed_at from interview_schedule
  where application_id in ('$pApp', '$rApp1');

  -- 5. applicant pool rows of R
  select source_application_id, pool_reason, availability, added_at, removed_at from talent_pool
  where source_application_id in ($allApps) order by added_at;

  -- 6. the unique constraints the API maps to 409
  select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
  from pg_constraint where contype = 'u'
    and conrelid in ('public.final_evaluation'::regclass, 'public.competency_rating'::regclass);

Expect (P = $pApp, R V1b = $rApp1, R V2 = $rApp2, R V3 = $rApp3, HR = $hrUserId):
  1. P and R V1b: 15 ratings each, min 3, max 5, raters 1, rated_by = HR, with_attempt 15. No rows for R V2 / R V3.
  2. P: interview 77.50, final $($jsP.finalScore), passed true, overall 4, source = P.
     R V1b: interview 77.50, final $($jsR1.finalScore), passing 100, passed false, source = R V1b.
     R V2: interview 76.67, final $($jsR2.finalScore), passed false, source = R V1b.
     R V3: interview $($jsR3.interviewScore), final $($jsR3.finalScore), passed $($jsR3.passed), source = R V1b.
     section_scores {"A": 83.33, "B": 75, "C": 75} on all four; computed_by = HR.
  3. interview_confirmed -> passed (P) / -> did_not_pass (R V1b) and shortlisted -> did_not_pass / passed (R V2, R V3):
     changed_by = HR, reasons 'Interview evaluated' / 'Reused ratings (BR-21)'.
  4. Both attempts: status completed, attempt_number 1, confirmed_at set.
  5. $poolExpect
  6. final_evaluation_application_id_key UNIQUE (application_id) and
     competency_rating_application_id_competency_id_key UNIQUE (application_id, competency_id).

Clean up afterwards (deletes only vacancies titled 'ZZ Check%' and their rows, then the empty 'ZZ Check' companies):
  run supabase/scripts/delete-check-vacancies.sql in the Supabase SQL editor.
"@

if ($script:Fail -gt 0) { exit 1 }
