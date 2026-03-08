$ErrorActionPreference = "Stop"

$projectRef = "kvyjgkhamwvelxveduvk"

Write-Host "Deploying Supabase database migrations to $projectRef..."
npx supabase db push --linked

Write-Host ""
Write-Host "Deploying Edge Function create-profile to $projectRef..."
npx supabase functions deploy create-profile --project-ref $projectRef

Write-Host ""
Write-Host "Next manual checks in Supabase Dashboard:"
Write-Host "1. Authentication -> URL Configuration -> Site URL = https://driveselect.pages.dev"
Write-Host "2. Authentication -> URL Configuration -> add https://driveselect.pages.dev to Redirect URLs"
Write-Host "3. Authentication -> Email -> verify recovery email/template/SMTP settings"
