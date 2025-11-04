# TRAIDEFI Platform - Safe File Cleanup Script
# This script deletes old/unnecessary files to free up disk space

Write-Host "🧹 Starting TRAIDEFI Platform Cleanup..." -ForegroundColor Cyan
Write-Host ""

# Change to project directory
$projectPath = "C:\Users\ollec\OneDrive\שולחן העבודה\Tangent-Platform"
Set-Location $projectPath

Write-Host "📁 Current directory: $projectPath" -ForegroundColor Yellow
Write-Host ""

# Count files before
$filesBefore = (Get-ChildItem -File | Measure-Object).Count
Write-Host "📊 Files before cleanup: $filesBefore" -ForegroundColor Yellow

# ============================================
# DELETE OLD SERVER FILES (29 files)
# ============================================
Write-Host "`n🗑️  Deleting old server files..." -ForegroundColor Red
$oldServers = @(
    "server_backup.js",
    "server_complete.js",
    "server_new.js",
    "server_old.js",
    "server-backup-working.js",
    "server-CLEAN-NO-ENCODING.js",
    "server-clean.js",
    "server-COMPLETE-FIXED-CLEAN.js",
    "server-COMPLETE-FIXED.js",
    "server-COMPLETE-INTEGRATED.js",
    "server-COMPLETE-PERFECT.js",
    "server-COMPLETE-PRODUCTION.js",
    "server-COMPLETE-RESTORED.js",
    "server-complete.js",
    "server-debug.js",
    "server-DEPLOY.js",
    "server-FINAL-WORKING.js",
    "server-final.js",
    "server-minimal.js",
    "server-original.js",
    "server-RAILWAY-OPTIMIZED.js",
    "server-ULTIMATE-CLEAN.js",
    "server-ULTIMATE-FINAL-CLEAN.js",
    "server-ULTIMATE-FINAL-FIXED.js",
    "server-ULTIMATE-FINAL.js",
    "server-ULTIMATE.js",
    "server-WORKING-CLEAN.js",
    "server-working.js",
    "server.js"
)

$deletedServers = 0
foreach ($file in $oldServers) {
    if (Test-Path $file) {
        Remove-Item $file -Force -ErrorAction SilentlyContinue
        $deletedServers++
        Write-Host "  ✓ Deleted: $file" -ForegroundColor Gray
    }
}
Write-Host "✅ Deleted $deletedServers old server files" -ForegroundColor Green

# ============================================
# DELETE OLD DOCUMENTATION FILES
# ============================================
Write-Host "`n🗑️  Deleting old documentation files..." -ForegroundColor Red
$oldDocs = @(
    "ADD-*.md",
    "CHECK-*.md",
    "CLOUDFLARE-*.md",
    "CREDENTIAL-*.md",
    "CREDIT-BUREAU-*.md",
    "CREDIT-SCORING-*.md",
    "CURRENT-STATE-*.md",
    "CURRENT-STATUS.md",
    "DATABASE-*.md",
    "DEAL-*.md",
    "DEPLOYMENT-*.md",
    "DOMAIN-*.md",
    "EMAIL-DEBUG-*.md",
    "EMAIL-FIX-*.md",
    "EMAIL-NOT-*.md",
    "EMAIL-ROOT-*.md",
    "EMAIL-SERVICE-*.md",
    "EMAIL-SETUP-*.md",
    "EMAIL-TROUBLESHOOTING-*.md",
    "EMERGENCY-*.md",
    "FIND-*.md",
    "FIX-*.md",
    "GITGUARDIAN-*.md",
    "GMAIL-*.md",
    "GODADDY-*.md",
    "HOW-TO-*.md",
    "INSURANCE-DASHBOARD-*.md",
    "INSURANCE-FEATURE-*.md",
    "INSURANCE-IMPLEMENTATION-*.md",
    "INTEGRATION-*.md",
    "NEXT-STEPS-*.md",
    "OFFLINE-*.md",
    "PAYPAL-*.md",
    "POST-*.md",
    "PRODUCTION-READINESS-*.md",
    "PRODUCTION-SAFETY-*.md",
    "PROJECT-STATUS.md",
    "QUICK-*.md",
    "RAILWAY-*.md",
    "REAL-*.md",
    "RESEND-*.md",
    "RESTART-*.md",
    "ROTATE-*.md",
    "SECURITY-*.md",
    "SESSION-*.md",
    "SSL-*.md",
    "SUPABASE-*.md",
    "TANGENT-PROTOCOL-*.md",
    "TEST-EMAIL-*.md",
    "TEST-INSURANCE.md",
    "TESTING-*.md",
    "TGT-INTEGRATION-*.md",
    "TRAIDEFI-DOMAIN-*.md",
    "TRAIDEFI-HERO-*.md",
    "TRAIDEFI-RAILWAY-*.md",
    "TRAIDEFI-SETUP-*.md",
    "TRAIDEFI-SPEC-*.md",
    "TRAIDEFY-*.md",
    "UPDATE-*.md",
    "URGENT-*.md",
    "WAIT-*.md",
    "WHAT-*.md",
    "WHERE-*.md",
    "ZALMAN-*.md",
    "CONSOLIDATION-*.md",
    "CONFIGURATION-*.md"
)

$deletedDocs = 0
foreach ($pattern in $oldDocs) {
    $files = Get-ChildItem -Filter $pattern -ErrorAction SilentlyContinue
    foreach ($file in $files) {
        # Keep essential docs
        if ($file.Name -notin @("README.md", "PLATFORM-STATUS-REPORT.md", "TANGENT-TRAIDEFI-REBRAND-DEPLOYED.md", "CLEANUP-GUIDE.md")) {
            Remove-Item $file.FullName -Force -ErrorAction SilentlyContinue
            $deletedDocs++
            Write-Host "  ✓ Deleted: $($file.Name)" -ForegroundColor Gray
        }
    }
}
Write-Host "✅ Deleted $deletedDocs documentation files" -ForegroundColor Green

# ============================================
# DELETE TEST FILES
# ============================================
Write-Host "`n🗑️  Deleting test files..." -ForegroundColor Red
$testFiles = Get-ChildItem -Filter "test-*.js", "test-*.html", "check-*.js", "simple-test.ps1", "deployment-test.ps1" -ErrorAction SilentlyContinue
$deletedTests = 0
foreach ($file in $testFiles) {
    Remove-Item $file.FullName -Force -ErrorAction SilentlyContinue
    $deletedTests++
    Write-Host "  ✓ Deleted: $($file.Name)" -ForegroundColor Gray
}
Write-Host "✅ Deleted $deletedTests test files" -ForegroundColor Green

# ============================================
# DELETE BATCH FILES
# ============================================
Write-Host "`n🗑️  Deleting batch files..." -ForegroundColor Red
$batchFiles = Get-ChildItem -Filter "*.bat", "*.ps1" -Exclude "DELETE-OLD-FILES.ps1" -ErrorAction SilentlyContinue
$deletedBatch = 0
foreach ($file in $batchFiles) {
    Remove-Item $file.FullName -Force -ErrorAction SilentlyContinue
    $deletedBatch++
    Write-Host "  ✓ Deleted: $($file.Name)" -ForegroundColor Gray
}
Write-Host "✅ Deleted $deletedBatch batch files" -ForegroundColor Green

# ============================================
# DELETE CORRUPTED FILES
# ============================================
Write-Host "`n🗑️  Deleting corrupted files..." -ForegroundColor Red
$corruptedFiles = @(
    "how c7c54f6e*",
    "how HEAD~1*",
    "tart",
    "tat -an*"
)
$deletedCorrupted = 0
foreach ($pattern in $corruptedFiles) {
    $files = Get-ChildItem -Filter $pattern -ErrorAction SilentlyContinue
    foreach ($file in $files) {
        Remove-Item $file.FullName -Force -ErrorAction SilentlyContinue
        $deletedCorrupted++
        Write-Host "  ✓ Deleted: $($file.Name)" -ForegroundColor Gray
    }
}
Write-Host "✅ Deleted $deletedCorrupted corrupted files" -ForegroundColor Green

# ============================================
# DELETE OLD CONFIG FILES
# ============================================
Write-Host "`n🗑️  Deleting old config files..." -ForegroundColor Red
$oldConfigs = @(
    "package-FINAL-WORKING.json",
    "config.example"
)
$deletedConfigs = 0
foreach ($file in $oldConfigs) {
    if (Test-Path $file) {
        Remove-Item $file -Force -ErrorAction SilentlyContinue
        $deletedConfigs++
        Write-Host "  ✓ Deleted: $file" -ForegroundColor Gray
    }
}
Write-Host "✅ Deleted $deletedConfigs old config files" -ForegroundColor Green

# ============================================
# DELETE STATUS FILES
# ============================================
Write-Host "`n🗑️  Deleting status files..." -ForegroundColor Red
$statusFiles = Get-ChildItem -Filter "STATUS*.txt", "COMMIT-AND-DEPLOY.txt" -ErrorAction SilentlyContinue
$deletedStatus = 0
foreach ($file in $statusFiles) {
    Remove-Item $file.FullName -Force -ErrorAction SilentlyContinue
    $deletedStatus++
    Write-Host "  ✓ Deleted: $($file.Name)" -ForegroundColor Gray
}
Write-Host "✅ Deleted $deletedStatus status files" -ForegroundColor Green

# ============================================
# SUMMARY
# ============================================
Write-Host "`n" -NoNewline
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🧹 CLEANUP COMPLETE!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Count files after
$filesAfter = (Get-ChildItem -File | Measure-Object).Count
$filesDeleted = $filesBefore - $filesAfter

Write-Host "📊 Files deleted: $filesDeleted" -ForegroundColor Yellow
Write-Host "📊 Files remaining: $filesAfter" -ForegroundColor Green
Write-Host ""

# Verify essential files
Write-Host "✅ Verifying essential files..." -ForegroundColor Cyan
$essentialFiles = @(
    "server-WORKING-FIXED.js",
    "package.json",
    "config.env",
    "lib/database.js",
    "credit-service/main.py",
    "insurance-service/main.py"
)

$allGood = $true
foreach ($file in $essentialFiles) {
    if (Test-Path $file) {
        Write-Host "  ✓ $file" -ForegroundColor Green
    } else {
        Write-Host "  ✗ MISSING: $file" -ForegroundColor Red
        $allGood = $false
    }
}

Write-Host ""
if ($allGood) {
    Write-Host "✅ All essential files present!" -ForegroundColor Green
    Write-Host "✅ Platform is ready to run" -ForegroundColor Green
} else {
    Write-Host "⚠️  WARNING: Some essential files are missing!" -ForegroundColor Red
    Write-Host "   Please restore from Git if needed" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "💡 Tip: Run 'npm start' to verify everything works" -ForegroundColor Cyan

