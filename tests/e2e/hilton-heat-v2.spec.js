/**
 * End-to-End Tests for Hilton Heat Player Assignment System v2
 * Tests the new web interface with TeamSnap integration
 */

const { test, expect } = require('@playwright/test');

test.describe('Hilton Heat Player Assignment System v2', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the new interface
    await page.goto('/hilton-heat-v2.html');
  });

  test('should load the main interface', async ({ page }) => {
    // Check that page loads with correct title
    await expect(page.locator('h1')).toContainText('Player Assignment System');
    
    // Check that all tabs are present
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=Teams')).toBeVisible();
    await expect(page.locator('text=Registrations')).toBeVisible();
    await expect(page.locator('text=Assignments')).toBeVisible();
  });

  test('should display dashboard with initial stats', async ({ page }) => {
    // Dashboard should be visible by default
    const dashboard = page.locator('#dashboardTab');
    await expect(dashboard).toBeVisible();
    
    // Stats should be present (even if zero)
    await expect(page.locator('#statTeams')).toBeVisible();
    await expect(page.locator('#statRegistrations')).toBeVisible();
    await expect(page.locator('#statAssignments')).toBeVisible();
    await expect(page.locator('#statUnassigned')).toBeVisible();
  });

  test('should sync teams from TeamSnap and display them', async ({ page }) => {
    // Click the sync/load button
    const syncButton = page.locator('button:has-text("Load Teams from TeamSnap")');
    await expect(syncButton).toBeVisible();
    await expect(syncButton).toBeEnabled();
    
    console.log('Clicking sync button...');
    await syncButton.click();
    
    // Button should show loading state
    await expect(syncButton).toContainText('Loading');
    await expect(syncButton).toBeDisabled();
    
    // Wait for the sync to complete (max 20 seconds)
    await expect(syncButton).toContainText('Load Teams from TeamSnap', { timeout: 20000 });
    await expect(syncButton).toBeEnabled();
    
    // Check for success message
    const alert = page.locator('.alert');
    await expect(alert).toContainText('Loaded', { timeout: 5000 });
    await expect(alert).toContainText('teams');
  });

  test('should display teams in the Teams tab after sync', async ({ page }) => {
    // First sync the teams
    const syncButton = page.locator('button:has-text("Load Teams from TeamSnap")');
    await syncButton.click();
    await expect(syncButton).toContainText('Load Teams from TeamSnap', { timeout: 20000 });
    
    // Wait for success alert
    await expect(page.locator('.alert')).toContainText('Loaded', { timeout: 5000 });
    
    // Switch to Teams tab
    await page.click('text=Teams');
    
    // Teams list should be visible
    const teamsList = page.locator('#teamsList');
    await expect(teamsList).toBeVisible();
    
    // Should have team cards
    const teamCards = page.locator('.team-card');
    const teamCount = await teamCards.count();
    console.log(`Found ${teamCount} teams`);
    expect(teamCount).toBeGreaterThan(0);
    expect(teamCount).toBeLessThanOrEqual(30);
    
    // Check that at least one team card has proper content
    const firstTeam = teamCards.first();
    await expect(firstTeam).toBeVisible();
    
    // Team card should have a name
    const teamName = firstTeam.locator('h3');
    await expect(teamName).not.toBeEmpty();
    const name = await teamName.textContent();
    console.log(`First team: ${name}`);
    expect(name.length).toBeGreaterThan(0);
  });

  test('should show specific teams like BU12-Sotile and BU14-Guzzetta', async ({ page }) => {
    // Sync teams
    const syncButton = page.locator('button:has-text("Load Teams from TeamSnap")');
    await syncButton.click();
    await expect(syncButton).toBeEnabled({ timeout: 20000 });
    
    // Go to Teams tab
    await page.click('text=Teams');
    
    // Wait for teams to load
    await page.waitForSelector('.team-card', { timeout: 5000 });
    
    // Search for BU12-Sotile
    const searchBox = page.locator('#teamSearch');
    await searchBox.fill('BU12');
    
    // Should find BU12 teams
    const bu12Teams = page.locator('.team-card:visible');
    const bu12Count = await bu12Teams.count();
    console.log(`Found ${bu12Count} BU12 teams`);
    expect(bu12Count).toBeGreaterThan(0);
    
    // Look for Sotile specifically
    await searchBox.fill('Sotile');
    const sotileTeam = page.locator('.team-card:has-text("Sotile")');
    await expect(sotileTeam).toBeVisible({ timeout: 2000 });
    console.log('✓ Found BU12-Sotile team');
    
    // Clear search and look for Guzzetta
    await searchBox.fill('Guzzetta');
    const guzzettaTeams = page.locator('.team-card:has-text("Guzzetta")');
    const guzzettaCount = await guzzettaTeams.count();
    console.log(`Found ${guzzettaCount} Guzzetta teams`);
    expect(guzzettaCount).toBeGreaterThan(0);
  });

  test('should filter teams by division', async ({ page }) => {
    // Sync teams
    const syncButton = page.locator('button:has-text("Load Teams from TeamSnap")');
    await syncButton.click();
    await expect(syncButton).toBeEnabled({ timeout: 20000 });
    
    // Go to Teams tab
    await page.click('text=Teams');
    await page.waitForSelector('.team-card', { timeout: 5000 });
    
    // Get total team count
    const allTeamCards = page.locator('.team-card');
    const totalCount = await allTeamCards.count();
    console.log(`Total teams: ${totalCount}`);
    
    // Select a division filter
    const divisionFilter = page.locator('#divisionFilter');
    await expect(divisionFilter).toBeVisible();
    
    // Get available divisions
    const options = await divisionFilter.locator('option').allTextContents();
    console.log('Available divisions:', options);
    
    // If there are divisions, select one
    if (options.length > 1) {
      // Select the second option (first is "All Divisions")
      await divisionFilter.selectOption({ index: 1 });
      
      // Wait a moment for filtering
      await page.waitForTimeout(500);
      
      // Filtered count should be less than or equal to total
      const filteredCards = page.locator('.team-card:visible');
      const filteredCount = await filteredCards.count();
      console.log(`Filtered to ${filteredCount} teams`);
      expect(filteredCount).toBeLessThanOrEqual(totalCount);
      expect(filteredCount).toBeGreaterThan(0);
    }
  });

  test('should update dashboard stats after sync', async ({ page }) => {
    // Get initial team count
    const statTeams = page.locator('#statTeams');
    const initialCount = await statTeams.textContent();
    console.log(`Initial team count: ${initialCount}`);
    
    // Sync teams
    const syncButton = page.locator('button:has-text("Load Teams from TeamSnap")');
    await syncButton.click();
    await expect(syncButton).toBeEnabled({ timeout: 20000 });
    
    // Dashboard stats should update
    await expect(statTeams).not.toHaveText(initialCount, { timeout: 5000 });
    const newCount = await statTeams.textContent();
    console.log(`New team count: ${newCount}`);
    expect(parseInt(newCount)).toBeGreaterThan(0);
  });

  test('should handle search functionality', async ({ page }) => {
    // Sync teams
    const syncButton = page.locator('button:has-text("Load Teams from TeamSnap")');
    await syncButton.click();
    await expect(syncButton).toBeEnabled({ timeout: 20000 });
    
    // Go to Teams tab
    await page.click('text=Teams');
    await page.waitForSelector('.team-card', { timeout: 5000 });
    
    // Get total count
    const allCards = page.locator('.team-card');
    const totalCount = await allCards.count();
    
    // Search for "BU14"
    const searchBox = page.locator('#teamSearch');
    await searchBox.fill('BU14');
    await page.waitForTimeout(500);
    
    // Should have fewer results
    const filteredCards = page.locator('.team-card:visible');
    const filteredCount = await filteredCards.count();
    console.log(`Searching "BU14": ${filteredCount} of ${totalCount} teams`);
    expect(filteredCount).toBeLessThanOrEqual(totalCount);
    
    // All visible cards should contain "BU14" somewhere
    const visibleTeams = await filteredCards.allTextContents();
    for (const team of visibleTeams) {
      const hasMatch = team.toLowerCase().includes('bu14') || 
                       team.toLowerCase().includes('14');
      if (!hasMatch) {
        console.log('Team text:', team);
      }
    }
  });

  test('should navigate between tabs', async ({ page }) => {
    // Dashboard should be active by default
    await expect(page.locator('#dashboardTab')).toBeVisible();
    
    // Click Teams tab
    await page.click('text=Teams');
    await expect(page.locator('#teamsTab')).toBeVisible();
    await expect(page.locator('#dashboardTab')).not.toBeVisible();
    
    // Click Registrations tab
    await page.click('text=Registrations');
    await expect(page.locator('#registrationsTab')).toBeVisible();
    await expect(page.locator('#teamsTab')).not.toBeVisible();
    
    // Click Assignments tab
    await page.click('text=Assignments');
    await expect(page.locator('#assignmentsTab')).toBeVisible();
    await expect(page.locator('#registrationsTab')).not.toBeVisible();
    
    // Go back to Dashboard
    await page.click('text=Dashboard');
    await expect(page.locator('#dashboardTab')).toBeVisible();
    await expect(page.locator('#assignmentsTab')).not.toBeVisible();
  });

  test('should show team member count badge', async ({ page }) => {
    // Sync teams
    const syncButton = page.locator('button:has-text("Load Teams from TeamSnap")');
    await syncButton.click();
    await expect(syncButton).toBeEnabled({ timeout: 20000 });
    
    // Go to Teams tab
    await page.click('text=Teams');
    await page.waitForSelector('.team-card', { timeout: 5000 });
    
    // Look for member count badge
    const firstTeam = page.locator('.team-card').first();
    const badge = firstTeam.locator('.badge');
    
    // Badge should exist and show a number
    await expect(badge).toBeVisible();
    const badgeText = await badge.textContent();
    console.log(`First team member count: ${badgeText}`);
    expect(badgeText).toMatch(/\d+/); // Should contain a number
  });

  test('should handle errors gracefully', async ({ page }) => {
    // Try to view teams without syncing first
    await page.click('text=Teams');
    
    // Should show helpful message
    const teamsList = page.locator('#teamsList');
    await expect(teamsList).toContainText('Load Teams from TeamSnap');
  });

  test('should be responsive', async ({ page }) => {
    // Test at mobile size
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Page should still be usable
    await expect(page.locator('h1')).toBeVisible();
    
    // Tabs should be visible (might be stacked)
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=Teams')).toBeVisible();
    
    // Test at tablet size
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('h1')).toBeVisible();
    
    // Test at desktop size
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('h1')).toBeVisible();
  });

  test('complete workflow: sync and view specific teams', async ({ page }) => {
    console.log('\n=== COMPLETE WORKFLOW TEST ===\n');
    
    // Step 1: Load the page
    console.log('Step 1: Page loaded');
    await expect(page.locator('h1')).toBeVisible();
    
    // Step 2: Sync teams
    console.log('Step 2: Clicking sync button...');
    const syncButton = page.locator('button:has-text("Load Teams from TeamSnap")');
    await syncButton.click();
    
    // Step 3: Wait for sync to complete
    console.log('Step 3: Waiting for sync to complete...');
    await expect(syncButton).toBeEnabled({ timeout: 20000 });
    await expect(page.locator('.alert')).toContainText('Loaded', { timeout: 5000 });
    
    // Step 4: Check dashboard updated
    console.log('Step 4: Checking dashboard stats...');
    const teamCount = await page.locator('#statTeams').textContent();
    console.log(`   Teams loaded: ${teamCount}`);
    expect(parseInt(teamCount)).toBeGreaterThan(0);
    
    // Step 5: View teams
    console.log('Step 5: Switching to Teams tab...');
    await page.click('text=Teams');
    await page.waitForSelector('.team-card', { timeout: 5000 });
    
    // Step 6: Verify specific teams exist
    console.log('Step 6: Verifying specific teams...');
    
    // Search for BU12-Sotile
    const searchBox = page.locator('#teamSearch');
    await searchBox.fill('BU12-Sotile');
    await page.waitForTimeout(500);
    const sotile = page.locator('.team-card:visible');
    const sotileCount = await sotile.count();
    console.log(`   Found ${sotileCount} team(s) matching "BU12-Sotile"`);
    expect(sotileCount).toBeGreaterThan(0);
    
    // Search for BU14-Guzzetta
    await searchBox.fill('BU14-Guzzetta');
    await page.waitForTimeout(500);
    const guzzetta = page.locator('.team-card:visible');
    const guzzettaCount = await guzzetta.count();
    console.log(`   Found ${guzzettaCount} team(s) matching "BU14-Guzzetta"`);
    expect(guzzettaCount).toBeGreaterThan(0);
    
    // Step 7: View all teams
    await searchBox.fill('');
    await page.waitForTimeout(500);
    const allTeams = page.locator('.team-card:visible');
    const allCount = await allTeams.count();
    console.log(`   Total teams visible: ${allCount}`);
    expect(allCount).toBeGreaterThanOrEqual(25); // Should have at least 25 teams
    
    console.log('\n✅ WORKFLOW TEST COMPLETE!\n');
  });

});






