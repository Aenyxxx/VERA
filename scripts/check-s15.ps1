# S15 Ranking, Notify, and close-out backend check (Windows PowerShell 5.1 compatible, ASCII only)
# Usage, from the repo root, with `pnpm dev` running (api + svc) AFTER the S15 migration was applied:
#   powershell -ExecutionPolicy Bypass -File scripts/check-s15.ps1 -HrEmail <hr email> `
#     -ApplicantAEmail <a> -ApplicantBEmail <b> -ApplicantCEmail <c> -ApplicantDEmail <d> `
#     -ApplicantEEmail <e> -ApplicantFEmail <f> -ApplicantGEmail <g> -ResumePath <text PDF>
# All parameters are required (no default accounts); passwords are prompted and never stored.
#
# Before running:
#   - Apply supabase/migrations/20261010000000_application_source_rematch.sql and
#     supabase/migrations/20261010010000_close_out_values.sql in the Supabase SQL Editor, then restart `pnpm dev`
#     (the script asks you to confirm the pg_enum query below; it never reads the database).
#   - Create SEVEN fresh throwaway applicants (no profile yet): pnpm --filter api seed:applicant -- --email <email>
#   - ResumePath is a text-based English PDF whose parsed profile passes the Cashier prescreen (ages 18-35,
#     senior high, 150 cm) and clears a matching threshold of 40 (the demo resume does).
#   - node is on PATH (the expected ranking order comes from apps/api/src/domain/ranking.js via
#     scripts/check-s15-rank.mjs).
#
# What it creates (never Cashier, Store Crew, or juan@vera.test):
#   - Companies "ZZ Check S15 <ts> Company 1 / 2" and published vacancies:
#       VR  @Company 1  Cashier copy, slots 1, endorsement 2, passing 50 -> ranking + Notify (A, B experienced; C first-time)
#       VR2 @Company 1  Cashier copy, open                              -> B (declined = archived) can still apply here (BR-15)
#       VC  @Company 2  Cashier copy, slots 1, endorsement 1, passing 50 -> close-out (D passed, E locked shortlisted,
#                                                                         F waiting pool, G interview scheduled)
#       VX  @Company 2  Store Crew copy, open                           -> D (standby) and E (not_selected) apply here:
#                                                                         free (BR-17) and no company block (BR-19)
#   - A confirms (for_endorsement), B declines (archived), C is notified later (stays awaiting confirmation).
#   - VC is closed, then ARCHIVED: D -> standby, E/F/G -> not_selected (neutral; applicant pool).
# No SQL is run by this script. Clean up afterwards with supabase/scripts/delete-check-vacancies.sql.

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
  addressLine = "S15 Test Street"; city = "Quezon City"; province = "Metro Manila"; contactNumber = "09170000000"
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

function Same($a, $b) { return ($null -ne $a -and $null -ne $b -and [math]::Abs([double]$a - [double]$b) -lt 0.001) }

# The JS RANK-03 order of the given rows (apps/api/src/domain/ranking.js via scripts/check-s15-rank.mjs).
function Js-RankOrder($Rows) {
  $list = @($Rows | ForEach-Object {
    @{ applicationId = $_.applicationId; finalScore = [double]$_.finalScore; matchingScore = [double]$_.matchingScore; appliedAt = "$($_.appliedAt)" }
  })
  $env:S15_RANK_INPUT = (ConvertTo-Json -InputObject $list -Compress -Depth 4)
  try { $out = & node scripts/check-s15-rank.mjs } finally { Remove-Item Env:S15_RANK_INPUT -ErrorAction SilentlyContinue }
  if ($LASTEXITCODE -ne 0 -or -not $out) { Stop-Check "node scripts/check-s15-rank.mjs failed." }
  return @($out | ConvertFrom-Json)
}

# ---------------------------------------------------------------- setup
Write-Host "`n== S15 Ranking, Notify, and close-out check ==`n"

$keys = @("A", "B", "C", "D", "E", "F", "G")
$emailOf = @{ A = $ApplicantAEmail; B = $ApplicantBEmail; C = $ApplicantCEmail; D = $ApplicantDEmail; E = $ApplicantEEmail; F = $ApplicantFEmail; G = $ApplicantGEmail }
$emails = @($HrEmail) + @($keys | ForEach-Object { $emailOf[$_] }) | ForEach-Object { $_.Trim().ToLowerInvariant() }
if ($emails -contains "juan@vera.test") { Stop-Check "juan@vera.test is never used by this check. Pass seven throwaway applicants." }
if (@($emails | Sort-Object -Unique).Count -ne 8) { Stop-Check "HR and the seven applicants must be eight different accounts." }

if (-not (Test-Path $EnvFile)) { Stop-Check "Run this from the repo root ($EnvFile not found)." }
if (-not (Test-Path "scripts/check-s15-rank.mjs")) { Stop-Check "scripts/check-s15-rank.mjs not found (run from the repo root)." }
if (-not (Test-Path $ResumePath)) { Stop-Check "ResumePath not found: $ResumePath" }
$resumeFile = (Resolve-Path $ResumePath).Path
$envLines    = Get-Content $EnvFile
$supabaseUrl = Get-EnvValue $envLines '^VITE_SUPABASE_URL='
$publishable = Get-EnvValue $envLines '^VITE_SUPABASE_(PUBLISHABLE|ANON)_KEY='
if (-not $supabaseUrl -or $publishable.Length -lt 30) { Stop-Check "Could not read VITE_SUPABASE_URL / publishable key from $EnvFile." }

# The migration pre-check (manual: this script never reads the database).
Write-Host @"

Pre-check: run this in the Supabase SQL Editor (read-only):

  select t.typname, v.value, exists (
           select 1 from pg_enum e where e.enumtypid = t.oid and e.enumlabel = v.value) as present
  from (values ('application_source', 'rematch'), ('application_status', 'not_selected'),
               ('pool_reason', 'not_selected'), ('pool_reason', 'standby'),
               ('interview_status', 'cancelled')) as v (typname, value)
  join pg_type t on t.typname = v.typname and t.typnamespace = 'public'::regnamespace
  order by t.typname, v.value;

Expect 5 rows, every one with present = true. If any is false, apply
supabase/migrations/20261010000000_application_source_rematch.sql and
supabase/migrations/20261010010000_close_out_values.sql first, then restart pnpm dev.
"@ -ForegroundColor Yellow
$answer = Read-Host "Type VALUES if all 5 rows are present = true"
if ($answer -ne "VALUES") { Write-Host "Stopped: apply the S15 migrations first." -ForegroundColor Yellow; exit 1 }

# The ranking helper must reproduce RANK-03's tie-breaks before anything is compared with it.
$probe = Js-RankOrder @(
  [pscustomobject]@{ applicationId = "a"; finalScore = 78.34; matchingScore = 76.67; appliedAt = "2026-10-10T01:00:00Z" },
  [pscustomobject]@{ applicationId = "b"; finalScore = 78.34; matchingScore = 80; appliedAt = "2026-10-10T02:00:00Z" },
  [pscustomobject]@{ applicationId = "c"; finalScore = 82.5; matchingScore = 87.5; appliedAt = "2026-10-10T03:00:00Z" }
)
Check "JS ranking helper: final DESC, then matching DESC (c, b, a)" (($probe -join ",") -eq "c,b,a") "got $($probe -join ',')"
if (($probe -join ",") -ne "c,b,a") { Stop-Check "The JS ranking helper does not give RANK-03's order." }

$r = Req Get "/api/health" $null
$healthy = $r.Status -eq 200 -and $r.Json.data.db -eq "up"
Check "API health (db up)" $healthy "status $($r.Status): $($r.Raw)"
if (-not $healthy) { Stop-Check "Start pnpm dev first." }

$hrTok = Login $HrEmail
$tok = @{}
foreach ($k in $keys) { $tok[$k] = Login $emailOf[$k] }
Check "Supabase logins (HR + A..G)" ([bool]$hrTok -and @($keys | Where-Object { -not $tok[$_] }).Count -eq 0)

$me = (Req Get "/api/me" $hrTok).Json.data
if ($me.role -ne "hr" -and $me.role -ne "admin") { Stop-Check "$HrEmail is not an HR/admin account." }
$hrUserId = $me.userId

# ---------------------------------------------------------------- 1. pre-checks (nothing changes yet)
foreach ($k in $keys) {
  $m = (Req Get "/api/me" $tok[$k]).Json.data
  if ($m.role -ne "applicant") { Stop-Check "$($emailOf[$k]) is not an applicant account." }
  if ($m.hasProfile) { Stop-Check "$($emailOf[$k]) already has a profile. Use a fresh throwaway (seed:applicant)." }
  if (@((Req Get "/api/applicant/applications" $tok[$k]).Json.data | Where-Object { $_ }).Count -ne 0) { Stop-Check "$($emailOf[$k]) already has applications." }
}

$rubric = @((Req Get "/api/admin/competencies" $hrTok).Json.data)
$counts = ($rubric | ForEach-Object { "$($_.sectionCode) $(@($_.items).Count)" }) -join " / "
if ($counts -ne "A 3 / B 9 / C 3") { Stop-Check "Unexpected Competency Profile rubric: $counts" }
function Ratings-Body($BySection) {
  $list = @()
  foreach ($section in $rubric) {
    $values = $BySection[$section.sectionCode]
    $i = 0
    foreach ($item in @($section.items)) { $list += @{ competencyId = $item.competencyId; rating = [int]$values[$i] }; $i++ }
  }
  return $list
}
$RatingsOf = @{
  A = Ratings-Body @{ A = @(5, 4, 4); B = @(4, 4, 4, 4, 5, 4, 3, 4, 4); C = @(4, 4, 4) }   # worked example, 77.50
  B = Ratings-Body @{ A = @(5, 4, 4); B = @(5, 5, 5, 4, 4, 4, 4, 4, 4); C = @(4, 4, 4) }   # Juan demo set, 80.00
  C = Ratings-Body @{ A = @(4, 4, 4); B = @(4, 4, 4, 4, 4, 4, 4, 4, 4); C = @(4, 4, 4) }   # all 4s, 75.00
  D = Ratings-Body @{ A = @(5, 4, 4); B = @(4, 4, 4, 4, 5, 4, 3, 4, 4); C = @(4, 4, 4) }
}

$ts = (Get-Date).ToString("yyyyMMdd-HHmmss")
Write-Host "`nNext steps create 2 companies and 4 published vacancies named 'ZZ Check S15 $ts ...' and change A..G permanently." -ForegroundColor Yellow
Write-Host "  A confirms, B declines (archived), C is notified; VC is archived: D standby, E/F/G not_selected." -ForegroundColor Yellow
$answer = Read-Host "Type S15 to continue"
if ($answer -ne "S15") { Write-Host "Stopped before changing anything." -ForegroundColor Yellow; exit 1 }

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
    companyName = "ZZ Check S15 $ts Company $No"; industry = "Check script (delete me)"; description = $null; website = $null
    contactPersonName = "ZZ Check"; contactPersonPosition = $null; contactEmail = "zz-check-s15@example.com"; contactNumber = $null
  }
  $r = Req Post "/api/admin/companies" $hrTok $body
  if ($r.Status -ne 201) { Stop-Check "Create company $No -> $($r.Status): $($r.Raw)" }
  return $r.Json.data
}

function New-Vacancy([string]$Name, $Company, $Text, [int]$Endorsement, [double]$Passing) {
  $body = @{
    companyId = $Company.companyId; jobTitle = "ZZ Check S15 $ts $Name"
    jobDescription = $Text.jobDescription; keyResponsibilities = $Text.keyResponsibilities
    requiredSkills = $Text.requiredSkills; experienceRequirement = $Text.experienceRequirement
    minYearsExperience = $Text.minYearsExperience; minAge = 18; maxAge = 35; genderRequirement = "any"
    minEducationLevel = "senior_high"; minHeightCm = 150; deploymentLocation = "Check only"; employmentType = "Full-time"
    slotsNeeded = 1; applicationCap = 8; endorsementCount = $Endorsement; matchingThreshold = 40; passingScore = $Passing
    sectionWeights = @(@{ sectionCode = "A"; weight = 30 }, @{ sectionCode = "B"; weight = 30 }, @{ sectionCode = "C"; weight = 40 })
  }
  $r = Req Post "/api/admin/vacancies" $hrTok $body
  if ($r.Status -ne 201) { Stop-Check "Create vacancy $Name -> $($r.Status): $($r.Raw)" }
  $v = $r.Json.data
  $r = Req Post "/api/admin/vacancies/$($v.vacancyId)/publish" $hrTok @{}
  if ($r.Status -ne 200) { Stop-Check "Publish vacancy $Name -> $($r.Status): $($r.Raw)" }
  $v = (Req Get "/api/admin/vacancies/$($v.vacancyId)" $hrTok).Json.data
  Check "Vacancy $Name created and open (endorsement $Endorsement, passing $Passing)" ($v.status -eq "open") "got $($v.status)"
  return $v
}

$c1 = New-Company 1; $c2 = New-Company 2
$vr  = New-Vacancy "VR"  $c1 $CashierText   2 50
$vr2 = New-Vacancy "VR2" $c1 $CashierText   1 50
$vc  = New-Vacancy "VC"  $c2 $CashierText   1 50
$vx  = New-Vacancy "VX"  $c2 $StoreCrewText 1 50
Info "VR $($vr.vacancyId) | VR2 $($vr2.vacancyId) | VC $($vc.vacancyId) | VX $($vx.vacancyId)"

# ---------------------------------------------------------------- 3. profiles
foreach ($k in $keys) {
  $r = Upload-Resume $tok[$k] $resumeFile
  if ($r.Status -ne 200) { Stop-Check "Resume upload for $k -> $($r.Status): $($r.Raw)" }
  $p = $r.Json.data.profile
  $problem = Profile-Problem $p $vr
  if ($problem) { Stop-Check "Parsed profile for $($k): $problem. Use a resume that passes the Cashier prescreen." }
  $fill = Fill-Profile $p
  $body = @{
    firstName = "S15 Test"; middleName = $null; lastName = $k; suffix = $null
    contactNumber = $fill.Values.contactNumber; birthdate = $p.birthdate; gender = $p.gender; heightCm = $p.heightCm
    addressLine = $fill.Values.addressLine; city = $fill.Values.city; province = $fill.Values.province
    educationLevel = $p.educationLevel
  }
  $r = Req Post "/api/applicant/profile/confirm" $tok[$k] $body
  if ($r.Status -ne 201) { Stop-Check "Profile confirm for $k -> $($r.Status): $($r.Json.error.message)" }
}
Check "Profiles confirmed: S15 Test A..G" $true

function Apply([string]$Key, $Vacancy, [string]$Type, [string]$Expect) {
  $r = Req Post "/api/applicant/applications" $tok[$Key] @{ vacancyId = $Vacancy.vacancyId; applicantType = $Type }
  Check "$Key applies to $($Vacancy.jobTitle) as $Type -> 201" ($r.Status -eq 201) "got $($r.Status): $($r.Raw)"
  if ($r.Status -ne 201) { Stop-Check "Apply failed for $Key." }
  Check-NoLeaks "apply response ($Key)" $r.Json
  $status = (My-Application $tok[$Key] $Vacancy.vacancyId).Row.status
  Check "$Key is $Expect at $($Vacancy.jobTitle)" ($status -eq $Expect) "got $status"
  if ($status -ne $Expect) { Stop-Check "$Key is not $Expect." }
  Start-Sleep -Milliseconds 1100 # distinct applied_at (tie-breaks)
  return $r.Json.data.applicationId
}

function Sheet([string]$AppId) { return (Req Get "/api/admin/applications/$AppId" $hrTok).Json.data }

function Verify-Resume([string]$Key, [string]$AppId) {
  $s = Sheet $AppId
  if ($s.resume.verificationStatus -ne "verified") {
    $r = Req Patch "/api/admin/resumes/$($s.resume.resumeId)/verification" $hrTok @{ status = "verified"; applicationId = $AppId }
    Check "Verify $Key's resume -> 200" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"
  }
  Check "$Key fully verified" ((Sheet $AppId).fullyVerified -eq $true) ""
}

# ---------------------------------------------------------------- 4. apply, verify, schedule (one batch at now + 90 s)
$app = @{}
$app.A = Apply "A" $vr "experienced" "shortlisted"
$app.B = Apply "B" $vr "experienced" "shortlisted"
$app.C = Apply "C" $vr "first_time" "shortlisted"
$app.D = Apply "D" $vc "experienced" "shortlisted"
$app.E = Apply "E" $vc "experienced" "shortlisted"
$app.F = Apply "F" $vc "experienced" "waiting_pool"   # quota 2 per group: the third Experienced applicant waits
$app.G = Apply "G" $vc "first_time" "shortlisted"
foreach ($k in @("A", "B", "C", "D", "E", "G")) { Verify-Resume $k $app[$k] }   # E: verified = locked slot, never scheduled

$scheduledUtc = Whole-Seconds ([datetime]::UtcNow.AddSeconds(90))
$interview = @{}
foreach ($k in @("A", "B", "C", "D", "G")) {
  $r = Req Post "/api/admin/interviews" $hrTok @{ applicationId = $app[$k]; scheduledAt = (Manila-Iso $scheduledUtc); durationMinutes = 30; meetingLink = "https://meet.google.com/s15-check-link"; interviewerId = $hrUserId }
  Check "Schedule $k at now + 90 s -> 201" ($r.Status -eq 201) "got $($r.Status): $($r.Raw)"
  if ($r.Status -ne 201) { Stop-Check "Scheduling failed for $k." }
  $interview[$k] = $r.Json.data.interviewId
}
foreach ($k in @("A", "B", "C", "D")) {   # G never confirms: interview_scheduled at close-out
  $r = Req Post "/api/applicant/interviews/$($interview[$k])/confirm" $tok[$k]
  Check "$k confirms the interview -> 200" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"
}
$target = $scheduledUtc.AddSeconds(5)
while ([datetime]::UtcNow -lt $target) {
  $left = [int][Math]::Ceiling(($target - [datetime]::UtcNow).TotalSeconds)
  Write-Host -NoNewline ("`rWaiting for the interview time to pass: {0,4} s " -f $left)
  Start-Sleep -Seconds 1
}
Write-Host ""

$final = @{}
foreach ($k in @("A", "B", "C", "D")) {
  $r = Req Post "/api/admin/applications/$($app[$k])/evaluation" $hrTok @{ ratings = $RatingsOf[$k] }
  Check "Evaluate $k -> 201, passed (passing 50)" ($r.Status -eq 201 -and $r.Json.data.status -eq "passed") "got $($r.Status): $($r.Raw)"
  if ($r.Status -ne 201 -or $r.Json.data.status -ne "passed") { Stop-Check "$k must pass for the rest of the check." }
  $final[$k] = $r.Json.data.finalScore
}
Info "Finals: A $($final.A), B $($final.B), C $($final.C), D $($final.D)"

# ---------------------------------------------------------------- 5. ranking (RANK-03, TC-50)
$r = Req Get "/api/admin/vacancies/$($vr.vacancyId)/ranking" $hrTok
Check "GET ranking -> 200" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"
$ranking = @($r.Json.data.ranking)
Check "Ranking has A, B, C (both groups, combined)" ($ranking.Count -eq 3 -and @($ranking | Where-Object { $_.applicantType -eq "first_time" }).Count -eq 1) "count $($ranking.Count)"
$jsOrder = Js-RankOrder $ranking
Check "Ranking order = JS RANK-03 order of the stored values" ((@($ranking | ForEach-Object { $_.applicationId }) -join ",") -eq ($jsOrder -join ",")) "api $(@($ranking | ForEach-Object { $_.applicantName }) -join ', ')"
Check "Ranks are 1..3" ((@($ranking | ForEach-Object { $_.rank }) -join ",") -eq "1,2,3") ""
foreach ($k in @("A", "B", "C")) {
  $row = $ranking | Where-Object { $_.applicationId -eq $app[$k] } | Select-Object -First 1
  Check "Ranking final for $k = the stored evaluation final ($($final[$k]))" (Same $row.finalScore $final[$k]) "got $($row.finalScore)"
}
Check "Places left 2 of 2, can notify" ($r.Json.data.vacancy.notifyRemaining -eq 2 -and $r.Json.data.vacancy.canNotify -eq $true) ($r.Json.data.vacancy | ConvertTo-Json -Compress)

# ---------------------------------------------------------------- 6. Notify (FR-END-03)
$r = Req Post "/api/admin/vacancies/$($vr.vacancyId)/notify" $hrTok @{ applicationIds = @($app.A, $app.B, $app.C) }
Check "Notify 3 with endorsement count 2 -> 422" ($r.Status -eq 422) "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/admin/vacancies/$($vr.vacancyId)/notify" $hrTok @{ applicationIds = @($app.A); message = "We will endorse you to $($c1.companyName.ToUpperInvariant()) soon." }
Check "Message naming the company (any case) -> 422" ($r.Status -eq 422) "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/admin/vacancies/$($vr.vacancyId)/notify" $hrTok @{ applicationIds = @($app.D) }
Check "Notify an application of another vacancy -> 404" ($r.Status -eq 404) "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/admin/vacancies/$($vr.vacancyId)/notify" $tok.A @{ applicationIds = @($app.A) }
Check "Applicant token on Notify -> 403" ($r.Status -eq 403) "got $($r.Status)"
foreach ($k in @("A", "B")) {
  Check "$k still passed after the refused requests" ((My-Application $tok[$k] $vr.vacancyId).Row.status -eq "passed") ""
}

$r = Req Post "/api/admin/vacancies/$($vr.vacancyId)/notify" $hrTok @{ applicationIds = @($app.A, $app.B) }
Check "Notify A and B (default message) -> 200" ($r.Status -eq 200 -and @($r.Json.data.notified).Count -eq 2 -and $r.Json.data.remaining -eq 0) "got $($r.Status): $($r.Raw)"
$actionDueAt = [datetime]$r.Json.data.actionDueAt
$hoursAhead = ($actionDueAt.ToUniversalTime() - [datetime]::UtcNow).TotalHours
Check "actionDueAt is about now + response_deadline_days (default 3 days)" ($hoursAhead -gt 23 -and $hoursAhead -lt 24 * 31) "hours ahead $hoursAhead"
Info "Endorsement confirmation due $($actionDueAt.ToUniversalTime().ToString('u'))"
$r = Req Post "/api/admin/vacancies/$($vr.vacancyId)/notify" $hrTok @{ applicationIds = @($app.A) }
Check "Notify A again -> 4xx (no places left / no longer passed)" ($r.Status -eq 422 -or $r.Status -eq 409) "got $($r.Status): $($r.Raw)"

$defaultBody = "You passed the agency assessment for $($vr.jobTitle), and we would like to endorse you to the employer. The employer makes the final hiring decision."
foreach ($k in @("A", "B")) {
  $d = My-Application $tok[$k] $vr.vacancyId
  Check "$k status panel: passed_awaiting_confirmation with nextDueAt = actionDueAt" `
    ($d.Row.status -eq "passed_awaiting_confirmation" -and [bool]$d.Row.nextDueAt -and [math]::Abs((([datetime]$d.Row.nextDueAt) - $actionDueAt).TotalSeconds) -lt 2) "got $($d.Row.status), $($d.Row.nextDueAt)"
  Check-NoLeaks "$k GET /api/applicant/applications (notified)" $d.Response.Json
  $n = My-Notifications $tok[$k] "passed_confirm_endorsement"
  Check "$k got passed_confirm_endorsement" ($n.Rows.Count -ge 1) ""
  if ($n.Rows.Count -ge 1) {
    $row = $n.Rows[0]
    Check "$k notice title: Please confirm: $($vr.jobTitle)" ("$($row.title)" -eq "Please confirm: $($vr.jobTitle)") "$($row.title)"
    Check "$k notice = default body + fixed deadline line" ("$($row.message)".StartsWith("$defaultBody Please confirm on your dashboard by ") -and "$($row.message)".EndsWith(" (Philippine time).")) "$($row.message)"
    Check "$k notice names the time zone once, no company, no score" (([regex]::Matches("$($row.message)", "\(Philippine time\)")).Count -eq 1 -and "$($row.title) $($row.message)" -notmatch "(?i)company|score|%|$([regex]::Escape($c1.companyName))") "$($row.message)"
  }
}

# ---------------------------------------------------------------- 7. answers (FR-END-04)
$r = Req Post "/api/applicant/applications/$($app.A)/endorsement/confirm" $tok.B
Check "B answering A's endorsement -> 404" ($r.Status -eq 404) "got $($r.Status)"
$r = Req Post "/api/applicant/applications/$($app.A)/endorsement/confirm" $hrTok
Check "HR token on the applicant answer route -> 403" ($r.Status -eq 403) "got $($r.Status)"
$r = Req Post "/api/applicant/applications/$($app.A)/endorsement/confirm" $tok.A
Check "A confirms -> 200 for_endorsement" ($r.Status -eq 200 -and $r.Json.data.status -eq "for_endorsement") "got $($r.Status): $($r.Raw)"
Check-NoLeaks "A confirm response" $r.Json
$r = Req Post "/api/applicant/applications/$($app.A)/endorsement/confirm" $tok.A
Check "A confirms again -> 409" ($r.Status -eq 409 -and "$($r.Json.error.message)" -eq "You already confirmed this endorsement.") "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/applicant/applications/$($app.B)/endorsement/decline" $tok.B
Check "B declines -> 200 archived" ($r.Status -eq 200 -and $r.Json.data.status -eq "archived") "got $($r.Status): $($r.Raw)"
$n = My-Notifications $hrTok "hr_endorsement_confirmed"
Check "Staff got hr_endorsement_confirmed for S15 Test A" ([bool]($n.Rows | Where-Object { "$($_.message)" -match "S15 Test A" })) ""
$n = My-Notifications $hrTok "hr_endorsement_declined"
Check "Staff got hr_endorsement_declined for S15 Test B" ([bool]($n.Rows | Where-Object { "$($_.message)" -match "S15 Test B" })) ""
Check "A's status panel: for_endorsement, no deadline" (((My-Application $tok.A $vr.vacancyId).Row.status -eq "for_endorsement") -and -not (My-Application $tok.A $vr.vacancyId).Row.actionDueAt) ""
$r = Req Get "/api/applicant/vacancies/$($vr2.vacancyId)" $tok.B
Check "B (archived = neutral) still sees VR2 at the same company (BR-15)" ($r.Status -eq 200) "got $($r.Status)"
$app.B2 = Apply "B" $vr2 "experienced" "shortlisted"

$r = Req Get "/api/admin/vacancies/$($vr.vacancyId)/ranking" $hrTok
Check "Places left back to 1 (A confirmed, B declined)" ($r.Json.data.vacancy.notifyRemaining -eq 1) "got $($r.Json.data.vacancy.notifyRemaining)"
$r = Req Post "/api/admin/vacancies/$($vr.vacancyId)/notify" $hrTok @{ applicationIds = @($app.C); message = "Thank you for attending the assessment. We would like to endorse you for this job." }
Check "Notify C with an edited message -> 200" ($r.Status -eq 200) "got $($r.Status): $($r.Raw)"
$n = My-Notifications $tok.C "passed_confirm_endorsement"
if ($n.Rows.Count -ge 1) {
  Check "C notice = edited body + fixed deadline line" ("$($n.Rows[0].message)".StartsWith("Thank you for attending the assessment. We would like to endorse you for this job. Please confirm on your dashboard by ") -and "$($n.Rows[0].message)".EndsWith(" (Philippine time).")) "$($n.Rows[0].message)"
} else { Check "C got passed_confirm_endorsement" $false "" }

# ---------------------------------------------------------------- 8. close-out (BR-22, TC-79): close keeps, archive closes out
$r = Req Post "/api/admin/vacancies/$($vc.vacancyId)/archive" $hrTok @{}
Check "Archive VC while open -> 409 (close it first)" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"
$r = Req Post "/api/admin/vacancies/$($vc.vacancyId)/close" $hrTok @{}
Check "Close VC (HR pause) -> 200" ($r.Status -eq 200 -and $r.Json.data.status -eq "closed") "got $($r.Status): $($r.Raw)"
$expectBefore = @{ D = "passed"; E = "shortlisted"; F = "waiting_pool"; G = "interview_scheduled" }
foreach ($k in @("D", "E", "F", "G")) {
  $s = (My-Application $tok[$k] $vc.vacancyId).Row.status
  Check "After close, $k unchanged ($($expectBefore[$k]); a pause keeps the waiting pool)" ($s -eq $expectBefore[$k]) "got $s"
}
$r = Req Post "/api/admin/vacancies/$($vc.vacancyId)/archive" $hrTok @{}
if ($r.Status -ne 200) {
  Check "Archive VC -> 200" $false "got $($r.Status): $($r.Raw)"
  Write-Host "`n== $($script:Pass) passed, $($script:Fail) failed ==" -ForegroundColor Red
  Stop-Check "The archive (close-out) failed; nothing after it was run. Check the API log, fix, and rerun with new accounts."
}
Check "Archive VC -> 200 with closeOut { notSelected 3, standby 1 }" ($r.Json.data.status -eq "archived" -and $r.Json.data.closeOut.notSelected -eq 3 -and $r.Json.data.closeOut.standby -eq 1) "got $($r.Raw)"

$expectAfter = @{ D = "standby"; E = "not_selected"; F = "not_selected"; G = "not_selected" }
foreach ($k in @("D", "E", "F", "G")) {
  $d = My-Application $tok[$k] $vc.vacancyId
  Check "$k is $($expectAfter[$k]) after the archive" ($d.Row.status -eq $expectAfter[$k]) "got $($d.Row.status)"
  Check-NoLeaks "$k GET /api/applicant/applications (closed out)" $d.Response.Json
}
$n = My-Notifications $tok.D "moved_to_standby"
Check "D got moved_to_standby" ($n.Rows.Count -ge 1) ""
if ($n.Rows.Count -ge 1) {
  Check "D notice wording (standby)" ("$($n.Rows[0].title)" -eq "Kept in our applicant pool: $($vc.jobTitle)" -and "$($n.Rows[0].message)" -eq "Your application for $($vc.jobTitle) will not go forward to the employer. You passed the agency assessment, so we keep your profile in our applicant pool. You can apply to other jobs.") "$($n.Rows[0].title) / $($n.Rows[0].message)"
}
foreach ($k in @("E", "F", "G")) {
  $n = My-Notifications $tok[$k] "not_selected"
  Check "$k got not_selected" ($n.Rows.Count -ge 1) ""
  if ($n.Rows.Count -ge 1) {
    Check "$k notice wording (job closed, neutral)" ("$($n.Rows[0].title)" -eq "Job closed: $($vc.jobTitle)" -and "$($n.Rows[0].message)" -eq "The $($vc.jobTitle) job is no longer open, so your application has ended. We keep your profile in our applicant pool. You can apply to other jobs.") "$($n.Rows[0].title) / $($n.Rows[0].message)"
    Check "$k notice has no company" ("$($n.Rows[0].title) $($n.Rows[0].message)" -notmatch [regex]::Escape($c2.companyName)) ""
  }
}
$r = Req Get "/api/applicant/interviews" $tok.G
Check "G's interview list is empty (attempt cancelled)" (@($r.Json.data | Where-Object { $_ }).Count -eq 0) $r.Raw
$r = Req Get "/api/admin/interviews?vacancyId=$($vc.vacancyId)" $hrTok
Check "VC has no open interviews left" (@($r.Json.data | Where-Object { $_ }).Count -eq 0) $r.Raw
$r = Req Post "/api/admin/vacancies/$($vc.vacancyId)/notify" $hrTok @{ applicationIds = @($app.D) }
Check "Notify on the archived VC -> 409" ($r.Status -eq 409) "got $($r.Status): $($r.Raw)"
$r = Req Get "/api/admin/vacancies/$($vc.vacancyId)/ranking" $hrTok
Check "VC ranking keeps D (standby) as a record; cannot notify" ((@($r.Json.data.ranking) | Where-Object { $_.applicationId -eq $app.D }).status -eq "standby" -and $r.Json.data.vacancy.canNotify -eq $false) ""

# BR-17 + BR-19: standby and not_selected are neutral and not ongoing: free to apply, same company included.
foreach ($k in @("D", "E")) {
  $r = Req Get "/api/applicant/vacancies/$($vx.vacancyId)" $tok[$k]
  Check "$k sees VX at the same company (no company block)" ($r.Status -eq 200) "got $($r.Status)"
}
$app.D2 = Apply "D" $vx "experienced" "shortlisted"
$app.E2 = Apply "E" $vx "experienced" "shortlisted"

# ---------------------------------------------------------------- summary
$color = "Green"; if ($script:Fail -gt 0) { $color = "Red" }
Write-Host "`n== $($script:Pass) passed, $($script:Fail) failed ==" -ForegroundColor $color

$main = "'$($app.A)', '$($app.B)', '$($app.C)', '$($app.D)', '$($app.E)', '$($app.F)', '$($app.G)'"
Write-Host @"

Now run these in the Supabase SQL editor (read-only):

  -- 1. status history with actors (Notify = HR; answers = the applicant; close-out = system / null)
  select h.application_id, h.from_status, h.to_status, h.reason, h.changed_by, u.role as changed_by_role, h.changed_at
  from application_status_history h left join user_account u on u.user_account_id = h.changed_by
  where h.application_id in ($main) and h.from_status is not null
    and h.to_status in ('passed_awaiting_confirmation', 'for_endorsement', 'archived', 'standby', 'not_selected')
  order by h.changed_at;

  -- 2. endorsement deadlines (only C still has one)
  select application_id, status, action_due_at from application where application_id in ('$($app.A)', '$($app.B)', '$($app.C)');

  -- 3. applicant pool rows from the close-out
  select source_application_id, pool_reason, availability, removed_at from talent_pool
  where source_application_id in ('$($app.D)', '$($app.E)', '$($app.F)', '$($app.G)') order by source_application_id;

  -- 4. G's interview attempt and the VC attempts
  select application_id, status from interview_schedule where application_id in ('$($app.D)', '$($app.G)');

  -- 5. notification types per application
  select application_id, notification_type, title from notification
  where application_id in ($main)
    and notification_type in ('passed_confirm_endorsement', 'moved_to_standby', 'not_selected', 'hr_endorsement_confirmed', 'hr_endorsement_declined')
  order by application_id, created_at;

Expect (A = $($app.A), B = $($app.B), C = $($app.C), D = $($app.D), E = $($app.E), F = $($app.F), G = $($app.G), HR = $hrUserId):
  1. A, B, C passed -> passed_awaiting_confirmation: changed_by = HR, reason 'Notified for endorsement'.
     A -> for_endorsement and B -> archived: changed_by = their own user (role applicant), reasons
     'Applicant confirmed the endorsement' / 'Applicant declined the endorsement'.
     D -> standby and E, F, G -> not_selected: changed_by NULL, reason 'close-out: vacancy archived'.
  2. A and B: action_due_at NULL; C: passed_awaiting_confirmation with action_due_at about 3 days ahead.
  3. D standby, E/F/G not_selected, availability available, removed_at NULL (the active entries).
  4. D completed (evaluated); G cancelled.
  5. A, B, C passed_confirm_endorsement (+ hr_endorsement_confirmed for A, hr_endorsement_declined for B, one row per
     active HR/admin); D moved_to_standby; E, F, G not_selected. No company name in any title.

Clean up afterwards (deletes only vacancies titled 'ZZ Check%' and their rows, then the empty 'ZZ Check' companies):
  run supabase/scripts/delete-check-vacancies.sql in the Supabase SQL editor.
Juan (juan@vera.test) was not touched.
"@

if ($script:Fail -gt 0) { exit 1 }
