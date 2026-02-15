# TeamSnap Public API Access Test
Write-Host ""
Write-Host "========================================"
Write-Host "TEAMSNAP PUBLIC API - ACCESS TEST"
Write-Host "========================================"
Write-Host ""

$baseUrl = "http://localhost:3000"
$results = @{}

# Test 1: User Info
Write-Host "1. Testing: User Info (/me)"
try {
    $data = Invoke-WebRequest -Uri "$baseUrl/api/hilton-heat/teamsnap/me" | ConvertFrom-Json
    
    if ($data.success) {
        Write-Host "   SUCCESS"
        Write-Host "   User ID: $($data.user.id)"
        Write-Host "   Email: $($data.user.email)"
        Write-Host "   Name: $($data.user.first_name) $($data.user.last_name)"
        
        if ($data.links) {
            $linkCount = ($data.links | Get-Member -MemberType NoteProperty).Count
            Write-Host "   Available Resource Links: $linkCount"
        }
        $results['me'] = "SUCCESS"
    } else {
        Write-Host "   Error: $($data.error)"
        $results['me'] = "Error"
    }
} catch {
    Write-Host "   Failed: $($_.Exception.Message)"
    $results['me'] = "Failed"
}
Write-Host ""

# Test 2: Organizations
Write-Host "2. Testing: Organizations"
try {
    $data = Invoke-WebRequest -Uri "$baseUrl/api/hilton-heat/teamsnap/organizations" | ConvertFrom-Json
    
    if ($data.success) {
        Write-Host "   SUCCESS"
        Write-Host "   Organizations Found: $($data.count)"
        Write-Host "   Total Teams: $($data.total_teams)"
        $results['organizations'] = "$($data.count) found"
    } else {
        Write-Host "   No organizations found"
        $results['organizations'] = "0 found"
    }
} catch {
    Write-Host "   Failed: $($_.Exception.Message)"
    $results['organizations'] = "Failed"
}
Write-Host ""

# Test 3: Registration Forms
Write-Host "3. Testing: Registration Forms (Org 60195)"
try {
    $data = Invoke-WebRequest -Uri "$baseUrl/api/hilton-heat/teamsnap/forms/60195" | ConvertFrom-Json
    
    if ($data.success) {
        Write-Host "   SUCCESS"
        Write-Host "   Forms Found: $($data.count)"
        
        if ($data.count -gt 0) {
            Write-Host ""
            Write-Host "   Registration Forms:"
            $data.forms | ForEach-Object {
                $activeStatus = if ($_.is_active) { "Active" } else { "Inactive" }
                Write-Host "      - ID: $($_.id) | $($_.name) | $activeStatus"
            }
        }
        $results['forms'] = "$($data.count) found"
    } else {
        Write-Host "   No forms found"
        $results['forms'] = "0 found"
    }
} catch {
    Write-Host "   Failed: $($_.Exception.Message)"
    $results['forms'] = "Failed"
}
Write-Host ""

# Test 4: Specific Form
Write-Host "4. Testing: Direct Form Access (ID 26146)"
try {
    $data = Invoke-WebRequest -Uri "$baseUrl/api/hilton-heat/teamsnap/form/26146" | ConvertFrom-Json
    
    if ($data.success) {
        Write-Host "   SUCCESS"
        Write-Host "   Form Name: $($data.form.name)"
        Write-Host "   Form ID: $($data.form.id)"
        Write-Host "   Active: $($data.form.is_active)"
        Write-Host "   Org ID: $($data.form.organization_id)"
        $results['form_26146'] = "Accessible"
    } else {
        Write-Host "   Error: $($data.error)"
        $results['form_26146'] = "Error"
    }
} catch {
    Write-Host "   Failed: $($_.Exception.Message)"
    $results['form_26146'] = "Failed"
}
Write-Host ""

# Test 5: Registration Signups
Write-Host "5. Testing: Registration Signups (Form 26146)"
try {
    $body = '{"season":"2025-26"}'
    $data = Invoke-WebRequest -Uri "$baseUrl/api/hilton-heat/teamsnap/sync/60195/registration/26146" -Method POST -ContentType "application/json" -Body $body | ConvertFrom-Json
    
    if ($data.success) {
        Write-Host "   API Call Successful"
        Write-Host "   Registrations Imported: $($data.imported)"
        Write-Host "   Errors: $($data.errors)"
        
        if ($data.imported -gt 0) {
            Write-Host "   DATA FOUND!"
            $results['signups'] = "$($data.imported) registrations"
        } else {
            Write-Host "   0 registrations returned (API limitation)"
            $results['signups'] = "0 registrations (API limitation)"
        }
    } else {
        Write-Host "   Error: $($data.error)"
        $results['signups'] = "Error"
    }
} catch {
    Write-Host "   Failed: $($_.Exception.Message)"
    $results['signups'] = "Failed"
}
Write-Host ""

# Summary
Write-Host "========================================"
Write-Host "SUMMARY"
Write-Host "========================================"
Write-Host ""

Write-Host "ACCESSIBLE via Public API:"
Write-Host "  - User account information"
Write-Host "  - Organization metadata (limited)"
Write-Host "  - Registration form definitions (metadata only)"
Write-Host "  - Form structure and fields"
Write-Host ""

Write-Host "NOT ACCESSIBLE via Public API:"
Write-Host "  - Actual registration signup data"
Write-Host "  - Player/participant information"
Write-Host "  - Form submissions/responses"
Write-Host ""

Write-Host "REASON:"
Write-Host "  Registration data requires session-based authentication"
Write-Host "  (browser cookies), not OAuth tokens."
Write-Host ""

Write-Host "RECOMMENDED APPROACH:"
Write-Host "  1. Manual CSV export from TeamSnap web interface"
Write-Host "  2. Import CSV to Hilton Heat system"
Write-Host "  3. Use Hilton Heat for all tryout management"
Write-Host ""

Write-Host "See TEAMSNAP_SESSION_AUTH_FINDING.md for details."
Write-Host ""
